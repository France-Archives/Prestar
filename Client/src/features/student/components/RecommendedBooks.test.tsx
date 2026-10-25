// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookSummary } from "@/types";
import * as booksService from "@/services/booksService";
import RecommendedBooks from "./RecommendedBooks";

vi.mock("@/services/booksService", () => ({ getRecommendedBooks: vi.fn() }));
vi.mock("@/features/books/components/BookGrid", () => ({
  default: ({ books }: { books: BookSummary[] }) => (
    <ul aria-label="Recommended book cards">{books.map((book) => <li key={book.id}>{book.title}</li>)}</ul>
  ),
}));

const book: BookSummary = {
  id: "3",
  title: "A Book",
  isbn: null,
  description: null,
  category: { id: "2", name: "Science" },
  authors: [],
  availability: { availableCopies: 2, totalUsableCopies: 3 },
  coverImageUrl: null,
};

function renderRecommendations(books: BookSummary[] | null) {
  return render(<MemoryRouter><RecommendedBooks books={books} /></MemoryRouter>);
}

describe("dashboard recommended books", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the dashboard recommendation list without an extra request", () => {
    renderRecommendations([book]);
    expect(screen.getByText("A Book")).toBeTruthy();
    expect(booksService.getRecommendedBooks).not.toHaveBeenCalled();
  });

  it("renders the empty state and edit-interests link for an empty list", () => {
    renderRecommendations([]);
    expect(screen.getByText("No books match your interests yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Edit interests" }).getAttribute("href")).toBe("/app/interests");
  });

  it("loads the recommendations endpoint when the dashboard value is null", async () => {
    vi.mocked(booksService.getRecommendedBooks).mockResolvedValue([book]);
    renderRecommendations(null);
    expect(await screen.findByText("A Book")).toBeTruthy();
    await waitFor(() => expect(booksService.getRecommendedBooks).toHaveBeenCalledOnce());
  });
});
