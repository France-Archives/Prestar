// Server/services/signupService.js
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Op, UniqueConstraintError } from "sequelize";
import {
  Course,
  sequelize,
  Signup,
  SignupVerification,
  Student,
  User,
} from "../models/index.js";
import { validateProofImage } from "../utils/proofImageValidation.js";

const normalize = (value) => String(value ?? "").trim().toLocaleLowerCase("en-US");
const PASSWORD_COST = 12;
const PROOF_UPLOAD_TOKEN_TTL_SECONDS = 30 * 60;

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

function createProofUploadCapability(referenceNo) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + PROOF_UPLOAD_TOKEN_TTL_SECONDS;
  const token = jwt.sign({
    scope: "signup-proof-upload",
    reference_no: referenceNo,
    iat: issuedAt,
    exp: expiresAt,
  }, secret, { audience: "signup-proof-upload", issuer: "prestar-api" });

  return { token, expiresAt: new Date(expiresAt * 1000).toISOString() };
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
        // Proofs are attached only through the capability-protected upload endpoint.
        proof_image: null,
        proof_mime_type: null,
        // This system has no email verification or OTP flow.
        email_verified_at: null,
      }, { transaction });

      let user = null;
      let proofUpload = null;
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
      } else {
        proofUpload = createProofUploadCapability(referenceNo);
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
        proofUpload,
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

export function verifyProofUploadCapability(token, referenceNo) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }

  try {
    const payload = jwt.verify(token, secret, {
      audience: "signup-proof-upload",
      issuer: "prestar-api",
    });
    if (payload.scope !== "signup-proof-upload" || payload.reference_no !== referenceNo) {
      throw new Error("Invalid proof upload capability.");
    }
  } catch {
    throw new SignupError(401, "Invalid or expired proof upload token.");
  }
}

export async function attachSignupProof(referenceNo, proofImage, proofMimeType) {
  validateProofImage({ buffer: proofImage, mimetype: proofMimeType });

  return sequelize.transaction(async (transaction) => {
    const signup = await Signup.findOne({
      where: { reference_no: referenceNo },
      attributes: ["signup_id", "reference_no", "status", "match_status"],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!signup) {
      throw new SignupError(404, "Pending signup was not found.");
    }
    if (signup.status !== "Pending" || signup.match_status !== "Unmatched") {
      throw new SignupError(409, "Proof can only be attached to an unmatched pending signup.");
    }
    const [updatedCount] = await Signup.update({
      proof_image: proofImage,
      proof_mime_type: proofMimeType,
    }, {
      where: {
        signup_id: signup.signup_id,
        status: "Pending",
        match_status: "Unmatched",
        proof_image: null,
      },
      transaction,
    });
    if (updatedCount === 0) {
      throw new SignupError(409, "Proof has already been uploaded for this signup.");
    }
    await SignupVerification.create({
      signup_id: signup.signup_id,
      action: "PROOF_UPLOADED",
      actor_id: null,
      remarks: "Proof of enrollment uploaded for manual review.",
    }, { transaction });

    return { referenceNo: signup.reference_no };
  });
}