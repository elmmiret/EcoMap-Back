-- Step 1: Add new language-specific columns with temporary defaults
ALTER TABLE "recycling_guide_item" ADD COLUMN "name_es" TEXT NOT NULL DEFAULT '';
ALTER TABLE "recycling_guide_item" ADD COLUMN "name_en" TEXT NOT NULL DEFAULT '';
ALTER TABLE "recycling_guide_item" ADD COLUMN "name_ca" TEXT NOT NULL DEFAULT '';
ALTER TABLE "recycling_guide_item" ADD COLUMN "keywords_es" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "recycling_guide_item" ADD COLUMN "keywords_en" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "recycling_guide_item" ADD COLUMN "keywords_ca" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "recycling_guide_item" ADD COLUMN "description_es" TEXT;
ALTER TABLE "recycling_guide_item" ADD COLUMN "description_en" TEXT;
ALTER TABLE "recycling_guide_item" ADD COLUMN "description_ca" TEXT;

-- Step 2: Migrate existing data to all language variants
-- Copy Spanish data to all three language columns
UPDATE "recycling_guide_item"
SET 
  "name_es" = "name",
  "name_en" = "name",
  "name_ca" = "name",
  "keywords_es" = "keywords",
  "keywords_en" = "keywords",
  "keywords_ca" = "keywords",
  "description_es" = "description",
  "description_en" = "description",
  "description_ca" = "description";

-- Step 3: Drop old single-language columns and unique constraint
DROP INDEX IF EXISTS "recycling_guide_item_name_key";
ALTER TABLE "recycling_guide_item" DROP COLUMN "name";
ALTER TABLE "recycling_guide_item" DROP COLUMN "keywords";
ALTER TABLE "recycling_guide_item" DROP COLUMN "description";

-- Step 4: Remove temporary defaults (columns are now properly populated)
ALTER TABLE "recycling_guide_item" ALTER COLUMN "name_es" DROP DEFAULT;
ALTER TABLE "recycling_guide_item" ALTER COLUMN "name_en" DROP DEFAULT;
ALTER TABLE "recycling_guide_item" ALTER COLUMN "name_ca" DROP DEFAULT;
ALTER TABLE "recycling_guide_item" ALTER COLUMN "keywords_es" DROP DEFAULT;
ALTER TABLE "recycling_guide_item" ALTER COLUMN "keywords_en" DROP DEFAULT;
ALTER TABLE "recycling_guide_item" ALTER COLUMN "keywords_ca" DROP DEFAULT;

-- Step 5: Create new indexes for each language
CREATE INDEX "recycling_guide_item_name_es_idx" ON "recycling_guide_item"("name_es");
CREATE INDEX "recycling_guide_item_name_en_idx" ON "recycling_guide_item"("name_en");
CREATE INDEX "recycling_guide_item_name_ca_idx" ON "recycling_guide_item"("name_ca");
