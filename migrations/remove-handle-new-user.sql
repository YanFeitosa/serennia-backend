-- Script para remover a função handle_new_user e seus triggers relacionados
-- Execute este script no SQL Editor do Supabase Dashboard
-- ATENÇÃO: Isso remove permanentemente a função e os triggers

-- ============================================
-- 1. VERIFICAR SE A FUNÇÃO EXISTE E QUAL É O NOME EXATO
-- ============================================
SELECT 
    p.proname as function_name,
    n.nspname as schema_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND (
    p.proname LIKE '%handle_new_user%'
    OR p.proname LIKE '%new_user%'
    OR p.proname LIKE '%handle_user%'
)
ORDER BY n.nspname, p.proname;

-- ============================================
-- 2. VERIFICAR TRIGGERS QUE USAM ESSA FUNÇÃO
-- ============================================
SELECT 
    t.trigger_name,
    t.event_object_table,
    t.event_object_schema,
    t.action_timing,
    t.event_manipulation,
    p.proname as function_name,
    n.nspname as function_schema
FROM information_schema.triggers t
LEFT JOIN pg_trigger pt ON pt.tgname = t.trigger_name
LEFT JOIN pg_proc p ON pt.tgfoid = p.oid
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE t.event_object_table = 'users'
AND t.event_object_schema = 'auth'
AND (
    p.proname LIKE '%handle_new_user%'
    OR p.proname LIKE '%new_user%'
    OR p.proname LIKE '%handle_user%'
    OR t.trigger_name LIKE '%new_user%'
    OR t.trigger_name LIKE '%handle%'
)
ORDER BY t.trigger_name;

-- ============================================
-- 3. LISTAR TODOS OS TRIGGERS NA TABELA auth.users
-- ============================================
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND event_object_schema = 'auth'
ORDER BY trigger_name;

-- ============================================
-- 4. DESABILITAR TRIGGERS PRIMEIRO (SE NECESSÁRIO)
-- ============================================
-- Desabilite os triggers antes de remover a função
-- Substitua 'nome_do_trigger' pelo nome real encontrado nas queries acima

-- Exemplo para desabilitar um trigger específico:
-- ALTER TABLE auth.users DISABLE TRIGGER nome_do_trigger;

-- Para desabilitar TODOS os triggers (use com cuidado):
-- ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- ============================================
-- 5. REMOVER TRIGGERS QUE USAM handle_new_user
-- ============================================
-- Execute estes comandos substituindo pelos nomes reais encontrados acima

-- Exemplo (descomente e ajuste):
-- DROP TRIGGER IF EXISTS nome_do_trigger ON auth.users;

-- Se você encontrou triggers com nomes como:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- ============================================
-- 6. REMOVER A FUNÇÃO handle_new_user
-- ============================================
-- IMPORTANTE: Remova a função apenas DEPOIS de remover os triggers que a usam

-- Se a função está no schema 'public':
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;

-- Se a função está no schema 'auth':
DROP FUNCTION IF EXISTS auth.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS auth.handle_new_user CASCADE;

-- Se a função tem argumentos (verifique na query 1):
-- DROP FUNCTION IF EXISTS public.handle_new_user(uuid, text) CASCADE;

-- Versão genérica que tenta todas as variações:
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    -- Remove função do schema public
    FOR func_record IN 
        SELECT proname, oidvectortypes(proargtypes) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname LIKE '%handle_new_user%'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.%s(%s) CASCADE', 
            func_record.proname, 
            COALESCE(func_record.args, ''));
        RAISE NOTICE 'Removida função: public.%(%)', func_record.proname, COALESCE(func_record.args, '');
    END LOOP;
    
    -- Remove função do schema auth (se existir)
    FOR func_record IN 
        SELECT proname, oidvectortypes(proargtypes) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'auth'
        AND p.proname LIKE '%handle_new_user%'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS auth.%s(%s) CASCADE', 
            func_record.proname, 
            COALESCE(func_record.args, ''));
        RAISE NOTICE 'Removida função: auth.%(%)', func_record.proname, COALESCE(func_record.args, '');
    END LOOP;
END $$;

-- ============================================
-- 7. VERIFICAR SE FOI REMOVIDA
-- ============================================
-- Execute novamente a query 1 para confirmar que a função não existe mais
SELECT 
    p.proname as function_name,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND p.proname LIKE '%handle_new_user%';

-- Se não retornar nenhuma linha, a função foi removida com sucesso!

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. O CASCADE remove automaticamente dependências (triggers, etc.)
-- 2. Se você receber erro de permissão, você pode precisar de privilégios de superuser
-- 3. Se a função não existir, o comando DROP FUNCTION IF EXISTS não causará erro
-- 4. Sempre execute as queries de verificação (1-3) primeiro para identificar o nome exato




