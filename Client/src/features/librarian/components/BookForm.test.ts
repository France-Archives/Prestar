import { describe, expect, it } from "vitest";
import {
  bookFormErrorFields,
  validateBookForm,
  validateCoverFile,
  type BookFormValues,
} from "./BookForm";

const validValues: BookFormValues = {
  title: "A thoughtful book",
  isbn: "",
  description: "",
  categoryId: "",
  publisher: "",
  publicationYear: "2020",
  language: "",
  price: "12.50",
  initialCopies: "0",
  coverImageUrl: "",
};

describe("book form validation", () => {
  it("requires a title and author", () => {
    expect(validateBookForm({ ...validValues, title: " " }, "", [], null, true)).toMatchObject({
      title: "Title is required.",
      author: "Choose an author.",
    });
  });

  it.each(["999", "3001", "20x0"])("rejects publication year %s outside the Server range", (year) => {
    expect(validateBookForm({ ...validValues, publicationYear: year }, "7", [], null, true))
      .toHaveProperty("publicationYear", "Enter a year from 1000 to 3000.");
  });

  it("accepts year boundaries and validates price", () => {
    expect(validateBookForm({ ...validValues, publicationYear: "1000", price: "-1" }, "7", [], null, true))
      .toHaveProperty("price", "Enter a non-negative price.");
    expect(validateBookForm({ ...validValues, publicationYear: "3000", price: "0" }, "7", [], null, true))
      .toEqual({});
  });

  it("validates image MIME type and the 5 MB size limit", () => {
    const unsupported = new File(["x"], "cover.gif", { type: "image/gif" });
    expect(validateCoverFile(unsupported)).toBe("Choose a JPEG, PNG, or WebP image.");

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "cover.png", { type: "image/png" });
    expect(validateCoverFile(oversized)).toBe("Cover images must be 5 MB or smaller.");

    const valid = new File(["cover"], "cover.webp", { type: "image/webp" });
    expect(validateCoverFile(valid)).toBeNull();
  });

  it("maps ISBN and author/category Server errors to their fields", () => {
    expect(bookFormErrorFields({ isAxiosError: true, response: { status: 409, data: { message: "ISBN already exists." } } }))
      .toEqual({ fields: { isbn: "ISBN already exists." }, message: null });
    expect(bookFormErrorFields({ isAxiosError: true, response: { status: 422, data: { message: "The chosen author does not exist." } } }))
      .toEqual({ fields: { author: "The chosen author does not exist." }, message: null });
    expect(bookFormErrorFields({ isAxiosError: true, response: { status: 422, data: { message: "The chosen category does not exist." } } }))
      .toEqual({ fields: { categoryId: "The chosen category does not exist." }, message: null });
  });
});
