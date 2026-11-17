-- Typo-tolerant food search, matching words in the brand and the name in any order.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.
--
-- How it matches: the query is split into words. Every word must appear in the
-- food's brand or name, either exactly or as a close spelling (pg_trgm
-- word similarity >= 0.5), so "fairlfe choclate milk" finds
-- brand "Fairlife" + name "Chocolate Milk".

-- pg_trgm may already be installed (in "public" or "extensions"); either works.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
SET search_path = public, extensions;

-- Speeds up fuzzy matching as the Food table grows
CREATE INDEX IF NOT EXISTS "Food_search_trgm_idx" ON "Food"
    USING gin ((lower(coalesce("brand", '') || ' ' || "name")) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_foods(q text, max_results int DEFAULT 10)
RETURNS SETOF "Food"
LANGUAGE sql
STABLE
SECURITY INVOKER          -- runs as the signed-in user, so row-level security still applies
SET search_path = public, extensions
SET pg_trgm.word_similarity_threshold = 0.5
AS $$
    WITH words AS (
        SELECT DISTINCT w
        FROM regexp_split_to_table(lower(trim(q)), '\s+') AS w
        WHERE w <> ''
    ),
    candidates AS (
        SELECT f AS food, f."name" AS name, lower(coalesce(f."brand", '') || ' ' || f."name") AS txt
        FROM "Food" f
        -- Same visibility rule as the app: public foods, or foods I created
        WHERE (f."isPublic" OR f."createdById" = (SELECT auth.uid())::text)
    )
    SELECT (c.food).*
    FROM (
        SELECT c.food, c.name,
               -- exact phrase anywhere ranks first, then how closely the words match
               (position(lower(trim(q)) IN c.txt) > 0)            AS phrase_hit,
               (SELECT sum(word_similarity(w, c.txt)) FROM words) AS score
        FROM candidates c
        WHERE EXISTS (SELECT 1 FROM words)
          AND NOT EXISTS (         -- every word must match (exactly or fuzzily)
              SELECT 1 FROM words
              WHERE position(w IN c.txt) = 0 AND NOT (w <% c.txt)
          )
    ) c
    ORDER BY c.phrase_hit DESC, c.score DESC, length(c.name)
    LIMIT greatest(1, least(max_results, 50));
$$;

GRANT EXECUTE ON FUNCTION public.search_foods(text, int) TO authenticated, anon;
