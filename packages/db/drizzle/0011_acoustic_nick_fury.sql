CREATE TABLE "month_seals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "month_seals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vehicle_id" bigint NOT NULL,
	"month" text NOT NULL,
	"revision" integer NOT NULL,
	"driver_name" text NOT NULL,
	"license_plate" text,
	"vehicle_display_name" text NOT NULL,
	"vehicle_vin" text,
	"drive_count" integer NOT NULL,
	"distance_km" double precision NOT NULL,
	"last_audit_hash" text,
	"content_hash" text NOT NULL,
	"seal_hash" text NOT NULL,
	"sealed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sealed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "month_seals_vehicle_month_revision_uq" UNIQUE("vehicle_id","month","revision")
);
--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "license_plate" text;--> statement-breakpoint
ALTER TABLE "month_seals" ADD CONSTRAINT "month_seals_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "month_seals_vehicle_month_idx" ON "month_seals" USING btree ("vehicle_id","month");