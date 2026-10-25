// Server/validators/shelfLocatorValidator.js

export function validateCopyId(req, res, next) {
  const rawId = req.params.copyId || req.params.id;
  const copyId = Number(rawId);

  if (!Number.isInteger(copyId) || copyId <= 0) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      error: "Copy ID must be a positive integer.",
      message: "Copy ID must be a positive integer.",
    });
  }

  req.copyId = copyId;
  return next();
}

export function validateBookIdParam(req, res, next) {
  const rawId = req.params.bookId || req.params.id;
  const bookId = Number(rawId);

  if (!Number.isInteger(bookId) || bookId <= 0) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      error: "Book ID must be a positive integer.",
      message: "Book ID must be a positive integer.",
    });
  }

  req.bookId = bookId;
  return next();
}

export function validateShelfSearchQuery(req, res, next) {
  const { search, bookId, shelfLocation, shelf, status, conditionStatus, page, limit } = req.query;

  let parsedPage = 1;
  let parsedLimit = 20;

  if (page !== undefined && page !== "") {
    parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "page must be a positive integer.",
        message: "page must be a positive integer.",
      });
    }
  }

  if (limit !== undefined && limit !== "") {
    parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "limit must be an integer between 1 and 100.",
        message: "limit must be an integer between 1 and 100.",
      });
    }
  }

  let parsedBookId = undefined;
  if (bookId !== undefined && bookId !== "") {
    parsedBookId = Number(bookId);
    if (!Number.isInteger(parsedBookId) || parsedBookId <= 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "bookId must be a positive integer.",
        message: "bookId must be a positive integer.",
      });
    }
  }

  if (search !== undefined && typeof search !== "string") {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      error: "search must be a string.",
      message: "search must be a string.",
    });
  }

  const effectiveShelf = shelfLocation || shelf;
  if (effectiveShelf !== undefined && typeof effectiveShelf !== "string") {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      error: "shelfLocation must be a string.",
      message: "shelfLocation must be a string.",
    });
  }

  req.shelfQuery = {
    search: search ? search.trim() : undefined,
    bookId: parsedBookId,
    shelfLocation: effectiveShelf ? effectiveShelf.trim() : undefined,
    status: status ? String(status).trim() : undefined,
    conditionStatus: conditionStatus ? String(conditionStatus).trim() : undefined,
    page: parsedPage,
    limit: parsedLimit,
  };

  return next();
}

export function validateUpdateShelfLocation(req, res, next) {
  const rawShelf = req.body?.shelfLocation ?? req.body?.shelf_location;

  if (rawShelf !== undefined && rawShelf !== null) {
    if (typeof rawShelf !== "string") {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "shelfLocation must be a string.",
        message: "shelfLocation must be a string.",
      });
    }
    if (rawShelf.length > 100) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "shelfLocation cannot exceed 100 characters.",
        message: "shelfLocation cannot exceed 100 characters.",
      });
    }
    req.shelfLocationValue = rawShelf.trim();
  } else {
    req.shelfLocationValue = null;
  }

  return next();
}

export function validateBulkShelfLocation(req, res, next) {
  const { copyIds, bookId, shelfLocation, shelf_location } = req.body || {};
  const rawShelf = shelfLocation ?? shelf_location;

  if (rawShelf !== undefined && rawShelf !== null) {
    if (typeof rawShelf !== "string") {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "shelfLocation must be a string.",
        message: "shelfLocation must be a string.",
      });
    }
    if (rawShelf.length > 100) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "shelfLocation cannot exceed 100 characters.",
        message: "shelfLocation cannot exceed 100 characters.",
      });
    }
  }

  if (!Array.isArray(copyIds) && (bookId === undefined || bookId === null || bookId === "")) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      error: "Must provide either copyIds (array) or bookId (positive integer).",
      message: "Must provide either copyIds (array) or bookId (positive integer).",
    });
  }

  if (copyIds !== undefined) {
    if (!Array.isArray(copyIds) || copyIds.length === 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "copyIds must be a non-empty array of copy IDs.",
        message: "copyIds must be a non-empty array of copy IDs.",
      });
    }
  }

  if (bookId !== undefined && bookId !== null) {
    const bId = Number(bookId);
    if (!Number.isInteger(bId) || bId <= 0) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        error: "bookId must be a positive integer.",
        message: "bookId must be a positive integer.",
      });
    }
  }

  req.bulkShelfPayload = {
    copyIds: Array.isArray(copyIds) ? copyIds : undefined,
    bookId: bookId !== undefined && bookId !== null ? Number(bookId) : undefined,
    shelfLocation: typeof rawShelf === "string" ? rawShelf.trim() : null,
  };

  return next();
}
