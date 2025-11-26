-- Migration: Add tenantRole column to User table
-- Date: 2024
-- Description: Adiciona a coluna tenantRole à tabela User para suportar roles de tenant (manager, receptionist, professional)

-- ============================================
-- ALTER USER TABLE
-- ============================================

-- Add tenantRole column to User table
ALTER TABLE "User" 
    ADD COLUMN IF NOT EXISTS "tenantRole" "UserRole";

-- ============================================
-- MIGRATION NOTES
-- ============================================

-- IMPORTANT: After running this migration:
-- 1. The tenantRole column will be nullable, allowing existing users to have NULL
-- 2. Tenant Admins should have tenantRole = NULL (they use platformRole instead)
-- 3. Tenant Users should have tenantRole set to their role (manager, receptionist, professional)
-- 4. Super Admins should have both platformRole = 'super_admin' and tenantRole = NULL

