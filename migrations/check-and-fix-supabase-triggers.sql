-- Script para verificar e corrigir triggers problemáticos no Supabase
-- Execute este script no SQL Editor do Supabase Dashboard

-- ============================================
-- 1. LISTAR TODOS OS TRIGGERS NA TABELA auth.users
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    event_object_schema,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND event_object_schema = 'auth'
ORDER BY trigger_name;

-- ============================================
-- 2. LISTAR FUNÇÕES QUE PODEM ESTAR SENDO CHAMADAS
-- ============================================
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (
    p.proname LIKE '%user%' 
    OR p.proname LIKE '%auth%'
    OR p.proname LIKE '%handle%'
)
ORDER BY p.proname;

-- ============================================
-- 3. VERIFICAR SE HÁ TRIGGERS TENTANDO INSERIR NA TABELA User
-- ============================================
-- Procure por funções que fazem INSERT na tabela "User"
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO%User%'
ORDER BY p.proname;

-- ============================================
-- 4. DESABILITAR TRIGGERS PROBLEMÁTICOS (EXECUTE APENAS SE NECESSÁRIO)
-- ============================================
-- CUIDADO: Desabilite apenas os triggers que você identificou como problemáticos
-- Substitua 'nome_do_trigger' pelo nome real do trigger

-- Exemplo (descomente e ajuste):
-- ALTER TABLE auth.users DISABLE TRIGGER nome_do_trigger;

-- ============================================
-- 5. REMOVER TRIGGERS PROBLEMÁTICOS (EXECUTE APENAS SE NECESSÁRIO)
-- ============================================
-- CUIDADO: Isso remove permanentemente o trigger
-- Certifique-se de que não precisa dele antes de executar

-- Exemplo (descomente e ajuste):
-- DROP TRIGGER IF EXISTS nome_do_trigger ON auth.users;

-- ============================================
-- 6. VERIFICAR LOGS DE ERRO (Execute no Supabase Dashboard > Logs)
-- ============================================
-- Vá em Logs > Postgres Logs e procure por erros relacionados a:
-- - "INSERT INTO User"
-- - "auth.users"
-- - "trigger"
-- - "function"

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- O backend já cria o registro na tabela User manualmente após criar
-- o usuário no Supabase Auth. Portanto, NÃO é necessário ter um trigger
-- que faça isso automaticamente. Na verdade, isso pode causar conflitos.

