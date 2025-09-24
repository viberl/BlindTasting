ALTER TABLE "tastings"
ADD COLUMN "show_rating_field" boolean DEFAULT true NOT NULL;

ALTER TABLE "tastings"
ADD COLUMN "show_notes_field" boolean DEFAULT true NOT NULL;
