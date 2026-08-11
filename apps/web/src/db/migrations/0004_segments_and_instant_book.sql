CREATE TYPE "public"."booking_source" AS ENUM('quote', 'instant');--> statement-breakpoint
CREATE TYPE "public"."vehicle_segment" AS ENUM('economy', 'premium', 'luxury');--> statement-breakpoint
CREATE TABLE "rate_card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"segment" "vehicle_segment" NOT NULL,
	"vehicle_class" "vehicle_class" NOT NULL,
	"base_fare_paise" bigint DEFAULT 0 NOT NULL,
	"per_km_rate_paise" bigint NOT NULL,
	"min_km_per_day" integer NOT NULL,
	"driver_bata_per_day_paise" bigint DEFAULT 0 NOT NULL,
	"night_halt_paise" bigint DEFAULT 0 NOT NULL,
	"included_km" integer,
	"included_hours" integer,
	"extra_km_rate_paise" bigint,
	"extra_hour_rate_paise" bigint,
	"toll_included" boolean DEFAULT false NOT NULL,
	"parking_included" boolean DEFAULT false NOT NULL,
	"state_permit_included" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "source" "booking_source" DEFAULT 'quote' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_request" ADD COLUMN "segment" "vehicle_segment" DEFAULT 'premium' NOT NULL;--> statement-breakpoint
ALTER TABLE "vehicle" ADD COLUMN "segment" "vehicle_segment" DEFAULT 'economy' NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_card" ADD CONSTRAINT "rate_card_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_card_unique_idx" ON "rate_card" USING btree ("operator_id","segment","vehicle_class");--> statement-breakpoint
CREATE INDEX "rate_card_lookup_idx" ON "rate_card" USING btree ("segment","vehicle_class");