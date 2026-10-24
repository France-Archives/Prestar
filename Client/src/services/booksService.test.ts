import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("./apiClient", () => ({
  apiGet: vi.fn(),
  apiGetPage: vi.fn(),
  apiPost: vi.fn(),
}));

import { apiGet, apiGetPage, apiPost } from "./apiClient";
import { createCategory, getBook, getRecommendedBooks, listBooks, listCategories, mapRecommendedBook } from "./booksService";

beforeEach(() => vi.clearAllMocks());

describe("live books service", () => {
  it("maps catalog fields and backend pagination while translating query parameters", async () => {
    vi.mocked(apiGetPage).mockResolvedValue({
      data: [{
        id: 41,
        title: "Example Book",
        isbn: "123",
        description: "A description",
        coverImageUrl: "/cover.png",
        author: { id: 8, name: "A. Author" },
        authors: [{ id: 8, name: "A. Author" }],
        category: { id: 6, name: "History" },
        availability: { availableCopies: 2, totalUsableCopies: 3 },
      }],
      meta: { page: 2, pageSize: 12, total: 25 },
    });

    await expect(listBooks({
      page: 2,
      pageSize: 12,
      categoryId: "6",
      search: "  history  ",
    })).resolves.toEqual({
      data: [{
        id: "41",
        title: "Example Book",
        isbn: "123",
        description: "A description",
        coverImageUrl: "/cover.png",
        authors: [{ id: "8", name: "A. Author" }],
        category: { id: "6", name: "History" },
        availability: { availableCopies: 2, totalUsableCopies: 3 },
      }],
      meta: { page: 2, pageSize: 12, total: 25 },
    });
    expect(apiGetPage).toHaveBeenCalledWith("/books", {
      page: 2,
      limit: 12,
      category_id: 6,
      search: "history",
    });
  });

  it("applies availability filtering before client-side pagination across backend pages", async () => {
    const books = Array.from({ length: 100 }, (_, index) => ({
      id: index + 1,
      title: `Book ${index + 1}`,
      availability: { availableCopies: 0, totalUsableCopies: 1 },
    }));
    vi.mocked(apiGetPage)
      .mockResolvedValueOnce({
        data: books,
        meta: { page: 1, pageSize: 100, total: 101 },
      })
      .mockResolvedValueOnce({
        data: [{
          id: 101,
          title: "Available title",
          availability: { availableCopies: 1, totalUsableCopies: 1 },
        }],
        meta: { page: 2, pageSize: 100, total: 101 },
      });

    await expect(listBooks({
      page: 1,
      pageSize: 12,
      availability: "AVAILABLE",
    })).resolves.toEqual({
      data: [{
        id: "101",
        title: "Available title",
        isbn: null,
        description: null,
        coverImageUrl: null,
        authors: [],
        category: null,
        availability: { availableCopies: 1, totalUsableCopies: 1 },
      }],
      meta: { page: 1, pageSize: 12, total: 1 },
    });
    expect(apiGetPage).toHaveBeenNthCalledWith(1, "/books", {
      page: 1,
      limit: 100,
    });
    expect(apiGetPage).toHaveBeenNthCalledWith(2, "/books", {
      page: 2,
      limit: 100,
    });
  });

  it("uses valid integer detail IDs and maps the backend detail response", async () => {
    vi.mocked(apiGet).mockResolvedValue({
      id: 42,
      title: "Detail Book",
      publisher: "Press",
      publicationYear: 2020,
      language: "English",
      isArchived: false,
      authors: [{ id: 9, name: "Writer" }],
      category: { id: 7, name: "Fiction" },
      availability: { availableCopies: 1, totalUsableCopies: 2 },
    });

    await expect(getBook("42")).resolves.toMatchObject({
      id: "42",
      title: "Detail Book",
      publisher: "Press",
      publicationYear: 2020,
      authors: [{ id: "9", name: "Writer" }],
      category: { id: "7", name: "Fiction" },
    });
    expect(apiGet).toHaveBeenCalledWith("/books/42");
  });

  it("rejects mock UUIDs rather than substituting another live book ID", async () => {
    await expect(getBook("mock-book-id")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("maps the live category list fields and preserves string IDs", async () => {
    vi.mocked(apiGet).mockResolvedValue([
      { id: "6", categoryId: 6, name: "History", description: "Past events" },
      { id: "7", categoryId: 7, name: "Science", description: null },
    ]);

    await expect(listCategories()).resolves.toEqual([
      { id: "6", name: "History", description: "Past events" },
      { id: "7", name: "Science", description: null },
    ]);
    expect(apiGet).toHaveBeenCalledWith("/categories");
  });

  it("rejects an invalid live category list", async () => {
    vi.mocked(apiGet).mockResolvedValue({ categories: [] });

    await expect(listCategories()).rejects.toThrow("The Server returned an invalid category list.");
  });

  it("loads and maps live personalized recommendations", async () => {
    vi.mocked(apiGet).mockResolvedValue([{
      id: 13,
      bookId: 13,
      title: "Popular book",
      category: { id: 2, name: "Science" },
      availability: { availableCopies: 2, totalUsableCopies: 3 },
    }]);

    await expect(getRecommendedBooks()).resolves.toEqual([{
      id: "13",
      title: "Popular book",
      isbn: null,
      description: null,
      category: { id: "2", name: "Science" },
      authors: [],
      availability: { availableCopies: 2, totalUsableCopies: 3 },
      coverImageUrl: null,
    }]);
    expect(apiGet).toHaveBeenCalledWith("/me/recommended-books");
  });

  it("rejects malformed recommendation records", () => {
    expect(() => mapRecommendedBook({ id: 13, title: "Missing availability" }))
      .toThrow("The Server returned a recommended book with invalid fields.");
  });

  it("posts and maps a live category", async () => {
    vi.mocked(apiPost).mockResolvedValue({
      id: 15,
      categoryId: 15,
      name: "Artificial Intelligence",
      description: "Books on AI",
    });

    await expect(createCategory({ name: "Artificial Intelligence", description: "  Books on AI  " })).resolves.toEqual({
      id: "15",
      name: "Artificial Intelligence",
      description: "Books on AI",
    });
    expect(apiPost).toHaveBeenCalledWith("/categories", {
      name: "Artificial Intelligence",
      description: "Books on AI",
    });
  });

  it.each([
    [409, "CONFLICT", "Category name already exists."],
    [400, "VALIDATION_ERROR", "Category name is required."],
  ] as const)("normalizes live category create HTTP %i errors", async (status, code, message) => {
    vi.mocked(apiPost).mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { status, data: { message } },
    });

    await expect(createCategory({ name: "History" })).rejects.toMatchObject({ status, code, message });
  });
});
