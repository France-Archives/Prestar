// Server/tests/otpSignupFlow.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { EmailOtp, sequelize, Student, User } from "../models/index.js";
import {
  createSignup,
  resendOtp,
  SignupError,
  verifyOtp,
} from "../services/signupService.js";

test("New OTP Signup Flow Test Suite", async (t) => {
  const testEmail = `test_${Date.now()}@prestar.edu`;
  const testStudentNo = `SN_${Date.now()}`;

  await t.test("initiates signup and issues 6-digit OTP", async () => {
    const res = await createSignup({
      first_name: "Test",
      last_name: "Student",
      email: testEmail,
      student_number: testStudentNo,
      password: "StrongPassword123!",
      college: "Computer Studies",
      course: "BS Information Technology",
      year_level: 3,
      student_type: "Regular",
    });

    assert.equal(res.email, testEmail);
    assert.equal(res.cooldown_seconds, 120);
    assert.equal(res.remaining_otps, 2);

    const otpRecord = await EmailOtp.findOne({ where: { email: testEmail } });
    assert.ok(otpRecord);
    assert.equal(otpRecord.resend_count, 1);
  });

  await t.test("blocks immediate second OTP request with 429 cooldown", async () => {
    await assert.rejects(
      async () => {
        await createSignup({
          first_name: "Test",
          last_name: "Student",
          email: testEmail,
          student_number: testStudentNo,
          password: "StrongPassword123!",
        });
      },
      (err) => {
        assert.ok(err instanceof SignupError);
        assert.equal(err.status, 429);
        assert.match(err.message, /Please wait .* seconds before requesting another OTP/);
        return true;
      },
    );
  });

  await t.test("rejects invalid OTP during verification", async () => {
    await assert.rejects(
      async () => {
        await verifyOtp(testEmail, "000000");
      },
      (err) => {
        assert.ok(err instanceof SignupError);
        assert.equal(err.status, 400);
        assert.equal(err.message, "Invalid OTP code.");
        return true;
      },
    );
  });

  await t.test("verifies OTP and creates User and Student records", async () => {
    // Manually fetch or generate a known OTP hash for verification test
    const bcrypt = (await import("bcrypt")).default;
    const testOtpCode = "789123";
    const otpHashed = await bcrypt.hash(testOtpCode, 10);

    await EmailOtp.update(
      { otp_hash: otpHashed, last_sent_at: new Date(Date.now() - 130_000) },
      { where: { email: testEmail } },
    );

    const verifyRes = await verifyOtp(testEmail, testOtpCode);
    assert.ok(verifyRes.user);
    assert.equal(verifyRes.user.email, testEmail);
    assert.equal(verifyRes.user.role, "Student");

    // Check DB records
    const user = await User.findOne({ where: { email: testEmail } });
    assert.ok(user);
    assert.equal(user.status, "Active");

    const student = await Student.findOne({ where: { user_id: user.id } });
    assert.ok(student);
    assert.equal(student.student_number, testStudentNo);

    // Verify OTP record cleaned up
    const remainingOtp = await EmailOtp.findOne({ where: { email: testEmail } });
    assert.equal(remainingOtp, null);

    // Clean up test rows
    await student.destroy();
    await user.destroy();
  });

  t.after(async () => {
    await sequelize.close();
  });
});
