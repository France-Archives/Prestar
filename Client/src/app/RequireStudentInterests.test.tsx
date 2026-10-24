// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Interest } from "@/types";
import type { AuthContextValue } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import { RequireStudentInterests } from "./guards";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function renderGate(value: Partial<AuthContextValue>) {
  const full: AuthContextValue = {
    user: null,
    status: "authenticated",
    sessionError: null,
    interests: [],
    interestsStatus: "loaded",
    interestsError: null,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    refreshInterests: vi.fn(),
    updateInterests: vi.fn(),
    ...value,
  };
  vi.mocked(useAuth).mockReturnValue(full);
  return render(
    <MemoryRouter initialEntries={["/app/dashboard"]}>
      <Routes>
        <Route element={<RequireStudentInterests />}>
          <Route path="/app/dashboard" element={<p>Dashboard</p>} />
          <Route path="/app/interests/welcome" element={<p>Interest onboarding</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const student = {
  id: "student-1",
  email: "student@example.edu",
  role: "STUDENT" as const,
  accountStatus: "ACTIVE" as const,
  emailVerified: true,
  emailVerifiedAt: null,
  displayName: "Student Reader",
  student: null,
  librarian: null,
};

describe("student interest route gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects a student with no interests to onboarding", () => {
    renderGate({ user: student, interests: [] });
    expect(screen.getByText("Interest onboarding")).toBeTruthy();
  });

  it("allows a student with saved interests to reach the dashboard", () => {
    const selected: Interest[] = [{ id: "8", categoryId: 8, name: "Literature" }];
    renderGate({ user: student, interests: selected });
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("shows a retryable error instead of redirecting when interests cannot load", () => {
    const refreshInterests = vi.fn();
    renderGate({
      user: student,
      interestsStatus: "error",
      interestsError: "The Server is unavailable.",
      refreshInterests,
    });
    expect(screen.getByText("The Server is unavailable.")).toBeTruthy();
    expect(screen.queryByText("Interest onboarding")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refreshInterests).toHaveBeenCalledOnce();
  });
});
