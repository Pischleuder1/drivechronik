CREATE TABLE "import_changes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_changes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"import_run_id" bigint NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" bigint NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "import_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"vehicle_id" bigint,
	"import_job_id" bigint,
	"file_name" text,
	"created_by" text DEFAULT 'system' NOT NULL,
	"summary" jsonb,
	"rollback_summary" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"rolled_back_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_changes" ADD CONSTRAINT "import_changes_import_run_id_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_changes_run_idx" ON "import_changes" USING btree ("import_run_id");--> statement-breakpoint
CREATE INDEX "import_changes_entity_idx" ON "import_changes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "import_runs_source_idx" ON "import_runs" USING btree ("source");--> statement-breakpoint
CREATE INDEX "import_runs_status_idx" ON "import_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_runs_started_at_idx" ON "import_runs" USING btree ("started_at");