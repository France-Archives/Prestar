// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LibrarianManagementPage from "./LibrarianManagementPage";

const { createLibrarian, success } = vi.hoisted(() => ({
  createLibrarian: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/services/adminService", () => ({ createLibrarian }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ success }) }));

describe("LibrarianManagementPage", () => {
  beforeEach(() => {
    createLibrarian.mockReset().mockResolvedValue({});
    success.mockReset();
  });

  it("renders the create form inline and stays on the page after creating", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LibrarianManagementPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Create a Librarian account.")).toBeTruthy();
    expect(screen.getByLabelText("First name")).toBeTruthy();
    expect(screen.getByLabelText("Confirm password")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/list is not available yet/i)).toBeNull();

    await user.type(screen.getByLabelText("First name"), "Rae");
    await user.type(screen.getByLabelText("Last name"), "Santos");
    await user.type(screen.getByLabelText("Email"), "rae@example.test");
    await user.type(screen.getByLabelText("Password"), "SecurePass123");
    await user.type(screen.getByLabelText("Confirm password"), "SecurePass123");
    fireEvent.submit(screen.getByRole("button", { name: "Create Librarian" }).closest("form")!);

    await waitFor(() => expect(createLibrarian).toHaveBeenCalledOnce());
    expect(createLibrarian).toHaveBeenCalledWith(expect.objectContaining({
      firstName: "Rae",
      lastName: "Santos",
      email: "rae@example.test",
      employeeNumber: null,
      password: "SecurePass123",
    }));
    expect(success).toHaveBeenCalledWith("Librarian account created successfully.");
    expect(screen.getByLabelText("First name")).toHaveProperty("value", "");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Librarians" })).toBeTruthy();
  });
});
