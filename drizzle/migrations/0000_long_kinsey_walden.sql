CREATE TABLE "flights" (
	"id" serial PRIMARY KEY NOT NULL,
	"tasting_id" integer NOT NULL,
	"name" text NOT NULL,
	"order_index" integer NOT NULL,
	"time_limit" integer DEFAULT 600 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "guesses" (
	"id" serial PRIMARY KEY NOT NULL,
	"participant_id" integer NOT NULL,
	"wine_id" integer NOT NULL,
	"country" text,
	"region" text,
	"producer" text,
	"name" text,
	"vintage" text,
	"varietals" text[],
	"rating" integer,
	"notes" text,
	"score" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"tasting_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tasting_id" integer NOT NULL,
	"country" integer DEFAULT 0 NOT NULL,
	"region" integer DEFAULT 0 NOT NULL,
	"producer" integer DEFAULT 0 NOT NULL,
	"wine_name" integer DEFAULT 0 NOT NULL,
	"vintage" integer DEFAULT 0 NOT NULL,
	"varietals" integer DEFAULT 0 NOT NULL,
	"any_varietal_point" boolean DEFAULT false NOT NULL,
	"display_count" integer
);
--> statement-breakpoint
CREATE TABLE "tasting_invitees" (
	"tasting_id" integer NOT NULL,
	"email" text NOT NULL,
	CONSTRAINT "tasting_invitees_tasting_id_email_pk" PRIMARY KEY("tasting_id","email")
);
--> statement-breakpoint
CREATE TABLE "tastings" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"host_id" integer NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"profile_image" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wines" (
	"id" serial PRIMARY KEY NOT NULL,
	"flight_id" integer NOT NULL,
	"letter_code" text NOT NULL,
	"country" text NOT NULL,
	"region" text NOT NULL,
	"producer" text NOT NULL,
	"name" text NOT NULL,
	"vintage" text NOT NULL,
	"varietals" text[] NOT NULL,
	"vinaturel_id" text,
	"is_custom" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flights" ADD CONSTRAINT "flights_tasting_id_tastings_id_fk" FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guesses" ADD CONSTRAINT "guesses_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_tasting_id_tastings_id_fk" FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_rules" ADD CONSTRAINT "scoring_rules_tasting_id_tastings_id_fk" FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasting_invitees" ADD CONSTRAINT "tasting_invitees_tasting_id_tastings_id_fk" FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tastings" ADD CONSTRAINT "tastings_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wines" ADD CONSTRAINT "wines_flight_id_flights_id_fk" FOREIGN KEY ("flight_id") REFERENCES "public"."flights"("id") ON DELETE no action ON UPDATE no action;