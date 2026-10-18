import { describe, expect, it } from "vitest";
import { validateSignup, type SignupValues } from "./authSchemas";

const validSignup: SignupValues = {
  firstName: "Ana",
  middleName: "",
  lastName: "Reyes",
  suffix: "",
  studentNumber: "2026-00123",
  college: "College of Computer Studies",
  program: "BS Information Technology",
  yearLevel: "1",
  email: "ana.reyes@wmsu.edu.ph",
  password: "StrongPassword123!",
  confirm: "StrongPassword123!",
  consent: true,
};

describe("student signup validation", () => {
  it("accepts the required fields, institutional address, optional names, and consent", () => {
    expect(validateSignup(validSignup)).toEqual({});
  });

  it("requires the WMSU email domain", () => {
    expect(validateSignup({ ...validSignup, email: "ana@example.com" }).email).toContain("@wmsu.edu.ph");
  });

  it("requires consent to both legal documents", () => {
    expect(validateSignup({ ...validSignup, consent: false }).consent).toContain("agree");
  });

  it("enforces persisted-field limits and bcrypt's 72-byte password maximum", () => {
    const errors = validateSignup({
      ...validSignup,
      college: "c".repeat(151),
      password: `A1${"é".repeat(36)}`,
      confirm: `A1${"é".repeat(36)}`,
    });
    expect(errors.college).toContain("150 characters");
    expect(errors.password).toContain("72 bytes");
  });
});
