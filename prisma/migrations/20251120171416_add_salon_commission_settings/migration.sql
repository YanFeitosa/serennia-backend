-- CreateEnum
CREATE TYPE "CommissionMode" AS ENUM ('service', 'professional');

-- AlterTable
ALTER TABLE "Salon" ADD COLUMN     "commissionMode" "CommissionMode" NOT NULL DEFAULT 'professional',
ADD COLUMN     "defaultCommissionRate" DECIMAL(65,30) NOT NULL DEFAULT 0.5;
