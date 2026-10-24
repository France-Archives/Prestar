// Server/validators/borrowedBookValidator.js
function parsePositiveId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const str = String(value).trim();
  if (!/^[1-9]\d*$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

export function validateBorrowId(req, res, next) {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    return res
      .status(400)
      .json({ error: "Borrow id must be a positive integer." });
  }
  req.resourceId = id;
  req.validatedLoanId = id;
  return next();
}

export function validateMyLoansQuery(req, res, next) {
  const { status } = req.query;
  const validStatuses = new Set(["Reserved", "Borrowed", "Returned", "Lost", "Cancelled"]);
  if (status !== undefined && status !== "" && !validStatuses.has(status)) {
    return res
      .status(400)
      .json({ error: "status is not a valid loan status." });
  }
  req.loanQuery = {
    status: status || undefined,
  };
  return next();
}

export function validateBorrowedBookStaffQuery(req, res, next) {
  const { status, search, page, limit } = req.query;

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

  if (search !== undefined && typeof search !== "string") {
    return res.status(400).json({ error: "search query must be a string." });
  }

  req.staffLoanQuery = {
    status: status || undefined,
    search: search ? search.trim() : undefined,
    page: parsedPage,
    limit: parsedLimit,
  };
  return next();
}

const ALLOWED_RETURN_CONDITIONS = new Set(["NEW", "GOOD", "FAIR", "DAMAGED", "UNUSABLE"]);

export function validateReturnLoan(req, res, next) {
  const { condition, notes, fineType, fineAmount } = req.body || {};

  if (condition !== undefined && condition !== null) {
    if (typeof condition !== "string") {
      return res.status(400).json({ error: "condition must be a string." });
    }
    const normalized = condition.trim().toUpperCase();
    if (!ALLOWED_RETURN_CONDITIONS.has(normalized)) {
      return res.status(400).json({
        error: `condition must be one of: ${Array.from(ALLOWED_RETURN_CONDITIONS).join(", ")}.`,
      });
    }
    req.returnCondition = normalized;
  } else {
    req.returnCondition = "GOOD";
  }

  if (notes !== undefined && notes !== null) {
    if (typeof notes !== "string") {
      return res.status(400).json({ error: "notes must be a string." });
    }
    if (notes.length > 1000) {
      return res.status(400).json({ error: "notes cannot exceed 1000 characters." });
    }
    req.returnNotes = notes.trim();
  } else {
    req.returnNotes = null;
  }

  req.returnFineType = typeof fineType === "string" ? fineType.trim() : null;
  req.returnFineAmount = Number(fineAmount) > 0 ? Number(fineAmount) : null;

  return next();
}

export function validateMarkLost(req, res, next) {
  const { notes, reason } = req.body || {};
  const noteContent = notes || reason;

  if (noteContent !== undefined && noteContent !== null) {
    if (typeof noteContent !== "string") {
      return res.status(400).json({ error: "notes must be a string." });
    }
    if (noteContent.length > 1000) {
      return res.status(400).json({ error: "notes cannot exceed 1000 characters." });
    }
    req.lostNotes = noteContent.trim();
  } else {
    req.lostNotes = null;
  }

  return next();
}
