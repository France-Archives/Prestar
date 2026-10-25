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

  describe("student penalties navigation", () => {
    it("places Penalties after COR and before My interests in the student Account section", () => {
      const sections = getNavSections(sessionUser("STUDENT"));
      const account = sections.find((section) => section.id === "student-account");
      const items = account?.items ?? [];

      expect(items.map((item) => item.label)).toEqual([
        "COR",
        "Penalties",
        "My interests",
        "Profile",
        "Notifications",
      ]);
      expect(items[1]?.to).toBe(ROUTES.student.penalties);
      expect(items[1]?.capability).toBe("STUDENT_AREA");
      expect(navPaths("LIBRARIAN")).not.toContain(ROUTES.student.penalties);
      expect(navPaths("ADMIN")).not.toContain(ROUTES.student.penalties);
    });
  });

  it("keeps Admin navigation and staff access while avoiding duplicate COR and book links", () => {
    const paths = navPaths("ADMIN");
    const sections = getNavSections(sessionUser("ADMIN"));
    const firstItem = sections[0]?.items[0];
    expect(can(sessionUser("ADMIN"), "COR_REVIEW")).toBe(true);
    expect(paths).toContain(ROUTES.staff.corReview);
    expect(paths).toContain(ROUTES.staff.books);
    expect(paths).not.toContain(ROUTES.admin.cor);
    expect(paths).not.toContain(ROUTES.admin.books);
    expect(firstItem).toMatchObject({ label: "Dashboard", to: ROUTES.admin.dashboard });
    expect(paths.filter((path) => path === ROUTES.admin.dashboard)).toHaveLength(1);
    expect(paths).not.toContain(ROUTES.staff.dashboard);
    expect(sections.flatMap((section) => section.items.map((item) => item.label))).not.toContain("Admin dashboard");
  });

  it("keeps the Librarian dashboard as the first navigation item", () => {
    const firstItem = getNavSections(sessionUser("LIBRARIAN"))[0]?.items[0];
    expect(firstItem).toMatchObject({ label: "Dashboard", to: ROUTES.staff.dashboard });
  });

  it("omits the removed pages from Admin and Librarian navigation", () => {
    for (const role of ["LIBRARIAN", "ADMIN"] as const) {
      const items = getNavSections(sessionUser(role)).flatMap((section) => section.items);
      expect(items.map((item) => item.label)).not.toContain("Check Penalties");
      expect(items.map((item) => item.label)).not.toContain("Borrowing policies");
      expect(items.map((item) => item.to)).not.toContain("/staff/penalty-check");
      expect(items.map((item) => item.to)).not.toContain("/admin/policies");
    }
  });

  it("does not grant Students access to the staff area", () => {
    expect(can(sessionUser("STUDENT"), "STAFF_AREA")).toBe(false);
    expect(navPaths("STUDENT")).not.toContain(ROUTES.staff.dashboard);
    expect(navPaths("STUDENT")).not.toContain(ROUTES.staff.corReview);
  });
});
