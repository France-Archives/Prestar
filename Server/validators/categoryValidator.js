// Server/validators/categoryValidator.js

export function validateCreateCategory(req, res, next) {
  const { name, category_name, description } = req.body || {};
  const catName = name ?? category_name;

  if (!catName || typeof catName !== "string" || !catName.trim()) {
    return res.status(400).json({ error: "Category name is required." });
  }

  const trimmedName = catName.trim();
  if (trimmedName.length > 100) {
    return res.status(400).json({ error: "Category name must not exceed 100 characters." });
  }

  if (description !== undefined && description !== null && typeof description !== "string") {
    return res.status(400).json({ error: "Description must be a string." });
  }

  req.cleanCategoryBody = {
    category_name: trimmedName,
    name: trimmedName,
    description: description !== undefined && description !== null ? description.trim() : null,
  };

  return next();
}
