-- Migration: Add collaborator commission fields
-- Run this in Supabase SQL Editor

-- Add commission and professional fields to Collaborator table
ALTER TABLE "Collaborator" 
ADD COLUMN IF NOT EXISTS "commissionMode" TEXT DEFAULT 'service',
ADD COLUMN IF NOT EXISTS "pixKey" TEXT,
ADD COLUMN IF NOT EXISTS "pixKeyType" TEXT,
ADD COLUMN IF NOT EXISTS "bankName" TEXT,
ADD COLUMN IF NOT EXISTS "bankAgency" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccount" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccountType" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "addressNumber" TEXT,
ADD COLUMN IF NOT EXISTS "addressComplement" TEXT,
ADD COLUMN IF NOT EXISTS "addressNeighborhood" TEXT,
ADD COLUMN IF NOT EXISTS "addressCity" TEXT,
ADD COLUMN IF NOT EXISTS "addressState" TEXT,
ADD COLUMN IF NOT EXISTS "addressZipCode" TEXT,
ADD COLUMN IF NOT EXISTS "hireDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);

-- Add constraint for commissionMode enum values
ALTER TABLE "Collaborator" 
DROP CONSTRAINT IF EXISTS "Collaborator_commissionMode_check";

ALTER TABLE "Collaborator" 
ADD CONSTRAINT "Collaborator_commissionMode_check" 
CHECK ("commissionMode" IN ('service', 'professional'));

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'Collaborator' 
AND column_name IN (
  'commissionMode', 'pixKey', 'pixKeyType', 'bankName', 'bankAgency', 
  'bankAccount', 'bankAccountType', 'address', 'addressNumber', 
  'addressComplement', 'addressNeighborhood', 'addressCity', 
  'addressState', 'addressZipCode', 'hireDate', 'birthDate'
)
ORDER BY column_name;
