/**
 * Script para executar prisma db push usando Session mode
 * Session mode (sem pgbouncer=true) é necessário para operações de db push
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Carrega o .env
require('dotenv').config();

// Obtém a DATABASE_URL atual
const currentUrl = process.env.DATABASE_URL;

if (!currentUrl) {
  console.error('❌ DATABASE_URL não encontrada no .env');
  process.exit(1);
}

// Converte para Session mode (remove pgbouncer=true)
// Formato: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
// Para:    postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
let sessionUrl = currentUrl
  .replace(/\?pgbouncer=true(&sslmode=require)?/i, '')
  .replace(/&sslmode=require/i, '');

// Adiciona parâmetros para Session mode
const urlParams = new URLSearchParams();
urlParams.set('sslmode', 'require');
urlParams.set('prepared_statements', 'false'); // Evita problemas com prepared statements

// Remove query string existente e adiciona novos parâmetros
const urlObj = new URL(sessionUrl);
urlObj.search = urlParams.toString();
sessionUrl = urlObj.toString();

console.log('🔄 Executando db push com Session mode...');
console.log('📝 URL de push:', sessionUrl.replace(/:[^:@]+@/, ':****@'));

try {
  // Executa db push com Session mode
  // A variável de ambiente será lida pelo prisma.config.ts
  process.env.DATABASE_URL = sessionUrl;
  
  execSync(`npx prisma db push`, {
    stdio: 'inherit',
    env: process.env
  });
  
  console.log('✅ Schema sincronizado com sucesso!');
} catch (error) {
  console.error('❌ Erro ao executar db push:', error.message);
  process.exit(1);
}

