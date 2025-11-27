-- Migration: Add soft delete fields to all relevant tables
-- Date: 2024
-- Description: Add deletedAt field for soft delete pattern across all entities

-- Add deletedAt to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Add deletedAt to Client table
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Add deletedAt to Collaborator table  
ALTER TABLE "Collaborator" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Add deletedAt to Service table
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Add deletedAt to Product table
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Add deletedAt to Category table
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE;

-- Add deletedAt to Expense table
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE;

-- Add deletedAt to MessageTemplate table
ALTER TABLE "MessageTemplate" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Add deletedAt to OrderItem table (for when items are removed from orders)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Create indexes for soft delete queries performance
CREATE INDEX IF NOT EXISTS "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX IF NOT EXISTS "Client_deletedAt_idx" ON "Client"("deletedAt");
CREATE INDEX IF NOT EXISTS "Collaborator_deletedAt_idx" ON "Collaborator"("deletedAt");
CREATE INDEX IF NOT EXISTS "Service_deletedAt_idx" ON "Service"("deletedAt");
CREATE INDEX IF NOT EXISTS "Product_deletedAt_idx" ON "Product"("deletedAt");
CREATE INDEX IF NOT EXISTS "Category_deletedAt_idx" ON "Category"("deletedAt");
CREATE INDEX IF NOT EXISTS "Expense_deletedAt_idx" ON "Expense"("deletedAt");
CREATE INDEX IF NOT EXISTS "MessageTemplate_deletedAt_idx" ON "MessageTemplate"("deletedAt");
CREATE INDEX IF NOT EXISTS "OrderItem_deletedAt_idx" ON "OrderItem"("deletedAt");

-- Note: Records with deletedAt = NULL are active, deletedAt = timestamp means soft deleted
