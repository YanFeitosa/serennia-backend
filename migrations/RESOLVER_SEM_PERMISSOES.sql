-- Script para resolver erro "Database error creating new user" SEM precisar modificar auth.users
-- Execute este script no SQL Editor do Supabase Dashboard
-- Este script funciona mesmo sem permissões de owner na tabela auth.users

-- ============================================
-- PASSO 1: VERIFICAR TRIGGERS E FUNÇÕES PROBLEMÁTICAS
-- ============================================
-- Lista todos os triggers na tabela auth.users (apenas leitura, não precisa de permissão)
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'users'
AND event_object_schema = 'auth'
ORDER BY trigger_name;

-- ============================================
-- PASSO 2: VERIFICAR FUNÇÕES NO SCHEMA PUBLIC QUE PODEM SER MODIFICADAS
-- ============================================
-- Lista funções no schema public que tentam criar User
SELECT 
    p.proname as function_name,
    n.nspname as schema_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (
    p.proname LIKE '%handle_new_user%'
    OR p.proname LIKE '%new_user%'
    OR p.proname LIKE '%create_user%'
    OR pg_get_functiondef(p.oid) LIKE '%INSERT INTO%"User"%'
)
ORDER BY p.proname;

-- ============================================
-- PASSO 3: CRIAR FUNÇÃO DE SEGURANÇA NO SCHEMA PUBLIC
-- ============================================
-- Cria uma função que previne erros ao tentar criar User automaticamente
-- Esta função pode ser chamada por triggers, mas não faz nada (seguro)
CREATE OR REPLACE FUNCTION public.handle_new_user_safe()
RETURNS TRIGGER AS $$
BEGIN
    -- Não faz nada - apenas previne erros
    -- O backend já cria o User manualmente
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignora qualquer erro
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PASSO 4: VERIFICAR SE HÁ FUNÇÕES PROBLEMÁTICAS NO PUBLIC
-- ============================================
-- Se encontrar funções que fazem INSERT em User, podemos modificá-las
-- Exemplo de como modificar uma função (descomente e ajuste se necessário):
/*
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Verifica se User já existe antes de criar
    IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = NEW.id) THEN
        -- Não cria automaticamente - o backend faz isso
        -- INSERT INTO "User" (id, email, name) VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
    END IF;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignora erros
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/

-- ============================================
-- SOLUÇÃO ALTERNATIVA: CRIAR FUNÇÃO QUE IGNORA ERROS
-- ============================================
-- Se houver uma função handle_new_user no public, podemos substituí-la por esta versão segura
DO $$
BEGIN
    -- Tenta substituir a função se ela existir
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'handle_new_user'
    ) THEN
        -- Cria versão segura que não faz nada
        CREATE OR REPLACE FUNCTION public.handle_new_user()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Não faz nada - o backend cria o User manualmente
            RETURN NEW;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        
        RAISE NOTICE 'Função handle_new_user substituída por versão segura';
    ELSE
        RAISE NOTICE 'Função handle_new_user não encontrada no schema public';
    END IF;
END $$;

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
-- Verifica se a função segura foi criada
SELECT 
    p.proname as function_name,
    n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%handle_new_user%';

-- ============================================
-- NOTA IMPORTANTE
-- ============================================
-- Se você não tem permissão para modificar auth.users, tente:
-- 1. Verificar se há funções no schema public que podem ser modificadas
-- 2. Contatar o suporte do Supabase para desabilitar triggers
-- 3. Ou usar a solução alternativa: criar a função handle_new_user no public
--    que não faz nada (versão segura acima)

-- ============================================
-- SOLUÇÃO TEMPORÁRIA: CRIAR USER MANUALMENTE NO SUPABASE
-- ============================================
-- Se nada funcionar, você pode criar o usuário manualmente:
-- 1. Vá em Supabase Dashboard > Authentication > Users
-- 2. Clique em "Add user" > "Create new user"
-- 3. Preencha email e senha
-- 4. Depois execute o script create-super-admin novamente
--    (ele vai detectar que o usuário já existe e atualizar)




