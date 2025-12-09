-- =============================================================================
-- MIGRAÇÃO COMPLETA: Sincronização Total Schema Prisma <-> Banco de Dados
-- Execute este arquivo no Supabase SQL Editor
-- Criado em: 09/12/2025
-- =============================================================================
-- Este script usa ADD COLUMN IF NOT EXISTS para segurança - pode ser rodado
-- múltiplas vezes sem causar erros.
-- =============================================================================

-- =============================================================================
-- PARTE 1: ENUMS (Criar se não existirem)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE "PlatformRole" AS ENUM ('super_admin', 'tenant_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalonStatus" AS ENUM ('pending', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('manager', 'receptionist', 'professional');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CollaboratorStatus" AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AppointmentStatus" AS ENUM ('pending', 'in_progress', 'completed', 'canceled', 'no_show', 'not_paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AppointmentOrigin" AS ENUM ('whatsapp', 'app', 'totem', 'reception');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('open', 'closed', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderItemType" AS ENUM ('service', 'product');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'pix', 'online');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'confirmed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('info', 'warning', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CategoryType" AS ENUM ('service', 'product');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuditAction" AS ENUM ('INSERT', 'UPDATE', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CommissionMode" AS ENUM ('service', 'professional');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageChannel" AS ENUM ('whatsapp', 'sms', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MessageStatus" AS ENUM ('pending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseType" AS ENUM ('FIXED', 'VARIABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PARTE 2: TABELA SALON
-- =============================================================================

ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "defaultCommissionRate" DECIMAL(65,30) DEFAULT 0.5;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "commissionMode" TEXT DEFAULT 'professional';
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "fixedCostsMonthly" DECIMAL(65,30);
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "variableCostRate" DECIMAL(65,30);
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "rolePermissions" JSONB;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "theme" JSONB;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "stockControlEnabled" BOOLEAN DEFAULT true;

-- WhatsApp Integration
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "whatsappApiUrl" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "whatsappApiKey" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "whatsappInstanceId" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "whatsappPhone" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "whatsappConnected" BOOLEAN DEFAULT false;

-- Payment Integration
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "paymentProvider" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "mpAccessToken" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "mpPublicKey" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "stripeSecretKey" TEXT;
ALTER TABLE "Salon" ADD COLUMN IF NOT EXISTS "stripePublishableKey" TEXT;

-- =============================================================================
-- PARTE 3: TABELA USER
-- =============================================================================

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "platformRole" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantRole" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_platformRole_idx" ON "User"("platformRole");
CREATE INDEX IF NOT EXISTS "User_salonId_platformRole_idx" ON "User"("salonId", "platformRole");
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");

-- =============================================================================
-- PARTE 4: TABELA CLIENT
-- =============================================================================

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "lastVisit" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Client_deletedAt_idx" ON "Client"("deletedAt");

-- =============================================================================
-- PARTE 5: TABELA COLLABORATOR (Sistema de Comissões)
-- =============================================================================

-- Campos básicos
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "cpf" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Sistema de comissões
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "commissionMode" TEXT;  -- NULL = usa padrão do Salon

-- Informações bancárias
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "pixKey" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "pixKeyType" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "bankAgency" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "bankAccountType" TEXT;

-- Endereço
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "addressNumber" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "addressComplement" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "addressNeighborhood" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "addressCity" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "addressState" TEXT;
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "addressZipCode" TEXT;

-- Datas
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "hireDate" TIMESTAMP(3);
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);

-- Constraint para commissionMode
ALTER TABLE "Collaborator" DROP CONSTRAINT IF EXISTS "Collaborator_commissionMode_check";
ALTER TABLE "Collaborator" ADD CONSTRAINT "Collaborator_commissionMode_check" 
CHECK ("commissionMode" IS NULL OR "commissionMode" IN ('service', 'professional'));

-- Unique constraints e índices
CREATE INDEX IF NOT EXISTS "Collaborator_deletedAt_idx" ON "Collaborator"("deletedAt");

