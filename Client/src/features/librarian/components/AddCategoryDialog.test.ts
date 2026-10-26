import { describe, expect, it } from "vitest";
import {
  addCreatedCategory,
  categoryCreateError,
  validateCategoryName,
} from "./AddCategoryDialog";

describe("add category dialog helpers", () => {
  it("requires a name and enforces the 100-character limit", () => {
    expect(validateCategoryName("   ")).toBe("A category name is required.");
    expect(validateCategoryName("x".repeat(101))).toBe("Category name must be 100 characters or fewer.");
    expect(validateCategoryName("History")).toBeNull();
  });

  it("adds a saved category and returns its ID for automatic selection", () => {
    const before = [{ id: "1", name: "History" }];
    const saved = { id: "2", name: "Science", description: null };

    expect(addCreatedCategory(before, saved)).toEqual({
      categories: [...before, saved],
      selectedCategoryId: "2",
    });
  });

  it("maps duplicate names to a name field error and permission failures to a form alert", () => {
    expect(categoryCreateError({ isAxiosError: true, response: { status: 409, data: { message: "Duplicate." } } }))
      .toEqual({ nameError: "Category already exists.", formError: null });
    expect(categoryCreateError({ isAxiosError: true, response: { status: 403, data: { message: "Forbidden." } } }))
      .toEqual({ nameError: null, formError: "Forbidden." });
  });
});
