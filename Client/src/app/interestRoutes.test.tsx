// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ROUTES, getNavSections } from "./routeConfig";
import { studentRoutes } from "./router";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "student-1",
      email: "student@example.edu",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: null,
      displayName: "Student Reader",
      student: null,
      librarian: null,
    },
  }),
}));

describe("student interests routes and navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not include an Interests navigation item", () => {
    const sections = getNavSections({
      id: "student-1",
      email: "student@example.edu",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      emailVerifiedAt: null,
      displayName: "Student Reader",
      student: null,
      librarian: null,
    });
    expect(sections.flatMap((section) => section.items.map((item) => item.label))).not.toContain("My interests");
    expect(sections.flatMap((section) => section.items.map((item) => item.to))).not.toContain("/app/interests");
  });

  it.each(["interests", "interests/welcome"])("redirects the old /app/%s route to Profile", (path) => {
    const route = studentRoutes.find((item) => item.path === path);
    expect(route).toBeDefined();
    render(
      <MemoryRouter initialEntries={[`/app/${path}`]}>
        <Routes>
          <Route path="/app/interests" element={route?.element} />
          <Route path="/app/interests/welcome" element={route?.element} />
          <Route path={ROUTES.student.profile} element={<p>Student profile</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Student profile")).toBeTruthy();
  });
});
