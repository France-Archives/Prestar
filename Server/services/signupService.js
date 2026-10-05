// Server/services/signupService.js
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { Op, UniqueConstraintError } from "sequelize";
import {
  Course,
  sequelize,
  Signup,
  SignupVerification,
  Student,
  User,
} from "../models/index.js";

const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("en-US");
const PASSWORD_COST = 12;

export class SignupError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "SignupError";
    this.status = status;
  }
}

function createReferenceNo() {
  return `LIB-${randomUUID().toUpperCase()}`;
}

function matchesStudent(input, student) {
  const identityMatches = normalize(input.first_name) === normalize(student.first_name)
    && normalize(input.last_name) === normalize(student.last_name)
    && normalize(input.email) === normalize(student.email);

  const courseMatches = !input.submitted_course
    || [student.course?.course_code, student.course?.course_name]
      .some((value) => normalize(value) === normalize(input.submitted_course));

  const yearMatches = input.submitted_year_level === undefined
    || Number(student.year_level) === Number(input.submitted_year_level);

  return identityMatches && courseMatches && yearMatches;
}

export async function createSignup(input) {
  const studentId = input.student_id.trim();
  const email = input.email.trim().toLowerCase();

  try {
    return await sequelize.transaction(async (transaction) => {
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { student_id: studentId },
            { email },
          ],
        },
        attributes: ["id"],
        transaction,
      });

      const student = await Student.findByPk(studentId, {
        include: [{ model: Course, as: "course", attributes: ["course_code", "course_name"] }],
        transaction,
      });

      if (existingUser) {
        throw new SignupError(409, "Unable to create an account with those details. Contact the library if you need assistance.");
      }
      if (student && student.enrollment_status !== "Enrolled") {
        throw new SignupError(403, "Only currently enrolled students can create an account. Please contact the library for assistance.");
      }

      const matched = Boolean(student && matchesStudent(input, student));
      const referenceNo = createReferenceNo();
      const passwordHash = await bcrypt.hash(input.password, PASSWORD_COST);
      const signup = await Signup.create({
        reference_no: referenceNo,
        submitted_student_no: studentId,
        student_id: matched ? student.student_id : null,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        email: matched ? normalize(student.email) : email,
        password_hash: passwordHash,
        student_type: input.student_type ?? "Regular",
        submitted_course: input.submitted_course?.trim() || null,
        submitted_year_level: input.submitted_year_level ?? null,
        previous_school: input.previous_school?.trim() || null,
        match_status: matched ? "Matched" : "Unmatched",
        verification_type: matched ? "Automatic" : "Manual",
        status: matched ? "Approved" : "Pending",
        proof_file: input.proof_file ?? null,
        // This system has no email verification or OTP flow.
        email_verified_at: null,
      }, { transaction });

      let user = null;
      if (matched) {
        user = await User.create({
          student_id: student.student_id,
          first_name: student.first_name.trim(),
          last_name: student.last_name.trim(),
          email: normalize(student.email),
          password_hash: passwordHash,
          role: "Student",
          status: "Active",
        }, { transaction });

        await signup.update({ created_user_id: user.id }, { transaction });
      }

      await SignupVerification.create({
        signup_id: signup.signup_id,
        action: matched ? "AUTO_MATCH" : "AUTO_UNMATCHED",
        actor_id: null,
        remarks: matched
          ? "Student record matched; account created and approved automatically."
          : "Automatic student-record check did not match; request queued for manual review.",
      }, { transaction });

      return {
        matched,
        referenceNo,
        user: user ? {
          id: user.id,
          student_id: user.student_id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role,
          status: user.status,
        } : null,
      };
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new SignupError(409, "Unable to create an account with those details. Contact the library if you need assistance.");
    }
    throw error;
  }
}