// Server/controllers/verificationController.js
import {
  approveStudentVerification,
  expireOverdueVerifications,
  formatDateOnly,
  formatVerification,
  getOrCreateTermForDate,
  listAcademicTerms,
  rejectStudentVerification,
} from "../services/academicTermService.js";
import { AcademicTerm, StudentVerification, User } from "../models/index.js";
import { Op } from "sequelize";

/**
 * GET /api/academic-terms
 */
export async function getTerms(req, res, next) {
  try {
    const terms = await listAcademicTerms();
    return res.status(200).json(terms);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/me/verifications or GET /api/verifications/me
 */
export async function getMyVerifications(req, res, next) {
  try {
    await expireOverdueVerifications();

    const verifications = await StudentVerification.findAll({
      where: { user_id: req.user.id },
      include: [{ model: AcademicTerm, as: "term" }],
      order: [["submitted_at", "DESC"]],
    });

    const formatted = verifications.map((v) => formatVerification(v));
    return res.status(200).json(formatted);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/me/verifications or POST /api/verifications
 * Student submits COR document proof.
 */
export async function submitVerification(req, res, next) {
  try {
    const userId = req.user.id;
    const proofFile = req.body.proof_file || req.body.proofFile || req.body.file || "cor_proof_uploaded";

    // Resolve or find active term for today
    const term = await getOrCreateTermForDate(new Date());

    // Mark previous pending uploads for the same term as superseded/deleted
    await StudentVerification.destroy({
      where: {
        user_id: userId,
        term_id: term.term_id,
        status: "Pending",
      },
    });

    const verification = await StudentVerification.create({
      user_id: userId,
      term_id: term.term_id,
      proof_file: typeof proofFile === "string" ? proofFile : JSON.stringify(proofFile),
      status: "Pending",
      submitted_at: new Date(),
    });

    return res.status(201).json(formatVerification(verification, term));
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/staff/verifications
 * Librarian or Admin views queue.
 */
export async function getStaffQueue(req, res, next) {
  try {
    await expireOverdueVerifications();

    const { status, search } = req.query;
    const where = {};
    if (status) {
      where.status = status;
    }

    const verifications = await StudentVerification.findAll({
      where,
      include: [
        { model: AcademicTerm, as: "term" },
        {
          model: User,
          as: "user",
          attributes: ["user_id", "first_name", "last_name", "email", "role"],
        },
      ],
      order: [["submitted_at", "DESC"]],
    });

    const formatted = verifications.map((v) => {
      const base = formatVerification(v);
      const studentUser = v.user;
      return {
        ...base,
        student: studentUser
          ? {
              id: studentUser.user_id,
              name: `${studentUser.first_name || ""} ${studentUser.last_name || ""}`.trim(),
              email: studentUser.email,
            }
          : null,
      };
    });

    return res.status(200).json(formatted);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/staff/verifications/:id/approve
 * Approves COR:
 * - Assigns academic term based on when approval happens
 * - Sets valid_from to approval date
 * - Sets valid_until to end of the month of the term
 * - Updates status to 'Approved'
 */
export async function approveVerificationHandler(req, res, next) {
  try {
    const verificationId = req.params.id;
    const reviewerId = req.user.id;
    const remarks = req.body.remarks || "Approved";

    const result = await approveStudentVerification({
      verificationId,
      reviewerId,
      approvalDate: new Date(),
      remarks,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/staff/verifications/:id/reject
 */
export async function rejectVerificationHandler(req, res, next) {
  try {
    const verificationId = req.params.id;
    const reviewerId = req.user.id;
    const remarks = req.body.reason || req.body.remarks;

    const result = await rejectStudentVerification({
      verificationId,
      reviewerId,
      remarks,
      rejectionDate: new Date(),
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}
