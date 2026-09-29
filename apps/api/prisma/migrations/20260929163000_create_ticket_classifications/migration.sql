CREATE TABLE "ticket_classifications" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "subcategory" VARCHAR(80) NOT NULL,
    "impact" VARCHAR(32) NOT NULL,
    "urgency" VARCHAR(32) NOT NULL,
    "priority" "TicketPriority" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "entities" JSONB NOT NULL,
    "missing_information" JSONB NOT NULL,
    "next_action" VARCHAR(40) NOT NULL,
    "reason" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_classifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ticket_classifications_ticket_id_created_at_idx"
ON "ticket_classifications"("ticket_id", "created_at");

ALTER TABLE "ticket_classifications"
ADD CONSTRAINT "ticket_classifications_ticket_id_fkey"
FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
