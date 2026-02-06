-- Add missing columns to Profile table for Goal Tracking
ALTER TABLE "Profile" 
ADD COLUMN IF NOT EXISTS "tdeeAtGoalStart" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "startWeight" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "goalWeight" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "goalDate" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "goalType" TEXT,
ADD COLUMN IF NOT EXISTS "dynamicTDEE" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "tdeeSource" TEXT,
ADD COLUMN IF NOT EXISTS "activity" DOUBLE PRECISION;

-- Note: In older versions, activity might have been a String. 
-- If it exists as a String, we might need to convert it, but ADD COLUMN IF NOT EXISTS with a different type will likely fail or do nothing if it already exists.
-- To be safe, we ensure it's a number.
ALTER TABLE "Profile" ALTER COLUMN "activity" TYPE DOUBLE PRECISION USING "activity"::double precision;

COMMENT ON COLUMN "Profile"."tdeeAtGoalStart" IS 'Metadata snapshot of TDEE when goal was set';
