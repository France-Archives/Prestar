// Server/services/academicTermService.js
import { Op } from "sequelize";
import { AcademicTerm, StudentVerification, User, sequelize } from "../models/index.js";
import { withActor } from "../utils/withActor.js";

/**
 * Calculates academic term details based on calendar month rules:
 * - Aug to Dec (months 8-12): 1st Term (ends Dec 31)
 * - Jan to May (months 1-5): 2nd Term (ends May 31)
 * - June to July (months 6-7): Summer Term (ends July 31)
 *
 * @param {Date|string} [dateInput]
 * @returns {{
 *   termType: '1st Term'|'2nd Term'|'Summer',
 *   termName: string,
 *   academicYear: string,
 *   startDate: string,
 *   endDate: string,
 *   corDeadline: string
 * }}
 */
export function calculateTermWindow(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date provided for term calculation.");
  }

  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1 to 12

  if (month >= 8 && month <= 12) {
    // 1st Term: Aug 1 to Dec 31
    const ay = `${year}-${year + 1}`;
    return {
      termType: "1st Term",
      termName: `1st Semester ${ay}`,
      academicYear: ay,
      startDate: `${year}-08-01`,
      endDate: `${year}-12-31`,
      corDeadline: `${year}-12-31`,
    };
  }

  if (month >= 1 && month <= 5) {
    // 2nd Term: Jan 1 to May 31
    const ay = `${year - 1}-${year}`;
    return {
      termType: "2nd Term",
      termName: `2nd Semester ${ay}`,
      academicYear: ay,
      startDate: `${year}-01-01`,
      endDate: `${year}-05-31`,
      corDeadline: `${year}-05-31`,
    };
  }

  // June to July: Summer Term
  const ay = `${year - 1}-${year}`;
  return {
    termType: "Summer",
    termName: `Summer Term ${ay}`,
    academicYear: ay,
    startDate: `${year}-06-01`,
    endDate: `${year}-07-31`,
    corDeadline: `${year}-07-31`,
  };
}

/**
 * Formats a Date object or string as YYYY-MM-DD.
 */
export function formatDateOnly(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return d.toISOString().slice(0, 10);
}

/**
 * Finds or creates the AcademicTerm record in the database for the given date.
 */
export async function getOrCreateTermForDate(dateInput = new Date(), options = {}) {
  const transaction = options.transaction || null;
  const window = calculateTermWindow(dateInput);

  let term = await AcademicTerm.findOne({
    where: {
      [Op.or]: [
        { term_name: window.termName },
        {
          start_date: window.startDate,
          end_date: window.endDate,
        },
      ],
    },
    transaction,
  });

  if (!term) {
    term = await AcademicTerm.create(
      {
        term_name: window.termName,
        start_date: window.startDate,
        end_date: window.endDate,
        cor_deadline: window.corDeadline,
        status: "Active",
      },
      { transaction },
    );
  }

  return term;
}

/**
 * Checks if a string is a valid ISO date in YYYY-MM-DD format.
 */
