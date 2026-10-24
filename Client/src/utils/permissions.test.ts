import { describe, expect, it } from "vitest";
import type { SessionUser, UserRole } from "@/types";
import { getNavSections, ROUTES } from "@/app/routeConfig";
import { can } from "./permissions";

function sessionUser(role: UserRole): SessionUser {
  return {
    id: "user-1",
    email: "user@example.test",
    role,
    accountStatus: "ACTIVE",
    emailVerifiedAt: null,
    emailVerified: false,
    displayName: "Test User",
    student: null,
    librarian: null,
  };
}

function navPaths(role: UserRole): string[] {
  return getNavSections(sessionUser(role)).flatMap((section) => section.items.map((item) => item.to));
}

describe("staff access and navigation", () => {
  it("allows Librarians to review CORs without a returned librarian permission list", () => {
    const librarian = sessionUser("LIBRARIAN");
    expect(can(librarian, "COR_REVIEW")).toBe(true);
    expect(navPaths("LIBRARIAN")).toContain(ROUTES.staff.corReview);
    expect(can(librarian, "CATALOG_MANAGE")).toBe(false);
    expect(can(librarian, "FINE_MANAGE")).toBe(false);
  });

  it("keeps Admin navigation and staff access while avoiding duplicate COR and book links", () => {
    const paths = navPaths("ADMIN");
    expect(can(sessionUser("ADMIN"), "COR_REVIEW")).toBe(true);
    expect(paths).toContain(ROUTES.staff.corReview);
    expect(paths).toContain(ROUTES.staff.books);
    expect(paths).not.toContain(ROUTES.admin.cor);
    expect(paths).not.toContain(ROUTES.admin.books);
    expect(paths).toContain(ROUTES.admin.dashboard);
  });

  it("does not grant Students access to the staff area", () => {
    expect(can(sessionUser("STUDENT"), "STAFF_AREA")).toBe(false);
    expect(navPaths("STUDENT")).not.toContain(ROUTES.staff.dashboard);
    expect(navPaths("STUDENT")).not.toContain(ROUTES.staff.corReview);
  });
});
