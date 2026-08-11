CREATE TYPE "public"."photo_kind" AS ENUM('exterior', 'interior', 'seats', 'boot', 'documents');--> statement-breakpoint
CREATE TABLE "vehicle_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kind" "photo_kind" DEFAULT 'exterior' NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"caption" text,
	"verification" "verification_status" DEFAULT 'pending' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle_photo" ADD CONSTRAINT "vehicle_photo_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_photo_vehicle_idx" ON "vehicle_photo" USING btree ("vehicle_id");