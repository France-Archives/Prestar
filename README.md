# Prestar

## Signup proof upload API

Create an account with `POST /api/auth/signup` using the existing JSON signup fields. If the submitted details do not match a student record, the API returns `202` with `proof_required: true`, a `reference_no`, a short-lived `proof_upload_token` (valid for 30 minutes), and a `proof_upload_url`. The frontend must retain the token securely for the upload; the reference number by itself cannot authorize an upload.

Upload the enrollment photo to the returned URL with `multipart/form-data`: use `proof` as the file field and send `Authorization: Bearer <proof_upload_token>`. JPEG, PNG, and WebP images are accepted up to 5 MB. The token is bound to that signup and can attach only one proof image.

Proof bytes are stored in PostgreSQL in the `signups.proof_image` `BYTEA` column, with the validated media type in `signups.proof_mime_type`. Apply `Server/migrations/20261007_add_signup_proof_bytea.sql` before deploying the updated backend. The upload is not exposed through a public URL; future reviewer access should be through an authenticated, role-protected endpoint.