-- AI Coach tables. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to run again (IF NOT EXISTS / DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS "CoachProfile" (
    "userId" TEXT PRIMARY KEY,
    "goals" TEXT,
    "trainingSchedule" TEXT,
    "experience" TEXT,
    "injuries" TEXT,
    "foodPreferences" TEXT,
    "notes" TEXT,
    "trainingPhase" TEXT,
    "phaseStart" DATE,
    "phaseEnd" DATE,
    "trackCycle" BOOLEAN NOT NULL DEFAULT false,
    "lastPeriodStart" DATE,
    "cycleLength" INTEGER,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "CoachMessage" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL CHECK ("role" IN ('user', 'assistant')),
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "CoachMessage_user_created_idx" ON "CoachMessage" ("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "CoachPlan" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'archived')),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "CoachPlan_user_idx" ON "CoachPlan" ("userId");

-- Row-level security: each signed-in user can only see and change their own rows.
ALTER TABLE "CoachProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CoachPlan" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_profile_own" ON "CoachProfile";
CREATE POLICY "coach_profile_own" ON "CoachProfile" FOR ALL TO authenticated
    USING ((select auth.uid())::text = "userId") WITH CHECK ((select auth.uid())::text = "userId");

DROP POLICY IF EXISTS "coach_message_own" ON "CoachMessage";
CREATE POLICY "coach_message_own" ON "CoachMessage" FOR ALL TO authenticated
    USING ((select auth.uid())::text = "userId") WITH CHECK ((select auth.uid())::text = "userId");

DROP POLICY IF EXISTS "coach_plan_own" ON "CoachPlan";
CREATE POLICY "coach_plan_own" ON "CoachPlan" FOR ALL TO authenticated
    USING ((select auth.uid())::text = "userId") WITH CHECK ((select auth.uid())::text = "userId");

GRANT SELECT, INSERT, UPDATE, DELETE ON "CoachProfile", "CoachMessage", "CoachPlan" TO authenticated;
