ALTER TABLE "platform_setting" ALTER COLUMN "home_state" SET DEFAULT 'Tamil Nadu';--> statement-breakpoint
ALTER TABLE "driver" ADD COLUMN "languages" text[] DEFAULT '{"ta"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "trip_request" ADD COLUMN "preferred_driver_language" text;