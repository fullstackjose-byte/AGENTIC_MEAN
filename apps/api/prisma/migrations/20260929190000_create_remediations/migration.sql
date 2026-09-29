CREATE TABLE "remediations" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "risk" VARCHAR(20) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "verification_status" VARCHAR(20) NOT NULL,
    "requested_by" VARCHAR(120) NOT NULL,
    "decided_by" VARCHAR(120),
    "decision_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "remediations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "remediations_ticket_id_created_at_idx"
ON "remediations"("ticket_id", "created_at");
CREATE INDEX "remediations_status_idx" ON "remediations"("status");

ALTER TABLE "remediations"
ADD CONSTRAINT "remediations_ticket_id_fkey"
FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
