-- =============================================================================
-- MIGRAÇÃO COMPLETA: Sincronização Schema Prisma <-> Banco de Dados
-- Execute este arquivo no Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- PARTE 1: CAMPOS DO COLLABORATOR (Sistema de Comissões)
-- =============================================================================

-- Adiciona campos de comissão e dados profissionais
ALTER TABLE "Collaborator" 
ADD COLUMN IF NOT EXISTS "commissionMode" TEXT,  -- NULL = usa o modo do Salon
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

-- Constraint para commissionMode (se preenchido, deve ser válido)
ALTER TABLE "Collaborator" 
DROP CONSTRAINT IF EXISTS "Collaborator_commissionMode_check";

ALTER TABLE "Collaborator" 
ADD CONSTRAINT "Collaborator_commissionMode_check" 
CHECK ("commissionMode" IS NULL OR "commissionMode" IN ('service', 'professional'));

-- =============================================================================
-- PARTE 2: SOFT DELETE PARA ORDERITEM
-- =============================================================================

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "OrderItem_deletedAt_idx" ON "OrderItem"("deletedAt");

-- =============================================================================
-- PARTE 2: TABELA CommissionRecord (Registros de Comissão)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "CommissionRecord" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "salonId" TEXT NOT NULL,
  "collaboratorId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT,
  "amount" DECIMAL(65,30) NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "paymentDate" TIMESTAMP(3),
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),

  CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- Foreign keys para CommissionRecord
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'CommissionRecord_salonId_fkey'
  ) THEN
    ALTER TABLE "CommissionRecord" 
    ADD CONSTRAINT "CommissionRecord_salonId_fkey" 
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'CommissionRecord_collaboratorId_fkey'
  ) THEN
    ALTER TABLE "CommissionRecord" 
    ADD CONSTRAINT "CommissionRecord_collaboratorId_fkey" 
    FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'CommissionRecord_orderId_fkey'
  ) THEN
    ALTER TABLE "CommissionRecord" 
    ADD CONSTRAINT "CommissionRecord_orderId_fkey" 
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'CommissionRecord_orderItemId_fkey'
  ) THEN
    ALTER TABLE "CommissionRecord" 
    ADD CONSTRAINT "CommissionRecord_orderItemId_fkey" 
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- PARTE 3: TABELA CommissionPayment (Pagamentos de Comissão)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "CommissionPayment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "salonId" TEXT NOT NULL,
  "collaboratorId" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,

  CONSTRAINT "CommissionPayment_pkey" PRIMARY KEY ("id")
);

-- Foreign keys para CommissionPayment
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'CommissionPayment_salonId_fkey'
  ) THEN
    ALTER TABLE "CommissionPayment" 
    ADD CONSTRAINT "CommissionPayment_salonId_fkey" 
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'CommissionPayment_collaboratorId_fkey'
  ) THEN
    ALTER TABLE "CommissionPayment" 
    ADD CONSTRAINT "CommissionPayment_collaboratorId_fkey" 
    FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- PARTE 4: ÍNDICES PARA PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS "CommissionRecord_salonId_idx" ON "CommissionRecord"("salonId");
CREATE INDEX IF NOT EXISTS "CommissionRecord_collaboratorId_idx" ON "CommissionRecord"("collaboratorId");
CREATE INDEX IF NOT EXISTS "CommissionRecord_orderId_idx" ON "CommissionRecord"("orderId");
CREATE INDEX IF NOT EXISTS "CommissionRecord_paid_idx" ON "CommissionRecord"("paid");

CREATE INDEX IF NOT EXISTS "CommissionPayment_salonId_idx" ON "CommissionPayment"("salonId");
CREATE INDEX IF NOT EXISTS "CommissionPayment_collaboratorId_idx" ON "CommissionPayment"("collaboratorId");
CREATE INDEX IF NOT EXISTS "CommissionPayment_periodStart_idx" ON "CommissionPayment"("periodStart");

-- =============================================================================
-- PARTE 5: VERIFICAÇÃO FINAL
-- =============================================================================

-- Verifica campos do Collaborator
SELECT 'Collaborator columns:' as info;
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

-- Verifica tabelas de comissão
SELECT 'Commission tables:' as info;
SELECT table_name, 
       (SELECT COUNT(*) FROM information_schema.columns c2 WHERE c2.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('CommissionRecord', 'CommissionPayment')
ORDER BY table_name;

-- Contagem de registros
SELECT 'Record counts:' as info;
SELECT 'CommissionRecord' as table_name, COUNT(*) as count FROM "CommissionRecord"
UNION ALL
SELECT 'CommissionPayment' as table_name, COUNT(*) as count FROM "CommissionPayment";
