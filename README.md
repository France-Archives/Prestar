# PRESTAR

Library-management frontend demonstration with synthetic in-memory data.

## Local development

Run the client from `Client/` with `npm install` and `npm run dev`. The mock database is initialized in browser memory; refreshing the page resets mutations to the seed data. The signed-in mock account is stored in `sessionStorage`.

All mock accounts use the development-only password `Password123`. The login page lists the available role and student scenarios. Useful synthetic student accounts:

| Scenario | Email |
| --- | --- |
| Eligible for a borrowing request; also has active loans | `ana.reyes@university.edu` |
| Verified; current-term COR pending review | `noah.garcia@university.edu` |
| Verified; current-term COR rejected, with a reason and resubmission available | `gina.cruz@university.edu` |
| Verified; no COR on record | `dan.uy@university.edu` |
| Verified; active loan and an overdue restriction | `carla.diaz@university.edu` |

Administrator and librarian logins are listed on the login page. The librarians have different permissions so that permission-gated views can be tried.

## Demo and production boundaries

- All people, email addresses, account passwords, documents, and transactions are synthetic. Never use these credentials or mock records in a deployed environment.
- COR submission requires taking a photo from the live browser camera. The demo does not upload or retain the photo: it keeps only the file name, and the seeded COR records contain no student documents. A browser camera interface cannot prove that an image is live; a production backend must validate trusted capture evidence and inspect submissions stored in private, access-controlled object storage.
- The academic-term records are editable mock configuration. Seeded examples include First Semester (August–December), Second Semester (January–May), and Summer Term (June–July). Current-term COR eligibility is based on term records and each approval's effective dates, not month-number rules. Approval does not take effect before a term's configured start or authorize a different term.
- Book availability is calculated from individual copy records. Staff catalog views show total, available, reserved, on-loan, maintenance, lost, and withdrawn counts from the shared mock store.
- Mock services simulate workflows and permissions for demonstration only. A production backend must independently enforce authentication, role permissions, school-email verification, term-specific COR approval and effective dates, borrowing restrictions, duplicate prevention, inventory concurrency, FIFO reservations, and valid status transitions in atomic transactions. It must also securely process COR files, hash passwords, issue email tokens, and persist audit and notification records.
- The app intentionally preserves existing configured policies where a rule is unresolved; for example, it does not create a new COR late-submission policy.