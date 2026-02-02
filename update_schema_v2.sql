-- Add Smart Portion columns to Food table
ALTER TABLE "Food" 
ADD COLUMN "servingWeight" DOUBLE PRECISION,
ADD COLUMN "quantity" DOUBLE PRECISION DEFAULT 1,
ADD COLUMN "unit" TEXT;

-- Comment on columns for clarity
COMMENT ON COLUMN "Food"."servingWeight" IS 'Weight in grams of the serving';
COMMENT ON COLUMN "Food"."quantity" IS 'Base count (e.g. 11)';
COMMENT ON COLUMN "Food"."unit" IS 'Base unit (e.g. "crackers")';
