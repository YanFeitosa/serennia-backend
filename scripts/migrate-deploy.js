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

try {
  process.env.DATABASE_URL = directUrl;
  
  execSync(`npx prisma migrate deploy`, {
    stdio: 'inherit',
    env: process.env,
    timeout: 120000 // 2 minutos de timeout
  });
  
  console.log('✅ Migrações aplicadas com sucesso!');
} catch (error) {
  // Se falhar, pode ser que não haja migrações pendentes ou o banco já está sincronizado
  console.error('⚠️  Aviso durante migrações:', error.message);
  // Não sai com erro se for apenas "no pending migrations"
  if (error.message && error.message.includes('No pending migrations')) {
    console.log('ℹ️  Nenhuma migração pendente.');
    process.exit(0);
  }
  process.exit(1);
}

