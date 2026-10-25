import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { current: { role: "LIBRARIAN", librarian: { permissions: ["CATALOG_MANAGE"] } } },
  getBookCopies: vi.fn(),
  listShelfOverview: vi.fn(),
  updateCopyShelf: vi.fn(),
  updateCopiesShelf: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user.current }) }));
vi.mock("@/services/booksService", () => ({
  getBookCopies: mocks.getBookCopies,
  listShelfOverview: mocks.listShelfOverview,
  updateCopyShelf: mocks.updateCopyShelf,
  updateCopiesShelf: mocks.updateCopiesShelf,
}));

import BookCopiesPanel from "./BookCopiesPanel";

const result = {
  bookTitle: "Systems Thinking",
  totalCopies: 1,
  availableCopies: 1,
  copies: [{
    id: "101",
    bookId: "42",
    accessionNo: "ACC-101",
    barcode: "ACC-101",
    shelfLocation: "Shelf-1",
    conditionStatus: "Good",
    status: "Available",
    book: { title: "Systems Thinking", isbn: null, coverImageUrl: null, publisher: null, category: "Science", author: "A. Writer" },
    activeLoan: null,
  }],
};
const overview = {
  shelves: [
    { shelfLocation: "Shelf-1", name: "Shelf-1", totalCopies: 1, availableCopies: 1, distinctTitles: 1 },
    { shelfLocation: "Shelf-2", name: "Shelf-2", totalCopies: 2, availableCopies: 2, distinctTitles: 2 },
  ],
  totalShelves: 2,
  unassigned: { shelfLocation: null, name: "Unassigned", totalCopies: 0, availableCopies: 0, distinctTitles: 0 },
};

describe("BookCopiesPanel", () => {
  beforeEach(() => {
    mocks.user.current = { role: "LIBRARIAN", librarian: { permissions: ["CATALOG_MANAGE"] } };
    mocks.getBookCopies.mockReset().mockResolvedValue(result);
    mocks.listShelfOverview.mockReset().mockResolvedValue(overview);
    mocks.updateCopyShelf.mockReset().mockResolvedValue(undefined);
    mocks.updateCopiesShelf.mockReset().mockResolvedValue(1);
  });

  it("moves one copy to a selected shelf", async () => {
    render(<BookCopiesPanel bookId="42" />);
    const shelf = await screen.findByRole("combobox", { name: "New shelf for ACC-101" });
    fireEvent.change(shelf, { target: { value: "Shelf-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => expect(mocks.updateCopyShelf).toHaveBeenCalledWith("101", "Shelf-2"));
  });

  it("confirms a bulk move of all copies of a book", async () => {
    render(<BookCopiesPanel bookId="42" />);
    fireEvent.click(await screen.findByRole("button", { name: "Move all copies of this book" }));
    fireEvent.change(screen.getByRole("combobox", { name: "New shelf location" }), { target: { value: "Shelf-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(mocks.updateCopiesShelf).toHaveBeenCalledWith({ bookId: "42", shelfLocation: "Shelf-2" }));
  });

  it("shows copy details read-only without catalog capability", async () => {
    mocks.user.current = { role: "LIBRARIAN", librarian: { permissions: [] } };
    render(<BookCopiesPanel bookId="42" />);
    expect(await screen.findByText("Copy locations are read-only for your account.")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "New shelf for ACC-101" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move all copies of this book" })).toBeNull();
  });
});
