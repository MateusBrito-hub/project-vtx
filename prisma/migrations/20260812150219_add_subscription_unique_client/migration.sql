/*
  Warnings:

  - You are about to drop the column `tenantId` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the `Tenant` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[clientId]` on the table `Subscription` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clientId` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Tenant" DROP CONSTRAINT "Tenant_planId_fkey";

-- DropIndex
DROP INDEX "Subscription_tenantId_key";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "tenantId",
ADD COLUMN     "clientId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Tenant";

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "socialName" TEXT NOT NULL,
    "fantasyName" TEXT NOT NULL,
    "CPF_CNPJ" TEXT NOT NULL,
    "IE" TEXT,
    "IM" TEXT,
    "owner" TEXT NOT NULL,
    "ownerDocument" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "complement" TEXT NOT NULL,
    "UF" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "planId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_socialName_key" ON "Client"("socialName");

-- CreateIndex
CREATE UNIQUE INDEX "Client_CPF_CNPJ_key" ON "Client"("CPF_CNPJ");

-- CreateIndex
CREATE UNIQUE INDEX "Client_slug_key" ON "Client"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_clientId_key" ON "Subscription"("clientId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
