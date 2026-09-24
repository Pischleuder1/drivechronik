ALTER TABLE "vehicle_metrics" ADD COLUMN "tpms_fl_bar" double precision;--> statement-breakpoint
ALTER TABLE "vehicle_metrics" ADD COLUMN "tpms_fr_bar" double precision;--> statement-breakpoint
ALTER TABLE "vehicle_metrics" ADD COLUMN "tpms_rl_bar" double precision;--> statement-breakpoint
ALTER TABLE "vehicle_metrics" ADD COLUMN "tpms_rr_bar" double precision;--> statement-breakpoint
-- TPMS history backfill:
-- Existing vehicle_metrics rows predate the historical TPMS columns.
-- Reset only this sync watermark so the worker re-reads TeslaMate positions.
DELETE FROM "sync_state"
WHERE "entity" = 'vehicle_metrics';
