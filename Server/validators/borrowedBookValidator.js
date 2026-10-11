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
