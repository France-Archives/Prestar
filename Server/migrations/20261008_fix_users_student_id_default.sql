-- Server/migrations/20261008_fix_users_student_id_default.sql
-- Remove accidental '20' default on users.student_id while preserving
-- column type VARCHAR(20), nullable uniqueness, and foreign key to students.student_id.
BEGIN;

ALTER TABLE public.users ALTER COLUMN student_id DROP DEFAULT;

COMMIT;
