-- Manual Migration Script
-- Execute this SQL directly on your database to add the missing columns/tables

-- 1. Add 'theme' column to Salon table
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "theme" JSONB;

-- 2. Add 'cpf' column to Collaborator table  
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "cpf" TEXT;

-- 3. Create unique index for CPF per salon
CREATE UNIQUE INDEX IF NOT EXISTS "Collaborator_salonId_cpf_key" ON "Collaborator"("salonId", "cpf");

-- 4. Create ExpenseType enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "ExpenseType" AS ENUM ('FIXED', 'VARIABLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Create Expense table
CREATE TABLE IF NOT EXISTS "Expense" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- 6. Create unique index for expense name per salon
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_salonId_name_key" ON "Expense"("salonId", "name");

-- 7. Add foreign key constraint for Expense -> Salon
DO $$ BEGIN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

