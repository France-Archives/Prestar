import { afterEach, describe, expect, it } from "vitest";
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { bookId } from "@/data";
import { assignMissingCopyBarcodes, db } from "@/services/mockStore";
import { checkEligibility, commitmentsOf, offerCopyToQueue, toReservationBookToRelease } from "@/services/mockEngine";
import type { BookCopy } from "@/types";
import { can, normalizeUserRole, roleAllowed } from "@/utils/permissions";

const original = {
  loans: structuredClone(db.loans),
  requests: structuredClone(db.requests),
  reservations: structuredClone(db.reservations),
  copies: structuredClone(db.copies),
  notifications: structuredClone(db.notifications),
};

afterEach(() => {
  db.loans = structuredClone(original.loans);
  db.requests = structuredClone(original.requests);
  db.reservations = structuredClone(original.reservations);
  db.copies = structuredClone(original.copies);
  db.notifications = structuredClone(original.notifications);
});

describe("permission and role normalization", () => {
  it("accepts valid role strings and rejects invalid ones", () => {
    expect(normalizeUserRole("student")).toBe("STUDENT");
    expect(normalizeUserRole("LIBRARIAN")).toBe("LIBRARIAN");
    expect(normalizeUserRole("unknown")).toBeNull();
  });

  it("applies the same access policy for staff and student roles", () => {
    const student = { id: "u-student", role: "STUDENT" as const, emailVerifiedAt: "2024-01-01T00:00:00.000Z", accountStatus: "ACTIVE" as const, email: "student@example.com", displayName: "Student", student: null, librarian: null };
    const librarian = { id: "u-lib", role: "LIBRARIAN" as const, emailVerifiedAt: "2024-01-01T00:00:00.000Z", accountStatus: "ACTIVE" as const, email: "lib@example.com", displayName: "Librarian", student: null, librarian: { permissions: ["CATALOG_MANAGE", "COR_REVIEW"] } };

    expect(can(student as any, "STUDENT_AREA")).toBe(true);
    expect(can(student as any, "STAFF_AREA")).toBe(false);
    expect(can(librarian as any, "STAFF_AREA")).toBe(true);
    expect(can(librarian as any, "CATALOG_MANAGE")).toBe(true);
    expect(homePathFor(student as any)).toBe(ROUTES.student.dashboard);
    expect(homePathFor(librarian as any)).toBe(ROUTES.staff.dashboard);
    expect(roleAllowed("ADMIN", ["ADMIN", "LIBRARIAN"])) .toBe(true);
    expect(roleAllowed("STUDENT", ["LIBRARIAN", "ADMIN"])) .toBe(false);
  });
});

describe("borrowing commitments", () => {
  it("counts only active loans and concrete offers, not waiting reservations", () => {
    const studentId = "student-commitment-test";
    const titleId = bookId(99);
    const copyOne = crypto.randomUUID();
    const copyTwo = crypto.randomUUID();
    const now = new Date().toISOString();
    const plusSeven = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.loans.push({
      id: "loan-commitment-test",
      studentId,
      bookId: titleId,
      bookTitle: "Atomic Habits",
      copyId: copyOne,
      copyBarcode: "PR-0099-1",
      status: "ACTIVE",
      borrowedAt: now,
      dueAt: plusSeven,
      returnedAt: null,
      renewedCount: 0,
    });

    db.requests.push({
      id: "request-commitment-test",
      studentId,
      bookId: titleId,
      bookTitle: "Atomic Habits",
      assignedCopyId: copyTwo,
      requestedDurationDays: 14,
      status: "APPROVED",
      requestedAt: now,
      approvedAt: now,
      pickupDeadline: plusSeven,
      claimedAt: null,
      decisionReason: null,
    });

    db.reservations.push(
      {
        id: "waiting-commitment-test",
        studentId,
        bookId: titleId,
        bookTitle: "Atomic Habits",
        requestedDurationDays: 14,
        status: "WAITING",
        reservedAt: now,
        pickupDeadline: null,
        offeredCopyId: null,
      },
      {
        id: "offered-commitment-test",
        studentId,
        bookId: titleId,
        bookTitle: "Atomic Habits",
        requestedDurationDays: 7,
        status: "OFFERED",
        reservedAt: now,
        pickupDeadline: plusSeven,
        offeredCopyId: copyTwo,
      },
    );

    expect(commitmentsOf(studentId, titleId)).toBe(3);
  });
});