-- =============================================================================
-- PARTE 6: TABELA CATEGORY
-- =============================================================================

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Category_deletedAt_idx" ON "Category"("deletedAt");

-- =============================================================================
-- PARTE 7: TABELA SERVICE
-- =============================================================================

ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "commission" DECIMAL(65,30);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Foreign key para Category
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Service_categoryId_fkey'
  ) THEN
    ALTER TABLE "Service" 
    ADD CONSTRAINT "Service_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Service_deletedAt_idx" ON "Service"("deletedAt");

-- =============================================================================
-- PARTE 8: TABELA PRODUCT (IMPORTANTE - Controle de Estoque)
-- =============================================================================

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(65,30);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stock" INTEGER DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trackStock" BOOLEAN DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Foreign key para Category
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Product_categoryId_fkey'
  ) THEN
    ALTER TABLE "Product" 
    ADD CONSTRAINT "Product_categoryId_fkey" 
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Product_deletedAt_idx" ON "Product"("deletedAt");

-- =============================================================================
-- PARTE 9: TABELA APPOINTMENT
-- =============================================================================

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "origin" TEXT DEFAULT 'reception';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

-- =============================================================================
-- PARTE 10: TABELA ORDER
-- =============================================================================

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

-- Foreign key para User (createdBy)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Order_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "Order" 
    ADD CONSTRAINT "Order_createdByUserId_fkey" 
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- PARTE 11: TABELA ORDERITEM
-- =============================================================================

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "salonId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "collaboratorId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "quantity" INTEGER DEFAULT 1;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "commission" DECIMAL(65,30) DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Foreign keys
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'OrderItem_salonId_fkey'
  ) THEN
    ALTER TABLE "OrderItem" 
    ADD CONSTRAINT "OrderItem_salonId_fkey" 
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'OrderItem_collaboratorId_fkey'
  ) THEN
    ALTER TABLE "OrderItem" 
    ADD CONSTRAINT "OrderItem_collaboratorId_fkey" 
    FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "OrderItem_deletedAt_idx" ON "OrderItem"("deletedAt");

-- Atualizar salonId dos OrderItems existentes que não têm
UPDATE "OrderItem" oi
SET "salonId" = o."salonId"
FROM "Order" o
WHERE oi."orderId" = o."id" AND oi."salonId" IS NULL;

-- =============================================================================
-- PARTE 12: TABELA PAYMENT
-- =============================================================================

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "receivedByUserId" TEXT;

-- Foreign key
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Payment_receivedByUserId_fkey'
  ) THEN
    ALTER TABLE "Payment" 
    ADD CONSTRAINT "Payment_receivedByUserId_fkey" 
    FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- PARTE 13: TABELA COMMISSIONRECORD
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

CREATE INDEX IF NOT EXISTS "CommissionRecord_salonId_idx" ON "CommissionRecord"("salonId");
CREATE INDEX IF NOT EXISTS "CommissionRecord_collaboratorId_idx" ON "CommissionRecord"("collaboratorId");
CREATE INDEX IF NOT EXISTS "CommissionRecord_orderId_idx" ON "CommissionRecord"("orderId");
CREATE INDEX IF NOT EXISTS "CommissionRecord_paid_idx" ON "CommissionRecord"("paid");

-- =============================================================================
-- PARTE 14: TABELA COMMISSIONPAYMENT
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

CREATE INDEX IF NOT EXISTS "CommissionPayment_salonId_idx" ON "CommissionPayment"("salonId");
CREATE INDEX IF NOT EXISTS "CommissionPayment_collaboratorId_idx" ON "CommissionPayment"("collaboratorId");
CREATE INDEX IF NOT EXISTS "CommissionPayment_periodStart_idx" ON "CommissionPayment"("periodStart");

-- =============================================================================
-- PARTE 15: TABELA AUDITLOG
-- =============================================================================

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- =============================================================================
-- PARTE 16: TABELA NOTIFICATION
-- =============================================================================

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "link" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "type" TEXT;

