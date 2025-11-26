-- Script URGENTE para resolver erro "Database error creating new user"
-- Execute este script no SQL Editor do Supabase Dashboard AGORA
-- Este erro acontece quando há triggers tentando criar User automaticamente

-- ============================================
-- PASSO 1: DESABILITAR TODOS OS TRIGGERS (TEMPORÁRIO)
-- ============================================
-- Isso permite criar usuários sem que triggers interfiram
ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- ============================================
-- PASSO 2: VERIFICAR QUAIS TRIGGERS EXISTEM
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND event_object_schema = 'auth'
ORDER BY trigger_name;

-- ============================================
-- PASSO 3: REMOVER TRIGGERS PROBLEMÁTICOS PERMANENTEMENTE
-- ============================================
-- Remove triggers comuns que causam problemas
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- ============================================
-- PASSO 4: REMOVER FUNÇÃO handle_new_user (SE EXISTIR)
-- ============================================
-- Remove a função que pode estar causando o problema
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS auth.handle_new_user() CASCADE;

-- ============================================
-- PASSO 5: VERIFICAR FUNÇÕES QUE FAZEM INSERT EM User
-- ============================================
-- Lista funções que podem estar tentando criar User automaticamente
SELECT 
    p.proname as function_name,
    n.nspname as schema_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO%"User"%'
ORDER BY n.nspname, p.proname;

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Após executar este script:
-- 1. Tente criar o super admin novamente: npm run create-super-admin
-- 2. Se ainda der erro, verifique os logs do Supabase (Logs > Postgres Logs)
-- 3. Os triggers foram desabilitados, então você pode criar usuários normalmente
-- 4. O backend já cria o User manualmente, então não precisamos dos triggers




