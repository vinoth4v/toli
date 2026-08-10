CREATE TABLE "booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"all_in_paise" integer NOT NULL,
	"advance_paise" integer NOT NULL,
	"commission_paise" integer NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charter_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" serial NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"segment" text NOT NULL,
	"from_city" text NOT NULL,
	"itinerary" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"passengers" integer NOT NULL,
	"vehicle_kind" text NOT NULL,
	"vehicles_needed" integer DEFAULT 1 NOT NULL,
	"estimated_km" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "operator" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"gstin" text,
	"verified" boolean DEFAULT false NOT NULL,
	"commission_bps" integer DEFAULT 1000 NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"vehicle_kind" text NOT NULL,
	"seats" integer NOT NULL,
	"base_fare_paise" integer NOT NULL,
	"included_km" integer NOT NULL,
	"per_km_paise" integer NOT NULL,
	"driver_bata_paise" integer DEFAULT 0 NOT NULL,
	"night_halt_paise" integer DEFAULT 0 NOT NULL,
	"tolls_included" boolean DEFAULT false NOT NULL,
	"tolls_paise" integer DEFAULT 0 NOT NULL,
	"parking_included" boolean DEFAULT false NOT NULL,
	"parking_paise" integer DEFAULT 0 NOT NULL,
	"permit_included" boolean DEFAULT false NOT NULL,
	"permit_paise" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"status" text DEFAULT 'submitted' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operator_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"seats" integer NOT NULL,
	"registration" text NOT NULL,
	"model_year" integer,
	"ac" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_request_id_charter_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."charter_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_request_id_charter_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."charter_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_request_key" ON "booking" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "charter_request_status_idx" ON "charter_request" USING btree ("status");--> statement-breakpoint
CREATE INDEX "charter_request_start_idx" ON "charter_request" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "operator_city_idx" ON "operator" USING btree ("city");--> statement-breakpoint
CREATE INDEX "quote_request_idx" ON "quote" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "vehicle_operator_idx" ON "vehicle" USING btree ("operator_id");
