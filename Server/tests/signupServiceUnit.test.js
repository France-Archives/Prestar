import test from "node:test";
import assert from "node:assert/strict";
import {
  createSignup,
  resendOtp,
  SignupError,
  signupOtpPolicy,
  verifyOtp,
} from "../services/signupService.js";
import { emailVerificationEligibilityReason } from "../services/borrowEligibilityService.js";

function fixture({ sendEmail } = {}) {
  const state = { users: [], students: [], otps: [], nextId: 1 };
  let time = new Date("2026-01-01T00:00:00.000Z");
  const now = () => new Date(time);
  const advance = (milliseconds) => { time = new Date(time.getTime() + milliseconds); };

  const matches = (record, where) => Object.entries(where).every(([key, value]) => record[key] === value);
  const makeOtp = (fields) => ({
    ...fields,
    async update(values) { Object.assign(this, values); },
    async increment(field) { this[field] += 1; },
    async destroy() { state.otps = state.otps.filter((record) => record !== this); },
  });

  const UserModel = {
    async findOne({ where }) { return state.users.find((record) => matches(record, where)) ?? null; },
    async create(fields) {
      const user = { ...fields, id: state.nextId++ };
      state.users.push(user);
      return user;
    },
  };
  const StudentModel = {
    async findOne({ where }) { return state.students.find((record) => matches(record, where)) ?? null; },
    async create(fields) {
      const student = { ...fields };
      state.students.push(student);
      return student;
    },
  };
  const EmailOtpModel = {
    async findOne({ where }) { return state.otps.find((record) => matches(record, where)) ?? null; },
    async create(fields) {
      const record = makeOtp(fields);
      state.otps.push(record);
      return record;
    },
    async update(values, { where }) {
      const record = state.otps.find((item) => matches(item, where));
      if (!record) return [0];
      Object.assign(record, values);
      return [1];
    },
    async destroy({ where }) {
      const before = state.otps.length;
      state.otps = state.otps.filter((record) => !matches(record, where));
      return before - state.otps.length;
    },
  };
  const database = {
    async transaction(callback) {
      const snapshot = {
        users: structuredClone(state.users),
        students: structuredClone(state.students),
        otps: [...state.otps],
        nextId: state.nextId,
      };
      try {
        return await callback({ LOCK: { UPDATE: "UPDATE" } });
      } catch (error) {
        state.users = snapshot.users;
        state.students = snapshot.students;
        state.otps = snapshot.otps;
        state.nextId = snapshot.nextId;
        throw error;
      }
    },
  };

  const delivered = [];
  const deps = {
    UserModel,
    StudentModel,
    EmailOtpModel,
    database,
    now,
    sendEmail: sendEmail ?? (async (email, code) => {
      delivered.push({ email, code });
      return { sent: true };
    }),
  };
  return { state, deps, delivered, advance, now };
}

function registration(email = "unit.student@wmsu.edu.ph") {
  return {
    email,
    password: "StrongPassword123!",
    firstName: "Ana",
    middleName: "Marie",
    lastName: "Reyes",
    suffix: "Jr.",
    studentNumber: "2026-00991",
    college: "College of Computer Studies",
    program: "BS Information Technology",
    yearLevel: 1,
    termsAccepted: true,
    privacyPolicyAccepted: true,
  };
}

async function beginSignup(f) {
  await createSignup(registration(), f.deps);
  return f.delivered.at(-1).code;
}

test("signup stores hashes and pending payload but creates no account before OTP verification", async () => {
  const f = fixture();
  await beginSignup(f);
  const otp = f.state.otps[0];
  assert.equal(f.state.users.length, 0);
  assert.equal(f.state.students.length, 0);
  assert.match(otp.otp_hash, /^\$2[aby]\$/);
  assert.notEqual(otp.signup_payload.password_hash, registration().password);
  assert.equal(otp.signup_payload.middle_name, "Marie");
  assert.equal(otp.signup_payload.suffix, "Jr.");
  assert.ok(otp.signup_payload.terms_accepted_at);
  assert.ok(otp.signup_payload.privacy_policy_accepted_at);
});

test("successful OTP verification transaction creates active verified records and consumes the code", async () => {
  const f = fixture();
  const code = await beginSignup(f);
  const result = await verifyOtp(registration().email, code, f.deps);
  assert.equal(result.message, "Registration successful. You may now log in.");
  assert.equal(f.state.users.length, 1);
  assert.equal(f.state.users[0].status, "Active");
  assert.equal(f.state.users[0].email_verified, true);
  assert.ok(f.state.users[0].terms_accepted_at);
  assert.ok(f.state.users[0].privacy_policy_accepted_at);
  assert.equal(f.state.students[0].middle_name, "Marie");
  assert.equal(f.state.students[0].suffix, "Jr.");
  assert.equal(f.state.otps.length, 0);
  await assert.rejects(() => verifyOtp(registration().email, code, f.deps), { status: 404 });
});

