import { Op, QueryTypes } from "sequelize";
import {
  AcademicTerm,
  StudentVerification,
  Suspension,
  User,
  sequelize,
} from "../models/index.js";
import { expireOverdueVerifications } from "./academicTermService.js";

export function emailVerificationEligibilityReason(user) {
  if (user?.role !== "Student" || user.email_verified === true) return null;
  return {
    code: "EMAIL_NOT_VERIFIED",
    message: "Student email address must be verified before borrowing.",
  };
}

/**
 * Checks borrow eligibility for a given user.
 * Single source of truth used at request creation, review/approval, and pickup.
 * Evaluates all conditions and accumulates every failing reason.
 *
 * @param {number|string} userId
 * @param {{ transaction?: import("sequelize").Transaction }} [options]
 * @returns {Promise<{ eligible: boolean, reasons: Array<{ code: string, message: string, [key: string]: any }> }>}
 */
export async function checkBorrowEligibility(userId, options = {}) {
  const transaction = options.transaction || null;
  const reasons = [];

  // 1. USER_NOT_ACTIVE: user must exist, status = 'Active', role = 'Student'
  const user = await User.unscoped().findByPk(userId, {
    attributes: ["user_id", "status", "role", "email_verified"],
    transaction,
  });

  if (!user || user.status !== "Active" || user.role !== "Student") {
    reasons.push({
      code: "USER_NOT_ACTIVE",
      message: "User account is not active.",
    });
  }
  const emailVerificationReason = emailVerificationEligibilityReason(user);
  if (emailVerificationReason) reasons.push(emailVerificationReason);

  // 1b. ACTIVE_SUSPENSION: check if student has an active suspension
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeSuspension = await Suspension.findOne({
    where: {
      user_id: userId,
      status: "Active",
      start_date: { [Op.lte]: todayStr },
      [Op.or]: [
        { end_date: null },
        { end_date: { [Op.gte]: todayStr } },
      ],
    },
    transaction,
  });

  if (activeSuspension) {
    reasons.push({
      code: "ACTIVE_SUSPENSION",
      message: "Student has an active suspension.",
      details: activeSuspension.reason_details,
    });
  }

  // Lazily transition any overdue approved verifications to 'Expired'
  await expireOverdueVerifications(new Date(), { transaction });

  // 2. NO_ACTIVE_TERM: must have an academic_terms row with status = 'Active'
  const activeTerm = await AcademicTerm.findOne({
    where: { status: "Active" },
    attributes: ["term_id", "term_name", "status"],
    transaction,
  });

  if (!activeTerm) {
    reasons.push({
      code: "NO_ACTIVE_TERM",
      message: "No active academic term currently exists.",
    });
  } else {
    // 3. Student verification status for the active term
    const verification = await StudentVerification.findOne({
      where: {
        user_id: userId,
        term_id: activeTerm.term_id,
      },
      attributes: ["verification_id", "status", "valid_from", "valid_until", "remarks"],
      transaction,
    });

    if (!verification) {
      reasons.push({
        code: "VERIFICATION_REQUIRED",
        message: "Student enrollment verification is required for the active academic term.",
      });
    } else if (verification.status === "Pending") {
      reasons.push({
        code: "VERIFICATION_PENDING",
        message: "Student enrollment verification is pending review.",
      });
    } else if (verification.status === "Rejected") {
      reasons.push({
        code: "VERIFICATION_REJECTED",
        message: "Student enrollment verification was rejected.",
        remarks: verification.remarks || null,
      });
    } else if (verification.status === "Expired") {
      reasons.push({
        code: "VERIFICATION_EXPIRED",
        message: "Student enrollment verification has expired for the current date.",
        valid_from: verification.valid_from,
        valid_until: verification.valid_until,
      });
    } else if (verification.status === "Approved") {
      const todayStr = new Date().toISOString().slice(0, 10);
      const isExpired =
        (verification.valid_from && todayStr < verification.valid_from) ||
        (verification.valid_until && todayStr > verification.valid_until);

      if (isExpired) {
        reasons.push({
          code: "VERIFICATION_EXPIRED",
          message: "Student enrollment verification has expired for the current date.",
          valid_from: verification.valid_from,
          valid_until: verification.valid_until,
        });
      }
    } else {
      reasons.push({
        code: "VERIFICATION_REQUIRED",
        message: `Student enrollment verification has unapproved status: ${verification.status}`,
      });
    }
  }

  // 4. ACTIVE_PENALTY: check view v_user_active_penalties for any unpaid/partially paid penalty
  const activePenalties = await sequelize.query(
    `SELECT penalty_id, borrow_id, penalty_type, amount, amount_paid, balance, status
     FROM public.v_user_active_penalties
     WHERE user_id = :userId`,
    {
      replacements: { userId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  if (activePenalties && activePenalties.length > 0) {
    const totalBalance = activePenalties.reduce(
      (sum, p) => sum + Number(p.balance || 0),
      0,
    );
    reasons.push({
      code: "ACTIVE_PENALTY",
      message: `Student has ${activePenalties.length} active penalty/penalties with total balance of ${totalBalance.toFixed(2)}.`,
      penalties: activePenalties,
      total_balance: Number(totalBalance.toFixed(2)),
    });
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

export default {
  checkBorrowEligibility,
};
