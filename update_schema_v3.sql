-- Fix FoodLog table to allow NULL foodId and add mission columns for snapshots
ALTER TABLE "FoodLog"
ALTER COLUMN "foodId" DROP NOT NULL;

-- Add missing snapshot columns if they don't exist
-- Using multiple ALTER TABLE statements for compatibility
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "calories" DOUBLE PRECISION;
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "protein" DOUBLE PRECISION;
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "fat" DOUBLE PRECISION;
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "carbs" DOUBLE PRECISION;
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "servingSize" TEXT;
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "servingWeight" DOUBLE PRECISION;
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "FoodLog" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- Comment for clarity
COMMENT ON COLUMN "FoodLog"."servingWeight" IS 'Snapshot of the weight in grams for the serving logged';
