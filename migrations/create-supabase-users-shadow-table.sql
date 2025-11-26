-- Creates a compatibility table expected by Supabase default triggers (handle_new_user)
-- Run this inside the Supabase SQL editor

-- 1. Create table "public.users" if it does not exist
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    aud text,
    role text,
    email text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Ensure FK to auth.users so rows get cleaned automatically
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_id_fkey'
            AND table_schema = 'public'
            AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_id_fkey
            FOREIGN KEY (id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Optional helper index to avoid sequential scans when the trigger mails the email column
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

-- NOTE:
-- Supabase's default trigger handle_new_user inserts into public.users.
-- In this project, we use a different "User" table (capitalized) and do not need the trigger,
-- but we also cannot disable it. Creating this compatibility table prevents the trigger from
-- crashing when new auth.users rows are inserted.
