// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Interest } from "@/types";
import { ApiError } from "@/utils/errors";

const mocks = vi.hoisted(() => ({
  updateInterests: vi.fn(),
  listInterestOptions: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ updateInterests: mocks.updateInterests }) }));
vi.mock("@/services/authService", () => ({ listInterestOptions: mocks.listInterestOptions }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ success: mocks.success }) }));

import InterestsPicker from "./InterestsPicker";

const options: Interest[] = [
  { id: "1", categoryId: 1, name: "History" },
  { id: "2", categoryId: 2, name: "Science" },
];

describe("InterestsPicker", () => {
  beforeEach(() => {
    mocks.updateInterests.mockReset().mockResolvedValue(options);
    mocks.listInterestOptions.mockReset().mockResolvedValue(options);
    mocks.success.mockReset();
  });

  it("keeps Continue disabled until one interest is selected", async () => {
    const user = userEvent.setup();
    render(<InterestsPicker mode="first-login" onClose={vi.fn()} />);
    const continueButton = await screen.findByRole("button", { name: "Continue" });
    expect(continueButton.hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(false);
  });

  it("saves successfully, toasts, and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<InterestsPicker mode="first-login" onClose={onClose} />);
    await user.click(await screen.findByRole("button", { name: "Science" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mocks.updateInterests).toHaveBeenCalledWith({ interestIds: ["2"] }));
    expect(mocks.success).toHaveBeenCalledWith("Interests saved. Welcome!");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the modal open and shows an inline error when saving fails", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mocks.updateInterests.mockRejectedValue(new ApiError("VALIDATION_ERROR", "Selected categories are no longer available.", 422));
    render(<InterestsPicker mode="first-login" onClose={onClose} />);
    await user.click(await screen.findByRole("button", { name: "History" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Selected categories are no longer available.");
    expect(screen.getByRole("dialog", { name: "What do you like to read?" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("supports a retry when available interests fail to load", async () => {
    const user = userEvent.setup();
    mocks.listInterestOptions.mockRejectedValueOnce(new Error("Cannot load categories.")).mockResolvedValueOnce(options);
    render(<InterestsPicker mode="first-login" onClose={vi.fn()} />);
    expect(await screen.findByText("Cannot load categories.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "History" })).toBeTruthy();
  });
});
