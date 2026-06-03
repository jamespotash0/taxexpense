-- Tally — Database access hardening (DEC-030). Defense-in-depth for the public/anon path.
--
-- CONTEXT: 100% of app data access is server-side via the SERVICE ROLE (bypasses RLS);
-- the anon key is defined but never used for data (verified in code). RLS is already
-- ENABLED on every table with NO policies (= default-deny), so the anon/public REST API
-- already returns nothing. This migration makes that guarantee belt-and-suspenders and
-- self-enforcing:
--   1. Re-assert RLS on every app table (centralizes + documents the invariant).
--   2. REVOKE all privileges from the public `anon`/`authenticated` roles so the anon key
--      cannot even reference the tables — and so a future *accidental* permissive policy
--      can't expose data on its own.
--   3. Make those revokes apply to FUTURE objects too (ALTER DEFAULT PRIVILEGES).
--   4. Self-check: fail loudly if any table in `public` ships without RLS (regression guard).
--
-- NON-BREAKING: `service_role` (used by the server) has BYPASSRLS + retains its grants, so
-- the app is unaffected. This does NOT add per-tenant RLS policies — because every request
-- runs as service_role (which bypasses RLS), cross-tenant isolation is enforced in app code
-- (lib/db.orgTable); see JOURNAL DEC-030 for that trade-off.
--
-- Run in the Supabase SQL editor. Idempotent.

-- 1) Re-assert RLS on every application table (idempotent).
ALTER TABLE organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE substantiation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE irc_summaries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_codes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;

-- 2) Strip ALL privileges from the public roles. RLS default-deny already blocks row
--    access; this removes the table-level GRANTs Supabase hands `anon`/`authenticated`
--    by default, so the anon key gets "permission denied" before RLS is even consulted.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- 3) Apply the same denial to objects CREATED LATER by the migration role (so a new table
--    can't be born with anon grants). The self-check in step 4 is the catch-all regardless
--    of which role creates a table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- NOTE (intentionally NOT enabled): `FORCE ROW LEVEL SECURITY`. With no policies it would
-- also block the table-OWNER role used by the Supabase dashboard's data viewer / manual
-- maintenance, with no security gain here (service_role already bypasses RLS, and anon is
-- fully revoked above). Enable per-table only if you add real policies and want the owner
-- subject to them, e.g.:  ALTER TABLE receipts FORCE ROW LEVEL SECURITY;

-- 4) Regression guard: refuse to leave any base table in `public` without RLS. A future
--    migration that adds a table and forgets RLS will FAIL here until it's fixed.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'            -- ordinary tables only
    AND c.relrowsecurity = false;  -- RLS not enabled
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Security guard: these public tables have no RLS enabled: %', missing;
  END IF;
END $$;