describe("reservation copy offers", () => {
  it("assigns a usable copy once and never offers damaged copies", () => {
    const book = bookId(99);
    const studentId = db.accounts.find(
      (account) => account.student && checkEligibility(account.student.id, { includeLimits: true, bookId: book }).eligible,
    )?.student?.id;
    if (!studentId) throw new Error("No eligible student fixture is available.");
    const ineligibleStudentId = db.accounts.find(
      (account) => account.student && !checkEligibility(account.student.id, { includeLimits: true, bookId: book }).eligible,
    )?.student?.id;
    if (!ineligibleStudentId) throw new Error("No ineligible student fixture is available.");
    const offeredCopyId = crypto.randomUUID();
    const waitingReservation = {
      id: crypto.randomUUID(),
      studentId,
      bookId: book,
      bookTitle: "Queue test",
      requestedDurationDays: 14 as const,
      status: "WAITING" as const,
      reservedAt: new Date().toISOString(),
      pickupDeadline: null,
      offeredCopyId: null,
    };
    const skippedReservation = {
      ...waitingReservation,
      id: crypto.randomUUID(),
      studentId: ineligibleStudentId,
      reservedAt: new Date(Date.now() - 60_000).toISOString(),
    };
    const makeCopy = (condition: BookCopy["condition"]): BookCopy => ({
      id: offeredCopyId,
      bookId: book,
      barcode: "PR-0099-1",
      status: "AVAILABLE",
      condition,
      shelfLocation: null,
      section: null,
      shelfCode: null,
      levelOrRow: null,
      locationNotes: null,
      acquisitionDate: null,
      notes: null,
    });
    const copy = makeCopy("GOOD");
    db.reservations.push(skippedReservation, waitingReservation);
    db.copies.push(copy);

    expect(offerCopyToQueue(copy)).toBe(true);
    expect(skippedReservation.status).toBe("WAITING");
    expect(waitingReservation.status).toBe("OFFERED");
    expect(copy.status).toBe("RESERVED");
    expect(db.notifications.filter((notification) => notification.relatedEntityId === waitingReservation.id)).toHaveLength(1);
    expect(offerCopyToQueue(copy)).toBe(false);
    expect(db.notifications.filter((notification) => notification.relatedEntityId === waitingReservation.id)).toHaveLength(1);

    const damagedCopy = makeCopy("DAMAGED");
    damagedCopy.id = crypto.randomUUID();
    damagedCopy.barcode = "PR-0099-2";
    damagedCopy.bookId = bookId(100);
    const damagedReservation = { ...waitingReservation, id: crypto.randomUUID(), bookId: damagedCopy.bookId, status: "WAITING" as const, offeredCopyId: null };
    db.reservations.push(damagedReservation);
    db.copies.push(damagedCopy);

    expect(offerCopyToQueue(damagedCopy)).toBe(false);
    expect(damagedReservation.status).toBe("WAITING");
    expect(damagedCopy.status).toBe("AVAILABLE");
  });

  it("preserves existing barcodes and assigns missing copies unique IDs", () => {
    const copy = (id: string, barcode?: string): Omit<BookCopy, "barcode"> & { barcode?: string | null } => ({
      id,
      bookId: bookId(99),
      barcode,
      status: "AVAILABLE",
      condition: "GOOD",
      shelfLocation: null,
      section: null,
      shelfCode: null,
      levelOrRow: null,
      locationNotes: null,
      acquisitionDate: null,
      notes: null,
    });
    const copies = [copy("existing", "KEEP-THIS"), copy("missing-a"), copy("missing-b")];

    assignMissingCopyBarcodes(copies);

    expect(copies[0].barcode).toBe("KEEP-THIS");
    expect(copies[1].barcode).toBeTruthy();
    expect(copies[2].barcode).toBeTruthy();
    expect(new Set(copies.map((entry) => entry.barcode)).size).toBe(copies.length);
  });

  it("uses the location fields of the exact copy assigned to a reservation", () => {
    const copyId = crypto.randomUUID();
    const studentId = db.accounts.find((account) => account.student)?.student?.id;
    if (!studentId) throw new Error("No student fixture is available.");
    const reservation = {
      id: crypto.randomUUID(),
      studentId,
      bookId: bookId(99),
      bookTitle: "Shelf location test",
      requestedDurationDays: 14 as const,
      status: "OFFERED" as const,
      reservedAt: new Date().toISOString(),
      pickupDeadline: new Date(Date.now() + 60_000).toISOString(),
      offeredCopyId: copyId,
    };
    db.reservations.push(reservation);
    db.copies.push({
      id: copyId,
      bookId: reservation.bookId,
      barcode: "PR-TEST-99",
      status: "RESERVED",
      condition: "GOOD",
      section: "B",
      shelfCode: "S-99",
      levelOrRow: "Row 4",
      locationNotes: "Near the window",
      shelfLocation: "Legacy shelf",
      acquisitionDate: null,
      notes: null,
    });

    const release = toReservationBookToRelease(reservation);
    expect(release.copy.id).toBe(copyId);
    expect(release.copy.shelfCode).toBe("S-99");
    expect(release.copy.section).toBe("B");
  });
});
