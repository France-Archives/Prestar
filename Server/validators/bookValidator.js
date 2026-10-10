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
  const categoryId = req.query.category_id === undefined
    ? undefined
    : parsePositiveInteger(req.query.category_id, "category_id");
  const search = req.query.search;

  if (page === null) return res.status(400).json({ error: "page must be a positive integer." });
  if (limit === null) return res.status(400).json({ error: "limit must be an integer from 1 to 100." });
  if (req.query.category_id !== undefined && categoryId === null) return res.status(400).json({ error: "category_id must be a positive integer." });
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
