// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignupForm from "./SignupForm";
import * as authService from "@/services/authService";

vi.mock("@/services/authService", () => ({
  register: vi.fn(),
}));

function changeValue(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
  if (!input) throw new Error(`Missing signup field ${selector}`);
  fireEvent.change(input, { target: { value } });
}

async function completeSignup(user: ReturnType<typeof userEvent.setup>) {
  changeValue('input[autocomplete="given-name"]', "Mina");
  changeValue('input[autocomplete="family-name"]', "Santos");
  changeValue('input[placeholder="2026-00123"]', "2026-00123");
  changeValue('input[type="number"]', "2");
  const selects = document.querySelectorAll<HTMLSelectElement>("select");
  fireEvent.change(selects[0], { target: { value: "College of Computer Studies" } });
  fireEvent.change(selects[1], { target: { value: "BS Computer Science" } });
  changeValue('input[type="email"]', "mina@wmsu.edu.ph");
  const passwords = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
  fireEvent.change(passwords[0], { target: { value: "SecurePass123" } });
  fireEvent.change(passwords[1], { target: { value: "SecurePass123" } });
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignupForm confirmation", () => {
  beforeEach(() => {
    vi.mocked(authService.register).mockReset();
  });

  it("shows confirmation before registration and Cancel does not call the service", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SignupForm /></MemoryRouter>);

    await completeSignup(user);
    expect(screen.getByRole("dialog", { name: "Create your student account?" })).toBeTruthy();
    expect(screen.getByText("You will need to verify your email with a code.")).toBeTruthy();
    expect(authService.register).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(authService.register).not.toHaveBeenCalled();
  });

  it("calls registration once after confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(authService.register).mockResolvedValue({
      email: "mina@wmsu.edu.ph",
      mockVerificationCode: undefined,
    });
    render(<MemoryRouter><SignupForm /></MemoryRouter>);

    await completeSignup(user);
    const dialog = screen.getByRole("dialog", { name: "Create your student account?" });
    await user.dblClick(within(dialog).getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(authService.register).toHaveBeenCalledOnce());
  });
});
