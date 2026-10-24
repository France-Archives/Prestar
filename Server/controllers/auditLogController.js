// Server/controllers/auditLogController.js
import { getAuditLogs, recordAuditEntry } from "../services/auditLogService.js";

/**
 * GET /api/admin/audit-logs or GET /api/audit-logs
 *
 * Query params:
 * - from: YYYY-MM-DD
 * - to: YYYY-MM-DD
 * - actorRole: ADMIN | LIBRARIAN | STUDENT
 * - action: action code filter
 * - search: keyword search
 * - page: 1-based page number
 * - pageSize / limit: items per page
 */
export async function getAuditLogsHandler(req, res, next) {
  try {
    const result = await getAuditLogs(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/admin/audit-logs
 * Optional endpoint for explicit audit logging
 */
export async function recordAuditLogHandler(req, res, next) {
  try {
    const actorUserId = req.user?.id;
    const { action, entityType, entityTable, entityId, summary, details } = req.body || {};

    const entry = await recordAuditEntry({
      actorUserId,
      action,
      entityTable: entityTable || entityType,
      entityId,
      summary,
      newValues: details,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(201).json({
      message: "Audit entry recorded successfully.",
      data: entry,
    });
  } catch (error) {
    return next(error);
  }
}
