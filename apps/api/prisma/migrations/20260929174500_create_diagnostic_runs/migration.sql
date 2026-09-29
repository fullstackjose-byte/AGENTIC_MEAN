CREATE TABLE "diagnostic_runs" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "operating_system" VARCHAR(20) NOT NULL,
    "error_message" TEXT NOT NULL,
    "dns_resolved" BOOLEAN NOT NULL,
    "tcp_reachable" BOOLEAN NOT NULL,
    "latency_ms" INTEGER,
    "error_code" VARCHAR(40),
    "outcome" VARCHAR(40) NOT NULL,
    "recommendation" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diagnostic_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "diagnostic_runs_ticket_id_created_at_idx"
ON "diagnostic_runs"("ticket_id", "created_at");

ALTER TABLE "diagnostic_runs"
ADD CONSTRAINT "diagnostic_runs_ticket_id_fkey"
FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
