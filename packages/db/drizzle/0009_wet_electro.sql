CREATE TABLE "vehicle_metrics" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vehicle_metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"vehicle_id" bigint NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"soc" smallint,
	"rated_range_km" double precision,
	"odometer_km" double precision,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_metrics_vehicle_ts_source_uq" UNIQUE("vehicle_id","ts","source")
);
--> statement-breakpoint
ALTER TABLE "vehicle_metrics" ADD CONSTRAINT "vehicle_metrics_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_metrics_vehicle_ts_idx" ON "vehicle_metrics" USING btree ("vehicle_id","ts");