/*
  Warnings:

  - You are about to drop the column `category` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Service` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[salonId,phone]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[salonId,phone]` on the table `Collaborator` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[salonId,email]` on the table `Collaborator` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('service', 'product');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_salonId_type_name_key" ON "Category"("salonId", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_salonId_phone_key" ON "Client"("salonId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Collaborator_salonId_phone_key" ON "Collaborator"("salonId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Collaborator_salonId_email_key" ON "Collaborator"("salonId", "email");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
