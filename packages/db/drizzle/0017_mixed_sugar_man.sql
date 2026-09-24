CREATE TABLE "vehicle_state_periods" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_state_periods_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vehicle_id" bigint NOT NULL,
	"state" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_state_periods_source_uq" UNIQUE("source","source_id")
);
--> statement-breakpoint
ALTER TABLE "vehicle_state_periods" ADD CONSTRAINT "vehicle_state_periods_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_state_periods_vehicle_start_idx" ON "vehicle_state_periods" USING btree ("vehicle_id","start_time");