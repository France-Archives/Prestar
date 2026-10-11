# Prestar API Reference

> **Base URL**: `http://localhost:<PORT>/api`  
> **Auth mechanism**: HTTP-only cookie (`auth_token`) issued on login — sent automatically by the browser.  
> All protected routes validate the cookie via `authMiddleware`.  
> Role enforcement is done by `requireRole(["Admin","Librarian"])` (staff) or `requireRole(["Student"])`.

---

## Table of Contents

1. [Auth](#1-auth)
2. [Books](#2-books)
3. [Borrow Requests](#3-borrow-requests)
4. [Borrowed Books](#4-borrowed-books)
5. [Common Error Responses](#5-common-error-responses)

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
    "role": "Student"
  },
  "dashboard_url": "/student/dashboard"
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Missing or invalid token |

---

### 1.4 `POST /api/auth/signup`
Initiate registration and dispatch a 6-digit OTP code to the provided email via the official Gmail REST API. Enforces a **2-minute cooldown** between requests and a **maximum of 3 OTP requests**.

| Property | Value |
|---|---|
| **Auth required** | No |
| **Rate limited** | Yes (`signupRateLimiter`) |

**Request body**
```json
{
  "email": "student@example.edu",
  "password": "StrongPassword123!",
  "first_name": "Juan",
  "last_name": "Dela Cruz",
  "student_number": "2024-00001",
  "college": "College of Computer Studies",
  "course": "BS Information Technology",
  "year_level": 1,
  "student_type": "Regular"
}
```

**Success `200`**
```json
{
  "message": "OTP sent to your email. Please verify to complete your registration.",
  "email": "student@example.edu",
  "cooldown_seconds": 120,
  "remaining_otps": 2
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation error (missing or malformed fields) |
| `409` | Email or student number already registered |
| `429` | Cooldown active or maximum 3 OTP requests exceeded |

---

### 1.5 `POST /api/auth/signup/verify-otp`
Verify the 6-digit OTP code received via email and finalize account creation in `users` and `students` tables.

| Property | Value |
|---|---|
| **Auth required** | No |

**Request body**
```json
{
  "email": "student@example.edu",
  "otp": "123456"
}
```

**Success `201`**
```json
{
  "message": "Registration successful. You may now log in.",
  "user": {
    "id": 1,
    "email": "student@example.edu",
    "role": "Student",
    "student_number": "2024-00001",
    "first_name": "Juan",
    "last_name": "Dela Cruz"
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid OTP code or expired OTP |
| `404` | No pending registration found for the email |
| `409` | Email already registered |

---

### 1.6 `POST /api/auth/signup/resend-otp`
Resend a fresh 6-digit OTP code. Enforces a **2-minute cooldown** and a **maximum limit of 3 OTPs**.

| Property | Value |
|---|---|
| **Auth required** | No |
| **Rate limited** | Yes (`otpRateLimiter`: max 3 per 2 minutes) |

**Request body**
```json
{
  "email": "student@example.edu"
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
| `404` | No pending registration found |
| `429` | Cooldown in effect (wait remaining seconds) or 3 OTP limit reached |

---

## 2. Books

**Prefix**: `/api/books`  
All book routes require authentication (cookie).

### 2.1 `GET /api/books`
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
  "books": [ { "id": 1, "title": "...", "available_copies": 3 } ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid query parameter |
| `401` | Not authenticated |

---

### 2.2 `GET /api/books/:id`
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
  "book": {
    "id": 5,
    "title": "Introduction to Algorithms",
    "author": "...",
    "available_copies": 2,
    "copies": [ { "id": 12, "status": "Available", "condition": "Good" } ]
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | `id` is not a positive integer |
| `401` | Not authenticated |
| `404` | Book not found or not active |

---

## 3. Borrow Requests

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

### 3.1 `POST /api/borrow-requests`
Submit a new borrow request for an active book.

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
| `book_id` | integer | Yes | Positive integer ID of an Active book. |
| `requested_days` | integer | Yes | Duration in days (1 to `MAX_REQUEST_DAYS`, default max 14). Selected via frontend dropdown. |

**Success `201`**
```json
{
  "message": "Borrow request created successfully.",
  "request": {
    "request_id": 101,
    "user_id": 9001,
    "book_id": 5,
    "requested_days": 7,
    "status": "Pending",
    "request_date": "2026-10-11T09:00:00.000Z"
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Malformed input, or `requested_days` not in range 1..14 |
| `401` | Authentication required or expired session |
| `403` | Student ineligible (account inactive, term missing, unapproved verification, or active penalties) |
| `404` | Active book not found |
| `409` | `DUPLICATE_REQUEST` (already have pending/approved request), `NO_COPY_AVAILABLE` (no good available copy), `MAX_COPIES_PER_BOOK_EXCEEDED` (max 2 per title reached), or `MAX_ACTIVE_BORROWS_EXCEEDED` (max 10 active borrows reached) |

---

### 3.2 `GET /api/borrow-requests/mine`
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
      "request_id": 101,
      "book_id": 5,
      "book_title": "Design Patterns",
      "author": "Erich Gamma, Richard Helm",
      "requested_days": 7,
      "request_date": "2026-10-11T09:00:00.000Z",
      "status": "Pending",
      "remarks": null,
      "pickup_deadline": null
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

### 3.3 `GET /api/borrow-requests`
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
      "request_id": 101,
      "user_id": 9001,
      "book_id": 5,
      "requested_days": 7,
      "request_date": "2026-10-11T09:00:00.000Z",
      "status": "Pending",
      "reviewed_by": null,
      "reviewed_at": null,
      "pickup_deadline": null,
      "remarks": null,
      "book": {
        "book_id": 5,
        "title": "Design Patterns",
        "isbn": "978-0201633610"
      },
      "student": {
        "user_id": 9001,
        "name": "Jane Doe",
        "student_number": "SN-2024-001",
        "college": "CCS",
        "course": "BSIT",
        "year_level": 3
      },
      "eligibility": {
        "eligible": true,
        "reason_codes": [],
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

### 3.4 `GET /api/borrow-requests/:id/available-copies`
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

### 3.5 `POST /api/borrow-requests/:id/review`
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
  "request_id": 101,
  "borrow_id": 55,
  "copy_id": 12,
  "pickup_deadline": "2026-10-14T09:00:00.000Z"
}
```

**Success `200` (Rejection)**
```json
{
  "message": "Request rejected successfully.",
  "request_id": 101,
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

## 4. Borrowed Books

**Prefix**: `/api/borrowed-books`  
All routes require authentication (cookie).

### 4.1 `GET /api/borrowed-books/mine`
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
      "borrow_id": 55,
      "book": {
        "title": "Design Patterns",
        "cover_image": "https://example.com/cover.jpg",
        "author": "Erich Gamma, Richard Helm"
      },
      "accession_no": "ACC-00012",
      "shelf_location": "Shelf B-3",
      "status": "Reserved",
      "pickup_deadline": "2026-10-14T09:00:00.000Z",
      "borrow_date": null,
      "due_date": null,
      "days_remaining": null,
      "is_overdue": false
    }
  ]
}
```

---

### 4.2 `GET /api/borrowed-books`
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
      "borrow_id": 55,
      "request_id": 101,
      "status": "Reserved",
      "borrow_date": null,
      "due_date": null,
      "pickup_deadline": "2026-10-14T09:00:00.000Z",
      "book": {
        "book_id": 5,
        "title": "Design Patterns",
        "isbn": "978-0201633610"
      },
      "copy": {
        "copy_id": 12,
        "accession_no": "ACC-00012",
        "shelf_location": "Shelf B-3"
      },
      "student": {
        "user_id": 9001,
        "student_number": "SN-2024-001",
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

### 4.3 `GET /api/borrowed-books/:id/pickup-check`
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

### 4.4 `POST /api/borrowed-books/:id/pickup`
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
  "borrow_id": 55,
  "borrow_date": "2026-10-11T10:00:00.000Z",
  "due_date": "2026-10-18",
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

## 5. Common Error Responses

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

*Generated: 2026-10-11 — Prestar Library Management System Backend v3*

