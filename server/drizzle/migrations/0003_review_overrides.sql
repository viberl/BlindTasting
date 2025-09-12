-- Add review + overrides fields
ALTER TABLE "guesses"
  ADD COLUMN IF NOT EXISTS "override_score" integer,
  ADD COLUMN IF NOT EXISTS "override_by" integer,
  ADD COLUMN IF NOT EXISTS "override_reason" text,
  ADD COLUMN IF NOT EXISTS "override_flags" json;

ALTER TABLE "flights"
  ADD COLUMN IF NOT EXISTS "review_approved_at" timestamp;