test("expired codes and wrong codes are rejected, with a five-attempt limit", async () => {
  const expired = fixture();
  await beginSignup(expired);
  expired.state.otps[0].expires_at = new Date(expired.now().getTime() - 1);
  await assert.rejects(() => verifyOtp(registration().email, "123456", expired.deps), { status: 400 });

  const attempts = fixture();
  await beginSignup(attempts);
  for (let attempt = 0; attempt < signupOtpPolicy.maxAttempts; attempt += 1) {
    await assert.rejects(() => verifyOtp(registration().email, "000000", attempts.deps), { status: 400 });
  }
  assert.equal(attempts.state.otps[0].attempts, signupOtpPolicy.maxAttempts);
  await assert.rejects(() => verifyOtp(registration().email, "000000", attempts.deps), /Too many failed attempts/);
});

test("resend enforces cooldown and three sends per 24-hour window without resetting each cooldown", async () => {
  const f = fixture();
  await beginSignup(f);
  await assert.rejects(() => resendOtp(registration().email, f.deps), { status: 429 });
  f.advance(signupOtpPolicy.cooldownMs + 1);
  await resendOtp(registration().email, f.deps);
  f.advance(signupOtpPolicy.cooldownMs + 1);
  await resendOtp(registration().email, f.deps);
  f.advance(signupOtpPolicy.cooldownMs + 1);
  await assert.rejects(() => resendOtp(registration().email, f.deps), { status: 429 });
  f.advance(signupOtpPolicy.windowMs);
  await resendOtp(registration().email, f.deps);
  assert.equal(f.state.otps[0].resend_count, 1);
});

test("failed email delivery is surfaced and does not leave an undisclosed active OTP", async () => {
  const f = fixture({ sendEmail: async () => ({ sent: false }) });
  await assert.rejects(() => createSignup(registration(), f.deps), { status: 503 });
  assert.equal(f.state.otps.length, 0);
  assert.equal(f.state.users.length, 0);
});

test("failed resend restores the previously delivered code and send counter", async () => {
  let shouldFail = false;
  const f = fixture({
    sendEmail: async (email, code) => {
      if (shouldFail) return { sent: false };
      f.delivered.push({ email, code });
      return { sent: true };
    },
  });
  await createSignup(registration(), f.deps);
  const previous = { ...f.state.otps[0] };
  f.advance(signupOtpPolicy.cooldownMs + 1);
  shouldFail = true;
  await assert.rejects(() => resendOtp(registration().email, f.deps), { status: 503 });
  assert.equal(f.state.otps[0].otp_hash, previous.otp_hash);
  assert.equal(f.state.otps[0].resend_count, previous.resend_count);
});

test("duplicate email and student number registrations are rejected", async () => {
  const duplicateEmail = fixture();
  duplicateEmail.state.users.push({ email: registration().email });
  await assert.rejects(() => createSignup(registration(), duplicateEmail.deps), { status: 409 });

  const duplicateNumber = fixture();
  duplicateNumber.state.students.push({ student_number: registration().studentNumber });
  await assert.rejects(() => createSignup(registration(), duplicateNumber.deps), { status: 409 });
});

test("verification rechecks duplicates before creating either database record", async () => {
  const f = fixture();
  const code = await beginSignup(f);
  f.state.users.push({ email: registration().email });
  await assert.rejects(() => verifyOtp(registration().email, code, f.deps), { status: 409 });
  assert.equal(f.state.users.length, 1);
  assert.equal(f.state.students.length, 0);
  assert.equal(f.state.otps.length, 1);
});

test("transaction rollback leaves no partial account and preserves pending OTP", async () => {
  const f = fixture();
  const code = await beginSignup(f);
  const createStudent = f.deps.StudentModel.create;
  f.deps.StudentModel.create = async () => { throw new Error("simulated insert failure"); };
  await assert.rejects(() => verifyOtp(registration().email, code, f.deps), /simulated insert failure/);
  f.deps.StudentModel.create = createStudent;
  assert.equal(f.state.users.length, 0);
  assert.equal(f.state.students.length, 0);
  assert.equal(f.state.otps.length, 1);
});

test("borrowing eligibility explicitly blocks only unverified student users", () => {
  assert.equal(emailVerificationEligibilityReason({ role: "Student", email_verified: false }).code, "EMAIL_NOT_VERIFIED");
  assert.equal(emailVerificationEligibilityReason({ role: "Student", email_verified: true }), null);
  assert.equal(emailVerificationEligibilityReason({ role: "Librarian", email_verified: false }), null);
});
