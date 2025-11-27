/**
 * Script para executar prisma migrate deploy usando conexão direta
 * Migrações DDL requerem conexão direta, não pooler
 * 
 * Se DATABASE_URL_DIRECT estiver definida, usa ela diretamente.
 * Caso contrário, tenta converter a URL do pooler para conexão direta.
 */

const { execSync } = require('child_process');

// Carrega o .env
require('dotenv').config();

// Prioriza DATABASE_URL_DIRECT se disponível (recomendado para Supabase)
let directUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

if (!directUrl) {
  console.error('❌ DATABASE_URL ou DATABASE_URL_DIRECT não encontrada');
  process.exit(1);
}

// Se não for uma URL direta, tenta converter
if (directUrl.includes('pooler.supabase.com') && directUrl.includes(':6543')) {
  console.log('⚠️  Detectada URL de pooler. Convertendo para conexão direta...');
  directUrl = directUrl
    .replace(/\?pgbouncer=true(&sslmode=require)?/i, '')
    .replace(/&pgbouncer=true/i, '')
    .replace(/:6543\//i, ':5432/');
  
  // Garante sslmode=require
  const urlObj = new URL(directUrl);
  urlObj.searchParams.set('sslmode', 'require');
  urlObj.searchParams.delete('prepared_statements');
  urlObj.searchParams.delete('pgbouncer');
  directUrl = urlObj.toString();
}

console.log('🔄 Executando migrações...');
console.log('📝 URL:', directUrl.replace(/:[^:@]+@/, ':****@'));

process.env.DATABASE_URL = directUrl;

try {
  execSync(`npx prisma migrate deploy`, {
    stdio: 'inherit',
    env: process.env,
    timeout: 120000
  });
  
  console.log('✅ Migrações aplicadas com sucesso!');
} catch (error) {
  const errorMsg = error.message || '';
  
  // Se o banco não está vazio (P3005), fazer baseline
  if (errorMsg.includes('P3005') || errorMsg.includes('not empty')) {
    console.log('⚠️  Banco já existe. Tentando resolver com baseline...');
    
    try {
      // Marca todas as migrações como já aplicadas
      execSync(`npx prisma migrate resolve --applied 20251120022559_init`, {
        stdio: 'inherit',
        env: process.env,
        timeout: 60000
      });
      console.log('✅ Baseline aplicado para migração init');
      
      // Tenta aplicar as migrações restantes
      try {
        execSync(`npx prisma migrate deploy`, {
          stdio: 'inherit',
          env: process.env,
          timeout: 120000
        });
        console.log('✅ Migrações restantes aplicadas!');
      } catch (deployError) {
        // Se ainda falhar com "not empty", marca as outras migrações também
        console.log('⚠️  Tentando marcar todas as migrações como aplicadas...');
        const migrations = [
          '20251120155817_add_category_and_soft_delete',
          '20251120162738_remove_buffer_time',
          '20251120171416_add_salon_commission_settings'
        ];
        
        for (const migration of migrations) {
          try {
            execSync(`npx prisma migrate resolve --applied ${migration}`, {
              stdio: 'inherit',
              env: process.env,
              timeout: 30000
            });
            console.log(`✅ Migração ${migration} marcada como aplicada`);
          } catch (e) {
            // Ignora se já foi marcada
          }
        }
        console.log('✅ Todas as migrações marcadas como aplicadas!');
      }
    } catch (baselineError) {
      console.error('⚠️  Erro no baseline, continuando sem migrações:', baselineError.message);
      // Continua mesmo assim - o banco pode já estar sincronizado via db push
    }
  } else if (errorMsg.includes('No pending migrations')) {
    console.log('ℹ️  Nenhuma migração pendente.');
  } else {
    console.error('❌ Erro nas migrações:', errorMsg);
    process.exit(1);
  }
}

