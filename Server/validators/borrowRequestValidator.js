// Server/validators/borrowRequestValidator.js
const requestStatuses = new Set(["Pending", "Approved", "Issued", "Rejected", "Cancelled", "Expired"]);

function parsePositiveId(value) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function validateCreateBorrowRequest(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "A JSON request body is required." });
  }
  const rawBookId = req.body.book_id;
  if (typeof rawBookId !== "number" && typeof rawBookId !== "string") {
    return res.status(400).json({ error: "book_id must be a positive integer." });
  }
  if (typeof rawBookId === "number" && (!Number.isSafeInteger(rawBookId) || rawBookId < 1)) {
    return res.status(400).json({ error: "book_id must be a positive integer." });
  }
  const bookId = parsePositiveId(String(rawBookId));
  if (bookId === null) return res.status(400).json({ error: "book_id must be a positive integer." });
  req.validatedBookId = bookId;
  return next();
}

export function validateRequestId(req, res, next) {
  const id = parsePositiveId(req.params.id);
  if (id === null) return res.status(400).json({ error: "Request id must be a positive integer." });
  req.resourceId = id;
  return next();
}

export function validateRequestListQuery(req, res, next) {
  const status = req.query.status;
  if (status !== undefined && !requestStatuses.has(status)) {
    return res.status(400).json({ error: "status is not a valid borrow request status." });
  }
  req.requestStatus = status;
  return next();
}

export function validateReviewBorrowRequest(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "A JSON request body is required." });
  }
  const { decision, remarks } = req.body;
  if (decision !== "approve" && decision !== "reject") {
    return res.status(400).json({ error: "decision must be 'approve' or 'reject'." });
  }
  if (remarks !== undefined && (typeof remarks !== "string" || remarks.trim().length > 2000)) {
    return res.status(400).json({ error: "remarks must be a string up to 2000 characters." });
  }
  if (decision === "reject" && (typeof remarks !== "string" || !remarks.trim())) {
    return res.status(400).json({ error: "remarks is required when rejecting a request." });
  }
  req.reviewInput = { decision, remarks: remarks?.trim() || "" };
  return next();
}
