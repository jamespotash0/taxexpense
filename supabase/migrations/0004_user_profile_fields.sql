-- TaxSnap/Tally — Add user profile fields (DEC-014).
-- full_name: captured during SMS onboarding (warm personalization + export/accountant headers).
-- email:     captured later at the dashboard (NOT over SMS — typo-prone; not needed for
--            phone-OTP login). Optional. organizations.name already exists (used for org name).
--
-- Run in the Supabase SQL editor. Idempotent.

ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Optional: speed up dashboard lookups by email if we add email-based features later.
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
