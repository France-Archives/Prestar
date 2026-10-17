import { afterEach, describe, expect, it } from "vitest";
import { ROUTES, homePathFor } from "@/app/routeConfig";
import { bookId } from "@/data";
import { db } from "@/services/mockStore";
import { commitmentsOf } from "@/services/mockEngine";
import { can, normalizeUserRole, roleAllowed } from "@/utils/permissions";

const original = {
  loans: structuredClone(db.loans),
  requests: structuredClone(db.requests),
  reservations: structuredClone(db.reservations),
};

afterEach(() => {
  db.loans = structuredClone(original.loans);
  db.requests = structuredClone(original.requests);
  db.reservations = structuredClone(original.reservations);
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
        status: "OFFERED",
        reservedAt: now,
        pickupDeadline: plusSeven,
        offeredCopyId: copyTwo,
      },
    );

    expect(commitmentsOf(studentId, titleId)).toBe(3);
  });
});
