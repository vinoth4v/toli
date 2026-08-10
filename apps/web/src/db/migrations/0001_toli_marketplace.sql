CREATE TABLE "transport_operator" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"gstin" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"commission_bps" integer DEFAULT 1200 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"registration" text NOT NULL,
	"class" text NOT NULL,
	"seats" integer NOT NULL,
	"model" text,
	"ac" boolean DEFAULT true NOT NULL,
	"permit_type" text NOT NULL,
	"permit_expiry" date,
	"per_km_paise" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"trip_type" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"days" integer DEFAULT 1 NOT NULL,
	"passengers" integer NOT NULL,
	"estimated_km" integer NOT NULL,
	"vehicle_class" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"per_km_paise" integer NOT NULL,
	"chargeable_km" integer NOT NULL,
	"base_fare_paise" integer NOT NULL,
	"driver_allowance_paise" integer NOT NULL,
	"night_halt_paise" integer NOT NULL,
	"tolls_parking_paise" integer NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"gst_rate_bps" integer NOT NULL,
	"gst_paise" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"commission_bps" integer NOT NULL,
	"commission_paise" integer NOT NULL,
	"operator_payout_paise" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"quote_id" uuid NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"driver_name" text,
	"driver_phone" text,
	"vehicle_registration" text,
	"pickup_note" text,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"cancellation_reason" text
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"method" text NOT NULL,
	"reference" text,
	"note" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_operator_id_transport_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."transport_operator"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_enquiry_id_enquiry_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_operator_id_transport_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."transport_operator"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_enquiry_id_enquiry_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiry"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transport_operator_status_idx" ON "transport_operator" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_registration_idx" ON "vehicle" USING btree ("registration");--> statement-breakpoint
CREATE INDEX "vehicle_operator_idx" ON "vehicle" USING btree ("operator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enquiry_ref_idx" ON "enquiry" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "enquiry_status_idx" ON "enquiry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enquiry_start_at_idx" ON "enquiry" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "quote_enquiry_idx" ON "quote" USING btree ("enquiry_id");--> statement-breakpoint
CREATE INDEX "quote_status_idx" ON "quote" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_ref_idx" ON "booking" USING btree ("ref");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_quote_idx" ON "booking" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "booking_status_idx" ON "booking" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_booking_idx" ON "payment" USING btree ("booking_id");