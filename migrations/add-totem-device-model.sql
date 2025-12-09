-- Migration: add-totem-device-model
-- Description: Adiciona tabela TotemDevice para gerenciar dispositivos de autoatendimento

-- Criar tabela TotemDevice
CREATE TABLE IF NOT EXISTS "TotemDevice" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastAccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TotemDevice_pkey" PRIMARY KEY ("id")
);

-- Criar índice único para o código de acesso
CREATE UNIQUE INDEX IF NOT EXISTS "TotemDevice_accessCode_key" ON "TotemDevice"("accessCode");

-- Criar índice para salonId (busca por salão)
CREATE INDEX IF NOT EXISTS "TotemDevice_salonId_idx" ON "TotemDevice"("salonId");

-- Criar índice para accessCode (busca por código)
CREATE INDEX IF NOT EXISTS "TotemDevice_accessCode_idx" ON "TotemDevice"("accessCode");

-- Adicionar foreign key para Salon
ALTER TABLE "TotemDevice" ADD CONSTRAINT "TotemDevice_salonId_fkey" 
    FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Função para atualizar updatedAt automaticamente
CREATE OR REPLACE FUNCTION update_totem_device_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updatedAt
DROP TRIGGER IF EXISTS update_totem_device_updated_at ON "TotemDevice";
CREATE TRIGGER update_totem_device_updated_at
    BEFORE UPDATE ON "TotemDevice"
    FOR EACH ROW
    EXECUTE FUNCTION update_totem_device_updated_at();
