import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("./apiClient", () => ({
  apiClient: {
    post: vi.fn(),
    patch: vi.fn(),
  },
  apiGet: vi.fn(),
  apiGetPage: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}));

import { apiClient, apiGet, apiGetPage, apiPatch, apiPost } from "./apiClient";
import {
  createBook,
  createCategory,
  getBook,
  getRecommendedBooks,
  listBooks,
  listBooksForStaff,
  listCategories,
  listAuthors,
  mapRecommendedBook,
  updateBook,
} from "./booksService";

beforeEach(() => vi.clearAllMocks());

describe("live books service", () => {
  const serverBook = {
    id: 42,
    bookId: 42,
    title: "Systems Thinking",
    isbn: "978-1",
    description: "A systems guide",
    coverImageUrl: "https://example.test/cover.webp",
    publicationYear: 2021,
    publisher: "Academic Press",
    language: "English",
    price: "150.00",
    status: "Active",
    author: { id: 5, name: "A. Writer" },
    authors: [{ id: 5, name: "A. Writer" }],
    category: { id: 2, name: "Science" },
    availability: { availableCopies: 2, totalUsableCopies: 4 },
    isArchived: false,
    createdAt: "2026-01-10T12:00:00.000Z",
    updatedAt: "2026-02-15T08:30:00.000Z",
  };

  it("loads the staff book list with server pagination and maps full book fields", async () => {
    vi.mocked(apiGetPage).mockResolvedValue({
      data: [serverBook],
      meta: { page: 2, pageSize: 10, total: 21 },
    });

    await expect(listBooksForStaff({ page: 2, pageSize: 10, search: "writer", categoryId: "2" })).resolves.toEqual({
      data: [{
        id: "42",
        title: "Systems Thinking",
        isbn: "978-1",
        description: "A systems guide",
        coverImageUrl: "https://example.test/cover.webp",
        authors: [{ id: "5", name: "A. Writer" }],
        category: { id: "2", name: "Science" },
        availability: { availableCopies: 2, totalUsableCopies: 4 },
        publisher: "Academic Press",
        publicationYear: 2021,
        language: "English",
        price: "150.00",
        isArchived: false,
      }],
      meta: { page: 2, pageSize: 10, total: 21 },
    });
    expect(apiGetPage).toHaveBeenCalledWith("/books", {
      page: 2,
      limit: 10,
      category_id: 2,
      search: "writer",
    });
  });

  it("creates a book with JSON using the Server's single authorId field", async () => {
    vi.mocked(apiPost).mockResolvedValue(serverBook);

    await expect(createBook({
      title: "Systems Thinking",
      authorIds: ["5"],
      categoryId: "2",
      publicationYear: 2021,
      price: 150,
      initialCopies: 2,
      isbn: null,
    })).resolves.toMatchObject({ id: "42", title: "Systems Thinking", price: "150.00" });
    expect(apiPost).toHaveBeenCalledWith("/books", {
      title: "Systems Thinking",
      authorId: 5,
      categoryId: 2,
      publicationYear: 2021,
      price: 150,
      initialCopies: 2,
      isbn: null,
    });
  });

  it("creates a book with multipart data when a cover file is selected", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: serverBook } });
    const file = new File(["cover"], "cover.webp", { type: "image/webp" });

    await expect(createBook({
      title: "Systems Thinking",
      authorIds: ["5"],
      coverImage: file,
    })).resolves.toMatchObject({ id: "42" });
    const [url, form, config] = vi.mocked(apiClient.post).mock.calls[0];
    expect(url).toBe("/books");
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get("authorId")).toBe("5");
    expect((form as FormData).get("coverImage")).toBe(file);
    expect(config?.headers).toMatchObject({ "Content-Type": "multipart/form-data" });
  });

  it("patches only the changed fields and supports archive and restore updates", async () => {
    vi.mocked(apiPatch).mockResolvedValue(serverBook);
    await expect(updateBook("42", { title: "Changed title" })).resolves.toMatchObject({ id: "42" });
    expect(apiPatch).toHaveBeenNthCalledWith(1, "/books/42", { title: "Changed title" });

    await updateBook("42", { isArchived: true });
    expect(apiPatch).toHaveBeenNthCalledWith(2, "/books/42", { isArchived: true });

    await updateBook("42", { isArchived: false });
    expect(apiPatch).toHaveBeenNthCalledWith(3, "/books/42", { isArchived: false });
  });

  it.each([
    [409, "ISBN already exists"],
    [422, "Author does not exist"],
    [400, "Publication year is invalid"],
  ] as const)("maps live create HTTP %i errors", async (status, message) => {
    vi.mocked(apiPost).mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { status, data: { message } },
    });

    await expect(createBook({ title: "Systems Thinking", authorIds: ["5"] }))
      .rejects.toMatchObject({ status, message });
  });

  it("rejects malformed staff book-list records", async () => {
    vi.mocked(apiGetPage).mockResolvedValue({
      data: [{ id: "no-id", title: "Invalid", availability: { availableCopies: 1, totalUsableCopies: 1 } }],
      meta: { page: 1, pageSize: 10, total: 1 },
    });

    await expect(listBooksForStaff()).rejects.toThrow("The Server returned a book with invalid fields.");
  });

  it("loads and maps live author options", async () => {
    vi.mocked(apiGet).mockResolvedValue([{ id: 7, authorId: 7, name: "Robert C. Martin", firstName: "Robert", lastName: "Martin" }]);
    await expect(listAuthors()).resolves.toEqual([{ id: "7", name: "Robert C. Martin" }]);
    expect(apiGet).toHaveBeenCalledWith("/authors");
  });

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
