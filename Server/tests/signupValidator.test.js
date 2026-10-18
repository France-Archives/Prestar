import test from "node:test";
import assert from "node:assert/strict";
import { validateResendOtp, validateSignup, validateVerifyOtp } from "../validators/authValidator.js";

function runValidator(validator, body) {
  const req = { body };
  const response = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  let nextCalled = false;
  validator(req, response, () => { nextCalled = true; });
  return { req, response, nextCalled };
}

const signupBody = () => ({
  email: "ana.reyes@wmsu.edu.ph",
  password: "StrongPassword123!",
  firstName: "Ana",
  middleName: "Marie",
  lastName: "Reyes",
  suffix: "Jr.",
  studentNumber: "2026-00123",
  college: "College of Computer Studies",
  program: "BS Information Technology",
  yearLevel: 1,
  termsAccepted: true,
  privacyPolicyAccepted: true,
});

test("valid signup contract normalizes email and maps aliases", () => {
  const { req, response, nextCalled } = runValidator(validateSignup, signupBody());
  assert.equal(response.statusCode, 200);
  assert.equal(nextCalled, true);
  assert.equal(req.body.email, "ana.reyes@wmsu.edu.ph");
  assert.equal(req.body.course, "BS Information Technology");
  assert.equal(req.body.year_level, 1);
});

test("signup rejects non-institutional addresses, missing consent, and overlong fields", () => {
  for (const body of [
    { ...signupBody(), email: "ana@example.com" },
    { ...signupBody(), termsAccepted: false },
    { ...signupBody(), suffix: "S".repeat(101) },
    { ...signupBody(), college: "C".repeat(151) },
    { ...signupBody(), password: `A1${"é".repeat(36)}` },
  ]) {
    const { response, nextCalled } = runValidator(validateSignup, body);
    assert.equal(response.statusCode, 400);
    assert.equal(nextCalled, false);
  }
});

test("signup verification and resend require institutional email; verification requires six digits", () => {
  const invalidDomain = runValidator(validateVerifyOtp, { email: "a@example.com", otp: "123456" });
  assert.equal(invalidDomain.response.statusCode, 400);
  const malformedCode = runValidator(validateVerifyOtp, { email: "a@wmsu.edu.ph", otp: "12345x" });
  assert.equal(malformedCode.response.statusCode, 400);
  const invalidResend = runValidator(validateResendOtp, { email: "a@example.com" });
  assert.equal(invalidResend.response.statusCode, 400);
});
