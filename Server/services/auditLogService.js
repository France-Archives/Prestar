// Server/services/auditLogService.js
import { Op } from "sequelize";
import { AuditLog, User } from "../models/index.js";

/**
 * Helper to parse a date string into start-of-day Date in UTC/local.
 */
function parseStartDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(`${clean}T00:00:00.000Z`);
  }
  const d = new Date(clean);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Helper to parse a date string into end-of-day Date (inclusive 23:59:59.999).
 */
function parseEndDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(`${clean}T23:59:59.999Z`);
  }
  const d = new Date(clean);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Resolves the effective actor user ID from the audit record or its JSON values.
 */
function extractActorUserId(row) {
  if (row.actor_user_id) return Number(row.actor_user_id);

  const nv = row.new_values || {};
  const ov = row.old_values || {};

  const possible = [
    nv.received_by,
    nv.waived_by,
    nv.reviewed_by,
    nv.created_by,
    nv.issued_by,
    nv.assigned_by,
    ov.received_by,
    ov.waived_by,
    ov.reviewed_by,
  ];

  for (const id of possible) {
    if (id !== undefined && id !== null && id !== "") {
      const num = Number(id);
      if (!Number.isNaN(num) && num > 0) return num;
    }
  }

  return null;
}

/**
 * Maps raw database action and table into a clean frontend action code, entityType, and summary.
 */
