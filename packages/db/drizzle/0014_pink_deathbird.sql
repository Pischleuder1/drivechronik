CREATE TABLE "tesla_charging_records" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tesla_charging_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"charge_session_id" bigint,
	"charge_start_time" timestamp with time zone NOT NULL,
	"name" text,
	"vin" text NOT NULL,
	"model" text,
	"country" text,
	"site_location_name" text,
	"description" text,
	"quantity_base_raw" text,
	"energy_kwh" double precision,
	"unit_cost_base_raw" text,
	"vat_raw" text,
	"total_ex_vat" numeric(12, 2),
	"total_inc_vat" numeric(12, 2),
	"currency" char(3),
	"invoice_number" text,
	"status" text,
	"invoice_url" text,
	"source_hash" text NOT NULL,
	"raw_data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tesla_charging_records_source_hash_uq" UNIQUE("source_hash")
);
--> statement-breakpoint
ALTER TABLE "tesla_charging_records" ADD CONSTRAINT "tesla_charging_records_charge_session_id_charge_sessions_id_fk" FOREIGN KEY ("charge_session_id") REFERENCES "public"."charge_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tesla_charging_records_charge_session_idx" ON "tesla_charging_records" USING btree ("charge_session_id");--> statement-breakpoint
CREATE INDEX "tesla_charging_records_start_idx" ON "tesla_charging_records" USING btree ("charge_start_time");--> statement-breakpoint
CREATE INDEX "tesla_charging_records_vin_idx" ON "tesla_charging_records" USING btree ("vin");