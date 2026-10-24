// Server/tests/academicTermsAndVerification.test.js
import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  AcademicTerm,
  StudentVerification,
  Student,
  User,
  sequelize,
} from "../models/index.js";
import {
  calculateTermWindow,
  getOrCreateTermForDate,
  approveStudentVerification,
  rejectStudentVerification,
  expireOverdueVerifications,
} from "../services/academicTermService.js";
import { checkBorrowEligibility } from "../services/borrowEligibilityService.js";

describe("Academic Terms & COR Verification Lifecycle Test Suite", () => {
  let librarianUser;
  let studentUser;
  let studentProfile;
  let uniqueSuffix;

  before(async () => {
    uniqueSuffix = Date.now();

    // 1. Staff librarian
    librarianUser = await User.create({
      first_name: "Head",
      last_name: "Librarian",
      email: `librarian_${uniqueSuffix}@prestar.edu`,
      password_hash: "dummyhash",
      role: "Librarian",
      status: "Active",
      email_verified: true,
    });

    // 2. Student user & student profile
    studentUser = await User.create({
      first_name: "Juan",
      last_name: "Dela Cruz",
      email: `student_${uniqueSuffix}@prestar.edu`,
      password_hash: "dummyhash",
      role: "Student",
      status: "Active",
      email_verified: true,
    });

    studentProfile = await Student.create({
      user_id: studentUser.id,
      student_number: `SN-${uniqueSuffix}`,
      course: "BS Information Technology",
      year_level: 2,
    });
  });

  describe("1. Academic Term Time Period Calculation Rules", () => {
    it("August to December maps to 1st Term, ends Dec 31", () => {
      // August
      const augWindow = calculateTermWindow(new Date("2026-08-15"));
      assert.equal(augWindow.termType, "1st Term");
      assert.equal(augWindow.startDate, "2026-08-01");
      assert.equal(augWindow.endDate, "2026-12-31");
      assert.equal(augWindow.corDeadline, "2026-12-31");

      // October
      const octWindow = calculateTermWindow(new Date("2026-10-12"));
      assert.equal(octWindow.termType, "1st Term");
      assert.equal(octWindow.endDate, "2026-12-31");

      // December
      const decWindow = calculateTermWindow(new Date("2026-12-25"));
      assert.equal(decWindow.termType, "1st Term");
      assert.equal(decWindow.endDate, "2026-12-31");
    });

    it("January to May maps to 2nd Term, ends May 31", () => {
      // January
      const janWindow = calculateTermWindow(new Date("2027-01-10"));
      assert.equal(janWindow.termType, "2nd Term");
      assert.equal(janWindow.startDate, "2027-01-01");
      assert.equal(janWindow.endDate, "2027-05-31");
      assert.equal(janWindow.corDeadline, "2027-05-31");

      // March
      const marWindow = calculateTermWindow(new Date("2027-03-20"));
      assert.equal(marWindow.termType, "2nd Term");
      assert.equal(marWindow.endDate, "2027-05-31");

      // May
      const mayWindow = calculateTermWindow(new Date("2027-05-31"));
      assert.equal(mayWindow.termType, "2nd Term");
      assert.equal(mayWindow.endDate, "2027-05-31");
    });

    it("June to July maps to Summer Term, ends July 31", () => {
      // June
      const junWindow = calculateTermWindow(new Date("2027-06-15"));
      assert.equal(junWindow.termType, "Summer");
      assert.equal(junWindow.startDate, "2027-06-01");
      assert.equal(junWindow.endDate, "2027-07-31");
      assert.equal(junWindow.corDeadline, "2027-07-31");

      // July
      const julWindow = calculateTermWindow(new Date("2027-07-28"));
      assert.equal(julWindow.termType, "Summer");
      assert.equal(julWindow.endDate, "2027-07-31");
    });
  });

  describe("2. COR Approval Lifecycle & Deadline Assignment", () => {
    it("Approval in October sets valid_from=approval date and valid_until=Dec 31 (1st Term)", async () => {
      const approvalDate = new Date("2026-10-15");
      const tempTerm = await getOrCreateTermForDate(approvalDate);

      const verification = await StudentVerification.create({
        user_id: studentUser.id,
        term_id: tempTerm.term_id,
        proof_file: "test_cor_october.pdf",
        status: "Pending",
        submitted_at: new Date("2026-10-14"),
      });

      const approved = await approveStudentVerification({
        verificationId: verification.verification_id,
        reviewerId: librarianUser.id,
        approvalDate,
        remarks: "COR verified for First Term",
      });

      assert.equal(approved.status, "Approved");
      assert.equal(approved.validFrom, "2026-10-15"); // Start date filled upon approval
      assert.equal(approved.validUntil, "2026-12-31"); // End of term month
      assert.ok(approved.termName.includes("1st Semester"));

      // Clean up verification
      await verification.destroy();
    });

    it("Approval in February sets valid_from=approval date and valid_until=May 31 (2nd Term)", async () => {
      const approvalDate = new Date("2027-02-10");
      const tempTerm = await getOrCreateTermForDate(approvalDate);

      const verification = await StudentVerification.create({
        user_id: studentUser.id,
        term_id: tempTerm.term_id,
        proof_file: "test_cor_feb.pdf",
        status: "Pending",
        submitted_at: new Date("2027-02-05"),
      });

      const approved = await approveStudentVerification({
        verificationId: verification.verification_id,
        reviewerId: librarianUser.id,
        approvalDate,
        remarks: "Approved for Second Term",
      });

      assert.equal(approved.status, "Approved");
      assert.equal(approved.validFrom, "2027-02-10");
      assert.equal(approved.validUntil, "2027-05-31");
      assert.ok(approved.termName.includes("2nd Semester"));

      await verification.destroy();
    });

    it("Approval in June sets valid_from=approval date and valid_until=July 31 (Summer Term)", async () => {
      const approvalDate = new Date("2027-06-05");
      const tempTerm = await getOrCreateTermForDate(approvalDate);

      const verification = await StudentVerification.create({
        user_id: studentUser.id,
        term_id: tempTerm.term_id,
        proof_file: "test_cor_summer.pdf",
        status: "Pending",
        submitted_at: new Date("2027-06-01"),
      });

      const approved = await approveStudentVerification({
        verificationId: verification.verification_id,
        reviewerId: librarianUser.id,
        approvalDate,
        remarks: "Approved for Summer Term",
      });

      assert.equal(approved.status, "Approved");
      assert.equal(approved.validFrom, "2027-06-05");
      assert.equal(approved.validUntil, "2027-07-31");
      assert.ok(approved.termName.includes("Summer Term"));

      await verification.destroy();
    });
  });

  describe("3. Expiry Date & Borrow Eligibility Enforcement", () => {
    it("When valid_until has passed, expireOverdueVerifications updates status to 'Expired'", async () => {
      const pastTerm = await getOrCreateTermForDate(new Date("2025-08-15"));

      // Create an approved verification that expired in the past (e.g. 2025-12-31)
      const expiredRecord = await StudentVerification.create({
        user_id: studentUser.id,
        term_id: pastTerm.term_id,
        proof_file: "past_cor.pdf",
        status: "Approved",
        reviewed_by: librarianUser.id,
        reviewed_at: new Date("2025-09-01"),
        valid_from: "2025-09-01",
        valid_until: "2025-12-31", // in the past
      });

      // Run expireOverdueVerifications as of today
      await expireOverdueVerifications(new Date());

      // Verify DB record status is updated to 'Expired'
      const refreshed = await StudentVerification.findByPk(expiredRecord.verification_id);
      assert.equal(refreshed.status, "Expired");

      await expiredRecord.destroy();
    });

    it("Borrow eligibility blocks students with expired COR with VERIFICATION_EXPIRED reason", async () => {
      const currentTerm = await getOrCreateTermForDate(new Date());

      const expiredRecord = await StudentVerification.create({
        user_id: studentUser.id,
        term_id: currentTerm.term_id,
        proof_file: "expired_cor.pdf",
        status: "Expired",
        reviewed_by: librarianUser.id,
        reviewed_at: new Date("2026-08-01"),
        valid_from: "2026-08-01",
        valid_until: "2026-08-10",
      });

      const eligibility = await checkBorrowEligibility(studentUser.id);
      assert.equal(eligibility.eligible, false);
      const expiredReason = eligibility.reasons.find((r) => r.code === "VERIFICATION_EXPIRED");
      assert.ok(expiredReason, "Expected VERIFICATION_EXPIRED reason");

      await expiredRecord.destroy();
    });
  });

  after(async () => {
    try {
      await StudentVerification.destroy({ where: { user_id: studentUser.id } });
      if (studentProfile) await studentProfile.destroy();
      if (studentUser) await studentUser.destroy();
      if (librarianUser) await librarianUser.destroy();
    } catch (e) {
      console.error("Cleanup error in test:", e);
    }
  });
});
