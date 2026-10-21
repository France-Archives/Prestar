# Prestar API Reference

> **Base URL**: `http://localhost:<PORT>/api`  
> **Auth mechanism**: HTTP-only cookie (`auth_token`) issued on login — sent automatically by the browser.  
> All protected routes validate the cookie via `authMiddleware`.  
> Role enforcement is done by `requireRole(["Admin","Librarian"])` (staff) or `requireRole(["Student"])`.

---

## Table of Contents

1. [Auth](#1-auth)
2. [Student Dashboard](#2-student-dashboard)
3. [Books](#3-books)
4. [Borrow Requests](#4-borrow-requests)
5. [Borrowed Books](#5-borrowed-books)
6. [Common Error Responses](#6-common-error-responses)
7. [Academic Terms & COR Verification](#7-academic-terms--cor-verification)
8. [Reservations (FIFO Queue System)](#8-reservations-fifo-queue-system)
9. [Notifications](#9-notifications)
10. [Admin Account Management](#10-admin-account-management)

---

## 1. Auth

**Prefix**: `/api/auth`

### 1.1 `POST /api/auth/login`
Log in with email and password. Sets an HTTP-only `auth_token` cookie valid for **6 hours**.

| Property | Value |
|---|---|
| **Auth required** | No |
| **Rate limited** | Yes (login rate limiter) |

**Request body**
```json
{
  "email": "student@example.com",
  "password": "secret"
}
```

**Success `200`**
```json
{ "message": "Login successful." }
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation failure (missing/malformed fields) |
| `401` | Invalid credentials or inactive account |
| `429` | Too many requests |

---

### 1.2 `POST /api/auth/logout`
Clear the session cookie.

| Property | Value |
|---|---|
| **Auth required** | No (cookie cleared regardless) |

**Success `200`**
```json
{ "message": "Logged out successfully." }
```

---

### 1.3 `GET /api/auth/me`
Return the currently authenticated user's profile.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Success `200`**
```json
{
  "user": {
    "id": 1,
    "email": "student@example.com",
    "role": "Student",
    "accountStatus": "ACTIVE",
    "emailVerified": true,
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "displayName": "Juan Dela Cruz",
    "student": {
      "id": 1,
      "userId": 1,
      "studentNumber": "2024-00001",
      "college": "College of Computer Studies",
      "course": "BS Information Technology",
      "program": "BS Information Technology",
      "yearLevel": 1
    }
  },
  "dashboardUrl": "/student/dashboard"
}
```

`emailVerified` is a boolean derived from `users.email_verified`. The endpoint does not expose a verification timestamp.
The response also includes `data` as an alias of `user` and `dashboard_url` as an alias of `dashboardUrl`.

**Errors**
| Code | Meaning |
|---|---|
| `401` | Missing or invalid token |

---

### 1.4 `POST /api/auth/signup`
Initiate registration and dispatch a 6-digit OTP code to the provided email via the Gmail API. The user and student rows are created only after OTP verification. Enforces a **2-minute cooldown** and a **maximum of 3 OTP emails per 24-hour signup window**; the window does not reset after each cooldown.

| Property | Value |
|---|---|
| **Auth required** | No |
| **Rate limited** | Yes (`signupRateLimiter`) |

**Request body**
```json
{
  "email": "student@wmsu.edu.ph",
  "password": "StrongPassword123!",
  "first_name": "Juan",
  "last_name": "Dela Cruz",
  "student_number": "2024-00001",
  "college": "College of Computer Studies",
  "course": "BS Information Technology",
  "year_level": 1,
  "student_type": "Regular",
  "middleName": "Maria",
  "suffix": "Jr.",
  "termsAccepted": true,
  "privacyPolicyAccepted": true
}
```

> **Email requirement**: Must be a valid institutional WMSU email ending with `@wmsu.edu.ph`.

**Success `200`**
```json
{
  "message": "OTP sent to your email. Please verify to complete your registration.",
  "email": "student@wmsu.edu.ph",
  "cooldownSeconds": 120,
  "cooldown_seconds": 120,
  "remainingOtps": 2,
  "remaining_otps": 2
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation error (missing or malformed fields) |
| `409` | Email or student number already registered |
| `429` | Cooldown active, send limit exceeded, or signup rate limit exceeded |
| `503` | Verification email could not be sent; the new OTP is removed and any previous OTP is restored |

---

### 1.5 `POST /api/auth/signup/verify-otp`
Verify the 6-digit OTP code received via email and finalize account creation in `users` and `students` tables.

| Property | Value |
|---|---|
| **Auth required** | No |

**Request body**
```json
{
  "email": "student@wmsu.edu.ph",
  "otp": "123456"
}
```

**Success `201`**
```json
{
  "message": "Registration successful. You may now log in."
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid OTP code or expired OTP |
| `404` | No pending registration found for the email |
| `409` | Email or student number already registered |
| `429` | Verification rate limit exceeded |

---

### 1.6 `POST /api/auth/signup/resend-otp`
Resend a fresh 6-digit OTP code. Enforces a **2-minute cooldown** and the same **maximum of 3 OTP emails per 24-hour signup window** as initial signup. The generic response for an email without a pending signup does not confirm whether an account exists.

| Property | Value |
|---|---|
| **Auth required** | No |
| **Rate limited** | Yes (`otpRateLimiter`: max 3 per 2 minutes) |

**Request body**
```json
{
  "email": "student@wmsu.edu.ph"
}
```

**Success `200`**
```json
{
  "message": "A new OTP has been sent to your email.",
  "email": "student@example.edu",
  "cooldown_seconds": 120,
  "remaining_otps": 1
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation error |
| `429` | Cooldown in effect, 24-hour send limit reached, or IP rate limit exceeded |
| `503` | Verification email could not be sent; the previous OTP record is restored with its original expiry |

Signup OTPs are bcrypt-hashed and expire after 10 minutes. Five failed code attempts invalidate verification for that code. Codes are single-use. Signup OTP rows are retained only through the 24-hour send-limit window, then eligible for cleanup.

The separate standalone `/api/otp/request` and `/api/otp/verify` flow is not signup: it uses HMAC-hashed codes and updates `users.email_verified` on an existing user. Do not use those endpoints to create student accounts.

---

## 2. Student Dashboard

### `GET /api/me/dashboard`
Returns the authenticated Student's dashboard data. The route requires a valid `auth_token` cookie and the `Student` role. It reads the current account, active-term COR, open requests, active loans, reservations, and most-borrowed books from the database.

Personalized recommendations and notifications are not implemented by the backend; `recommended`, `recentNotifications`, and `unreadCount` are `null` rather than simulated empty results. Most-borrowed books are ranked over the preceding seven days.

**Success `200`**
```json
{
  "data": {
    "accountStatus": "ACTIVE",
    "emailVerified": true,
    "cor": {
      "status": "APPROVED",
      "currentTerm": { "id": "1", "name": "1st Semester 2026-2027" }
    },
    "commitments": { "active": 2, "max": 10 },
    "pickupWaiting": [{ "id": "12", "status": "APPROVED" }],
    "activeLoans": [{ "id": "24", "bookTitle": "Example Book", "status": "ACTIVE", "dueAt": "2026-10-25" }],
    "reservations": [{ "id": "7", "status": "WAITING" }],
    "recentNotifications": null,
    "unreadCount": null,
    "recommended": null,
    "mostBorrowed": []
  }
}
```

`commitments.active` reports the sum of pending/approved requests, reserved/borrowed loan rows, and waiting/ready reservations. `commitments.max` uses `MAX_ACTIVE_BORROWS`. This is display data, not authorization; the borrowing and reservation eligibility checks remain authoritative.

**Errors**
| Status | Meaning |
|---|---|
| `401` | Missing/invalid session or inactive account |
| `403` | Authenticated account is not a Student |
| `500` | Dashboard query failed |

## 3. Books

**Prefix**: `/api/books`  
All book routes require authentication (cookie).

### 3.1 `GET /api/books`
List books with pagination, optional full-text search, and optional category filter.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `page` | integer | `1` | Positive integer |
| `limit` | integer | `20` | 1 to 100 |
| `search` | string | — | Max 100 chars |
| `category_id` | integer | — | Positive integer |

**Success `200`**
```json
{
  "data": [
    {
      "id": 1,
      "bookId": 1,
      "title": "Introduction to Algorithms",
      "isbn": "978-0-262-04630-5",
      "description": "...",
      "coverImageUrl": "https://...",
      "publicationYear": 2009,
      "publisher": "MIT Press",
      "language": "English",
      "price": "89.99",
      "status": "Active",
      "author": { "id": 3, "name": "Thomas Cormen" },
      "authors": [{ "id": 3, "name": "Thomas Cormen" }],
      "category": { "id": 2, "name": "Computer Science" },
      "availability": { "availableCopies": 3, "totalUsableCopies": 3 },
      "availableCopies": 3,
      "isArchived": false,
      "createdAt": "2026-01-10T12:00:00.000Z",
      "updatedAt": "2026-02-15T08:30:00.000Z"
    }
  ],
  "books": [ /* same array of books */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 42
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid query parameter |
| `401` | Not authenticated |

---

### 3.2 `GET /api/books/:id`
Retrieve full details for a single active book, including copy availability.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Path parameter**: `id` — positive integer book ID.

**Availability rule**: A copy is borrowable when `status = 'Available'` AND `condition = 'Good'`.

**Success `200`**
```json
{
  "data": {
    "id": 5,
    "bookId": 5,
    "title": "Introduction to Algorithms",
    "isbn": "978-0-262-04630-5",
    "description": "...",
    "coverImageUrl": "https://...",
    "publisher": "MIT Press",
    "publicationYear": 2009,
    "language": "English",
    "price": "89.99",
    "status": "Active",
    "author": { "id": 3, "name": "Thomas Cormen" },
    "authors": [{ "id": 3, "name": "Thomas Cormen" }],
    "category": { "id": 2, "name": "Computer Science" },
    "availability": {
      "availableCopies": 2,
      "totalUsableCopies": 4
    },
    "availableCopies": 2,
    "isArchived": false,
    "createdAt": "2026-01-10T12:00:00.000Z",
    "updatedAt": "2026-02-15T08:30:00.000Z"
  },
  "book": { /* same clean book object */ }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | `id` is not a positive integer |
| `401` | Not authenticated |
| `404` | Book not found or not active |

---

### 3.3 `GET /api/books/top`
Returns the top most-borrowed books ranked by total loan count (books that were actually picked up, i.e. `borrowed_books.status IN ('Borrowed', 'Returned')`).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `limit` | integer | `10` | 1 to 50 |

**Success `200`**
```json
{
  "data": [
    {
      "id": 1,
      "bookId": 1,
      "title": "Introduction to Algorithms",
      "loanCount": 42,
      "isbn": "978-0-262-04630-5",
      "description": "...",
      "coverImageUrl": "https://...",
      "author": { "id": 3, "name": "Thomas Cormen" },
      "authors": [{ "id": 3, "name": "Thomas Cormen" }],
      "category": { "id": 2, "name": "Computer Science" },
      "availability": {
        "availableCopies": 3,
        "totalUsableCopies": 5
      },
      "availableCopies": 3
    }
  ],
  "books": [ /* same array of top books */ ]
}
```

Each item matches the frontend `PopularBook` type (`bookId`, `title`, `loanCount`) plus extra display fields (`author`, `coverImageUrl`, `category`, `availability`) so the frontend can render cards without a second API call.

**Errors**
| Code | Meaning |
|---|---|
| `400` | `limit` is not a valid integer from 1 to 50 |
| `401` | Not authenticated |

---

## 4. Borrow Requests

**Prefix**: `/api/borrow-requests`  
All routes require authentication (cookie).

### Business rules enforced by this group

| Rule | Detail |
|---|---|
| **Borrow limit** | Max **10** concurrent active loans (`'Borrowed'`) + open requests (`'Pending'`, `'Approved'`) per student (`MAX_ACTIVE_BORROWS = 10`). Enforced on request submission and review approval. |
| **Same-book limit** | Max **2** concurrent active loans + open requests per `book_id` per student (`MAX_COPIES_PER_BOOK = 2`). |
| **Loan Timeline Selection** | The student selects the desired borrowing timeline in the frontend from a dropdown (e.g. 1 to 14 days, with standard options like 3, 5, 7, 14 days). Sent as `requested_days: <integer>` in the JSON body and stored as a standard scalar `smallint` in `borrow_requests.requested_days` (1..`MAX_REQUEST_DAYS = 14`, DB hard limit 60). |
| **Eligibility check** | Evaluated via `borrowEligibilityService`: user status must be `Active`, role `Student`, active academic term must exist, student verification for active term must be `Approved` and in-date, and student must have **no active/unpaid penalties** (`v_user_active_penalties`). |
| **Availability rule** | A copy is borrowable only when `status = 'Available'` AND `condition_status = 'Good'`. |
| **Duplicate prevention** | A student cannot submit a new request for a book if they already have an active request in status `Pending` or `Approved` for that book (guarded by partial unique index). |
| **Audit logging** | All write transactions set the transaction-local session setting `app.user_id` so database audit triggers record the actor. |

---

### 4.1 `POST /api/borrow-requests`
Submit a new borrow request for an active book. The system automatically performs a comprehensive flag check, assigns an available copy, auto-approves the request, and creates the reservation loan record in `borrowed_books`.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Automated System Flag Validation:**
Before creating a request, the system checks all student eligibility flags:
1. **Account Status & Email Verification**: Must be `Active` with role `Student` and verified email (`email_verified: true`). If email is not verified, rejects with `EMAIL_NOT_VERIFIED`.
2. **Academic Term & COR Verification**: Active term must exist, and student's COR for that term must be `Approved` (and not expired).
3. **Account Suspensions**: Student must have no active suspensions.
4. **Penalties**: Student must have no unpaid/active penalties.
5. **Same-Book Limit**: Must not exceed max **2** concurrent copies for this title (`MAX_COPIES_PER_BOOK = 2`).
6. **Total Loan Limit**: Must not exceed max **10** active library loans/reservations (`MAX_ACTIVE_BORROWS = 10`).
7. **Copy Availability**: Book must have at least one copy in `Available` status with `condition_status = 'Good'`.

> **Note on Rejections**: If any single flag is triggered or no copy is available, the request is rejected immediately. The response body is **strictly a message** stating why it was rejected based on the detected flag. Common rejection reasons include `"Student email address must be verified before borrowing."` (`EMAIL_NOT_VERIFIED`).

**Request body**
```json
{
  "book_id": 5,
  "requested_days": 7
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `book_id` | integer | Yes | Positive integer ID of an Active book. |
| `requested_days` | integer | Yes | Duration in days (1 to `MAX_REQUEST_DAYS`, default max 14). Selected via frontend dropdown. |

**Success `201`** (Copy auto-assigned and loan record created)
```json
{
  "message": "Borrow request approved and copy reserved successfully.",
  "request": {
    "id": 101,
    "userId": 9001,
    "bookId": 5,
    "requestedDurationDays": 7,
    "status": "Approved",
    "requestedAt": "2026-10-18T06:00:00.000Z",
    "pickupDeadline": "2026-10-21T06:00:00.000Z",
    "assignedCopyId": 42,
    "loan": {
      "borrowId": 80,
      "copyId": 42,
      "status": "Reserved"
    }
  }
}
```

**Flag Rejection Error Responses (`400`, `403`, `409`)**
When a request fails flag verification, the API returns a response containing only the explanatory message:
```json
{
  "message": "Borrowing rejected: Student enrollment verification is required for the active academic term."
}
```
*Other example messages:*
- `"Borrowing rejected: You have reached the limit of 2 active copies for this title."`
- `"Borrowing rejected: You have reached the maximum allowed limit of 10 active book loans/requests."`
- `"Borrowing rejected: No available copies are currently in good condition for this book. Please join the reservation queue instead."`
- `"Borrowing rejected: Student has 1 active penalty/penalties with total balance of 50.00."`

---

### 4.2 `GET /api/borrow-requests/mine`
List the authenticated student's own borrow requests (newest first, paginated).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `page` | integer | `1` | Positive integer |
| `limit` | integer | `10` | Positive integer up to 50 |
| `status` | string | — (all) | `Pending`, `Approved`, `Rejected`, `Cancelled`, `Fulfilled`, `Expired` |

**Success `200`**
```json
{
  "requests": [
    {
      "id": 101,
      "bookId": 5,
      "bookTitle": "Design Patterns",
      "author": "Erich Gamma, Richard Helm",
      "requestedDurationDays": 7,
      "requestedAt": "2026-10-11T09:00:00.000Z",
      "status": "Pending",
      "remarks": null,
      "decisionReason": null,
      "pickupDeadline": null
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid query parameter |
| `401` | Authentication required |
| `403` | Role is not Student |

---

### 4.3 `GET /api/borrow-requests`
Review queue for staff — lists pending requests (or filtered by status), oldest first. Includes book details, student profile, and a live eligibility assessment.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `status` | string | `Pending` | Request status filter |
| `page` | integer | `1` | Positive integer |
| `limit` | integer | `10` | Positive integer up to 50 |

**Success `200`**
```json
{
  "requests": [
    {
      "id": 101,
      "userId": 9001,
      "bookId": 5,
      "requestedDurationDays": 7,
      "requestedAt": "2026-10-11T09:00:00.000Z",
      "status": "Pending",
      "reviewedBy": null,
      "reviewedAt": null,
      "pickupDeadline": null,
      "decisionReason": null,
      "remarks": null,
      "book": {
        "id": 5,
        "title": "Design Patterns",
        "isbn": "978-0201633610"
      },
      "student": {
        "id": 9001,
        "name": "Jane Doe",
        "studentNumber": "SN-2024-001",
        "college": "CCS",
        "program": "BSIT",
        "yearLevel": 3
      },
      "eligibility": {
        "eligible": true,
        "reasonCodes": [],
        "reasons": []
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid query parameter |
| `401` | Authentication required |
| `403` | Role is not Librarian or Admin |

---

### 4.4 `GET /api/borrow-requests/:id/available-copies`
List available copies in 'Good' condition for the book associated with this request, so the librarian can select a specific physical copy for assignment.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Path parameter**: `id` — positive integer borrow request ID.

**Success `200`**
```json
{
  "copies": [
    {
      "copy_id": 12,
      "accession_no": "ACC-00012",
      "shelf_location": "Shelf B-3"
    }
  ]
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid request ID |
| `401` | Authentication required |
| `403` | Role not allowed |
| `404` | Request not found |

---

### 4.5 `POST /api/borrow-requests/:id/review`
Approve or reject a **Pending** borrow request. Atomic transaction with row-level lock.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Path parameter**: `id` — positive integer borrow request ID.

**Request body**
```json
{
  "decision": "approve",
  "copy_id": 12,
  "remarks": "Optional approval note"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `decision` | string | Yes | `"approve"` or `"reject"` |
| `remarks` | string | Required if rejecting | Notes up to 2000 characters |
| `copy_id` | integer | Optional | Specific copy ID to assign. If omitted on approval, system auto-selects an available good copy using `FOR UPDATE SKIP LOCKED`. |

**Approval Side-effects (atomic)**:
- Re-verifies student eligibility, 10-loan max limit, and 2-copy-per-title limit.
- Locks selected/auto-picked copy and sets `book_copies.status` → `'Reserved'`.
- Inserts `borrowed_books` record with `status: 'Reserved'`, `assigned_by`, `assigned_at`, `due_date: NULL`, `issued_by: NULL`.
- Sets `borrow_requests` status → `'Approved'`, `reviewed_by`, `reviewed_at`, and `pickup_deadline` (`now + PICKUP_WINDOW_DAYS = 3 days`).

**Success `200` (Approval)**
```json
{
  "message": "Request approved and copy reserved.",
  "requestId": 101,
  "borrowId": 55,
  "copyId": 12,
  "pickupDeadline": "2026-10-14T09:00:00.000Z"
}
```

**Success `200` (Rejection)**
```json
{
  "message": "Request rejected successfully.",
  "requestId": 101,
  "status": "Rejected",
  "remarks": "Reason for rejection"
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation error (invalid decision, missing remarks on rejection, etc.) |
| `401` | Authentication required |
| `403` | Role not allowed |
| `404` | Request not found |
| `409` | Request not in Pending status, student ineligible (`STUDENT_INELIGIBLE`), limits exceeded (`MAX_COPIES_PER_BOOK_EXCEEDED`, `MAX_ACTIVE_BORROWS_EXCEEDED`), or copy not available (`NO_COPY_AVAILABLE`) |

---

### 4.6 `POST /api/borrow-requests/:id/approve`
*(Role: Librarian, Admin)* Dedicated endpoint to approve a pending borrow request, auto-assigning (or selecting) an available copy and reserving it.

**Request body**
```json
{
  "copy_id": 12,
  "remarks": "Approved by librarian"
}
```

**Success `200`**
```json
{
  "message": "Request approved and copy reserved.",
  "requestId": 101,
  "borrowId": 55,
  "copyId": 12,
  "pickupDeadline": "2026-10-15T09:00:00.000Z"
}
```

---

### 4.7 `POST /api/borrow-requests/:id/reject`
*(Role: Librarian, Admin)* Dedicated endpoint to reject a pending borrow request with a required reason.

**Request body**
```json
{
  "remarks": "Course limit exceeded"
}
```

**Success `200`**
```json
{
  "message": "Request rejected successfully.",
  "requestId": 101,
  "status": "Rejected",
  "remarks": "Course limit exceeded"
}
```

---

### 4.8 `POST /api/borrow-requests/:id/confirm-handover`
*(Role: Librarian, Admin)* (Alias: `POST /api/borrow-requests/:id/pickup`)
Confirm book handover by request ID. Releases the reserved copy to the student as an active loan (`status = 'Borrowed'`).

**Request body (optional barcode scan verification):**
```json
{
  "copy_barcode": "ACC-00012"
}
```

**Success `200`**
```json
{
  "message": "Book pickup confirmed successfully.",
  "id": 55,
  "borrowId": 55,
  "requestId": 101,
  "borrowDate": "2026-10-12T10:00:00.000Z",
  "dueAt": "2026-10-26",
  "dueDate": "2026-10-26",
  "status": "Borrowed"
}
```

---

### 4.9 `POST /api/borrow-requests/:id/reject-handover`
*(Role: Librarian, Admin)* Reject handover at the pickup desk. Cancels the reservation, releases the assigned copy back to `Available`, and marks request as `Rejected`.

**Request body:**
```json
{
  "remarks": "Student presented invalid ID",
  "reason_code": "STUDENT_NOT_PRESENT"
}
```

**Success `200`**
```json
{
  "message": "Pickup request rejected successfully. The assigned copy has been released.",
  "requestId": 101,
  "borrowId": 55,
  "copyId": 12,
  "status": "Rejected",
  "copyStatus": "Available",
  "remarks": "[STUDENT_NOT_PRESENT] Student presented invalid ID"
}
```

---

## 5. Borrowed Books

**Prefix**: `/api/borrowed-books`  
All routes require authentication (cookie).

### 5.1 `GET /api/borrowed-books/mine`
List the authenticated student's own loans (Reserved for pickup or on loan). Students can never access other students' loans.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Query parameters**

| Param | Type | Allowed values |
|---|---|---|
| `status` | string | `Reserved`, `Borrowed`, `Returned`, `Lost`, `Cancelled` |

**Success `200`**
```json
{
  "loans": [
    {
      "id": 55,
      "borrowId": 55,
      "bookId": 5,
      "book": {
        "id": 5,
        "title": "Design Patterns",
        "coverImageUrl": "https://example.com/cover.jpg",
        "author": "Erich Gamma, Richard Helm"
      },
      "copyId": 12,
      "accessionNo": "ACC-00012",
      "shelfLocation": "Shelf B-3",
      "status": "Reserved",
      "pickupDeadline": "2026-10-14T09:00:00.000Z",
      "borrowedAt": null,
      "dueAt": null,
      "dueDate": null,
      "daysRemaining": null,
      "isOverdue": false
    }
  ]
}
```

---

### 5.2 `GET /api/borrowed-books`
Staff list of borrowed books (Reserved or Borrowed). Searchable by `student_number`, student name, `accession_no`, and book `title`.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `status` | string | — (all) | `Reserved`, `Borrowed`, etc. (comma-separated supported) |
| `search` | string | — | Filter across student number, name, accession number, or title |
| `page` | integer | `1` | Positive integer |
| `limit` | integer | `10` | Positive integer up to 50 |

**Success `200`**
```json
{
  "loans": [
    {
      "id": 55,
      "borrowId": 55,
      "requestId": 101,
      "status": "Reserved",
      "borrowedAt": null,
      "dueAt": null,
      "dueDate": null,
      "pickupDeadline": "2026-10-14T09:00:00.000Z",
      "book": {
        "id": 5,
        "title": "Design Patterns",
        "isbn": "978-0201633610"
      },
      "copy": {
        "id": 12,
        "accessionNo": "ACC-00012",
        "shelfLocation": "Shelf B-3"
      },
      "student": {
        "id": 9001,
        "userId": 9001,
        "studentNumber": "SN-2024-001",
        "name": "Jane Doe",
        "email": "jane@university.edu"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 5.3 `GET /api/borrowed-books/:id/pickup-check`
Read-only pre-pickup verification check. Lazily expires stale pickups, re-checks student borrow eligibility, inspects active penalties and verification, and returns whether the book can be released.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Path parameter**: `id` — positive integer borrow ID (`borrow_id`).

**Success `200`**
```json
{
  "can_release": true,
  "reasons": [],
  "penalties": {
    "list": [],
    "total_balance": 0
  },
  "verification": {
    "term_name": "A.Y. 2026-2027 1st Semester",
    "status": "Approved",
    "valid_from": "2026-09-01",
    "valid_until": "2027-01-31"
  },
  "pickup_deadline": "2026-10-14T09:00:00.000Z"
}
```

---

### 5.4 `POST /api/borrowed-books/:id/pickup`
Mark an approved and reserved book as picked up and borrowed. Executed in a single atomic transaction through `withActor` with row-level locks on `borrowed_books`, `borrow_requests`, and `book_copies`.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Path parameter**: `id` — positive integer borrow ID (`borrow_id`).

**Verification steps**:
1. Checks that loan is in `'Reserved'` and request is in `'Approved'`.
2. Validates that current time `<= pickup_deadline`. If expired, transitions request to `'Expired'`, loan to `'Cancelled'`, and copy to `'Available'`, returning `409 PICKUP_EXPIRED`.
3. Re-verifies student borrow eligibility (active account, valid term verification, no active unpaid penalties). If ineligible, rejects release with `409 STUDENT_INELIGIBLE`.
4. Re-verifies max active borrow limit (`MAX_ACTIVE_BORROWS = 10`).

**Release Side-effects (atomic)**:
- Sets `borrowed_books.status` → `'Borrowed'`, `borrow_date = now`, `due_date = CURRENT_DATE + requested_days`, `issued_by = req.user.id`, `picked_up_at = now`.
- Sets `book_copies.status` → `'Borrowed'`.
- Sets `borrow_requests.status` → `'Fulfilled'`.

**Success `200`**
```json
{
  "message": "Book pickup confirmed successfully.",
  "id": 55,
  "borrowId": 55,
  "borrowDate": "2026-10-11T10:00:00.000Z",
  "dueAt": "2026-10-18",
  "dueDate": "2026-10-18",
  "status": "Borrowed"
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid borrow ID |
| `401` | Authentication required |
| `403` | Role not allowed |
| `404` | Loan or request not found |
| `409` | Loan not in Reserved status (`INVALID_STATUS`), pickup deadline expired (`PICKUP_EXPIRED`), student ineligible (`STUDENT_INELIGIBLE`), or max active borrows exceeded |

---

### 5.5 `POST /api/borrowed-books/:id/reject-pickup`
*(Role: Librarian, Admin)* (Alias: `POST /api/borrowed-books/:id/reject`)
Reject handover by loan/borrow ID (`borrow_id`). Cancels the loan (`status = 'Cancelled'`), releases the assigned copy back to `Available`, and marks the request as `Rejected`.

**Request body:**
```json
{
  "remarks": "Student did not claim before counter close",
  "reason_code": "STUDENT_NOT_PRESENT"
}
```

**Success `200`**
```json
{
  "message": "Pickup request rejected successfully. The assigned copy has been released.",
  "requestId": 101,
  "borrowId": 55,
  "copyId": 12,
  "status": "Rejected",
  "copyStatus": "Available",
  "remarks": "[STUDENT_NOT_PRESENT] Student did not claim before counter close"
}
```

---

## 6. Common Error Responses

Error responses return JSON with standardized message and error code structures:

```json
{
  "code": "ERROR_CODE",
  "message": "Detailed description of the issue.",
  "error": "Detailed description of the issue.",
  "reasons": [
    {
      "code": "ACTIVE_PENALTY",
      "message": "Student has 1 active penalty/penalties with total balance of 50.00."
    }
  ]
}
```

| HTTP Status | Primary Meaning | Common Business Codes |
|---|---|---|
| `400 Bad Request` | Missing or malformed parameters / body payload | `INVALID_REQUESTED_DAYS`, `REMARKS_REQUIRED` |
| `401 Unauthorized` | Missing, expired, or invalid session cookie | `UNAUTHORIZED` |
| `403 Forbidden` | Insufficient role or student ineligible to borrow | `BORROW_INELIGIBLE` (`USER_NOT_ACTIVE`, `NO_ACTIVE_TERM`, `VERIFICATION_REQUIRED`, `VERIFICATION_PENDING`, `VERIFICATION_REJECTED`, `VERIFICATION_EXPIRED`, `ACTIVE_PENALTY`) |
| `404 Not Found` | Requested book, request, or loan does not exist | `BOOK_NOT_FOUND`, `REQUEST_NOT_FOUND`, `LOAN_NOT_FOUND` |
| `409 Conflict` | Business constraint violation | `DUPLICATE_REQUEST`, `NO_COPY_AVAILABLE`, `MAX_COPIES_PER_BOOK_EXCEEDED`, `MAX_ACTIVE_BORROWS_EXCEEDED`, `STUDENT_INELIGIBLE`, `PICKUP_EXPIRED`, `INVALID_STATUS` |
| `500 Internal Server Error` | Unexpected server exception (logged internally, not leaked) | `INTERNAL_SERVER_ERROR` |

---

## 7. Academic Terms & COR Verification

### Term Schedule Rules
- **1st Term (First Semester):** August 1 to December 31 (`YYYY-08-01` to `YYYY-12-31`). Deadline: `YYYY-12-31`.
- **2nd Term (Second Semester):** January 1 to May 31 (`YYYY-01-01` to `YYYY-05-31`). Deadline: `YYYY-05-31`.
- **Summer Term:** June 1 to July 31 (`YYYY-06-01` to `YYYY-07-31`). Deadline: `YYYY-07-31`.

### Verification Lifecycle Rules
1. **Approval Date Determines Term:** When staff approves a COR verification, the academic term is dynamically assigned based on the approval date.
2. **Start Date (`valid_from`):** Populated with the approval date (`YYYY-MM-DD`).
3. **End Date / Deadline (`valid_until`):** Always set to the end of the month of the respective term (`12-31`, `05-31`, or `07-31`).
4. **Expiration (`status = 'Expired'`):** When the current date passes `valid_until`, the COR status becomes `Expired`, and borrowing is blocked with `VERIFICATION_EXPIRED`.

### 7.1 `GET /api/academic-terms`
Returns the list of academic terms sorted by start date.

**Success `200`**
```json
[
  {
    "id": 1,
    "termId": 1,
    "term_id": 1,
    "name": "1st Semester 2026-2027",
    "startDate": "2026-08-01",
    "endDate": "2026-12-31",
    "corDeadline": "2026-12-31",
    "status": "Active"
  }
]
```

### 7.2 `GET /api/me/verifications`
*(Alias: `GET /api/verifications/me`)*  
Returns the authenticated student's COR verifications.

**Success `200`**
```json
[
  {
    "id": 1,
    "verificationId": 1,
    "userId": 42,
    "termId": 1,
    "termName": "1st Semester 2026-2027",
    "status": "Approved",
    "validFrom": "2026-10-12",
    "validUntil": "2026-12-31",
    "submittedAt": "2026-10-10T08:00:00.000Z",
    "reviewedAt": "2026-10-12T09:30:00.000Z"
  }
]
```

### 7.3 `POST /api/me/verifications`
*(Alias: `POST /api/verifications`)*  
Submits a student COR proof document. Supports two upload modes: **multipart file upload** (camera capture / file picker) or **JSON body with base64-encoded image data**. Previous pending verifications for the same term are automatically superseded. Creates a `COR_SUBMITTED` notification for the student.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |
| **Max file size** | 10 MB |
| **Allowed types** | JPEG, PNG, WEBP, PDF |

**Mode 1: Multipart/form-data (file upload)**
```
Content-Type: multipart/form-data

file: <binary image/pdf>
```

**Mode 2: JSON body (base64 / data URL)**
```json
{
  "proof_file": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

**Success `201`**
```json
{
  "id": "1",
  "verificationId": "1",
  "userId": "42",
  "termId": "1",
  "termName": "1st Semester 2026-2027",
  "status": "Pending",
  "validFrom": null,
  "validUntil": null,
  "submittedAt": "2026-10-21T08:00:00.000Z",
  "reviewedAt": null,
  "originalFileName": "camera_cor.jpg",
  "proofFile": "cor_42_1729497600000_a1b2c3d4.jpg"
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | No file / image data provided |
| `401` | Not authenticated |
| `422` | Invalid file type or file exceeds 10 MB |

---

### 7.4 `GET /api/me/verifications/:id/document`
Securely streams the stored COR document to the student who owns it. Files are served inline from private storage with appropriate MIME type detection. Prevents directory traversal.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student (owner) or Staff |

**Success `200`**: Binary stream with headers:
- `Content-Type`: detected MIME type (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`)
- `Content-Disposition`: `inline; filename="cor_42_..._a1b2c3d4.jpg"`
- `Cache-Control`: `private, no-cache, no-store, must-revalidate`

**Errors**
| Code | Meaning |
|---|---|
| `401` | Not authenticated |
| `403` | Not the owner and not Staff |
| `404` | Verification record or file not found |

---

### 7.5 `GET /api/staff/verifications`
*(Role: Librarian, Admin)* Lists the verification queue with optional `?status=Pending` and `?search=`. Now includes student profile details (student number, college, course) and the stored proof file name.

**Success `200`**
```json
{
  "verifications": [
    {
      "id": "1",
      "verificationId": "1",
      "userId": "42",
      "termId": "1",
      "termName": "1st Semester 2026-2027",
      "status": "Pending",
      "submittedAt": "2026-10-21T08:00:00.000Z",
      "originalFileName": "cor_42_1729497600000_a1b2c3d4.jpg",
      "proofFile": "cor_42_1729497600000_a1b2c3d4.jpg",
      "student": {
        "id": "42",
        "studentNumber": "2024-00001",
        "name": "Juan Dela Cruz",
        "email": "student@wmsu.edu.ph",
        "college": "College of Computer Studies",
        "course": "BS Information Technology"
      }
    }
  ]
}
```

---

### 7.6 `POST /api/staff/verifications/:id/approve`
*(Role: Librarian, Admin)* (Alias: `POST /api/verifications/:id/approve`)
Approves student COR, setting `valid_from` to the approval date, `valid_until` to the term's end date, and status to `Approved`. Creates a `COR_APPROVED` notification for the student.

**Payload:**
```json
{
  "remarks": "Approved"
}
```

---

### 7.7 `POST /api/staff/verifications/:id/reject`
*(Role: Librarian, Admin)* (Alias: `POST /api/verifications/:id/reject`)
Rejects student COR with a required reason. Student verification status remains unverified. Creates a `COR_REJECTED` notification for the student with the rejection reason.

**Payload:**
```json
{
  "reason": "Document blurred or invalid term"
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Reason is required and must not be empty |

---

### 7.8 `GET /api/staff/verifications/:id/document`
*(Role: Librarian, Admin)* Securely streams the stored COR proof document for staff review. Same streaming behavior as the student endpoint (7.4).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Success `200`**: Binary stream with detected MIME type.

**Errors**
| Code | Meaning |
|---|---|
| `401` | Not authenticated |
| `403` | Role not allowed |
| `404` | Verification record or file not found |

---

### COR File Storage

COR documents are stored in a **private file system** at `Server/storage/cor/` which is excluded from version control via `.gitignore`. Files are named `cor_<userId>_<timestamp>_<random>.ext` to prevent collisions and ensure traceability.

| Property | Detail |
|---|---|
| **Storage path** | `Server/storage/cor/` |
| **Max size** | 10 MB |
| **Allowed types** | JPEG, PNG, WEBP, PDF |
| **Security** | Directory traversal prevention via `path.basename()` |
| **Access** | Streaming only via authenticated API endpoints |

---

## 8. Reservations (FIFO Queue System)

**Prefix**: `/api/reservations`  
All routes require authentication (`auth_token` cookie).

### Overview & Dual-Checkpoint Flag Architecture

When a book has **0 available copies**, students can place a reservation to join the book's FIFO queue (`ORDER BY reservation_date ASC, reservation_id ASC`).

The system implements a **Dual-Checkpoint Flag Enforcement Architecture**:

```
[Student joins queue]
         │
  (Checkpoint 1) ──► Check flags (Email verification, COR, suspensions, penalties, limits)
         │           • If any flag exists (e.g. unverified email) ──► Reject with message only
         │           • Duplicate entry check ──► Reject if already waiting/ready
         ▼
[In FIFO Queue (status: 'Waiting')]
         │
         │  (A copy becomes 'Available' via Return, Cancellation, or Inventory Add)
         ▼
  (Checkpoint 2) ──► System Automated Queue Processor:
                     1. Inspects queue front (`ORDER BY reservation_date ASC`).
                     2. Re-evaluates student flags (Email verification, COR, account status, limits).
                     3. Flagged student? ──► Mark reservation 'Cancelled' with remarks:
                                              "Skipped: <flagReason>" (e.g. unverified email),
                                              and automatically advance to NEXT student.
                     4. Eligible student? ──► Lock available copy ('Reserved'),
                                              auto-create Approved BorrowRequest,
                                              create 'Reserved' row in `borrowed_books`,
                                              mark reservation 'Ready' with `expires_at`.
```

---

### 8.1 `POST /api/reservations`
Join the FIFO reservation queue for an out-of-stock book.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Request body**
```json
{
  "book_id": 5,
  "requested_days": 7
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `book_id` | integer | Yes | Positive integer ID of an Active book that has 0 available copies. |
| `requested_days` | integer | No | Loan duration desired once ready (default: 7 days, max 14). |

**Success `201`**
```json
{
  "message": "You have joined the reservation queue successfully.",
  "reservation": {
    "id": 12,
    "reservationId": 12,
    "bookId": 5,
    "bookTitle": "Clean Architecture",
    "status": "Waiting",
    "queuePosition": 1,
    "reservedAt": "2026-10-18T06:15:00.000Z"
  }
}
```

**Rejection Errors (`400`, `403`, `409`)**
Returns a message stating specifically why the reservation was rejected:
```json
{
  "message": "Reservation rejected: This book currently has 2 copy/copies available to borrow directly."
}
```
*Other common rejection messages:*
- `"Reservation rejected: Student email address must be verified before borrowing."`
- `"Reservation rejected: You are already in the reservation queue for this title."`
- `"Reservation rejected: Student enrollment verification is required for the active academic term."`
- `"Reservation rejected: Student account has active suspension(s)."`
- `"Reservation rejected: Student has 1 active penalty/penalties with total balance of 50.00."`
- `"Reservation rejected: You already have active loans, requests, or queue entries for this title, reaching the limit of 2 per title."`
- `"Reservation rejected: You have reached the maximum allowed limit of 10 active book loans/requests/reservations."`

---

### 8.2 `GET /api/reservations/mine`
List the authenticated student's own reservations, including dynamic real-time FIFO queue positions.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Query parameters**
| Param | Type | Constraints | Description |
|---|---|---|---|
| `status` | string | `Waiting`, `Ready`, `Fulfilled`, `Cancelled`, `Expired` | Optional filter by status |

**Success `200`**
```json
{
  "reservations": [
    {
      "id": 12,
      "reservationId": 12,
      "bookId": 5,
      "bookTitle": "Clean Architecture",
      "isbn": "9780134494166",
      "status": "Waiting",
      "queuePosition": 1,
      "reservedAt": "2026-10-18T06:15:00.000Z",
      "pickupDeadline": null,
      "closedAt": null,
      "remarks": "Requested loan duration: 7 days"
    },
    {
      "id": 8,
      "reservationId": 8,
      "bookId": 12,
      "bookTitle": "Introduction to Algorithms",
      "isbn": "9780262033848",
      "status": "Ready",
      "queuePosition": null,
      "reservedAt": "2026-10-15T10:00:00.000Z",
      "pickupDeadline": "2026-10-21T10:00:00.000Z",
      "closedAt": null,
      "remarks": "Copy assigned (145). Ready for pickup before deadline."
    }
  ]
}
```

---

### 8.3 `POST /api/reservations/:id/cancel`
Cancel a waiting or ready reservation. If the reservation was in `Ready` status, its assigned copy is automatically released and immediately dispatched to the next eligible student in the FIFO queue.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**URL Parameters**
- `id`: The reservation ID.

**Success `200`**
```json
{
  "message": "Reservation cancelled successfully.",
  "reservationId": 12,
  "status": "Cancelled"
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid reservation ID |
| `404` | Reservation not found or does not belong to student |
| `409` | Reservation status is not `Waiting` or `Ready` (e.g. already fulfilled or cancelled) |

---

### 8.4 `GET /api/reservations`
Staff endpoint to monitor the global reservation queues across books.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian, Admin |

**Query parameters**
| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status (`Waiting`, `Ready`, `Fulfilled`, `Cancelled`, `Expired`) |
| `book_id` | integer | Filter by specific book ID |

**Success `200`**
```json
{
  "reservations": [
    {
      "reservation_id": 12,
      "user_id": 9001,
      "book_id": 5,
      "status": "Waiting",
      "reservation_date": "2026-10-18T06:15:00.000Z",
      "expires_at": null,
      "remarks": "Requested loan duration: 7 days",
      "book": {
        "book_id": 5,
        "title": "Clean Architecture",
        "isbn": "9780134494166"
      },
      "student": {
        "user_id": 9001,
        "first_name": "Juan",
        "last_name": "Dela Cruz",
        "email": "student@wmsu.edu.ph"
      }
    }
  ]
}
```

---

## 9. Notifications

**Prefix**: `/api/notifications`  
All routes require authentication (`auth_token` cookie or `Authorization: Bearer <token>` header). Notifications are created automatically by the system during COR lifecycle events (submit, approve, reject).

### Notification Types

| Type | Trigger | Recipient |
|---|---|---|
| `COR_SUBMITTED` | Student submits a COR document | Student |
| `COR_APPROVED` | Staff approves a COR | Student |
| `COR_REJECTED` | Staff rejects a COR | Student |

### Notification Shape
```json
{
  "id": "1",
  "type": "COR_APPROVED",
  "title": "COR approved",
  "message": "Your COR for 1st Semester 2026-2027 was approved. It is valid until 2026-12-31. You can now borrow books.",
  "relatedEntityType": "STUDENT_VERIFICATION",
  "relatedEntityId": "5",
  "readAt": null,
  "createdAt": "2026-10-21T09:30:00.000Z"
}
```

---

### 9.1 `GET /api/notifications`
List the authenticated user's notifications (newest first, paginated).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Query parameters**
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `pageSize` | integer | `20` | Items per page (max 100) |
| `unreadOnly` | string | — | Set to `"true"` to return only unread notifications |

**Success `200`**
```json
{
  "items": [
    {
      "id": "1",
      "type": "COR_APPROVED",
      "title": "COR approved",
      "message": "Your COR for 1st Semester 2026-2027 was approved...",
      "relatedEntityType": "STUDENT_VERIFICATION",
      "relatedEntityId": "5",
      "readAt": null,
      "createdAt": "2026-10-21T09:30:00.000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

---

### 9.2 `GET /api/notifications/unread-count`
Returns the count of unread notifications for the authenticated user.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Success `200`**
```json
{
  "unreadCount": 5
}
```

---

### 9.3 `POST /api/notifications/:id/read`
Mark a single notification as read. Idempotent — calling on an already-read notification is a no-op.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user (owner) |

**Path parameter**: `id` — notification ID.

**Success `200`**
```json
{
  "id": "1",
  "type": "COR_APPROVED",
  "title": "COR approved",
  "message": "Your COR was approved...",
  "relatedEntityType": "STUDENT_VERIFICATION",
  "relatedEntityId": "5",
  "readAt": "2026-10-21T10:00:00.000Z",
  "createdAt": "2026-10-21T09:30:00.000Z"
}
```

**Errors**
| Code | Meaning |
|---|---|
| `404` | Notification not found or does not belong to user |

---

### 9.4 `POST /api/notifications/read-all`
Mark all of the authenticated user's unread notifications as read.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Success `200`**
```json
{
  "message": "All notifications marked as read."
}
```

---

## 10. Admin Account Management

**Prefix**: `/api/admin`  
All routes require authentication **and** the `Admin` role. Uses standard password creation (bcrypt, 10 salt rounds). Created accounts are immediately `Active` with `emailVerified: true`.

### Validation Rules (shared)

| Field | Rule |
|---|---|
| `email` | Valid email format, max 255 chars, must be unique |
| `password` | Min 8 chars, max 72 bytes, must contain at least 1 letter + 1 number |
| `firstName` / `first_name` | Required, max 100 chars, letters/spaces/periods/dashes only |
| `lastName` / `last_name` | Required, max 100 chars, letters/spaces/periods/dashes only |
| `employeeNumber` / `employee_number` | Optional, max 50 chars |

---

### 10.1 `POST /api/admin/librarians`
*(Alias: `POST /api/admin/create-librarian`)*
Creates a new Librarian account. The account is created with `role: "Librarian"`, `status: "Active"`, and `email_verified: true`. A row in the `librarians` table is also created.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Admin only |

**Request body**
```json
{
  "email": "librarian@wmsu.edu.ph",
  "password": "SecurePass123",
  "firstName": "Maria",
  "lastName": "Santos",
  "employeeNumber": "EMP-2024-001"
}
```

**Success `201`**
```json
{
  "message": "Librarian account created successfully.",
  "user": {
    "id": "15",
    "userId": "15",
    "email": "librarian@wmsu.edu.ph",
    "firstName": "Maria",
    "lastName": "Santos",
    "displayName": "Maria Santos",
    "role": "Librarian",
    "status": "Active",
    "employeeNumber": "EMP-2024-001",
    "emailVerified": true
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation error (invalid email, weak password, missing name) |
| `401` | Not authenticated |
| `403` | Not an Admin |
| `409` | Email already registered |

---

### 10.2 `POST /api/admin/admins`
*(Alias: `POST /api/admin/create-admin`)*
Creates a new Admin account. Same validation and behavior as Librarian creation, but with `role: "Admin"` and a row in the `admins` table.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Admin only |

**Request body**
```json
{
  "email": "admin2@wmsu.edu.ph",
  "password": "SecurePass456",
  "firstName": "Jose",
  "lastName": "Rizal",
  "employeeNumber": "EMP-2024-002"
}
```

**Success `201`**
```json
{
  "message": "Admin account created successfully.",
  "user": {
    "id": "16",
    "userId": "16",
    "email": "admin2@wmsu.edu.ph",
    "firstName": "Jose",
    "lastName": "Rizal",
    "displayName": "Jose Rizal",
    "role": "Admin",
    "status": "Active",
    "employeeNumber": "EMP-2024-002",
    "emailVerified": true
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation error |
| `401` | Not authenticated |
| `403` | Not an Admin |
| `409` | Email already registered |

---

## Appendix: Authentication Methods

The auth middleware now supports **two** token delivery methods (checked in order):

1. **HTTP-only cookie** (`auth_token`) — default, set by login
2. **Authorization header** (`Authorization: Bearer <token>`) — for API clients / testing

Both methods use the same JWT verification and user lookup logic.

---

## Appendix: Migration Required

### `20261021_create_notifications_table.sql`

Creates the `notifications` table with indexes:

```sql
CREATE TABLE IF NOT EXISTS public.notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(100),
    related_entity_id BIGINT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
```

---

*Generated: 2026-10-21 — Prestar Library Management System Backend v4*
