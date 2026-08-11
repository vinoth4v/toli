CREATE TYPE "public"."ingest_device_kind" AS ENUM('driver_app', 'vltd');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('whatsapp', 'sms');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE "geo_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"provider" text NOT NULL,
	"payload" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ingest_device_kind" NOT NULL,
	"label" text NOT NULL,
	"operator_id" uuid,
	"vehicle_id" uuid,
	"driver_id" uuid,
	"vendor" text,
	"token_hash" text NOT NULL,
	"token_last_four" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"channel" "notification_channel" DEFAULT 'whatsapp' NOT NULL,
	"template" text NOT NULL,
	"to_phone" text NOT NULL,
	"payload" text NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"provider" text,
	"provider_ref" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" text NOT NULL,
	"signature_valid" boolean NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "provider_order_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "provider_payment_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "provider_link_url" text;--> statement-breakpoint
ALTER TABLE "ingest_device" ADD CONSTRAINT "ingest_device_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_device" ADD CONSTRAINT "ingest_device_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_device" ADD CONSTRAINT "ingest_device_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "geo_cache_expiry_idx" ON "geo_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_device_token_idx" ON "ingest_device" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ingest_device_vehicle_idx" ON "ingest_device" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "notification_booking_idx" ON "notification" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "notification_status_idx" ON "notification" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_event_provider_id_idx" ON "webhook_event" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "webhook_event_received_idx" ON "webhook_event" USING btree ("received_at");