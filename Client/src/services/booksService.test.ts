import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("./apiClient", () => ({
  apiGet: vi.fn(),
  apiGetPage: vi.fn(),
}));

import { apiGet, apiGetPage } from "./apiClient";
import { getBook, listBooks, listCategories } from "./booksService";

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

  it("does not present mock category data when no live category endpoint exists", async () => {
    await expect(listCategories()).resolves.toEqual([]);
  });
});
