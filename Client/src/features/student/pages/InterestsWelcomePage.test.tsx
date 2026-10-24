// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Interest } from "@/types";
import type { AuthContextValue } from "@/context/AuthContext";
import { useAuth } from "@/hooks/useAuth";
import * as authService from "@/services/authService";
import { ApiError } from "@/utils/errors";
import InterestsWelcomePage from "./InterestsWelcomePage";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/services/authService", () => ({ listInterestOptions: vi.fn() }));

const options: Interest[] = [
  { id: "1", categoryId: 1, name: "History" },
  { id: "2", categoryId: 2, name: "Science" },
];

function authValue(updateInterests = vi.fn().mockResolvedValue(options)): AuthContextValue {
  return {
    user: null,
    status: "authenticated",
    sessionError: null,
    interests: null,
    interestsStatus: "loaded",
    interestsError: null,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    refreshInterests: vi.fn(),
    updateInterests,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/interests/welcome"]}>
      <Routes>
        <Route path="/app/interests/welcome" element={<InterestsWelcomePage />} />
        <Route path="/app/dashboard" element={<p>Student dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("student interest onboarding", () => {
  beforeEach(() => {
    vi.mocked(authService.listInterestOptions).mockResolvedValue(options);
    vi.mocked(useAuth).mockReturnValue(authValue());
  });

  it("requires at least one selection and enables Continue after one", async () => {
    const user = userEvent.setup();
    renderPage();

    const continueButton = await screen.findByRole("button", { name: "Continue" });
    expect(continueButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Pick at least one.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("1 selected")).toBeTruthy();
  });

  it("supports multi-select and toggling selections off", async () => {
    const user = userEvent.setup();
    renderPage();
    const history = await screen.findByRole("button", { name: "History" });
    const science = screen.getByRole("button", { name: "Science" });

    await user.click(history);
    await user.click(science);
    expect(history.getAttribute("aria-pressed")).toBe("true");
    expect(science.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("2 selected")).toBeTruthy();

    await user.click(history);
    expect(history.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("1 selected")).toBeTruthy();
  });

  it("saves once and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    const updateInterests = vi.fn().mockResolvedValue(options);
    vi.mocked(useAuth).mockReturnValue(authValue(updateInterests));
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Science" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(updateInterests).toHaveBeenCalledOnce());
    expect(updateInterests).toHaveBeenCalledWith({ interestIds: ["2"] });
    expect(await screen.findByText("Student dashboard")).toBeTruthy();
  });

  it.each([
    [400, "Pick at least one interest before saving."],
    [422, "Selected categories are no longer available."],
  ])("keeps selected interests and shows the Server's HTTP %i error", async (status, message) => {
    const user = userEvent.setup();
    const updateInterests = vi.fn().mockRejectedValue(new ApiError("VALIDATION_ERROR", message, status));
    vi.mocked(useAuth).mockReturnValue(authValue(updateInterests));
    renderPage();

    const choice = await screen.findByRole("button", { name: "History" });
    await user.click(choice);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", message);
    expect(choice.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Student dashboard")).toBeNull();
  });
});
