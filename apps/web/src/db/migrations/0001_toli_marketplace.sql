CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'assigned', 'in_transit', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."compliance_source" AS ENUM('vahan', 'sarathi', 'gstn', 'manual');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'investigating', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('rc', 'state_permit', 'aitp', 'fitness', 'insurance', 'puc', 'vltd');--> statement-breakpoint
CREATE TYPE "public"."expense_kind" AS ENUM('toll', 'parking', 'fuel', 'state_permit');--> statement-breakpoint
CREATE TYPE "public"."gst_treatment" AS ENUM('passenger_transport_5', 'passenger_transport_12', 'rental_with_operator_18');--> statement-breakpoint
CREATE TYPE "public"."operator_status" AS ENUM('draft', 'pending_verification', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."operator_tier" AS ENUM('bronze', 'silver', 'gold');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('advance', 'balance', 'refund');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('upi', 'card', 'netbanking', 'neft', 'cash_to_driver');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('requested', 'submitted', 'accepted', 'rejected', 'expired', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'released', 'paid');--> statement-breakpoint
CREATE TYPE "public"."trip_event_kind" AS ENUM('dispatched', 'started', 'stop_reached', 'deviation', 'sos', 'completed', 'note');--> statement-breakpoint
CREATE TYPE "public"."trip_request_status" AS ENUM('open', 'quoting', 'booked', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trip_type" AS ENUM('one_way', 'round_trip', 'multi_day_tour', 'local_package_8_80', 'local_package_12_120', 'airport_transfer', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."vehicle_class" AS ENUM('mpv_suv', 'tempo_traveller', 'mini_bus', 'coach_seater', 'coach_multi_axle', 'sleeper_coach', 'double_decker');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('draft', 'pending_verification', 'active', 'suspended', 'retired');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"sub_contracted_to_operator_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"trip_request_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"agreed_total_paise" bigint NOT NULL,
	"advance_due_paise" bigint NOT NULL,
	"commission_bps" integer NOT NULL,
	"gst_treatment" "gst_treatment" NOT NULL,
	"place_of_supply" text NOT NULL,
	"intra_state" boolean DEFAULT true NOT NULL,
	"tracking_token" text NOT NULL,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"source" "compliance_source" NOT NULL,
	"passed" boolean,
	"result" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"gstin" text,
	"city" text,
	"segment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"refund_paise" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "driver" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"dl_number" text,
	"dl_expires_on" date,
	"police_verified_on" date,
	"medical_checked_on" date,
	"induction_trained_on" date,
	"verification" "verification_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"number" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"taxable_paise" bigint NOT NULL,
	"cgst_paise" bigint DEFAULT 0 NOT NULL,
	"sgst_paise" bigint DEFAULT 0 NOT NULL,
	"igst_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint NOT NULL,
	"gst_treatment" "gst_treatment" NOT NULL,
	"gst_rate_bps" integer NOT NULL,
	"sac_code" text NOT NULL,
	"place_of_supply" text NOT NULL,
	"customer_gstin" text
);
--> statement-breakpoint
CREATE TABLE "location_ping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"lat" text NOT NULL,
	"lng" text NOT NULL,
	"speed_kmph" smallint,
	"source" text DEFAULT 'driver_app' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"pan" text,
	"gstin" text,
	"status" "operator_status" DEFAULT 'pending_verification' NOT NULL,
	"tier" "operator_tier" DEFAULT 'bronze' NOT NULL,
	"commission_bps" integer,
	"bank_account_last4" text,
	"leakage_flagged" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"mode" "payment_mode" NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"gateway_ref" text,
	"collected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"default_commission_bps" integer DEFAULT 1000 NOT NULL,
	"tcs_bps" integer DEFAULT 100 NOT NULL,
	"tds_bps" integer DEFAULT 100 NOT NULL,
	"default_gst_treatment" "gst_treatment" DEFAULT 'passenger_transport_5' NOT NULL,
	"advance_bps" integer DEFAULT 2500 NOT NULL,
	"home_state" text DEFAULT 'Rajasthan' NOT NULL,
	"quote_validity_hours" integer DEFAULT 48 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_request_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"vehicle_id" uuid,
	"status" "quote_status" DEFAULT 'requested' NOT NULL,
	"base_fare_paise" bigint DEFAULT 0 NOT NULL,
	"included_km" integer,
	"included_hours" integer,
	"extra_km_rate_paise" bigint,
	"extra_hour_rate_paise" bigint,
	"per_km_rate_paise" bigint,
	"min_km_per_day" integer,
	"driver_bata_per_day_paise" bigint DEFAULT 0 NOT NULL,
	"night_halt_paise" bigint DEFAULT 0 NOT NULL,
	"toll_included" boolean DEFAULT false NOT NULL,
	"parking_included" boolean DEFAULT false NOT NULL,
	"state_permit_included" boolean DEFAULT false NOT NULL,
	"fuel_included" boolean DEFAULT true NOT NULL,
	"gst_treatment" "gst_treatment" NOT NULL,
	"estimated_total_paise" bigint DEFAULT 0 NOT NULL,
	"worst_case_total_paise" bigint DEFAULT 0 NOT NULL,
	"days" smallint DEFAULT 1 NOT NULL,
	"nights" smallint DEFAULT 0 NOT NULL,
	"cancellation_policy" text,
	"valid_until" timestamp with time zone,
	"notes" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"cleanliness" smallint NOT NULL,
	"driver_behaviour" smallint NOT NULL,
	"punctuality" smallint NOT NULL,
	"matched_booking" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"gross_paise" bigint NOT NULL,
	"commission_paise" bigint NOT NULL,
	"tcs_paise" bigint NOT NULL,
	"tds_paise" bigint NOT NULL,
	"expenses_reimbursed_paise" bigint DEFAULT 0 NOT NULL,
	"cash_collected_paise" bigint DEFAULT 0 NOT NULL,
	"net_payable_paise" bigint NOT NULL,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"utr" text,
	"released_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stop" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_request_id" uuid NOT NULL,
	"sequence" smallint NOT NULL,
	"label" text NOT NULL,
	"lat" text,
	"lng" text,
	"halt_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "trip_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "trip_event_kind" NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"detail" text,
	"odometer_km" integer,
	"lat" text,
	"lng" text
);
--> statement-breakpoint
CREATE TABLE "trip_expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "expense_kind" NOT NULL,
	"amount_paise" bigint NOT NULL,
	"receipt_url" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"trip_type" "trip_type" NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"passenger_count" smallint NOT NULL,
	"vehicle_class" "vehicle_class" NOT NULL,
	"vehicle_count" smallint DEFAULT 1 NOT NULL,
	"ac_required" boolean DEFAULT true NOT NULL,
	"features" text[] DEFAULT '{}' NOT NULL,
	"extras" text[] DEFAULT '{}' NOT NULL,
	"interstate" boolean DEFAULT false NOT NULL,
	"states_crossed" text[] DEFAULT '{}' NOT NULL,
	"estimated_km" integer,
	"notes" text,
	"status" "trip_request_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"registration_number" text NOT NULL,
	"vehicle_class" "vehicle_class" NOT NULL,
	"seats" smallint NOT NULL,
	"ac" boolean DEFAULT true NOT NULL,
	"year_of_manufacture" smallint NOT NULL,
	"fuel_type" text,
	"features" text[] DEFAULT '{}' NOT NULL,
	"photo_count" smallint DEFAULT 0 NOT NULL,
	"status" "vehicle_status" DEFAULT 'draft' NOT NULL,
	"suspension_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"number" text,
	"issued_on" date,
	"expires_on" date,
	"verification" "verification_status" DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_driver_id_driver_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."driver"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_sub_contracted_to_operator_id_operator_id_fk" FOREIGN KEY ("sub_contracted_to_operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_trip_request_id_trip_request_id_fk" FOREIGN KEY ("trip_request_id") REFERENCES "public"."trip_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute" ADD CONSTRAINT "dispute_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver" ADD CONSTRAINT "driver_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_ping" ADD CONSTRAINT "location_ping_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_trip_request_id_trip_request_id_fk" FOREIGN KEY ("trip_request_id") REFERENCES "public"."trip_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement" ADD CONSTRAINT "settlement_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stop" ADD CONSTRAINT "stop_trip_request_id_trip_request_id_fk" FOREIGN KEY ("trip_request_id") REFERENCES "public"."trip_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_event" ADD CONSTRAINT "trip_event_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_expense" ADD CONSTRAINT "trip_expense_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_request" ADD CONSTRAINT "trip_request_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_document" ADD CONSTRAINT "vehicle_document_vehicle_id_vehicle_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_booking_idx" ON "assignment" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_reference_idx" ON "booking" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_tracking_token_idx" ON "booking" USING btree ("tracking_token");--> statement-breakpoint
