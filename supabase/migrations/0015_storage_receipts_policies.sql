-- Tally — Lock down the private `receipts` Storage bucket (security audit, residual item).
--
-- The app accesses receipt images ONLY through service-role-signed URLs (see lib/ocr.ts:
-- getSignedReceiptUrl). The service_role bypasses RLS, and signed URLs are validated by the
-- Storage API via their embedded token — neither path depends on a SELECT policy. So no
-- anon/authenticated role ever needs direct object access, and the correct posture is
-- deny-by-default + an explicit RESTRICTIVE policy that keeps the receipts bucket sealed even
-- if a permissive "allow authenticated to read objects" policy is ever added later.
--
-- Previously the bucket's privacy depended solely on the Console `public = false` toggle, with
-- no policies on storage.objects. This migration codifies both so privacy is reproducible.
--
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.

-- 1. Pin the bucket private so privacy never silently depends on a Console toggle again.
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. RLS is enabled on storage.objects by default in Supabase; assert it (no-op if already on).
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Defense-in-depth: a RESTRICTIVE policy is AND-ed with every permissive policy, so this
--    blocks anon/authenticated from the receipts bucket regardless of what else exists. It does
--    NOT affect service_role (bypasses RLS) or signed-URL fetches (token-validated), so receipt
--    serving keeps working.
DROP POLICY IF EXISTS "receipts bucket is service-role only" ON storage.objects;
CREATE POLICY "receipts bucket is service-role only"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (bucket_id <> 'receipts')
  WITH CHECK (bucket_id <> 'receipts');
