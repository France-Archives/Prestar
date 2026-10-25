// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ auth: {} as Record<string, unknown> }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/services/authService", () => ({ listInterestOptions: vi.fn() }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ success: vi.fn() }) }));

import StudentInterestsPrompt from "./StudentInterestsPrompt";

const student = { role: "STUDENT" };

describe("StudentInterestsPrompt", () => {
  beforeEach(() => {
    state.auth = {
      user: student,
      interests: [],
      interestsStatus: "loaded",
      interestsError: null,
      refreshInterests: vi.fn(),
      updateInterests: vi.fn(),
    };
  });

  it("shows the first-login modal when interests are empty", () => {
    render(<StudentInterestsPrompt />);
    expect(screen.getByRole("dialog", { name: "What do you like to read?" })).toBeTruthy();
  });

  it("does not show the modal once interests exist", () => {
    state.auth = { ...state.auth, interests: [{ id: "3", categoryId: 3, name: "Literature" }] };
    render(<StudentInterestsPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not show the student prompt to staff", () => {
    state.auth = { ...state.auth, user: { role: "LIBRARIAN" } };
    render(<StudentInterestsPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
