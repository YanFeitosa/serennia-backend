-- Script para verificar e corrigir triggers problemáticos no Supabase
-- Execute este script no SQL Editor do Supabase Dashboard
-- Este script identifica e desabilita triggers que podem causar "Database error creating new user"

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
-- 2. LISTAR FUNÇÕES QUE PODEM ESTAR SENDO CHAMADAS POR TRIGGERS
-- ============================================
SELECT 
    p.proname as function_name,
    n.nspname as schema_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND (
    p.proname LIKE '%user%' 
    OR p.proname LIKE '%auth%'
    OR p.proname LIKE '%handle%'
    OR p.proname LIKE '%new_user%'
    OR p.proname LIKE '%create_user%'
)
ORDER BY n.nspname, p.proname;

-- ============================================
-- 3. VERIFICAR SE HÁ TRIGGERS TENTANDO INSERIR NA TABELA User
-- ============================================
-- Procure por funções que fazem INSERT na tabela "User"
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
-- 4. DESABILITAR TRIGGERS PROBLEMÁTICOS (EXECUTE APENAS SE NECESSÁRIO)
-- ============================================
-- CUIDADO: Desabilite apenas os triggers que você identificou como problemáticos
-- Substitua 'nome_do_trigger' pelo nome real do trigger

-- Exemplo (descomente e ajuste):
-- ALTER TABLE auth.users DISABLE TRIGGER nome_do_trigger;

-- Para desabilitar TODOS os triggers (use com cuidado):
-- ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- ============================================
-- 5. REMOVER TRIGGERS PROBLEMÁTICOS (EXECUTE APENAS SE NECESSÁRIO)
-- ============================================
-- CUIDADO: Isso remove permanentemente o trigger
-- Certifique-se de que não precisa dele antes de executar

-- Exemplo (descomente e ajuste):
-- DROP TRIGGER IF EXISTS nome_do_trigger ON auth.users;

-- ============================================
-- 6. VERIFICAR TRIGGERS DO SUPABASE (TRIGGERS PADRÃO)
-- ============================================
-- O Supabase pode ter triggers padrão que tentam criar registros automaticamente
-- Verifique especialmente:
-- - handle_new_user (trigger comum do Supabase)
-- - on_auth_user_created (trigger comum do Supabase)

SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_statement,
    p.proname as function_name
FROM information_schema.triggers t
LEFT JOIN pg_trigger pt ON pt.tgname = t.trigger_name
LEFT JOIN pg_proc p ON pt.tgfoid = p.oid
WHERE t.event_object_table = 'users'
AND t.event_object_schema = 'auth'
ORDER BY t.trigger_name;

-- ============================================
-- 7. SOLUÇÃO RECOMENDADA: DESABILITAR TRIGGERS QUE CRIAM User AUTOMATICAMENTE
-- ============================================
-- Se você encontrar um trigger que tenta criar um registro na tabela "User" automaticamente,
-- desabilite-o, pois o backend já faz isso manualmente após criar o usuário no Supabase Auth.

-- Exemplo de como desabilitar um trigger específico:
-- ALTER TABLE auth.users DISABLE TRIGGER handle_new_user;

-- ============================================
-- 8. REMOVER FUNÇÃO handle_new_user (SE NECESSÁRIO)
-- ============================================
-- Se você quiser remover a função completamente, execute o script:
-- migrations/remove-handle-new-user.sql
-- 
-- OU execute estes comandos (após remover os triggers que a usam):

-- Primeiro, remova os triggers que usam a função:
-- DROP TRIGGER IF EXISTS nome_do_trigger ON auth.users;

-- Depois, remova a função com CASCADE (remove dependências automaticamente):
-- DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
-- DROP FUNCTION IF EXISTS auth.handle_new_user() CASCADE;

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- O backend (src/routes/register.ts) já cria o registro na tabela User manualmente
-- após criar o usuário no Supabase Auth. Portanto, NÃO é necessário ter um trigger
-- que faça isso automaticamente. Na verdade, isso pode causar conflitos e erros.

