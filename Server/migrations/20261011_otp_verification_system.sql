-- Server/migrations/20261011_otp_verification_system.sql
-- Standalone email OTP verification system reusing existing email_otps table.
-- No new tables are created.
BEGIN;

-- 1. Add email_verified flag to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Make signup_payload optional on email_otps so general OTP requests can use it
ALTER TABLE public.email_otps
  ALTER COLUMN signup_payload DROP NOT NULL;

ALTER TABLE public.email_otps
  ALTER COLUMN signup_payload SET DEFAULT '{}'::jsonb;

-- 3. Ensure unique constraint on email for atomic ON CONFLICT upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_email_otps_email'
  ) THEN
    ALTER TABLE public.email_otps ADD CONSTRAINT uq_email_otps_email UNIQUE (email);
  END IF;
END $$;

COMMIT;
