-- Add QueueEntry model (simplified — appointment status is the source of truth)
-- This migration adds the queue/walk-in system for fair round-robin distribution

-- Create the QueueEntry table
CREATE TABLE "QueueEntry" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "notes" TEXT,
    "arrivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueEntry_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for appointmentId (1:1 relationship)
CREATE UNIQUE INDEX "QueueEntry_appointmentId_key" ON "QueueEntry"("appointmentId");

-- Create index for listing today's queue
CREATE INDEX "QueueEntry_salonId_arrivedAt_idx" ON "QueueEntry"("salonId", "arrivedAt");

-- Add foreign keys
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
