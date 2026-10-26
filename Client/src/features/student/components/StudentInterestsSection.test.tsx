// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Interest } from "@/types";

const mocks = vi.hoisted(() => ({
  auth: {} as Record<string, unknown>,
  updateInterests: vi.fn(),
  listInterestOptions: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ ...mocks.auth, updateInterests: mocks.updateInterests }) }));
vi.mock("@/services/authService", () => ({ listInterestOptions: mocks.listInterestOptions }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ success: mocks.success }) }));

import StudentInterestsSection from "./StudentInterestsSection";

const current: Interest[] = [{ id: "1", categoryId: 1, name: "History" }];
const options: Interest[] = [
  ...current,
  { id: "2", categoryId: 2, name: "Science" },
];

describe("StudentInterestsSection", () => {
  beforeEach(() => {
    mocks.auth = { user: { role: "STUDENT" }, interests: current, interestsStatus: "loaded", interestsError: null, refreshInterests: vi.fn() };
    mocks.updateInterests.mockReset().mockResolvedValue(options);
    mocks.listInterestOptions.mockReset().mockResolvedValue(options);
    mocks.success.mockReset();
  });

  it("prefills the edit picker from current interests and saves the changed selection", async () => {
    const user = userEvent.setup();
    render(<StudentInterestsSection />);
    await user.click(screen.getByRole("button", { name: "Edit interests" }));

    const history = await screen.findByRole("button", { name: "History" });
    expect(history.getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Science" }));
    await user.click(screen.getByRole("button", { name: "Save interests" }));

    await waitFor(() => expect(mocks.updateInterests).toHaveBeenCalledWith({ interestIds: ["1", "2"] }));
    expect(mocks.success).toHaveBeenCalledWith("Interests updated.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
