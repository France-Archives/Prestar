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

#### Signup Proof Upload
The `20261007_add_signup_proof_bytea.sql` migration adds proof-image columns to `signups`, but the current auth routes, controller, and signup service do not implement a proof-upload flow. Current student registration uses institutional email and OTP verification as documented below; do not expect a `202` proof-required response or an upload URL.

#### Student Signup Email Verification
`POST /api/auth/signup` stores a pending signup payload and sends a six-digit OTP; it creates no `users` or `students` rows until `POST /api/auth/signup/verify-otp` succeeds. Signup OTPs are bcrypt-hashed, expire in 10 minutes, allow five failed attempts, and are single-use. Resending has a two-minute cooldown and a maximum of three sends per 24-hour window. The resend counter is not reset by each cooldown. A failed or unconfigured Gmail delivery is an error; OTPs are not returned or logged.

The signup record stores accepted Terms and Privacy timestamps, plus optional middle name and suffix. Apply `Server/migrations/20261018_signup_profile_and_consent.sql` before deploying this version.

#### Standalone Email OTP Verification System
This is a separate endpoint flow from student registration. It uses PostgreSQL and HMAC-SHA256 OTP hashes to verify the email of an existing account; it does not create a user or student.

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
     - Updates `users.email_verified = true` for an existing user

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
