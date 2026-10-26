-- Migration: Allow 'Expired' status in student_verifications
-- Enables automated and manual expiration when valid_until passes.

ALTER TABLE student_verifications DROP CONSTRAINT IF EXISTS student_verifications_status_check;
ALTER TABLE student_verifications ADD CONSTRAINT student_verifications_status_check
  CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Expired'));

ALTER TABLE student_verifications DROP CONSTRAINT IF EXISTS chk_verification_review_fields;
ALTER TABLE student_verifications ADD CONSTRAINT chk_verification_review_fields
  CHECK (
    (status = 'Pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR
    (status IN ('Approved', 'Rejected', 'Expired') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  );
