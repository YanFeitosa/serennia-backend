/**
 * Script para aplicar migrations SQL manuais no Supabase
 * Este script executa o arquivo SQL consolidado diretamente no banco
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Carrega o .env
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env');
  process.exit(1);
}

// Converte para Session mode (remove pgbouncer=true)
let sessionUrl = DATABASE_URL
  .replace(/\?pgbouncer=true(&sslmode=require)?/i, '')
  .replace(/&sslmode=require/i, '');

// Adiciona parâmetros para Session mode
const urlParams = new URLSearchParams();
urlParams.set('sslmode', 'require');
urlParams.set('prepared_statements', 'false');

const urlObj = new URL(sessionUrl);
urlObj.search = urlParams.toString();
sessionUrl = urlObj.toString();

const sqlFile = path.join(__dirname, '..', 'migrations', 'apply-all-manual-migrations.sql');

if (!fs.existsSync(sqlFile)) {
  console.error(`❌ Arquivo SQL não encontrado: ${sqlFile}`);
  process.exit(1);
}

console.log('🔄 Aplicando migrations SQL manuais...');
console.log('📝 URL:', sessionUrl.replace(/:[^:@]+@/, ':****@'));
console.log('📄 Arquivo:', sqlFile);

try {
  // Lê o arquivo SQL
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');
  
  // Executa usando psql (se disponível) ou instrui o usuário
  // Como estamos no Windows e pode não ter psql, vamos instruir o usuário
  console.log('\n⚠️  IMPORTANTE: Este script requer que você execute o SQL manualmente no Supabase.');
  console.log('📋 Passos:');
  console.log('   1. Acesse o Supabase Dashboard > SQL Editor');
  console.log('   2. Abra o arquivo:', sqlFile);
  console.log('   3. Copie e cole o conteúdo no SQL Editor');
  console.log('   4. Execute o script (Ctrl+Enter ou botão Run)');
  console.log('   5. Verifique se não há erros');
  console.log('   6. Depois execute: npm run prisma:db:push\n');
  
  // Mostra o conteúdo do arquivo para facilitar
  console.log('📄 Conteúdo do arquivo SQL:');
  console.log('='.repeat(80));
  console.log(sqlContent);
  console.log('='.repeat(80));
  
} catch (error) {
  console.error('❌ Erro ao ler arquivo SQL:', error.message);
  process.exit(1);
}