function interpretAction(row) {
  const table = (row.entity_table || "").toLowerCase();
  const rawAction = (row.action || "").toUpperCase();
  const nv = row.new_values || {};
  const ov = row.old_values || {};

  // If new_values or old_values has a pre-stored explicit summary or action, prioritize it
  if (nv.summary && typeof nv.summary === "string") {
    return {
      action: nv.action || rawAction,
      entityType: nv.entityType || table.toUpperCase(),
      summary: nv.summary,
    };
  }

  // 1. Penalties
  if (table === "penalties") {
    const penaltyType = nv.penalty_type || ov.penalty_type || "Penalty";
    const amount = nv.amount !== undefined ? Number(nv.amount).toFixed(2) : (ov.amount !== undefined ? Number(ov.amount).toFixed(2) : "0.00");

    if (nv.status === "Waived" || (ov.status !== "Waived" && nv.status === "Waived")) {
      const reason = nv.waive_remarks || nv.reason || "Approved waiver";
      return {
        action: "FINE_WAIVED",
        entityType: "FINE",
        summary: `Waived ${penaltyType} penalty of ₱${amount}: ${reason}`,
      };
    }
    if (nv.status === "Paid" || (ov.status !== "Paid" && nv.status === "Paid")) {
      return {
        action: "FINE_SETTLED",
        entityType: "FINE",
        summary: `Settled ${penaltyType} penalty of ₱${amount} in full.`,
      };
    }
    if (rawAction.includes("INSERT")) {
      return {
        action: "FINE_ASSESSED",
        entityType: "FINE",
        summary: `Assessed ${penaltyType} fine of ₱${amount}${nv.reason ? ` (${nv.reason})` : ""}.`,
      };
    }
    return {
      action: "FINE_UPDATED",
      entityType: "FINE",
      summary: `Updated penalty #${row.entity_id || nv.penalty_id || ""}: status is ${nv.status || "Unpaid"}.`,
    };
  }

  // 2. Payments
  if (table === "payments") {
    const amount = Number(nv.amount || ov.amount || 0).toFixed(2);
    const receipt = nv.receipt_no || nv.reference_number || "N/A";
    const method = nv.payment_method || "Cash";
    return {
      action: "PAYMENT_RECORDED",
      entityType: "PAYMENT",
      summary: `Recorded ${method} payment of ₱${amount} (Receipt: ${receipt}).`,
    };
  }

  // 3. Borrow Requests
  if (table === "borrow_requests") {
    const reqId = row.entity_id || nv.request_id || ov.request_id || "";
    if (nv.status === "Approved" || (ov.status !== "Approved" && nv.status === "Approved")) {
      return {
        action: "REQUEST_APPROVED",
        entityType: "BORROWING_REQUEST",
        summary: `Approved borrow request #${reqId} and reserved copy for pickup.`,
      };
    }
    if (nv.status === "Rejected") {
      const why = nv.remarks || "Eligibility check failed";
      return {
        action: "REQUEST_REJECTED",
        entityType: "BORROWING_REQUEST",
        summary: `Rejected borrow request #${reqId}: ${why}`,
      };
    }
    if (nv.status === "Cancelled") {
      return {
        action: "REQUEST_CANCELLED",
        entityType: "BORROWING_REQUEST",
        summary: `Cancelled borrow request #${reqId}.`,
      };
    }
    if (rawAction.includes("INSERT")) {
      return {
        action: "REQUEST_CREATED",
        entityType: "BORROWING_REQUEST",
        summary: `Student submitted borrow request #${reqId} for book #${nv.book_id || ""}.`,
      };
    }
    return {
      action: "REQUEST_UPDATED",
      entityType: "BORROWING_REQUEST",
      summary: `Updated borrow request #${reqId} to ${nv.status || "Unknown"}.`,
    };
  }

  // 4. Borrowed Books (Loans)
  if (table === "borrowed_books") {
    const borrowId = row.entity_id || nv.borrow_id || ov.borrow_id || "";
    if (nv.status === "Returned") {
      return {
        action: "LOAN_RETURNED",
        entityType: "LOAN",
        summary: `Received returned borrowed book #${borrowId}.`,
      };
    }
    if (nv.status === "Lost") {
      return {
        action: "LOAN_MARKED_LOST",
        entityType: "LOAN",
        summary: `Marked borrowed book #${borrowId} as lost.`,
      };
    }
    if (nv.status === "Overdue") {
      return {
        action: "LOAN_OVERDUE",
        entityType: "LOAN",
        summary: `Marked borrowed book #${borrowId} as overdue.`,
      };
    }
    if (rawAction.includes("INSERT")) {
      return {
        action: "HANDOVER_CLAIMED",
        entityType: "LOAN",
        summary: `Confirmed handover & released copy #${nv.copy_id || ""} for loan #${borrowId}.`,
      };
    }
    return {
      action: "LOAN_UPDATED",
      entityType: "LOAN",
      summary: `Updated loan #${borrowId} to ${nv.status || "Active"}.`,
    };
  }

  // 5. Returned Books
  if (table === "returned_books") {
    const borrowId = nv.borrow_id || ov.borrow_id || row.entity_id || "";
    const condition = nv.condition_status || "Good";
    return {
      action: "LOAN_RETURNED",
      entityType: "RETURNED_BOOK",
      summary: `Accepted return for loan #${borrowId} in "${condition}" condition.`,
    };
  }

  // 6. Student Verifications (COR)
  if (table === "student_verifications") {
    const verId = row.entity_id || nv.verification_id || "";
    if (nv.status === "Approved") {
      return {
        action: "COR_APPROVED",
        entityType: "STUDENT_VERIFICATION",
        summary: `Approved student COR verification #${verId}.`,
      };
    }
    if (nv.status === "Rejected") {
      return {
        action: "COR_REJECTED",
        entityType: "STUDENT_VERIFICATION",
        summary: `Rejected student COR verification #${verId}: ${nv.remarks || "Invalid document"}.`,
      };
    }
    if (rawAction.includes("INSERT")) {
      return {
        action: "COR_SUBMITTED",
        entityType: "STUDENT_VERIFICATION",
        summary: `Student submitted Certificate of Registration for verification #${verId}.`,
      };
    }
    return {
      action: "COR_UPDATED",
      entityType: "STUDENT_VERIFICATION",
      summary: `Updated student verification #${verId} status to ${nv.status || ""}.`,
    };
  }

  // 7. Books & Copies
  if (table === "books") {
    const title = nv.title || ov.title || `Book #${row.entity_id || ""}`;
    if (rawAction.includes("INSERT")) {
      return {
        action: "BOOK_CREATED",
        entityType: "BOOK",
        summary: `Added "${title}"${nv.isbn ? ` (ISBN: ${nv.isbn})` : ""} to the library catalog.`,
      };
    }
    if (rawAction.includes("UPDATE")) {
      return {
        action: "BOOK_UPDATED",
        entityType: "BOOK",
        summary: `Updated catalog details for "${title}".`,
      };
    }
    return {
      action: "BOOK_DELETED",
      entityType: "BOOK",
      summary: `Removed book "${title}" from the catalog.`,
    };
  }

  if (table === "book_copies") {
    const acc = nv.accession_no || ov.accession_no || `#${row.entity_id || ""}`;
    if (rawAction.includes("INSERT")) {
      return {
        action: "BOOK_COPY_ADDED",
        entityType: "BOOK_COPY",
        summary: `Added new physical copy (${acc}) in ${nv.condition_status || "Good"} condition.`,
      };
    }
    if (rawAction.includes("UPDATE")) {
      return {
        action: "BOOK_COPY_UPDATED",
        entityType: "BOOK_COPY",
        summary: `Updated copy ${acc}: status "${nv.status || "Available"}", condition "${nv.condition_status || "Good"}".`,
      };
    }
    return {
      action: "BOOK_COPY_DELETED",
      entityType: "BOOK_COPY",
      summary: `Removed copy ${acc} from inventory.`,
    };
  }

  // 8. Categories & Authors
  if (table === "categories") {
    const name = nv.category_name || ov.category_name || "category";
    return {
      action: rawAction.includes("INSERT") ? "CATEGORY_CREATED" : "CATEGORY_UPDATED",
      entityType: "CATEGORY",
      summary: `${rawAction.includes("INSERT") ? "Created" : "Updated"} category "${name}".`,
    };
  }
  if (table === "authors") {
    const name = `${nv.first_name || ""} ${nv.last_name || ""}`.trim() || "Author";
    return {
      action: rawAction.includes("INSERT") ? "AUTHOR_CREATED" : "AUTHOR_UPDATED",
      entityType: "AUTHOR",
      summary: `${rawAction.includes("INSERT") ? "Added" : "Updated"} author "${name}".`,
    };
  }

  // 9. Users & Staff
  if (table === "librarians" && rawAction.includes("INSERT")) {
    return {
      action: "LIBRARIAN_CREATED",
      entityType: "USER",
      summary: `Created new Librarian account (ID #${nv.user_id || row.entity_id || ""}).`,
    };
  }
  if (table === "admins" && rawAction.includes("INSERT")) {
    return {
      action: "ADMIN_CREATED",
      entityType: "USER",
      summary: `Created new Administrator account (ID #${nv.user_id || row.entity_id || ""}).`,
    };
  }
  if (table === "users") {
    const name = `${nv.first_name || ov.first_name || ""} ${nv.last_name || ov.last_name || ""}`.trim();
    if (rawAction.includes("UPDATE")) {
      if (ov.status && nv.status && ov.status !== nv.status) {
        return {
          action: "USER_STATUS_CHANGED",
          entityType: "USER",
          summary: `Changed status of ${name || `User #${row.entity_id}`} from ${ov.status} to ${nv.status}.`,
        };
      }
      return {
        action: "USER_UPDATED",
        entityType: "USER",
        summary: `Updated user profile for ${name || `User #${row.entity_id}`}.`,
      };
    }
    if (rawAction.includes("INSERT")) {
      return {
        action: "USER_REGISTERED",
        entityType: "USER",
        summary: `Registered ${nv.role || "User"} account for ${name || nv.email || ""}.`,
      };
    }
  }

  // 10. Academic Terms
  if (table === "academic_terms") {
    const name = nv.term_name || ov.term_name || "Academic Term";
    return {
      action: rawAction.includes("INSERT") ? "TERM_CREATED" : "TERM_UPDATED",
      entityType: "ACADEMIC_TERM",
      summary: `${rawAction.includes("INSERT") ? "Created" : "Updated"} academic term "${name}".`,
    };
  }

  // 11. Reservations & Renewals
  if (table === "reservations") {
    return {
      action: rawAction.includes("INSERT") ? "RESERVATION_PLACED" : "RESERVATION_UPDATED",
      entityType: "RESERVATION",
      summary: `${rawAction.includes("INSERT") ? "Placed" : "Updated"} reservation #${row.entity_id || ""}.`,
    };
  }
  if (table === "renewals") {
    return {
      action: "LOAN_RENEWED",
      entityType: "RENEWAL",
      summary: `Processed loan renewal #${row.entity_id || ""}.`,
    };
  }

  // Generic fallback
  return {
    action: rawAction,
    entityType: table ? table.toUpperCase() : "SYSTEM",
    summary: `${rawAction} on ${table || "record"} #${row.entity_id || ""}`.trim(),
  };
}