CREATE INDEX "booking_status_idx" ON "booking" USING btree ("status");--> statement-breakpoint
CREATE INDEX "compliance_check_entity_idx" ON "compliance_check" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "consent_record_customer_idx" ON "consent_record" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_phone_idx" ON "customer" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "dispute_booking_idx" ON "dispute" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "driver_operator_idx" ON "driver" USING btree ("operator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_number_idx" ON "invoice" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoice_booking_idx" ON "invoice" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "location_ping_booking_idx" ON "location_ping" USING btree ("booking_id","at");--> statement-breakpoint
CREATE INDEX "operator_city_idx" ON "operator" USING btree ("city");--> statement-breakpoint
CREATE INDEX "payment_booking_idx" ON "payment" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "quote_trip_request_idx" ON "quote" USING btree ("trip_request_id");--> statement-breakpoint
CREATE INDEX "quote_operator_idx" ON "quote" USING btree ("operator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_booking_idx" ON "review" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_booking_idx" ON "settlement" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "stop_trip_request_idx" ON "stop" USING btree ("trip_request_id");--> statement-breakpoint
CREATE INDEX "trip_event_booking_idx" ON "trip_event" USING btree ("booking_id","at");--> statement-breakpoint
CREATE INDEX "trip_expense_booking_idx" ON "trip_expense" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_request_reference_idx" ON "trip_request" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "trip_request_status_idx" ON "trip_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trip_request_start_idx" ON "trip_request" USING btree ("start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_registration_idx" ON "vehicle" USING btree ("registration_number");--> statement-breakpoint
CREATE INDEX "vehicle_operator_idx" ON "vehicle" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "vehicle_document_vehicle_idx" ON "vehicle_document" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_document_expiry_idx" ON "vehicle_document" USING btree ("expires_on");