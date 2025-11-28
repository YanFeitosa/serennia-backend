-- Add deletedAt column to OrderItem table for soft delete functionality
-- Run this in Supabase SQL Editor

-- Add the deletedAt column
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Create index for better query performance when filtering by deletedAt
CREATE INDEX IF NOT EXISTS "OrderItem_deletedAt_idx" ON "OrderItem"("deletedAt");
