# PRESTAR

Library-management system for university libraries, featuring a modern frontend interface and PostgreSQL backend services.

## Local Development

### Client (Frontend)
Run the client from `Client/`:
```bash
cd Client
npm install
npm run dev
```

The mock database is initialized in browser memory; refreshing the page resets mutations to the seed data. The signed-in mock account is stored in `sessionStorage`.

All mock accounts use the development-only password `Password123`. The login page lists the available role and student scenarios. Useful synthetic student accounts:

| Scenario | Email |
| --- | --- |
| Eligible for a borrowing request; also has active loans | `ana.reyes@university.edu` |
| Verified; current-term COR pending review | `noah.garcia@university.edu` |
| Verified; current-term COR rejected, with a reason and resubmission available | `gina.cruz@university.edu` |
| Verified; no COR on record | `dan.uy@university.edu` |
| Verified; active loan and an overdue restriction | `carla.diaz@university.edu` |

Administrator and librarian logins are listed on the login page. The librarians have different permissions so that permission-gated views can be tried.

---

### Server (Backend)

#### Signup Proof Upload API
Create an account with `POST /api/auth/signup` using the existing JSON signup fields. If the submitted details do not match a student record, the API returns `202` with `proof_required: true`, a `reference_no`, a short-lived `proof_upload_token` (valid for 30 minutes), and a `proof_upload_url`. The frontend must retain the token securely for the upload; the reference number by itself cannot authorize an upload.

Upload the enrollment photo to the returned URL with `multipart/form-data`: use `proof` as the file field and send `Authorization: Bearer <proof_upload_token>`. JPEG, PNG, and WebP images are accepted up to 5 MB. The token is bound to that signup and can attach only one proof image.

Proof bytes are stored in PostgreSQL in the `signups.proof_image` `BYTEA` column, with the validated media type in `signups.proof_mime_type`. Apply `Server/migrations/20261007_add_signup_proof_bytea.sql` before deploying the updated backend. The upload is not exposed through a public URL; future reviewer access should be through an authenticated, role-protected endpoint.

#### Email OTP Verification System
A standalone email verification system using PostgreSQL and Gmail API OAuth2.

##### Endpoints
1. `POST /api/otp/request`
   - **Body**: `{ "email": "user@example.com" }`
   - **Response**: `{ "message": "If the email is valid, a code has been sent." }` (Generic 200 to prevent user enumeration)
   - **Protections**:
     - Per-IP rate limiting: 20 requests per 15 minutes
     - Per-email cooldown: 60 seconds enforced atomically
     - Per-email cap: 5 requests per hour
     - Global daily send cap (configurable via `OTP_DAILY_CAP`, default 400)
     - OTP is never logged or exposed in responses

2. `POST /api/otp/verify`
   - **Body**: `{ "email": "user@example.com", "code": "123456" }`
   - **Response**: `{ "message": "Email verified successfully.", "verified": true }`
   - **Protections**:
     - Strict 6-digit regex format validation before database lookup
     - Constant-time HMAC-SHA256 comparison (`crypto.timingSafeEqual`)
     - Atomic attempt increment with lockout after 5 failed attempts (deletes row)
     - Single-use deletion on verification success
     - Updates `users.email_verified = true`

##### Environment Setup
Add the following to `Server/.env`:
```env
# Gmail API (OAuth2)
GMAIL_CLIENT_ID=your_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token
GMAIL_USER=your_verified_gmail@gmail.com

# OTP Security
OTP_SECRET=random_32_or_64_character_hex_secret
OTP_DAILY_CAP=400
```

##### Running the Migration
Apply the non-destructive migration that adds `email_verified` to `users` and prepares `email_otps`:
```bash
psql -U postgres -d prestar -f Server/migrations/20261011_otp_verification_system.sql
```

##### Local Testing
Run the test suite using Node's built-in test runner:
```bash
cd Server
node --test tests/otpVerification.test.js
```

---

## Demo and Production Boundaries

- All people, email addresses, account passwords, documents, and transactions in the mock dataset are synthetic. Never use these credentials or mock records in a deployed environment.
- COR submission requires taking a photo from the live browser camera. The demo does not upload or retain the photo: it keeps only the file name, and the seeded COR records contain no student documents. A browser camera interface cannot prove that an image is live; a production backend must validate trusted capture evidence and inspect submissions stored in private, access-controlled object storage.
- The academic-term records are editable mock configuration. Seeded examples include First Semester (August–December), Second Semester (January–May), and Summer Term (June–July). Current-term COR eligibility is based on term records and each approval's effective dates, not month-number rules. Approval does not take effect before a term's configured start or authorize a different term.
- Book availability is calculated from individual copy records. Staff catalog views show total, available, reserved, on-loan, maintenance, lost, and withdrawn counts from the shared mock store.
- Mock services simulate workflows and permissions for demonstration only. A production backend must independently enforce authentication, role permissions, school-email verification, term-specific COR approval and effective dates, borrowing restrictions, duplicate prevention, inventory concurrency, FIFO reservations, and valid status transitions in atomic transactions. It must also securely process COR files, hash passwords, issue email tokens, and persist audit and notification records.
- The app intentionally preserves existing configured policies where a rule is unresolved; for example, it does not create a new COR late-submission policy.
