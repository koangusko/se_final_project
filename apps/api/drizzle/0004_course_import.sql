ALTER TABLE "courses" ADD COLUMN "teacher_name" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "unit_name" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "semester" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "courses_external_uq" ON "courses" USING btree ("source","semester","external_id");