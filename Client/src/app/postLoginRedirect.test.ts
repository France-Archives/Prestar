import { describe, expect, it } from "vitest";
import { postLoginPathFor, ROUTES } from "./routeConfig";
import type { SessionUser } from "@/types";

function user(role: SessionUser["role"]): SessionUser {
  return {
    id: `${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@example.test`,
    role,
    accountStatus: "ACTIVE",
    emailVerified: true,
    emailVerifiedAt: null,
    displayName: role,
    student: null,
    librarian: null,
  };
}

describe("post-login destination", () => {
  it.each([
    ["ADMIN", ROUTES.admin.dashboard],
    ["LIBRARIAN", ROUTES.staff.dashboard],
  ] as const)("sends %s home when next points into the student area", (role, expected) => {
    expect(postLoginPathFor(user(role), ROUTES.student.dashboard)).toBe(expected);
  });

  it("keeps a valid student deep link", () => {
    expect(postLoginPathFor(user("STUDENT"), `${ROUTES.student.books}?search=history`))
      .toBe(`${ROUTES.student.books}?search=history`);
  });
});
