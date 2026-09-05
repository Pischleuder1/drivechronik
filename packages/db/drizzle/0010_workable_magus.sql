ALTER TABLE "audit_log" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "event_type" text DEFAULT 'change' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "previous_hash" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "entry_hash" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "metadata" jsonb;