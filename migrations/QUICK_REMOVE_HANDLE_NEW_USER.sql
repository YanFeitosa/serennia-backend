-- Script RÁPIDO para remover handle_new_user
-- Execute este script no SQL Editor do Supabase Dashboard
-- Este script remove triggers e função de forma segura

-- ============================================
-- PASSO 1: DESABILITAR TODOS OS TRIGGERS PRIMEIRO
-- ============================================
ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- ============================================
-- PASSO 2: REMOVER TRIGGERS QUE USAM handle_new_user
-- ============================================
-- Remove triggers comuns do Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- ============================================
-- PASSO 3: REMOVER A FUNÇÃO handle_new_user
-- ============================================
-- Tenta remover de ambos os schemas (public e auth)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS auth.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS auth.handle_new_user CASCADE;

-- Versão com argumentos (caso a função tenha parâmetros)
DROP FUNCTION IF EXISTS public.handle_new_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS auth.handle_new_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS auth.handle_new_user(uuid, text) CASCADE;

-- ============================================
-- PASSO 4: VERIFICAR SE FOI REMOVIDA
-- ============================================
SELECT 
    p.proname as function_name,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND p.proname LIKE '%handle_new_user%';

-- Se não retornar nenhuma linha, a função foi removida com sucesso!

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Este script desabilita TODOS os triggers na tabela auth.users.
-- Se você precisar reabilitar algum trigger específico depois, use:
-- ALTER TABLE auth.users ENABLE TRIGGER nome_do_trigger;




