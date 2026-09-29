CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "TicketStatus" AS ENUM (
  'NEW', 'CLASSIFIED', 'IN_DIAGNOSIS', 'PENDING_USER',
  'PENDING_APPROVAL', 'IN_REMEDIATION', 'ESCALATED',
  'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED'
);

CREATE TYPE "TicketPriority" AS ENUM ('P1', 'P2', 'P3', 'P4');

CREATE TABLE "tickets" (
  "id" UUID NOT NULL,
  "number" VARCHAR(32) NOT NULL,
  "subject" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "requester_id" VARCHAR(120) NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
  "priority" "TicketPriority" NOT NULL DEFAULT 'P4',
  "contains_redacted_data" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tickets_number_key" ON "tickets"("number");
CREATE INDEX "tickets_status_priority_idx" ON "tickets"("status", "priority");
CREATE INDEX "tickets_created_at_idx" ON "tickets"("created_at");