function isValidDateStr(str) {
  if (!str || typeof str !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

/**
 * Normalizes status string to match PostgreSQL check constraint ('Upcoming' | 'Active' | 'Completed').
 */
function normalizeTermStatus(status) {
  if (!status) return "Upcoming";
  const s = String(status).trim().toUpperCase();
  if (s === "ACTIVE") return "Active";
  if (s === "COMPLETED") return "Completed";
  if (s === "UPCOMING") return "Upcoming";
  const firstCap = s.charAt(0) + s.slice(1).toLowerCase();
  if (["Active", "Upcoming", "Completed"].includes(firstCap)) return firstCap;
  return null;
}

/**
 * Formats an AcademicTerm database instance to match frontend expectations.
 */
export function formatAcademicTerm(term) {
  const plain = typeof term.get === "function" ? term.get({ plain: true }) : term;
  const statusStr = String(plain.status || "Upcoming").trim();
  const statusUpper = statusStr.toUpperCase();

  return {
    id: String(plain.term_id),
    termId: Number(plain.term_id),
    name: plain.term_name,
    termName: plain.term_name,
    startDate: plain.start_date,
    endDate: plain.end_date,
    corDeadline: plain.cor_deadline,
    status: statusUpper,
    statusLabel: statusStr,
    createdAt: plain.created_at ? new Date(plain.created_at).toISOString() : undefined,
    updatedAt: plain.updated_at ? new Date(plain.updated_at).toISOString() : undefined,
  };
}

/**
 * Returns all academic terms, sorted by start_date ascending (or descending).
 */
export async function listAcademicTerms() {
  const terms = await AcademicTerm.findAll({
    order: [["start_date", "ASC"], ["term_id", "ASC"]],
  });

  return terms.map(formatAcademicTerm);
}

/**
 * Gets a single academic term by ID.
 */
export async function getAcademicTermById(termId) {
  const id = Number(termId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Term ID must be a positive integer.");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const term = await AcademicTerm.findByPk(id);
  if (!term) {
    const err = new Error("We could not find that academic term.");
    err.status = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  return formatAcademicTerm(term);
}

/**
 * Creates a new AcademicTerm (Admin only).
 * Audited via withActor(actorUserId).
 */
export async function createAcademicTerm(payload, actorUserId) {
  const name = String(payload.name || payload.term_name || payload.termName || "").trim();
  const startDate = payload.startDate || payload.start_date;
  const endDate = payload.endDate || payload.end_date;
  const corDeadline = payload.corDeadline || payload.cor_deadline || endDate;
  const rawStatus = payload.status;

  if (!name || name.length > 100) {
    const err = new Error("Term name is required and must not exceed 100 characters.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (!isValidDateStr(startDate)) {
    const err = new Error("A valid start date (YYYY-MM-DD) is required.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (!isValidDateStr(endDate)) {
    const err = new Error("A valid end date (YYYY-MM-DD) is required.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (endDate < startDate) {
    const err = new Error("End date must be on or after start date.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (!isValidDateStr(corDeadline)) {
    const err = new Error("A valid COR deadline (YYYY-MM-DD) is required.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (corDeadline < startDate) {
    const err = new Error("COR deadline cannot be before the start date.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (corDeadline > endDate) {
    const err = new Error("The COR deadline cannot be after the end date.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const normalizedStatus = normalizeTermStatus(rawStatus) || "Upcoming";

  // Check unique term name
  const existingName = await AcademicTerm.findOne({
    where: { term_name: name },
  });
  if (existingName) {
    const err = new Error(`An academic term with the name "${name}" already exists.`);
    err.status = 409;
    err.code = "CONFLICT";
    throw err;
  }

  // Active term conflict check
  if (normalizedStatus === "Active") {
    const existingActive = await AcademicTerm.findOne({
      where: { status: "Active" },
    });
    if (existingActive) {
      const err = new Error("Another term is already active. Mark it completed first.");
      err.status = 409;
      err.code = "CONFLICT";
      throw err;
    }
  }

  return withActor(actorUserId, async (transaction) => {
    const created = await AcademicTerm.create(
      {
        term_name: name,
        start_date: startDate,
        end_date: endDate,
        cor_deadline: corDeadline,
        status: normalizedStatus,
      },
      { transaction },
    );

    return formatAcademicTerm(created);
  });
}

/**
 * Updates an existing AcademicTerm (Admin only).
 * Audited via withActor(actorUserId).
 */
export async function updateAcademicTerm(termId, payload, actorUserId) {
  const id = Number(termId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error("Term ID must be a positive integer.");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const term = await AcademicTerm.findByPk(id);
  if (!term) {
    const err = new Error("We could not find that academic term.");
    err.status = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const name = payload.name !== undefined || payload.term_name !== undefined || payload.termName !== undefined
    ? String(payload.name ?? payload.term_name ?? payload.termName ?? "").trim()
    : term.term_name;

  if (name.length === 0 || name.length > 100) {
    const err = new Error("Term name is required and must not exceed 100 characters.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  // If name changed, check uniqueness
  if (name !== term.term_name) {
    const existingName = await AcademicTerm.findOne({
      where: {
        term_name: name,
        term_id: { [Op.ne]: id },
      },
    });
    if (existingName) {
      const err = new Error(`An academic term with the name "${name}" already exists.`);
      err.status = 409;
      err.code = "CONFLICT";
      throw err;
    }
  }

  const startDate = payload.startDate || payload.start_date || term.start_date;
  const endDate = payload.endDate || payload.end_date || term.end_date;
  const corDeadline = payload.corDeadline || payload.cor_deadline || term.cor_deadline;

  if (!isValidDateStr(startDate)) {
    const err = new Error("A valid start date (YYYY-MM-DD) is required.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (!isValidDateStr(endDate)) {
    const err = new Error("A valid end date (YYYY-MM-DD) is required.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (endDate < startDate) {
    const err = new Error("End date must be on or after start date.");
    err.status = 422;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  if (corDeadline) {
    if (!isValidDateStr(corDeadline)) {
      const err = new Error("A valid COR deadline (YYYY-MM-DD) is required.");
      err.status = 422;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (corDeadline < startDate) {
      const err = new Error("COR deadline cannot be before the start date.");
      err.status = 422;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (corDeadline > endDate) {
      const err = new Error("The COR deadline cannot be after the end date.");
      err.status = 422;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
  }

  let normalizedStatus = term.status;
  if (payload.status !== undefined) {
    const parsed = normalizeTermStatus(payload.status);
    if (!parsed) {
      const err = new Error("Invalid status. Allowed values are Upcoming, Active, Completed.");
      err.status = 422;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    normalizedStatus = parsed;
  }

  // Active term conflict check if becoming active
  if (normalizedStatus === "Active" && term.status !== "Active") {
    const existingActive = await AcademicTerm.findOne({
      where: {
        status: "Active",
        term_id: { [Op.ne]: id },
      },
    });
    if (existingActive) {
      const err = new Error("Another term is already active. Mark it completed first.");
      err.status = 409;
      err.code = "CONFLICT";
      throw err;
    }
  }

  return withActor(actorUserId, async (transaction) => {
    await term.update(
      {
        term_name: name,
        start_date: startDate,
        end_date: endDate,
        cor_deadline: corDeadline,
        status: normalizedStatus,
      },
      { transaction },
    );

    return formatAcademicTerm(term);
  });
}


/**
 * Checks and updates any 'Approved' verifications whose valid_until
 * has passed, transitioning their status to 'Expired'.
 *
 * @param {Date|string} [asOfDate=new Date()]
 * @param {object} [options={}]
 * @returns {Promise<number>} Number of expired verifications updated
 */
export async function expireOverdueVerifications(asOfDate = new Date(), options = {}) {
  const transaction = options.transaction || null;
  const todayStr = formatDateOnly(asOfDate);

  const [affectedCount] = await StudentVerification.update(
    { status: "Expired" },
    {
      where: {
        status: "Approved",
        valid_until: { [Op.lt]: todayStr },
      },
      transaction,
    },
  );

  return affectedCount;
}

/**
 * Formats a student verification row into clean camelCase matching frontend CorVerification.
 */
export function formatVerification(row, term = null) {
  const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
  const t = term || plain.term || null;

  return {
    id: plain.verification_id,
    userId: plain.user_id,
    academicTermId: plain.term_id,
    termId: plain.term_id,
    termName: t?.term_name || null,
    status: plain.status,
    submittedAt: plain.submitted_at,
    reviewedBy: plain.reviewed_by,
    reviewedAt: plain.reviewed_at,
    validFrom: plain.valid_from,
    effectiveFrom: plain.valid_from,
    validUntil: plain.valid_until,
    remarks: plain.remarks,
    rejectionReason: plain.status === "Rejected" ? plain.remarks : null,
  };
}

/**
 * Staff approves a student verification (COR):
 * - Academic term is assigned dynamically based on the approval date.
 * - Start date (valid_from) is set to the approval date.
 * - Expiry date (valid_until) is set to the end of the month of the respective term.
 * - Status is set to 'Approved'.
 *
 * @param {{
 *   verificationId: number|string,
 *   reviewerId: number|string,
 *   approvalDate?: Date|string,
 *   remarks?: string
 * }} params
 */
export async function approveStudentVerification({
  verificationId,
  reviewerId,
  approvalDate = new Date(),
  remarks = "Approved",
}) {
  return withActor(reviewerId, async (transaction) => {
    // 1. Verify reviewer is an active Librarian or Admin
    const reviewer = await User.findByPk(reviewerId, {
      attributes: ["user_id", "role", "status"],
      transaction,
    });

    if (
      !reviewer ||
      reviewer.status !== "Active" ||
      !["Librarian", "Admin"].includes(reviewer.role)
    ) {
      const err = new Error("Only an active librarian or admin can review student verification.");
      err.status = 403;
      throw err;
    }

    // 2. Load verification record
    const verification = await StudentVerification.findByPk(verificationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!verification) {
      const err = new Error("Student verification record not found.");
      err.status = 404;
      throw err;
    }

    const appDate = approvalDate instanceof Date ? approvalDate : new Date(approvalDate);
    const appDateStr = formatDateOnly(appDate);

    // 3. Resolve academic term based on when the user gets approved
    const term = await getOrCreateTermForDate(appDate, { transaction });

    // 4. Update verification fields
    await verification.update(
      {
        term_id: term.term_id,
        valid_from: appDateStr,
        valid_until: term.end_date, // End of the month of the respective term
        status: "Approved",
        reviewed_by: reviewerId,
        reviewed_at: appDate,
        remarks: remarks || "Approved",
      },
      { transaction },
    );

    return formatVerification(verification, term);
  });
}

/**
 * Staff rejects a student verification.
 */
export async function rejectStudentVerification({
  verificationId,
  reviewerId,
  remarks,
  rejectionDate = new Date(),
}) {
  if (!remarks || !remarks.trim()) {
    const err = new Error("A reason/remarks is required to reject student verification.");
    err.status = 400;
    throw err;
  }

  return withActor(reviewerId, async (transaction) => {
    const reviewer = await User.findByPk(reviewerId, {
      attributes: ["user_id", "role", "status"],
      transaction,
    });

    if (
      !reviewer ||
      reviewer.status !== "Active" ||
      !["Librarian", "Admin"].includes(reviewer.role)
    ) {
      const err = new Error("Only an active librarian or admin can review student verification.");
      err.status = 403;
      throw err;
    }

    const verification = await StudentVerification.findByPk(verificationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!verification) {
      const err = new Error("Student verification record not found.");
      err.status = 404;
      throw err;
    }

    const rejDate = rejectionDate instanceof Date ? rejectionDate : new Date(rejectionDate);

    await verification.update(
      {
        status: "Rejected",
        reviewed_by: reviewerId,
        reviewed_at: rejDate,
        remarks: remarks.trim(),
      },
      { transaction },
    );

    return formatVerification(verification);
  });
}
