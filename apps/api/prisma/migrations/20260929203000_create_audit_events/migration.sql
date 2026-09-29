CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "actor_id" VARCHAR(120) NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_ticket_id_created_at_idx"
ON "audit_events"("ticket_id", "created_at");

ALTER TABLE "audit_events"
ADD CONSTRAINT "audit_events_ticket_id_fkey"
FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE OR DELETE ON "audit_events"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
