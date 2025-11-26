-- Migration: Add Platform Roles and Salon Status
-- Date: 2024
-- Description: Adiciona suporte para hierarquia de usuários (SuperAdmin, Tenant Admin) e status de salões

-- ============================================
-- CREATE ENUMS
-- ============================================

-- Create PlatformRole enum
DO $$ BEGIN
    CREATE TYPE "PlatformRole" AS ENUM ('super_admin', 'tenant_admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create SalonStatus enum
DO $$ BEGIN
    CREATE TYPE "SalonStatus" AS ENUM ('pending', 'active', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- ALTER TABLES
-- ============================================

-- Alter User table: Add platformRole, make salonId nullable, and make passwordHash nullable
ALTER TABLE "User" 
    ADD COLUMN IF NOT EXISTS "platformRole" "PlatformRole",
    ALTER COLUMN "salonId" DROP NOT NULL,
    ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Alter Salon table: Add tenantAdminId and status
ALTER TABLE "Salon"
    ADD COLUMN IF NOT EXISTS "tenantAdminId" TEXT,
    ADD COLUMN IF NOT EXISTS "status" "SalonStatus" NOT NULL DEFAULT 'pending';

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Index for platformRole lookups
CREATE INDEX IF NOT EXISTS "User_platformRole_idx" ON "User"("platformRole");

-- Index for salon status lookups
CREATE INDEX IF NOT EXISTS "Salon_status_idx" ON "Salon"("status");

-- ============================================
-- ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- Add foreign key from Salon.tenantAdminId to User.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Salon_tenantAdminId_fkey'
    ) THEN
        ALTER TABLE "Salon"
            ADD CONSTRAINT "Salon_tenantAdminId_fkey" 
            FOREIGN KEY ("tenantAdminId") 
            REFERENCES "User"("id") 
            ON DELETE SET NULL 
            ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================
-- ADD UNIQUE CONSTRAINTS
-- ============================================

-- Ensure only one tenant_admin per salon
-- This will be enforced at application level, but we add a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS "User_salonId_platformRole_tenant_admin_idx" 
ON "User"("salonId", "platformRole") 
WHERE "platformRole" = 'tenant_admin' AND "salonId" IS NOT NULL;

-- ============================================
-- MIGRATION NOTES
-- ============================================

-- IMPORTANT: After running this migration:
-- 1. Update existing users: Set platformRole based on current role
--    - Users with role 'admin' should become 'tenant_admin' (if they are the only admin in their salon)
--    - Other users should have platformRole = NULL (they are tenant users)
-- 2. Update existing salons: Set status to 'active' for existing salons
-- 3. Link Salon.tenantAdminId to the appropriate User.id for each salon

-- Example migration queries (run separately after this migration):
-- 
-- -- Set all existing salons to active
-- UPDATE "Salon" SET "status" = 'active' WHERE "status" IS NULL;
--
-- -- For each salon, find the first admin user and set as tenant_admin
-- -- (This should be done carefully, salon by salon, to ensure correct assignment)
-- UPDATE "User" 
-- SET "platformRole" = 'tenant_admin', "role" = NULL
-- WHERE id IN (
--     SELECT DISTINCT ON (u."salonId") u.id
--     FROM "User" u
--     WHERE u."role" = 'admin'
--     ORDER BY u."salonId", u."createdAt" ASC
-- );
--
-- -- Update Salon.tenantAdminId for each salon
-- UPDATE "Salon" s
-- SET "tenantAdminId" = (
--     SELECT u.id
--     FROM "User" u
--     WHERE u."salonId" = s.id 
--     AND u."platformRole" = 'tenant_admin'
--     LIMIT 1
-- );

