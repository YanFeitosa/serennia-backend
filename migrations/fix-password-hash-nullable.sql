-- Migration: Fix passwordHash to be nullable
-- Date: 2024
-- Description: Torna o campo passwordHash opcional, já que estamos usando Supabase Auth

-- ============================================
-- ALTER TABLES
-- ============================================

-- Make passwordHash nullable in User table
ALTER TABLE "User" 
    ALTER COLUMN "passwordHash" DROP NOT NULL;

-- ============================================
-- NOTES
-- ============================================

-- This migration makes passwordHash optional since we're using Supabase Auth
-- Existing users with passwordHash will keep their values
-- New users created via Supabase Auth will have passwordHash = NULL