/**
 * Lists audit logs with date filtering (from, to), actor role, search, and pagination.
 *
 * @param {object} params
 * @param {string} [params.from] - YYYY-MM-DD
 * @param {string} [params.to] - YYYY-MM-DD
 * @param {string} [params.actorRole] - "ADMIN" | "LIBRARIAN" | "STUDENT"
 * @param {string} [params.action] - Action code filter
 * @param {string} [params.search] - Search text
 * @param {number|string} [params.page=1]
 * @param {number|string} [params.pageSize=15]
 * @param {number|string} [params.limit=15]
 * @returns {Promise<{ data: Array<object>, meta: { page: number, pageSize: number, total: number }, auditLogs: Array<object> }>}
 */
export async function getAuditLogs(params = {}) {
  const {
    from,
    to,
    actorRole,
    action,
    search,
    page = 1,
    pageSize,
    limit,
  } = params;

  const numPage = Math.max(1, parseInt(page, 10) || 1);
  const numPageSize = Math.max(1, Math.min(100, parseInt(pageSize || limit, 10) || 15));

  const where = {};

  // Date filtering based on from and to
  const startDate = parseStartDate(from);
  const endDate = parseEndDate(to);

  if (startDate && endDate) {
    where.created_at = { [Op.between]: [startDate, endDate] };
  } else if (startDate) {
    where.created_at = { [Op.gte]: startDate };
  } else if (endDate) {
    where.created_at = { [Op.lte]: endDate };
  }

  // Fetch candidate audit logs with eager loading of actor
  const logs = await AuditLog.findAll({
    where,
    include: [
      {
        model: User,
        as: "actor",
        attributes: ["user_id", "first_name", "last_name", "role", "email"],
        required: false,
      },
    ],
    order: [
      ["created_at", "DESC"],
      ["audit_id", "DESC"],
    ],
  });

  // Collect any missing actor IDs from new_values/old_values for logs where actor is null
  const missingUserIds = new Set();
  for (const log of logs) {
    if (!log.actor) {
      const effectiveId = extractActorUserId(log);
      if (effectiveId) missingUserIds.add(effectiveId);
    }
  }

  // Batch-fetch any unassociated users
  const userMap = new Map();
  if (missingUserIds.size > 0) {
    const users = await User.findAll({
      where: { user_id: { [Op.in]: Array.from(missingUserIds) } },
      attributes: ["user_id", "first_name", "last_name", "role", "email"],
    });
    for (const u of users) {
      userMap.set(Number(u.user_id), u);
    }
  }

  // Format all rows into the frontend AuditLog structure
  let formatted = logs.map((log) => {
    const raw = typeof log.get === "function" ? log.get({ plain: true }) : log;
    let actorUser = raw.actor || null;
    let effectiveActorId = raw.actor_user_id ? Number(raw.actor_user_id) : null;

    if (!actorUser) {
      effectiveActorId = extractActorUserId(raw);
      if (effectiveActorId && userMap.has(effectiveActorId)) {
        actorUser = userMap.get(effectiveActorId);
      }
    }

    const actorName = actorUser
      ? `${actorUser.first_name || ""} ${actorUser.last_name || ""}`.trim() || actorUser.email || "Staff User"
      : "System";

    const actorRoleUpper = actorUser?.role
      ? actorUser.role.toUpperCase()
      : (raw.entity_table === "penalties" || raw.entity_table === "payments" ? "LIBRARIAN" : "ADMIN");

    const interpreted = interpretAction(raw);

    return {
      id: String(raw.audit_id),
      auditId: String(raw.audit_id),
      actorUserId: effectiveActorId ? String(effectiveActorId) : "",
      actorName,
      actorRole: actorRoleUpper, // "ADMIN" | "LIBRARIAN" | "STUDENT"
      action: interpreted.action,
      entityType: interpreted.entityType,
      entityId: raw.entity_id ? String(raw.entity_id) : null,
      summary: interpreted.summary,
      createdAt: raw.created_at ? new Date(raw.created_at).toISOString() : new Date().toISOString(),
    };
  });

  // Apply actorRole filter if supplied
  if (actorRole && typeof actorRole === "string" && actorRole.trim()) {
    const targetRole = actorRole.trim().toUpperCase();
    formatted = formatted.filter((item) => item.actorRole === targetRole);
  }

  // Apply action filter if supplied
  if (action && typeof action === "string" && action.trim()) {
    const targetAction = action.trim().toUpperCase();
    formatted = formatted.filter((item) =>
      item.action.toUpperCase() === targetAction || item.action.toUpperCase().includes(targetAction)
    );
  }

  // Apply search query across summary, actorName, action, and entityType
  if (search && typeof search === "string" && search.trim()) {
    const q = search.trim().toLowerCase();
    formatted = formatted.filter((item) => {
      return (
        item.summary.toLowerCase().includes(q) ||
        item.actorName.toLowerCase().includes(q) ||
        item.action.toLowerCase().includes(q) ||
        item.entityType.toLowerCase().includes(q)
      );
    });
  }

  const total = formatted.length;
  const offset = (numPage - 1) * numPageSize;
  const paginatedData = formatted.slice(offset, offset + numPageSize);

  return {
    data: paginatedData,
    auditLogs: paginatedData,
    meta: {
      page: numPage,
      pageSize: numPageSize,
      total,
    },
  };
}

/**
 * Explicit helper to record an audit log entry from application logic if needed.
 */
export async function recordAuditEntry({
  actorUserId,
  action,
  entityTable,
  entityId,
  summary,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  transaction = null,
}) {
  const payload = {
    actor_user_id: actorUserId ? Number(actorUserId) : null,
    action: action || "MANUAL_AUDIT",
    entity_table: entityTable || "system",
    entity_id: entityId ? String(entityId) : null,
    old_values: oldValues,
    new_values: summary ? { ...(newValues || {}), summary } : newValues,
    ip_address: ipAddress,
    user_agent: userAgent,
    created_at: new Date(),
  };

  return AuditLog.create(payload, { transaction });
}

export default {
  getAuditLogs,
  recordAuditEntry,
};
