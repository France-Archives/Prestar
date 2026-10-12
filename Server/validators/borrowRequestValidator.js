// Server/validators/borrowRequestValidator.js
import { MAX_REQUEST_DAYS } from "../config/libraryRules.js";

const allowedStatuses = new Set([
  "Pending",
  "Approved",
  "Rejected",
  "Cancelled",
  "Fulfilled",
  "Expired",
]);

function parsePositiveId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const str = String(value).trim();
  if (!/^[1-9]\d*$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

export function validateCreateBorrowRequest(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "A JSON request body is required." });
  }

  const rawBookId = req.body.book_id ?? req.body.bookId;
  const bookId = parsePositiveId(rawBookId);
  if (bookId === null) {
    return res
      .status(400)
      .json({ error: "book_id must be a positive integer." });
  }

  const rawRequestedDays =
    req.body.requested_days ??
    req.body.requestedDays ??
    req.body.requestedDurationDays ??
    req.body.duration ??
    req.body.days;

  let requestedDays;
  if (rawRequestedDays === undefined || rawRequestedDays === null || rawRequestedDays === "") {
    requestedDays = 7;
  } else {
    requestedDays = parsePositiveId(rawRequestedDays);
    if (
      requestedDays === null ||
      requestedDays < 1 ||
      requestedDays > MAX_REQUEST_DAYS
    ) {
      return res.status(400).json({
        error: `requested_days must be an integer between 1 and ${MAX_REQUEST_DAYS}.`,
      });
    }
  }

  req.validatedBookId = bookId;
  req.validatedInput = {
    book_id: bookId,
    bookId: bookId,
    requested_days: requestedDays,
    requestedDays: requestedDays,
    requestedDurationDays: requestedDays,
  };
  return next();
}

export function validateRequestId(req, res, next) {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    return res
      .status(400)
      .json({ error: "Request id must be a positive integer." });
  }
  req.resourceId = id;
  return next();
}

export function validateRequestListQuery(req, res, next) {
  const { status, page, limit } = req.query;

  if (status !== undefined && status !== "" && !allowedStatuses.has(status)) {
    return res
      .status(400)
      .json({ error: "status is not a valid borrow request status." });
  }

  let parsedPage = 1;
  if (page !== undefined && page !== "") {
    parsedPage = parsePositiveId(page);
    if (parsedPage === null) {
      return res.status(400).json({ error: "page must be a positive integer." });
    }
  }

  let parsedLimit = 10;
  if (limit !== undefined && limit !== "") {
    parsedLimit = parsePositiveId(limit);
    if (parsedLimit === null || parsedLimit > 50) {
      return res
        .status(400)
        .json({ error: "limit must be a positive integer up to 50." });
    }
  }

  req.pagination = {
    status: status || undefined,
    page: parsedPage,
    limit: parsedLimit,
  };
  return next();
}

export function validateReviewBorrowRequest(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "A JSON request body is required." });
  }

  const { decision, remarks, copy_id } = req.body;
  if (decision !== "approve" && decision !== "reject") {
    return res
      .status(400)
      .json({ error: "decision must be 'approve' or 'reject'." });
  }

  if (
    remarks !== undefined &&
    remarks !== null &&
    (typeof remarks !== "string" || remarks.trim().length > 2000)
  ) {
    return res
      .status(400)
      .json({ error: "remarks must be a string up to 2000 characters." });
  }

  if (decision === "reject" && (!remarks || !remarks.trim())) {
    return res
      .status(400)
      .json({ error: "remarks is required when rejecting a request." });
  }

  let parsedCopyId = null;
  if (copy_id !== undefined && copy_id !== null && copy_id !== "") {
    parsedCopyId = parsePositiveId(copy_id);
    if (parsedCopyId === null) {
      return res
        .status(400)
        .json({ error: "copy_id must be a positive integer." });
    }
  }

  req.reviewInput = {
    decision,
    remarks: remarks ? remarks.trim() : "",
    ...(parsedCopyId !== null ? { copy_id: parsedCopyId } : {}),
  };
  return next();
}
