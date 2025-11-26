-- Script consolidado para aplicar todas as migrations manuais
-- Execute este script no SQL Editor do Supabase antes de rodar prisma db push
-- Data: 2024-11-25

-- ============================================
-- 1. CREATE ENUMS (se não existirem)
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
-- 2. ALTER USER TABLE
-- ============================================

-- Add platformRole column (if not exists)
ALTER TABLE "User" 
    ADD COLUMN IF NOT EXISTS "platformRole" "PlatformRole";

-- Add tenantRole column (if not exists)
ALTER TABLE "User" 
    ADD COLUMN IF NOT EXISTS "tenantRole" "UserRole";

-- Make salonId nullable (if it's currently NOT NULL)
DO $$ 
BEGIN
    ALTER TABLE "User" ALTER COLUMN "salonId" DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN null; -- Column might already be nullable
END $$;

-- Make passwordHash nullable (if it's currently NOT NULL)
DO $$ 
BEGIN
    ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
EXCEPTION
    WHEN OTHERS THEN null; -- Column might already be nullable
END $$;

-- Remove old 'role' column if it exists (migrated to platformRole/tenantRole)
DO $$ 
BEGIN
    ALTER TABLE "User" DROP COLUMN IF EXISTS "role";
EXCEPTION
    WHEN OTHERS THEN null; -- Column might not exist
END $$;

-- ============================================
-- 3. ALTER SALON TABLE
-- ============================================

-- Add tenantAdminId column (if not exists)
ALTER TABLE "Salon"
    ADD COLUMN IF NOT EXISTS "tenantAdminId" TEXT;

-- Add status column (if not exists)
ALTER TABLE "Salon"
    ADD COLUMN IF NOT EXISTS "status" "SalonStatus" NOT NULL DEFAULT 'pending';

-- Add commission settings (if not exist)
ALTER TABLE "Salon"
    ADD COLUMN IF NOT EXISTS "defaultCommissionRate" DECIMAL(65,30) NOT NULL DEFAULT 0.5,
    ADD COLUMN IF NOT EXISTS "commissionMode" TEXT NOT NULL DEFAULT 'professional',
    ADD COLUMN IF NOT EXISTS "fixedCostsMonthly" DECIMAL(65,30),
    ADD COLUMN IF NOT EXISTS "variableCostRate" DECIMAL(65,30),
    ADD COLUMN IF NOT EXISTS "rolePermissions" JSONB;

-- ============================================
-- 4. CREATE INDEXES
-- ============================================

-- Index for platformRole lookups
CREATE INDEX IF NOT EXISTS "User_platformRole_idx" ON "User"("platformRole");

-- Index for salonId + platformRole lookups
CREATE INDEX IF NOT EXISTS "User_salonId_platformRole_idx" ON "User"("salonId", "platformRole");

-- Index for salon status lookups
CREATE INDEX IF NOT EXISTS "Salon_status_idx" ON "Salon"("status");

-- ============================================
-- 5. ADD FOREIGN KEY CONSTRAINTS
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
-- 6. ADD UNIQUE CONSTRAINTS
-- ============================================

-- Unique constraint for salonId + email (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'User_salonId_email_key'
    ) THEN
        ALTER TABLE "User"
            ADD CONSTRAINT "User_salonId_email_key" 
            UNIQUE ("salonId", "email");
    END IF;
EXCEPTION
    WHEN OTHERS THEN null; -- Constraint might already exist
END $$;

-- ============================================
-- 7. VERIFY CHANGES
-- ============================================

-- Check User table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'User' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check Salon table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'Salon' AND table_schema = 'public'
ORDER BY ordinal_position;




