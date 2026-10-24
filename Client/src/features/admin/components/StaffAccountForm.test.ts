import { describe, expect, it, vi } from "vitest";
import {
  submitStaffAccountForm,
  validateStaffAccountForm,
  type StaffAccountFormValues,
} from "./StaffAccountForm";

const validValues: StaffAccountFormValues = {
  firstName: "Maria",
  lastName: "Santos",
  email: "maria@example.com",
  employeeNumber: "EMP-12",
  password: "SecurePass123",
  confirmPassword: "SecurePass123",
};

describe("shared staff account form", () => {
  it.each(["Librarian", "Admin"] as const)("validates required fields for %s", async (role) => {
    const create = vi.fn();
    const result = await submitStaffAccountForm(role, { ...validValues, password: "", confirmPassword: "" }, [], create);

    expect(result.success).toBe(false);
    expect(result.fieldErrors.password).toBe("Password is required.");
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects confirmation mismatch and invalid server constraints", () => {
    const errors = validateStaffAccountForm({
      ...validValues,
      confirmPassword: "different",
      employeeNumber: "e".repeat(51),
    });
    expect(errors.confirmPassword).toBe("Passwords do not match.");
    expect(errors.employeeNumber).toBe("Employee number must not exceed 50 characters.");
  });

  it.each(["Librarian", "Admin"] as const)("submits a valid %s account and reports success", async (role) => {
    const create = vi.fn().mockResolvedValue({});
    const result = await submitStaffAccountForm(role, validValues, [], create);

    expect(result).toEqual({ fieldErrors: {}, formError: null, success: true });
    expect(create).toHaveBeenCalledWith({
      email: "maria@example.com",
      password: "SecurePass123",
      firstName: "Maria",
      lastName: "Santos",
      employeeNumber: "EMP-12",
    });
  });

  it.each(["Librarian", "Admin"] as const)("maps %s Server validation errors to their field", async (role) => {
    const create = vi.fn().mockRejectedValue(new Error("Password must be at least 8 characters long."));
    const result = await submitStaffAccountForm(role, validValues, [], create);

    expect(result.success).toBe(false);
    expect(result.fieldErrors.password).toBe("Password must be at least 8 characters long.");
    expect(result.formError).toBeNull();
  });

  it.each(["Librarian", "Admin"] as const)("maps duplicate-email %s Server errors to the email field", async (role) => {
    const create = vi.fn().mockRejectedValue(new Error("An account with that email already exists."));
    const result = await submitStaffAccountForm(role, validValues, [], create);

    expect(result.success).toBe(false);
    expect(result.fieldErrors.email).toBe("An account with that email already exists.");
    expect(result.formError).toBeNull();
  });

  it.each(["Librarian", "Admin"] as const)("shows general %s Server errors in the form alert", async (role) => {
    const create = vi.fn().mockRejectedValue(new Error("The account could not be created."));
    const result = await submitStaffAccountForm(role, validValues, [], create);

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toEqual({});
    expect(result.formError).toBe("The account could not be created.");
  });
});
