-- Enable ON DELETE CASCADE for key relations to allow safe tasting deletion
-- Drop existing FKs (NO ACTION) if they exist, then recreate with CASCADE.

-- flights.tasting_id -> tastings.id
ALTER TABLE "flights" DROP CONSTRAINT IF EXISTS "flights_tasting_id_tastings_id_fk";
ALTER TABLE "flights"
  ADD CONSTRAINT "flights_tasting_id_tastings_id_fk"
  FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- participants.tasting_id -> tastings.id
ALTER TABLE "participants" DROP CONSTRAINT IF EXISTS "participants_tasting_id_tastings_id_fk";
ALTER TABLE "participants"
  ADD CONSTRAINT "participants_tasting_id_tastings_id_fk"
  FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- guesses.participant_id -> participants.id
ALTER TABLE "guesses" DROP CONSTRAINT IF EXISTS "guesses_participant_id_participants_id_fk";
ALTER TABLE "guesses"
  ADD CONSTRAINT "guesses_participant_id_participants_id_fk"
  FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- guesses.wine_id -> wines.id
ALTER TABLE "guesses" DROP CONSTRAINT IF EXISTS "guesses_wine_id_wines_id_fk";
ALTER TABLE "guesses"
  ADD CONSTRAINT "guesses_wine_id_wines_id_fk"
  FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- wines.flight_id -> flights.id
ALTER TABLE "wines" DROP CONSTRAINT IF EXISTS "wines_flight_id_flights_id_fk";
ALTER TABLE "wines"
  ADD CONSTRAINT "wines_flight_id_flights_id_fk"
  FOREIGN KEY ("flight_id") REFERENCES "public"."flights"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- scoring_rules.tasting_id -> tastings.id
ALTER TABLE "scoring_rules" DROP CONSTRAINT IF EXISTS "scoring_rules_tasting_id_tastings_id_fk";
ALTER TABLE "scoring_rules"
  ADD CONSTRAINT "scoring_rules_tasting_id_tastings_id_fk"
  FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- tasting_invitees.tasting_id -> tastings.id
ALTER TABLE "tasting_invitees" DROP CONSTRAINT IF EXISTS "tasting_invitees_tasting_id_tastings_id_fk";
ALTER TABLE "tasting_invitees"
  ADD CONSTRAINT "tasting_invitees_tasting_id_tastings_id_fk"
  FOREIGN KEY ("tasting_id") REFERENCES "public"."tastings"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

