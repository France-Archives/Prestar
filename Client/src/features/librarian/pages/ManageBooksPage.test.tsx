// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ManageBooksPage from "./ManageBooksPage";
import * as booksService from "@/services/booksService";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/booksService", () => ({
  listBooksForStaff: vi.fn(),
  listCategories: vi.fn(),
  listAuthors: vi.fn(),
  updateBook: vi.fn(),
  createBook: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

const record = {
  id: "42",
  title: "Systems Thinking",
  isbn: "978-1",
  description: "A systems guide",
  coverImageUrl: null,
  authors: [{ id: "5", name: "A. Writer" }],
  category: { id: "2", name: "Science" },
  availability: { availableCopies: 2, totalUsableCopies: 4 },
  publisher: "Academic Press",
  publicationYear: 2021,
  language: "English",
  price: "150.00",
  isArchived: false,
};

function renderPage() {
  return render(<MemoryRouter><ManageBooksPage /></MemoryRouter>);
}

describe("ManageBooksPage live list states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { role: "ADMIN" } as ReturnType<typeof useAuth>["user"],
    } as ReturnType<typeof useAuth>);
    vi.mocked(booksService.listBooksForStaff).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0 },
    });
    vi.mocked(booksService.listCategories).mockResolvedValue([{ id: "2", name: "Science" }]);
    vi.mocked(booksService.listAuthors).mockResolvedValue([{ id: "5", name: "A. Writer" }]);
  });

  it("shows a loading skeleton while the list request is pending", async () => {
    let resolveBooks!: (result: Awaited<ReturnType<typeof booksService.listBooksForStaff>>) => void;
    vi.mocked(booksService.listBooksForStaff).mockReturnValue(new Promise((resolve) => {
      resolveBooks = resolve;
    }));
    renderPage();
    expect(screen.getByRole("status")).toBeTruthy();
    await act(async () => resolveBooks({ data: [], meta: { page: 1, pageSize: 10, total: 0 } }));
  });

  it("shows a retryable error state", async () => {
    vi.mocked(booksService.listBooksForStaff).mockRejectedValueOnce(new Error("Catalog unavailable"));
    renderPage();
    expect(await screen.findByText("Catalog unavailable")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(booksService.listBooksForStaff).toHaveBeenCalledTimes(2));
  });

  it("shows the empty state when the server returns no books", async () => {
    renderPage();
    expect(await screen.findByText("No books match.")).toBeTruthy();
  });

  it("renders the server page and keeps catalog actions hidden for read-only staff", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: "LIBRARIAN", librarian: { permissions: [] } } as unknown as ReturnType<typeof useAuth>["user"],
    } as ReturnType<typeof useAuth>);
    vi.mocked(booksService.listBooksForStaff).mockResolvedValue({
      data: [record],
      meta: { page: 1, pageSize: 10, total: 13 },
    });
    renderPage();
    expect(await screen.findAllByText("Systems Thinking")).toBeTruthy();
    expect(screen.getAllByText("A. Writer").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ISBN").length).toBeGreaterThan(0);
    expect(screen.getAllByText("978-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Add book" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Copies" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("filters by category and submits paginated searches to the service", async () => {
    renderPage();
    const category = screen.getByRole("combobox", { name: "Filter by category" });
    await screen.findByRole("option", { name: "Science" });
    await userEvent.selectOptions(category, "2");
    await waitFor(() => expect(booksService.listBooksForStaff).toHaveBeenLastCalledWith({
      search: undefined,
      categoryId: "2",
      page: 1,
      pageSize: 10,
    }));

    const search = screen.getByPlaceholderText("Search title, ISBN, publisher, or author…");
    fireEvent.change(search, { target: { value: "writer" } });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });
    await waitFor(() => expect(booksService.listBooksForStaff).toHaveBeenLastCalledWith({
      search: "writer",
      categoryId: "2",
      page: 1,
      pageSize: 10,
    }));
  });
});
