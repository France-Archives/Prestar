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
4. [Notifications](#4-notifications)
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
| **Borrow limit** | Max **10** concurrent active loans + open requests. Enforced under row-level lock on the student record to prevent race conditions. |
| **Suspension check** | Blocked when the student has an `Active` suspension where `start_date <= TODAY` and (`end_date IS NULL` OR `end_date >= TODAY`). |
| **Same-book limit** | Max **2** active or open loans/requests per `book_id` per student. |
| **Availability rule** | A copy is borrowable only when `status = 'Available'` AND `condition = 'Good'`. Used consistently for listing, eligibility checks, and approval. |

---

### 3.1 `POST /api/borrow-requests`
Create a new borrow request for a book.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Request body**
```json
{ "book_id": 5 }
```

**Success `201`**
```json
{
  "request": {
    "id": 99,
    "user_id": 1,
    "book_id": 5,
    "status": "Pending",
    "created_at": "2026-10-08T12:00:00.000Z"
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | `book_id` is not a positive integer |
| `401` | Not authenticated |
| `403` | Role is not Student, or account is suspended |
| `409` | No borrowable copy available, borrow limit reached, or same-book limit (2) reached |

---

### 3.2 `GET /api/borrow-requests/mine`
List the authenticated student's own borrow requests.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Query parameters**

| Param | Type | Default | Allowed values |
|---|---|---|---|
| `status` | string | — (all) | `Pending`, `Approved`, `Issued`, `Rejected`, `Cancelled`, `Expired` |

**Success `200`**
```json
{
  "requests": [ { "id": 99, "book_id": 5, "status": "Pending" } ]
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid `status` value |
| `401` | Not authenticated |
| `403` | Role is not Student |

---

### 3.3 `GET /api/borrow-requests`
List all borrow requests — staff view.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Admin or Librarian |

**Query parameters** — same `status` filter as 3.2.

**Success `200`**
```json
{
  "requests": [ { "id": 99, "user_id": 1, "book_id": 5, "status": "Pending" } ]
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid `status` value |
| `401` | Not authenticated |
| `403` | Role is not Admin or Librarian |

---

### 3.4 `POST /api/borrow-requests/:id/review`
Approve or reject a **Pending** borrow request.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Admin or Librarian |

**Path parameter**: `id` — positive integer request ID.

**Request body**
```json
{
  "decision": "approve",
  "remarks": "Optional notes (required when rejecting)"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `decision` | string | Yes | `"approve"` or `"reject"` |
| `remarks` | string | Only when rejecting | Max 2000 chars |

**Approval side-effects (atomic)**:
- Selects a borrowable copy (`status = 'Available'`, `condition = 'Good'`).
- Marks copy status → `Reserved`.
- Sets request status → `Approved`.

**Success `200`**
```json
{
  "request": { "id": 99, "status": "Approved", "copy_id": 12 }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation failure |
| `401` | Not authenticated |
| `403` | Role not allowed |
| `404` | Request not found |
| `409` | Request is not Pending, or no borrowable copy available |

---

### 3.5 `POST /api/borrow-requests/:id/confirm-pickup`
Confirm physical pickup of an **Approved** request, creating an active loan.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Admin or Librarian |

**Path parameter**: `id` — positive integer request ID.

**Side-effects (atomic, with lock on student user row)**:
- Request status → `Issued`.
- Copy status → `Borrowed`.
- Creates a `borrowed_books` record; `due_date` computed from library rules.
- Re-verifies student borrow limit under lock to prevent concurrent-request races.

**Success `200`**
```json
{
  "borrow": {
    "id": 55,
    "request_id": 99,
    "copy_id": 12,
    "user_id": 1,
    "borrowed_at": "2026-10-08T12:00:00.000Z",
    "due_date": "2026-10-22T12:00:00.000Z"
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Not authenticated |
| `403` | Role not allowed, or student borrow limit exceeded at pickup time |
| `404` | Request not found |
| `409` | Request is not in Approved status |

---

### 3.6 `POST /api/borrow-requests/:id/cancel`
Cancel a **Pending** borrow request (student self-cancellation only).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Path parameter**: `id` — positive integer request ID.

**Side-effects**:
- Request status → `Cancelled`.
- If a copy was already reserved, its status reverts → `Available`.

**Success `200`**
```json
{
  "request": { "id": 99, "status": "Cancelled" }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Not authenticated |
| `403` | Not the owner, or not a Student |
| `404` | Request not found |
| `409` | Request is not in a cancellable state (must be Pending) |

---

## 4. Notifications

**Prefix**: `/api/notifications`  
All routes require authentication (cookie).

### 4.1 `GET /api/notifications`
Retrieve all notifications for the authenticated user.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Success `200`**
```json
{
  "notifications": [
    {
      "id": 7,
      "message": "Your borrow request for 'Clean Code' has been approved.",
      "is_read": false,
      "created_at": "2026-10-08T12:00:00.000Z"
    }
  ]
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Not authenticated |

---

### 4.2 `PATCH /api/notifications/:id/read`
Mark a specific notification as read.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user (must own the notification) |

**Path parameter**: `id` — positive integer notification ID.

**Success `200`**
```json
{
  "notification": { "id": 7, "is_read": true }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Not authenticated |
| `403` | Notification does not belong to the current user |
| `404` | Notification not found |

---

## 5. Common Error Responses

All error responses share this shape:
```json
{ "error": "Human-readable description." }
```

| HTTP Code | Meaning |
|---|---|
| `400 Bad Request` | Malformed input, missing required fields, or invalid parameter values |
| `401 Unauthorized` | Missing, expired, or invalid `auth_token` cookie |
| `403 Forbidden` | Authenticated but insufficient role, suspended account, or ownership mismatch |
| `404 Not Found` | Resource does not exist or route is not defined |
| `409 Conflict` | Business rule violation (limit exceeded, wrong state, no copy available, duplicate) |
| `410 Gone` | Proof-upload token expired |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server-side failure |

---

*Generated: 2026-10-08 — Prestar Library Management System Backend v1*
