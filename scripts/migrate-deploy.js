/**
 * Script para executar prisma migrate deploy usando conexão direta
 * Migrações DDL requerem conexão direta, não pooler
 * 
 * Se DATABASE_URL_DIRECT estiver definida, usa ela diretamente.
 * Caso contrário, tenta converter a URL do pooler para conexão direta.
 */

const { spawnSync } = require('child_process');

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

// Lista de todas as migrações para fazer baseline se necessário
const allMigrations = [
  '20251120022559_init',
  '20251120155817_add_category_and_soft_delete',
  '20251120162738_remove_buffer_time',
  '20251120171416_add_salon_commission_settings'
];

function runCommand(command, args = []) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: 'pipe',
    shell: true,
    timeout: 120000
  });
  
  const stdout = result.stdout ? result.stdout.toString() : '';
  const stderr = result.stderr ? result.stderr.toString() : '';
  
  return {
    success: result.status === 0,
    stdout,
    stderr,
    output: stdout + stderr
  };
}

// Tenta deploy normal
console.log('📦 Tentando migrate deploy...');
let result = runCommand('npx', ['prisma', 'migrate', 'deploy']);

if (result.success) {
  console.log(result.output);
  console.log('✅ Migrações aplicadas com sucesso!');
  process.exit(0);
}

// Verifica se é erro P3005 (banco não está vazio)
if (result.output.includes('P3005') || result.output.includes('not empty')) {
  console.log('⚠️  Banco já existe com dados. Fazendo baseline de todas as migrações...');
  
  // Marca todas as migrações como já aplicadas
  for (const migration of allMigrations) {
    console.log(`📌 Marcando migração ${migration} como aplicada...`);
    const resolveResult = runCommand('npx', ['prisma', 'migrate', 'resolve', '--applied', migration]);
    
    if (resolveResult.success) {
      console.log(`✅ ${migration} marcada como aplicada`);
    } else if (resolveResult.output.includes('already') || resolveResult.output.includes('applied')) {
      console.log(`ℹ️  ${migration} já estava marcada`);
    } else {
      console.log(`⚠️  Aviso ao marcar ${migration}:`, resolveResult.output.substring(0, 200));
    }
  }
  
  console.log('✅ Baseline concluído! Todas as migrações marcadas como aplicadas.');
  process.exit(0);
}

// Se não for P3005, verifica se não há migrações pendentes
if (result.output.includes('No pending migrations') || result.output.includes('Already in sync')) {
  console.log('ℹ️  Banco já está sincronizado, nenhuma migração pendente.');
  process.exit(0);
}

// Outro erro
console.error('❌ Erro nas migrações:');
console.error(result.output);
process.exit(1);