-- =============================================================================
-- PARTE 17: TABELA MESSAGETEMPLATE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "MessageTemplate" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "salonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "variables" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageTemplate_salonId_name_key" UNIQUE ("salonId", "name")
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'MessageTemplate_salonId_fkey'
  ) THEN
    ALTER TABLE "MessageTemplate" 
    ADD CONSTRAINT "MessageTemplate_salonId_fkey" 
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MessageTemplate_deletedAt_idx" ON "MessageTemplate"("deletedAt");

-- =============================================================================
-- PARTE 18: TABELA MESSAGELOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS "MessageLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "salonId" TEXT NOT NULL,
  "templateId" TEXT,
  "appointmentId" TEXT,
  "clientId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sentAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'MessageLog_salonId_fkey'
  ) THEN
    ALTER TABLE "MessageLog" 
    ADD CONSTRAINT "MessageLog_salonId_fkey" 
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'MessageLog_templateId_fkey'
  ) THEN
    ALTER TABLE "MessageLog" 
    ADD CONSTRAINT "MessageLog_templateId_fkey" 
    FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'MessageLog_appointmentId_fkey'
  ) THEN
    ALTER TABLE "MessageLog" 
    ADD CONSTRAINT "MessageLog_appointmentId_fkey" 
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'MessageLog_clientId_fkey'
  ) THEN
    ALTER TABLE "MessageLog" 
    ADD CONSTRAINT "MessageLog_clientId_fkey" 
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- PARTE 19: TABELA EXPENSE
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Expense" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "salonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "type" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_salonId_name_key" UNIQUE ("salonId", "name")
);

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'Expense_salonId_fkey'
  ) THEN
    ALTER TABLE "Expense" 
    ADD CONSTRAINT "Expense_salonId_fkey" 
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Expense_deletedAt_idx" ON "Expense"("deletedAt");

-- =============================================================================
-- PARTE 20: VERIFICAÇÃO FINAL
-- =============================================================================

SELECT '=== VERIFICAÇÃO DE COLUNAS ===' as info;

-- Salon
SELECT 'Salon' as table_name, COUNT(*) as total_columns 
FROM information_schema.columns WHERE table_name = 'Salon';

-- User  
SELECT 'User' as table_name, COUNT(*) as total_columns 
FROM information_schema.columns WHERE table_name = 'User';

-- Collaborator
SELECT 'Collaborator' as table_name, COUNT(*) as total_columns 
FROM information_schema.columns WHERE table_name = 'Collaborator';

-- Product
SELECT 'Product' as table_name, COUNT(*) as total_columns 
FROM information_schema.columns WHERE table_name = 'Product';

-- OrderItem
SELECT 'OrderItem' as table_name, COUNT(*) as total_columns 
FROM information_schema.columns WHERE table_name = 'OrderItem';

-- Tabelas de comissão
SELECT 'CommissionRecord' as table_name, COUNT(*) as total_columns 
FROM information_schema.columns WHERE table_name = 'CommissionRecord';

SELECT 'CommissionPayment' as table_name, COUNT(*) as total_columns 
FROM information_schema.columns WHERE table_name = 'CommissionPayment';

SELECT '=== CONTAGEM DE REGISTROS ===' as info;

SELECT 'Salons' as entity, COUNT(*) as count FROM "Salon"
UNION ALL SELECT 'Users' as entity, COUNT(*) as count FROM "User"
UNION ALL SELECT 'Clients' as entity, COUNT(*) as count FROM "Client"
UNION ALL SELECT 'Collaborators' as entity, COUNT(*) as count FROM "Collaborator"
UNION ALL SELECT 'Products' as entity, COUNT(*) as count FROM "Product"
UNION ALL SELECT 'Services' as entity, COUNT(*) as count FROM "Service"
UNION ALL SELECT 'Orders' as entity, COUNT(*) as count FROM "Order"
UNION ALL SELECT 'CommissionRecords' as entity, COUNT(*) as count FROM "CommissionRecord"
UNION ALL SELECT 'CommissionPayments' as entity, COUNT(*) as count FROM "CommissionPayment";

SELECT '=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ===' as status;
