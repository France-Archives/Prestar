// Server/validators/bookValidator.js
function parsePositiveInteger(value, field, { fallback, max } = {}) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || (max !== undefined && parsed > max)) return null;
  return parsed;
}

export function validateBookListQuery(req, res, next) {
  const page = parsePositiveInteger(req.query.page, "page", { fallback: 1 });
  const limit = parsePositiveInteger(req.query.limit, "limit", { fallback: 20, max: 100 });
  const rawCategoryId =
    req.query.category_id ??
    req.query.categoryId ??
    req.query.category ??
    req.params.categoryId ??
    req.params.id;
  const categoryId =
    rawCategoryId === undefined || rawCategoryId === ""
      ? undefined
      : parsePositiveInteger(rawCategoryId, "category_id");
  const search = req.query.search;

  if (page === null) return res.status(400).json({ error: "page must be a positive integer." });
  if (limit === null) return res.status(400).json({ error: "limit must be an integer from 1 to 100." });
  if (rawCategoryId !== undefined && rawCategoryId !== "" && categoryId === null) {
    return res.status(400).json({ error: "category_id must be a positive integer." });
  }
  if (search !== undefined && (typeof search !== "string" || search.trim().length > 100)) {
    return res.status(400).json({ error: "search must be a string up to 100 characters." });
  }

  req.bookQuery = { page, limit, categoryId, search: search?.trim() || undefined };
  return next();
}

export function validateBookId(req, res, next) {
  const id = parsePositiveInteger(req.params.id, "id");
  if (id === null) return res.status(400).json({ error: "Book id must be a positive integer." });
  req.resourceId = id;
  return next();
}

export function validateCreateBook(req, res, next) {
  const { title, isbn, publicationYear, year_published, price } = req.body || {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ error: "Title is required and must be a non-empty string." });
  }

  if (title.trim().length > 300) {
    return res.status(400).json({ error: "Title must not exceed 300 characters." });
  }

  if (isbn !== undefined && isbn !== null && isbn !== "") {
    if (typeof isbn !== "string" || isbn.trim().length > 20) {
      return res.status(400).json({ error: "ISBN must be a string up to 20 characters." });
    }
  }

  const year = publicationYear !== undefined ? publicationYear : year_published;
  if (year !== undefined && year !== null && year !== "") {
    const numYear = Number(year);
    if (!Number.isInteger(numYear) || numYear < 1000 || numYear > 3000) {
      return res.status(400).json({ error: "Publication year must be a 4-digit integer between 1000 and 3000." });
    }
  }

  if (price !== undefined && price !== null && price !== "") {
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ error: "Price must be a non-negative number." });
    }
  }

  return next();
}

export function validateUpdateBook(req, res, next) {
  const { title, isbn, publicationYear, year_published, price } = req.body || {};

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Title cannot be empty." });
    }
    if (title.trim().length > 300) {
      return res.status(400).json({ error: "Title must not exceed 300 characters." });
    }
  }

  if (isbn !== undefined && isbn !== null && isbn !== "") {
    if (typeof isbn !== "string" || isbn.trim().length > 20) {
      return res.status(400).json({ error: "ISBN must be a string up to 20 characters." });
    }
  }

  const year = publicationYear !== undefined ? publicationYear : year_published;
  if (year !== undefined && year !== null && year !== "") {
    const numYear = Number(year);
    if (!Number.isInteger(numYear) || numYear < 1000 || numYear > 3000) {
      return res.status(400).json({ error: "Publication year must be a 4-digit integer between 1000 and 3000." });
    }
  }

  if (price !== undefined && price !== null && price !== "") {
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ error: "Price must be a non-negative number." });
    }
  }

  return next();
}
