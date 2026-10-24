# Prestar API Reference

> **Base URL**: `http://localhost:<PORT>/api`  
> **Auth mechanism**: HTTP-only cookie (`auth_token`) issued on login — sent automatically by the browser.  
> All protected routes validate the cookie via `authMiddleware`.  
> Role enforcement is done by `requireRole(["Admin","Librarian"])` (staff) or `requireRole(["Student"])`.

---

## Table of Contents

1. [Auth](#1-auth)
   - [Reading Interests & Personalized Recommendations](#19-reading-interests--personalized-recommendations)
2. [Student Dashboard](#2-student-dashboard)
3. [Books](#3-books)
   - [Categories (`GET /api/categories`, `POST /api/categories`)](#36-get-apicategories)
   - [Books by Category (`GET /api/categories/:id/books`)](#38-get-apicategoriesidbooks--get-apibookscategoryid)
4. [Borrow Requests](#4-borrow-requests)
5. [Borrowed Books](#5-borrowed-books)
6. [Common Error Responses](#6-common-error-responses)
7. [Academic Terms & COR Verification](#7-academic-terms--cor-verification)
8. [Reservations (FIFO Queue System)](#8-reservations-fifo-queue-system)
   - [Renewals](#8b-renewals)
9. [Notifications](#9-notifications)
10. [Admin Account Management & Audit Logs](#10-admin-account-management)
   - [Audit Logs (`GET /api/admin/audit-logs`)](#103-get-apiadminaudit-logs)
11. [Users](#11-users)
12. [Fines & Payments (Cash Only)](#12-fines--payments-cash-only)

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

### 1.7 `POST /api/auth/forgot-password`
Request a password-reset code (OTP). A 6-digit code is emailed to the account holder. The response is **always generic** — the API never confirms whether an email is registered, preventing user enumeration.

Cooldown and limits mirror the signup OTP flow: **2-minute cooldown** and **max 3 codes per 24-hour window** per email address.

| Property | Value |
|---|---|
| **Auth required** | No |
| **Rate limited** | Yes (`forgotPasswordLimiter`: 5 per 15 min per IP) |

**Request body**
```json
{ "email": "student@wmsu.edu.ph" }
```

**Success `200`** *(always returned, whether the email exists or not)*
```json
{
  "message": "If that email is registered, a reset code has been sent.",
  "email": "student@wmsu.edu.ph",
  "cooldown_seconds": 120
}
```

**Errors**
| Code | Meaning |
|---|---|
| `429` | Cooldown active, 24-hour send limit reached, or IP rate limit exceeded |
| `503` | Reset email could not be delivered |

> **Security note**: A `404` is never returned here. To check whether an account exists use the authenticated `GET /api/auth/me` endpoint instead.

---

### 1.8 `POST /api/auth/reset-password`
Verify the 6-digit reset code received via email and set a new password. The OTP record is destroyed immediately on success (single-use). The user's active session cookies are **not** invalidated automatically — the frontend should redirect to the login page.

| Property | Value |
|---|---|
| **Auth required** | No |
| **Rate limited** | Yes (`resetPasswordLimiter`: 10 per 15 min per IP) |

**Request body**
```json
{
  "email": "student@wmsu.edu.ph",
  "otp": "847291",
  "password": "NewStrongPassword1!",
  "confirmPassword": "NewStrongPassword1!"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | **Yes** | The account's email address. |
| `otp` | string | **Yes** | 6-digit code received via email. |
| `password` | string | **Yes** | New password (minimum 8 characters). Also accepted as `new_password` or `newPassword`. |
| `confirmPassword` | string | Optional | If provided, must match `password`. Also accepted as `confirm_password`. |

**Success `200`**
```json
{
  "message": "Password has been reset successfully. You may now log in."
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Missing fields, password too short, passwords don't match, invalid/expired OTP, or too many attempts |
| `404` | No password reset request found for this email |
| `429` | IP rate limit exceeded |

> **OTP policy**: Codes expire after **10 minutes**. After **5 failed attempts** the code is invalidated and a new one must be requested via `forgot-password`.

---

### 1.9 Reading Interests & Personalized Recommendations

#### `GET /api/interests`
List all available reading interests (categories from the catalog).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Success `200`**
```json
{
  "data": [
    { "id": "1", "categoryId": 1, "name": "Computer Science", "description": null },
    { "id": "2", "categoryId": 2, "name": "Mathematics", "description": null }
  ],
  "interests": [ /* same array */ ]
}
```

---

#### `GET /api/me/interests`
Retrieve the current student's selected category interests from `user_category_preferences`.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Success `200`**
```json
{
  "data": [
    { "id": "1", "categoryId": 1, "name": "Computer Science" }
  ],
  "interests": [ /* same array */ ]
}
```

---

#### `PUT /api/me/interests`
Update the student's selected category interests.
**Rule:** The user must choose **at least 1 interest** (`interestIds.length >= 1`). All selected IDs must exist in the `categories` table.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Request body**
```json
{
  "interestIds": [1, 2, 5]
}
```

**Success `200`**
```json
{
  "message": "Interests updated successfully.",
  "data": [
    { "id": "1", "categoryId": 1, "name": "Computer Science" },
    { "id": "2", "categoryId": 2, "name": "Mathematics" },
    { "id": "5", "categoryId": 5, "name": "Artificial Intelligence" }
  ],
  "interests": [ /* same array */ ]
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | At least 1 interest must be chosen (`VALIDATION_ERROR`) |
| `401` | Authentication required |
| `422` | One or more of the selected category IDs do not exist (`VALIDATION_ERROR`) |

---

#### `GET /api/me/recommended-books`
Retrieve personalized active book recommendations filtered to the student's chosen category interests. This same array is also returned dynamically in the student dashboard response (`GET /api/me/dashboard` ➔ `data.recommended`).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Success `200`**
```json
{
  "data": [
    {
      "id": 1,
      "bookId": 1,
      "title": "Introduction to Algorithms",
      "category": { "id": 2, "name": "Mathematics" },
      "availability": { "availableCopies": 3, "totalUsableCopies": 3 }
    }
  ],
  "books": [ /* same array */ ]
}
```

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
| `category_id` | integer | — | Positive integer (also accepts `categoryId` or `category`) |

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

### 3.4 `POST /api/books`
*(Role: Librarian, Admin)*  
Create a new book title in the catalog. Validates ISBN uniqueness, author and category foreign keys. Optionally creates initial physical copies.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Content Types Supported**
- `application/json`
- `multipart/form-data` (recommended when uploading an image file directly)

**Request body (JSON format)**
```json
{
  "title": "Clean Code",
  "isbn": "978-0-13-235088-4",
  "authorId": 7,
  "categoryId": 3,
  "publisher": "Prentice Hall",
  "publicationYear": 2008,
  "language": "English",
  "price": 45.00,
  "description": "A handbook of agile software craftsmanship.",
  "coverImageUrl": "https://example.com/clean-code.jpg",
  "initialCopies": 2
}
```

**Request body (`multipart/form-data` format)**
- Fields: `title`, `isbn`, `authorId`, `categoryId`, `publisher`, `publicationYear`, `language`, `price`, `description`, `initialCopies`
- File field: `coverImage` (or `cover_image`) — Image file (JPEG, PNG, WebP, max 5MB). The image will be uploaded to Supabase Storage and its public URL saved as the book's cover image.

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | **Yes** | Book title, 1–300 characters. |
| `isbn` | string | Optional | Up to 20 characters. Must be unique across all books. Auto-generated if omitted. |
| `authorId` | integer | **Yes** | ID of an existing author. Also accepts `authorIds: [id]` (first element used). |
| `categoryId` | integer | Optional | ID of an existing category. |
| `publisher` | string | Optional | Publisher name. |
| `publicationYear` | integer | Optional | 4-digit year (1000–3000). |
| `language` | string | Optional | Language of publication. |
| `price` | number | Optional | Non-negative decimal price. |
| `description` | string | Optional | Full book description. |
| `coverImageUrl` | string | Optional | URL to cover image (used if not uploading a file). |
| `coverImage` | file | Optional | File upload (`multipart/form-data` only). Automatically uploaded to Supabase Storage. Supports JPEG, PNG, WebP up to 5MB. |
| `initialCopies` | integer | Optional | Number of `Available`/`Good` copies to create alongside the book record (default `0`). |

**Success `201`**
```json
{
  "message": "Book created successfully.",
  "data": {
    "id": 42,
    "bookId": 42,
    "title": "Clean Code",
    "isbn": "978-0-13-235088-4",
    "description": "A handbook of agile software craftsmanship.",
    "publisher": "Prentice Hall",
    "publicationYear": 2008,
    "language": "English",
    "price": "45.00",
    "status": "Active",
    "coverImageUrl": "https://example.com/clean-code.jpg",
    "author": { "id": 7, "name": "Robert C. Martin" },
    "authors": [{ "id": 7, "name": "Robert C. Martin" }],
    "category": { "id": 3, "name": "Software Engineering" },
    "availability": { "availableCopies": 2, "totalUsableCopies": 2 },
    "isArchived": false
  },
  "book": { }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Missing title, invalid year, or invalid price |
| `401` | Authentication required |
| `403` | Role is not Librarian or Admin |
| `409` | ISBN already exists in catalog (`CONFLICT`) |
| `422` | Author not found, or category not found (`VALIDATION_ERROR`) |

---

### 3.5 `PATCH /api/books/:id` (or `PUT /api/books/:id`)
*(Role: Librarian, Admin)*  
Update any subset of a book's details. All fields are optional (partial update). Also handles archival/restoration of a title.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Path parameter**: `id` — positive integer book ID.

**Content Types Supported**
- `application/json`
- `multipart/form-data` (recommended when uploading a new cover image file)

**Request body (JSON format, all fields optional)**
```json
{
  "title": "Clean Code: Revised Edition",
  "isbn": "978-0-13-468599-1",
  "authorId": 7,
  "categoryId": 3,
  "publisher": "Prentice Hall",
  "publicationYear": 2024,
  "language": "English",
  "price": 55.00,
  "description": "Updated edition with new chapters.",
  "coverImageUrl": "https://example.com/clean-code-v2.jpg",
  "isArchived": false
}
```

**Request body (`multipart/form-data` format)**
- Fields: Any subset of `title`, `isbn`, `authorId`, `categoryId`, `publisher`, `publicationYear`, `language`, `price`, `description`, `isArchived`, `status`
- File field: `coverImage` (or `cover_image`) — Image file (JPEG, PNG, WebP, max 5MB). Uploads to Supabase Storage, replaces `cover_image` URL, and automatically removes the previous Supabase image file.

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Optional | Book title, 1–300 characters. |
| `isbn` | string | Optional | Up to 20 characters. Must be unique (excluding this book's own ISBN). |
| `authorId` | integer | Optional | Change the book's author. |
| `categoryId` | integer | Optional | Change the book's category. Set to `null` to clear. |
| `publisher` | string | Optional | Publisher name. Set to `null` to clear. |
| `publicationYear` | integer | Optional | 4-digit year (1000–3000). Set to `null` to clear. |
| `language` | string | Optional | Language. Set to `null` to clear. |
| `price` | number | Optional | Non-negative decimal. |
| `description` | string | Optional | Description. Set to `null` to clear. |
| `coverImageUrl` | string | Optional | Cover image URL. Set to `null` to clear. |
| `coverImage` | file | Optional | File upload (`multipart/form-data` only). Automatically uploaded to Supabase Storage. Replaces existing cover and cleans up old Supabase file. |
| `isArchived` | boolean | Optional | `true` to archive, `false` to restore. **Archiving is blocked if the book has active loans, pending requests, or active reservations.** |
| `status` | string | Optional | Alias: `"Archived"` to archive, `"Active"` to restore. |

**Success `200`**
```json
{
  "message": "Book updated successfully.",
  "data": {
    "id": 42,
    "bookId": 42,
    "title": "Clean Code: Revised Edition",
    "status": "Active",
    "isArchived": false,
    "author": { "id": 7, "name": "Robert C. Martin" },
    "category": { "id": 3, "name": "Software Engineering" },
    "availability": { "availableCopies": 2, "totalUsableCopies": 2 }
  },
  "book": { }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid title (empty), invalid year, or invalid price |
| `401` | Authentication required |
| `403` | Role is not Librarian or Admin |
| `404` | Book not found |
| `409` | ISBN conflict with another book (`CONFLICT`), or archiving blocked by active loans/requests/reservations (`INVALID_STATE`) |
| `422` | Author or category does not exist (`VALIDATION_ERROR`) |

---

### 3.6 `GET /api/categories`
List all available book categories, sorted alphabetically. Used to populate category dropdowns in the catalog and book creation/edit forms.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Success `200`**
```json
{
  "data": [
    { "id": "1", "categoryId": 1, "category_id": 1, "name": "Computer Science", "category_name": "Computer Science", "description": null },
    { "id": "2", "categoryId": 2, "category_id": 2, "name": "Mathematics", "category_name": "Mathematics", "description": "Pure and applied math" }
  ],
  "categories": [ /* same array of categories */ ]
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Authentication required |

---

### 3.7 `POST /api/categories`
*(Role: Librarian, Admin)*  
Add a new book category to the catalog. Validates uniqueness (case-insensitive).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Request Body**
```json
{
  "name": "Artificial Intelligence",
  "description": "Books on AI, ML, robotics, and neural networks"
}
```
*Note: Accepts either `name` or `category_name`.*

**Success `201`**
```json
{
  "message": "Category created successfully.",
  "data": {
    "id": "15",
    "categoryId": 15,
    "category_id": 15,
    "name": "Artificial Intelligence",
    "category_name": "Artificial Intelligence",
    "description": "Books on AI, ML, robotics, and neural networks",
    "created_at": "2026-10-24T12:00:00.000Z"
  },
  "category": { /* same category object */ }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Name missing, empty, or exceeds 100 characters (`VALIDATION_ERROR`) |
| `401` | Authentication required |
| `403` | User does not have staff privileges |
| `409` | Category name already exists (`CONFLICT`) |

---

### 3.8 `GET /api/categories/:id/books` & `GET /api/books/category/:id`
Retrieve active books belonging to a specific category (useful for dropdown selections). Supports standard pagination (`page`, `limit`) and search.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Success `200`**
```json
{
  "data": [
    {
      "id": 1,
      "bookId": 1,
      "title": "Introduction to Algorithms",
      "category": { "id": 2, "name": "Computer Science" },
      "availability": { "availableCopies": 3, "totalUsableCopies": 3 }
    }
  ],
  "books": [ /* same array of books */ ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
  "meta": { "page": 1, "pageSize": 20, "total": 1 }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Category ID is not a positive integer |
| `401` | Authentication required |

---

### 3.9 `GET /api/authors`
List all available authors, sorted alphabetically by first name then last name. Used to populate author selection in book creation/edit forms.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user |

**Success `200`**
```json
{
  "data": [
    { "id": "7", "authorId": 7, "name": "Robert C. Martin", "firstName": "Robert", "lastName": "Martin" },
    { "id": "3", "authorId": 3, "name": "Thomas Cormen", "firstName": "Thomas", "lastName": "Cormen" }
  ],
  "authors": [ ]
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Authentication required |

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

### 5.6 `GET /api/borrowed-books/:id`
*(Role: Librarian, Admin)* (Alias: `GET /api/staff/loans/:id`)  
Retrieve comprehensive staff loan details for return inspection and processing. Includes full book details, copy barcode/condition, student profile and verified contact info, borrow and due dates, calculated overdue days, return history, and associated penalties.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Path parameter**: `id` — positive integer borrow ID (`borrow_id`).

**Success `200`**
```json
{
  "loan": {
    "id": "55",
    "borrowId": 55,
    "requestId": 101,
    "status": "Borrowed",
    "borrowDate": "2026-10-10T08:00:00.000Z",
    "dueDate": "2026-10-17",
    "dueAt": "2026-10-17T23:59:59.000Z",
    "isOverdue": false,
    "overdueDays": 0,
    "book": {
      "id": 5,
      "title": "Clean Architecture",
      "isbn": "978-0134494164",
      "author": "Robert C. Martin"
    },
    "copy": {
      "id": 12,
      "copyBarcode": "ACC-00012",
      "accessionNo": "ACC-00012",
      "condition": "GOOD",
      "status": "Borrowed"
    },
    "student": {
      "id": 9001,
      "userId": 9001,
      "studentNumber": "SN-2024-001",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@university.edu",
      "college": "CCS",
      "course": "BSCS"
    },
    "returnedRecord": null,
    "penalties": []
  }
}
```

---

### 5.7 `POST /api/borrowed-books/:id/return`
*(Role: Librarian, Admin)* (Alias: `POST /api/staff/loans/:id/return`)  
Accept a returned physical copy at the circulation desk. Never blocked by overdue, unpaid fines, or account suspension.
- Evaluates days overdue: $\max\left(0, \left\lfloor \frac{\text{now} - \text{due\_date}}{86,400,000} \right\rfloor\right)$.
- Inspects copy condition (`NEW`, `GOOD`, `FAIR`, `DAMAGED`, `UNUSABLE`).
- If copy is usable (`NEW`, `GOOD`, `FAIR`), updates copy status to `Available` and triggers `processNextInReservationQueue(bookId)` to fulfill waiting reservations.
- If copy is damaged (`DAMAGED`), updates copy status to `Maintenance` and records condition as `Damaged`.
- If a damage fine is assessed (`fineType` & `fineAmount`), creates an `Unpaid` penalty record.
- Issues a `LOAN_RETURNED` in-app notification to the student.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian or Admin |

**Path parameter**: `id` — positive integer borrow ID (`borrow_id`).

**Request body**
```json
{
  "condition": "GOOD",
  "notes": "Book returned in excellent condition.",
  "fineType": "DAMAGE_MINOR",
  "fineAmount": 100
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `condition` | string | Yes | One of `NEW`, `GOOD`, `FAIR`, `DAMAGED`, `UNUSABLE`. |
| `notes` | string | Optional | Inspection notes up to 2000 characters. |
| `fineType` | string | Optional | `DAMAGE_MINOR` (₱100) or `DAMAGE_MAJOR` (₱200) if damage is assessed. |
| `fineAmount` | number | Optional | Non-negative penalty amount to assess. |

**Success `200`**
```json
{
  "message": "Book return accepted successfully.",
  "loan": {
    "id": 55,
    "borrowId": 55,
    "status": "Returned",
    "returnedAt": "2026-10-24T06:12:46.000Z",
    "daysOverdue": 0
  },
  "copyStatus": "AVAILABLE",
  "penalty": null
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation error (invalid condition or invalid fine amount) |
| `401` | Authentication required |
| `403` | Role not allowed (must be Librarian or Admin) |
| `404` | Loan not found |
| `409` | Loan is not in `Borrowed` status (`INVALID_STATE`) |

---

### 5.8 `POST /api/borrowed-books/:id/mark-lost`
*(Role: Librarian, Admin, Student)* (Aliases: `POST /api/borrowed-books/:id/report-lost`, `POST /api/staff/loans/:id/mark-lost`)  
Mark an active book loan as lost. Can be executed by library staff or **self-reported directly by the borrower student** (e.g. if the book was misplaced off-campus and the student will not be returning to the library).
- When called by a `Student`, the system strictly validates that the loan belongs to the authenticated student (returns `403 Forbidden` if attempting to mark another student's loan).
- Updates loan status to `Lost`.
- Updates physical copy status to `Lost` and condition status to `Damaged`.
- **Automatically assesses the standard ₱500 `Lost Book` fine** with status `Unpaid` on the student's account.
- Issues an immediate `FINE_ASSESSED` notification to the student with settlement details.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian, Admin, or Student |

**Path parameter**: `id` — positive integer borrow ID (`borrow_id`).

**Request body**
```json
{
  "notes": "Borrower reported book lost during commute."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `notes` | string | Optional | Notes/remarks describing the lost report up to 2000 characters. |

**Success `200`**
```json
{
  "message": "Loan marked as lost and ₱500 lost-book fine recorded.",
  "loan": {
    "id": 55,
    "borrowId": 55,
    "status": "Lost"
  },
  "penalty": {
    "id": "8",
    "fineType": "LOST_BOOK",
    "amount": 500,
    "paidAmount": 0,
    "balance": 500,
    "status": "UNPAID",
    "notes": "Self-reported as lost: Borrower reported book lost during commute."
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Validation failure on notes |
| `401` | Authentication required |
| `403` | Role not allowed, or student attempting to report another student's loan (`FORBIDDEN`) |
| `404` | Loan not found |
| `409` | Loan is not in `Borrowed` status (`INVALID_STATE`) |

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
Submits a student COR proof document. Only **realtime captured images** (JPEG, PNG, WebP) are accepted; PDF documents and client-invented filenames are rejected with `400`. Supports camera image data URL or camera capture image upload. Previous pending verifications for the same term are automatically superseded. Creates a `COR_SUBMITTED` notification for the student.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |
| **Max file size** | 10 MB |
| **Allowed types** | JPEG, PNG, WEBP (images only; PDF rejected) |

**Mode 1: Multipart/form-data (camera capture image)**
```
Content-Type: multipart/form-data

file: <binary image (JPEG, PNG, WebP)>
```

**Mode 2: JSON body (camera data URL)**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "originalFileName": "camera_cor.jpg"
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
| `400` | No image data provided, invalid file signature, or non-image document (e.g., PDF) |
| `401` | Not authenticated |

---

### 7.4 `GET /api/me/verifications/:id`
*(Alias: `GET /api/verifications/me/:id`)*  
Returns the details of a single verification record belonging to the authenticated student (owner only). Returns the exact same shape as an item in `GET /api/me/verifications`.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student (owner only) |

**Success `200`**
```json
{
  "id": 1,
  "userId": 42,
  "academicTermId": 1,
  "termId": 1,
  "termName": "1st Semester 2026-2027",
  "status": "Pending",
  "submittedAt": "2026-10-21T08:00:00.000Z",
  "reviewedBy": null,
  "reviewedAt": null,
  "validFrom": null,
  "effectiveFrom": null,
  "validUntil": null,
  "remarks": null,
  "rejectionReason": null,
  "originalFileName": "cor_42_1729497600000_a1b2c3d4.jpg",
  "proofFile": "cor_42_1729497600000_a1b2c3d4.jpg"
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Not authenticated |
| `403` | Not authorized (not owner) |
| `404` | Verification record not found |

---

### 7.5 `GET /api/me/verifications/:id/document`
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

### 7.6 `GET /api/staff/verifications`
*(Role: Librarian, Admin)*
*(Aliases: `GET /api/admin/verifications`, `GET /api/librarian/verifications`, `GET /api/verifications`)*

Lists the verification queue with optional `?status=` and `?search=` query parameters.

| Query Parameter | Description |
|---|---|
| `status` | Case-insensitive status filter (`Pending`, `Approved`, `Rejected`, `Expired`, `Superseded`). Use `ALL` or omit to return all statuses. |
| `search` | Free-text search matching student name, student number, email, college, course, term name, proof file name, status, or remarks. |

Results are sorted with **Pending** submissions first, then by newest `submittedAt`.

**Success `200`**
```json
[
  {
    "id": 1,
    "userId": 42,
    "academicTermId": 1,
    "termId": 1,
    "termName": "1st Semester 2026-2027",
    "status": "Pending",
    "submittedAt": "2026-10-21T08:00:00.000Z",
    "reviewedBy": null,
    "reviewedAt": null,
    "validFrom": null,
    "effectiveFrom": null,
    "validUntil": null,
    "remarks": null,
    "rejectionReason": null,
    "originalFileName": "cor_42_1729497600000_a1b2c3d4.jpg",
    "proofFile": "cor_42_1729497600000_a1b2c3d4.jpg",
    "student": {
      "id": "42",
      "studentNumber": "2024-00001",
      "name": "Juan Dela Cruz",
      "email": "student@wmsu.edu.ph",
      "college": "College of Computer Studies",
      "course": "BS Information Technology",
      "yearLevel": 2,
      "studentType": "Regular"
    },
    "reviewer": null
  }
]
```

When a verification has been reviewed, `reviewer` contains:
```json
"reviewer": {
  "id": "5",
  "name": "Librarian Name",
  "email": "librarian@wmsu.edu.ph",
  "role": "Librarian"
}
```

---

### 7.7 `GET /api/staff/verifications/:id`
*(Role: Librarian, Admin)*
*(Aliases: `GET /api/admin/verifications/:id`, `GET /api/librarian/verifications/:id`, `GET /api/verifications/:id`)*

Returns the details of a single verification record for staff review, including student details, academic term, and reviewer info. Returns the exact same shape as an item in `GET /api/staff/verifications`.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian, Admin |

**Success `200`**
```json
{
  "id": 1,
  "userId": 42,
  "academicTermId": 1,
  "termId": 1,
  "termName": "1st Semester 2026-2027",
  "status": "Pending",
  "submittedAt": "2026-10-21T08:00:00.000Z",
  "reviewedBy": null,
  "reviewedAt": null,
  "validFrom": null,
  "effectiveFrom": null,
  "validUntil": null,
  "remarks": null,
  "rejectionReason": null,
  "originalFileName": "cor_42_1729497600000_a1b2c3d4.jpg",
  "proofFile": "cor_42_1729497600000_a1b2c3d4.jpg",
  "student": {
    "id": "42",
    "studentNumber": "2024-00001",
    "name": "Juan Dela Cruz",
    "email": "student@wmsu.edu.ph",
    "college": "College of Computer Studies",
    "course": "BS Information Technology",
    "yearLevel": 2,
    "studentType": "Regular"
  },
  "reviewer": null
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Not authenticated |
| `403` | Not authorized (Staff role required) |
| `404` | Verification record not found |

---

### 7.8 `POST /api/staff/verifications/:id/approve`
*(Role: Librarian, Admin)*
*(Aliases: `POST /api/admin/verifications/:id/approve`, `POST /api/librarian/verifications/:id/approve`, `POST /api/verifications/:id/approve`)*

Approves student COR, setting `valid_from` to the approval date, `valid_until` to the term's end date, and status to `Approved`. Creates a `COR_APPROVED` notification for the student. Returns the full staff verification shape including `student` and `reviewer`.

**Payload:**
```json
{
  "remarks": "Approved"
}
```

---

### 7.9 `POST /api/staff/verifications/:id/reject`
*(Role: Librarian, Admin)*
*(Aliases: `POST /api/admin/verifications/:id/reject`, `POST /api/librarian/verifications/:id/reject`, `POST /api/verifications/:id/reject`)*

Rejects student COR with a required reason. Student verification status remains unverified. Creates a `COR_REJECTED` notification for the student with the rejection reason. Returns the full staff verification shape including `student` and `reviewer`.

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

### 7.10 `GET /api/staff/verifications/:id/document`
*(Role: Librarian, Admin)*
*(Aliases: `GET /api/admin/verifications/:id/document`, `GET /api/librarian/verifications/:id/document`, `GET /api/verifications/:id/document`)*

Securely streams the stored COR proof document for staff review. Same streaming behavior as the student endpoint (7.5).

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
| **Allowed types** | JPEG, PNG, WEBP (realtime captured images only) |
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

## 8b. Renewals

Renewal management and decisioning. Renewals extend the due date of active loans (`status: "Borrowed"`).

### 8b.1 Rules and Constraints
1. **Loan Status**: Only active loans (`status: "Borrowed"`) can be renewed.
2. **Renewal Limit**: Maximum 1 renewal per loan (`RENEWAL_LIMIT = 1`).
3. **Student Eligibility**: Checks all borrow eligibility flags (Active account, Active suspension, Active term, Approved COR, No unpaid penalties).
4. **Reservation Queue Check**: If another student is waiting for the same book (`Waiting` or `Ready`), the renewal is rejected with `decisionReason: "Another student is waiting for this title."` and recorded.
5. **Loan Limits**: Validates `MAX_COPIES_PER_BOOK` (2) and `MAX_ACTIVE_BORROWS` (10).
6. **Due Date Calculation**: New due date counts from the renewal approval date (`today + requestedDurationDays`).
7. **Notifications**: Automatically creates `RENEWAL_APPROVED` or `RENEWAL_REJECTED` notifications.

---

### 8b.2 `POST /api/borrowed-books/:id/renew`
Request and execute an automatic renewal for an active loan. (Also available at `POST /api/renewals/loan/:loanId`).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Request body**
```json
{
  "requestedDurationDays": 7
}
```

**Success `200` (Approved)**
```json
{
  "id": "1",
  "loanId": "45",
  "bookTitle": "Clean Architecture",
  "requestedDurationDays": 7,
  "status": "APPROVED",
  "requestedAt": "2026-10-23T10:30:00.000Z",
  "approvedAt": "2026-10-23T10:30:00.000Z",
  "oldDueAt": "2026-10-25T00:00:00.000Z",
  "newDueAt": "2026-10-30T00:00:00.000Z",
  "decisionReason": null
}
```

**Success `200` (Auto-rejected due to queue)**
```json
{
  "id": "2",
  "loanId": "45",
  "bookTitle": "Clean Architecture",
  "requestedDurationDays": 7,
  "status": "REJECTED",
  "requestedAt": "2026-10-23T10:30:00.000Z",
  "approvedAt": null,
  "oldDueAt": "2026-10-25T00:00:00.000Z",
  "newDueAt": null,
  "decisionReason": "Another student is waiting for this title."
}
```

**Errors**
| Code | Meaning |
|---|---|
| `400` | Invalid loan ID or request payload |
| `403` | Student ineligible (`BORROW_INELIGIBLE`) or renewal limit reached (`RENEWAL_LIMIT_REACHED`) |
| `404` | Loan not found or does not belong to student |
| `409` | Loan not in active `Borrowed` state, or limits exceeded |
| `422` | Invalid requested duration |

---

### 8b.3 `GET /api/renewals/mine`
List all renewal decisions and history for the authenticated student.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Student |

**Success `200`**
```json
[
  {
    "id": "1",
    "loanId": "45",
    "bookTitle": "Clean Architecture",
    "requestedDurationDays": 7,
    "status": "APPROVED",
    "requestedAt": "2026-10-23T10:30:00.000Z",
    "approvedAt": "2026-10-23T10:30:00.000Z",
    "oldDueAt": "2026-10-25T00:00:00.000Z",
    "newDueAt": "2026-10-30T00:00:00.000Z",
    "decisionReason": null
  }
]
```

---

### 8b.4 `GET /api/renewals`
Staff endpoint to monitor all renewal history across students.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Librarian, Admin |

**Query parameters**
| Param | Type | Description |
|---|---|---|
| `search` | string | Search by student name, student number, or book title |

**Success `200`**
```json
[
  {
    "id": "1",
    "loanId": "45",
    "bookTitle": "Clean Architecture",
    "requestedDurationDays": 7,
    "status": "APPROVED",
    "requestedAt": "2026-10-23T10:30:00.000Z",
    "approvedAt": "2026-10-23T10:30:00.000Z",
    "oldDueAt": "2026-10-25T00:00:00.000Z",
    "newDueAt": "2026-10-30T00:00:00.000Z",
    "decisionReason": null,
    "student": {
      "id": "10",
      "userId": "9001",
      "firstName": "Juan",
      "lastName": "Dela Cruz",
      "studentNumber": "2024-00123",
      "college": "College of Science",
      "program": "BS Computer Science"
    }
  }
]
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

### 10.3 `GET /api/admin/audit-logs`
*(Also available at `GET /api/audit-logs`)*

Retrieve immutable audit logs tracking actions by administrators and librarians across the system (handovers, returns, damage/lost fines, waivers, cash payments, COR reviews, book/copy additions, account creation, and user status changes).

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | `Admin` (at `/api/admin/audit-logs`), `Admin` or `Librarian` (at `/api/audit-logs`) |

**Query parameters**
| Param | Type | Default | Description |
|---|---|---|---|
| `from` | string (YYYY-MM-DD) | — | Start date filter (inclusive 00:00:00 UTC) |
| `to` | string (YYYY-MM-DD) | — | End date filter (inclusive 23:59:59.999 UTC) |
| `actorRole` | string | — | Filter by actor role: `ADMIN`, `LIBRARIAN`, `STUDENT` |
| `action` | string | — | Filter by action code (e.g. `FINE_WAIVED`, `PAYMENT_RECORDED`) |
| `search` | string | — | Keyword search across summary, actor name, action, and entity type |
| `page` | integer | `1` | Page number |
| `pageSize` / `limit` | integer | `15` | Items per page (max 100) |

**Success `200`**
```json
{
  "data": [
    {
      "id": "7133",
      "auditId": "7133",
      "actorUserId": "764",
      "actorName": "Librarian Cruz",
      "actorRole": "LIBRARIAN",
      "action": "FINE_WAIVED",
      "entityType": "FINE",
      "entityId": "14",
      "summary": "Waived Lost Book penalty of ₱500.00: Misplaced in stack",
      "createdAt": "2026-10-24T16:09:27.171Z"
    },
    {
      "id": "7131",
      "auditId": "7131",
      "actorUserId": "764",
      "actorName": "Librarian Cruz",
      "actorRole": "LIBRARIAN",
      "action": "PAYMENT_RECORDED",
      "entityType": "PAYMENT",
      "entityId": "13",
      "summary": "Recorded Cash payment of ₱200.00 (Receipt: OR-2026-001).",
      "createdAt": "2026-10-24T16:09:27.126Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 15,
    "total": 42
  }
}
```

**Errors**
| Code | Meaning |
|---|---|
| `401` | Not authenticated |
| `403` | Forbidden (requires Admin role for `/api/admin/audit-logs`) |

---

## 11. Users

**Prefix**: `/api/users` (staff) or `/api/admin/users` (admin only)

### 11.1 `GET /api/users`
*(Also available at `GET /api/admin/users` — Admin only)*

Retrieve all users in the system. Returns only **name**, **status**, and **role** for each user. Results are sorted by role then status by default.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | `/api/users` → Admin or Librarian; `/api/admin/users` → Admin only |

**Query parameters**

| Param | Type | Default | Description |
|---|---|---|---|
| `sort_by` | string | `role` | Primary sort field. `role` or `status`. Also accepts `sortBy`. |
| `role_order` | string | `ASC` | Sort direction for role column (`ASC` or `DESC`). Also accepts `roleOrder`. |
| `status_order` | string | `ASC` | Sort direction for status column (`ASC` or `DESC`). Also accepts `statusOrder`. |
| `role` | string | — | Filter by role (e.g. `Student`, `Librarian`, `Admin`). |
| `status` | string | — | Filter by status (e.g. `Active`, `Inactive`, `Suspended`). |
| `page` | integer | — | Page number (pagination only applies when `limit` is set). |
| `limit` | integer | — | Results per page. |

**Success `200`**
```json
{
  "data": [
    { "name": "Juan Dela Cruz", "status": "Active", "role": "Admin" },
    { "name": "Maria Santos", "status": "Active", "role": "Librarian" },
    { "name": "Jose Rizal", "status": "Active", "role": "Student" },
    { "name": "Ana Reyes", "status": "Inactive", "role": "Student" }
  ],
  "users": [ /* same array */ ]
}
```

> Each user object contains exactly three fields: `name` (full name), `status`, and `role`. No IDs, emails, or other PII are exposed.

**Errors**
| Code | Meaning |
|---|---|
| `401` | Authentication required |
| `403` | Role is not Admin or Librarian (for `/api/users`) or not Admin (for `/api/admin/users`) |

---

## 12. Fines & Payments (Cash Only)

**Prefix**: `/api/fines` (also aliased to `/api/penalties`)  
All routes require authentication. Staff routes (`Admin`, `Librarian`) manage fines and record payments. Student routes show the student's own penalties.

### Business Rules

| Rule | Detail |
|---|---|
| **Cash only** | The library accepts cash only, paid in person at the counter. No online payment, no "Pending" state. |
| **Full payment required** | Partial payments are strictly rejected. The payment amount must exactly match the penalty amount. |
| **Unique receipt number** | Every payment must have a unique official receipt number (`receipt_no`). Duplicate receipt numbers are rejected with `409 Conflict`. |
| **Penalty types** | `Late Return`, `Lost Book`, `Damaged Book` |
| **Penalty statuses** | `Unpaid` → `Paid` (via cash payment) or `Waived` (by admin/librarian). No `Partially Paid` state. |

### Notification Types

| Type | Trigger | Recipient |
|---|---|---|
| `FINE_ASSESSED` | Penalty created during book return | Student |
| `FINE_PAYMENT_RECORDED` | Librarian records a full cash payment | Student |
| `FINE_WAIVED` | Admin/librarian waives a penalty | Student |

### Staff Fine Shape
```json
{
  "id": "1",
  "penaltyId": "1",
  "borrowId": "5",
  "returnId": "3",
  "fineType": "DAMAGED_BOOK",
  "fineTypeLabel": "Damaged Book",
  "amount": 200,
  "paidAmount": 0,
  "balance": 200,
  "status": "Unpaid",
  "statusEnum": "UNPAID",
  "receiptNo": null,
  "referenceNumber": null,
  "reason": "Water damage to pages 10-30",
  "recordedAt": "2026-10-24T10:00:00.000Z",
  "waivedAt": null,
  "waivedBy": null,
  "waiveRemarks": null,
  "student": {
    "id": "2",
    "userId": "2",
    "studentNumber": "SN-123456",
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "email": "juan@wmsu.edu.ph"
  },
  "book": {
    "id": "10",
    "title": "Data Structures and Algorithms",
    "isbn": "978-0-123456-78-9"
  },
  "bookTitle": "Data Structures and Algorithms"
}
```

---

### 12.1 `GET /api/fines`
List fines for staff. Defaults to all penalties; filter by status, search by student name/number, book title, or receipt number.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | `Admin`, `Librarian` |

**Query parameters**
| Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | — | Filter: `Unpaid`, `Paid`, or `Waived` |
| `search` | string | — | Search across student name, student number, book title, receipt number |
| `page` | integer | `1` | Page number |
| `limit` | integer | `50` | Items per page (max 100) |

**Success `200`**
```json
{
  "data": [ /* Array of Staff Fine objects */ ],
  "fines": [ /* Same array (alias) */ ],
  "total": 5,
  "page": 1,
  "limit": 50
}
```

---

### 12.2 `POST /api/fines/:id/payments`
Record a full cash payment for a penalty. The librarian enters the official receipt number and the exact penalty amount. The penalty status is set to `Paid` and a notification is sent to the student.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | `Admin`, `Librarian` |

**URL parameters**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Penalty ID |

**Request body**
| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | number | Yes | Must exactly match `penalty.amount`. Partial/overpayment rejected. |
| `receiptNo` | string | Yes | Official receipt number. Must be unique across all payments. Also accepts `referenceNumber` or `receipt_no`. |
| `remarks` | string | No | Optional notes about the payment. |

**Success `201`**
```json
{
  "message": "Payment recorded and penalty settled successfully.",
  "payment": {
    "id": "1",
    "paymentId": "1",
    "penaltyId": "5",
    "amount": 200,
    "paymentMethod": "Cash",
    "paymentStatus": "Completed",
    "receiptNo": "OR-2026-001",
    "referenceNumber": "OR-2026-001",
    "paidAt": "2026-10-24T10:30:00.000Z"
  },
  "fine": {
    "id": "5",
    "status": "Paid",
    "balance": 0,
    "paidAmount": 200
  }
}
```

**Error responses**

| Status | Condition | Code |
|---|---|---|
| `400` | Missing or empty receipt number | `VALIDATION_ERROR` |
| `400` | Amount ≤ 0 or not a number | `VALIDATION_ERROR` |
| `400` | Amount ≠ penalty amount (partial or overpayment) | `PARTIAL_PAYMENT_NOT_ALLOWED` |
| `400` | Penalty already `Paid` or `Waived` | `INVALID_STATE` |
| `404` | Penalty not found | `NOT_FOUND` |
| `409` | Receipt number already exists in the system | `CONFLICT` |

**Example error (partial payment rejected)**
```json
{
  "code": "PARTIAL_PAYMENT_NOT_ALLOWED",
  "message": "Partial payments are not accepted. Full payment of ₱200.00 is required.",
  "error": "Partial payments are not accepted. Full payment of ₱200.00 is required."
}
```

---

### 12.3 `POST /api/fines/:id/waive`
Waive an unpaid penalty with an audited reason. Only unpaid penalties can be waived. A notification is sent to the student.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | `Admin`, `Librarian` |

**URL parameters**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Penalty ID |

**Request body**
| Field | Type | Required | Description |
|---|---|---|---|
| `reason` | string | Yes | Reason for waiving the penalty (audited). |

**Success `200`**
```json
{
  "message": "Penalty waived successfully.",
  "fine": { /* Staff Fine object with status: "Waived" */ }
}
```

**Error responses**

| Status | Condition | Code |
|---|---|---|
| `404` | Penalty not found | `NOT_FOUND` |
| `409` | Penalty already `Paid` or `Waived` | `INVALID_STATE` |
| `422` | Missing or empty reason | `VALIDATION_ERROR` |

---

### 12.4 `GET /api/fines/payments`
List settled (completed) payments history for the Payment Recording screen. Shows who received the payment, receipt numbers, and associated student/book details.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | `Admin`, `Librarian` |

**Query parameters**
| Param | Type | Default | Description |
|---|---|---|---|
| `search` | string | — | Search across student name, student number, book title, receipt number, recorded-by name |
| `page` | integer | `1` | Page number |
| `limit` | integer | `50` | Items per page (max 100) |

**Success `200`**
```json
{
  "data": [
    {
      "id": "1",
      "paymentId": "1",
      "fineId": "5",
      "penaltyId": "5",
      "amount": 200,
      "paymentMethod": "Cash",
      "paymentStatus": "Completed",
      "receiptNo": "OR-2026-001",
      "referenceNumber": "OR-2026-001",
      "paidAt": "2026-10-24T10:30:00.000Z",
      "recordedByUserId": "3",
      "recordedByName": "Librarian Staff",
      "fineType": "DAMAGED_BOOK",
      "fineTypeLabel": "Damaged Book",
      "bookTitle": "Data Structures and Algorithms",
      "remarks": null,
      "student": {
        "id": "2",
        "userId": "2",
        "studentNumber": "SN-123456",
        "firstName": "Juan",
        "lastName": "Dela Cruz",
        "email": "juan@wmsu.edu.ph"
      }
    }
  ],
  "payments": [ /* Same array (alias) */ ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

---

### 12.5 `GET /api/me/penalties`
Student views their own penalties. Also accessible at `GET /api/me/fines`.

| Property | Value |
|---|---|
| **Auth required** | Yes |
| **Role** | Any authenticated user (student-facing) |

**Success `200`**
```json
{
  "message": "Please pay in cash at the library counter. The library accepts cash only in full.",
  "data": [ /* Array of Staff Fine objects for this student */ ],
  "fines": [ /* Same array (alias) */ ],
  "totalBalance": 500
}
```

> If the user is not a student or has no borrowed books, returns an empty array with `totalBalance: 0`.

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
