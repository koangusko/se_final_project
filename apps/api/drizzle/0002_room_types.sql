ALTER TABLE "rooms" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "type" SET DEFAULT 'classroom'::text;--> statement-breakpoint
DROP TYPE "public"."room_type";--> statement-breakpoint
CREATE TYPE "public"."room_type" AS ENUM('classroom', 'lecture_hall', 'seminar_room', 'meeting_room', 'computer_lab', 'office', 'other');--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "type" SET DEFAULT 'classroom'::"public"."room_type";--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "type" SET DATA TYPE "public"."room_type" USING "type"::"public"."room_type";