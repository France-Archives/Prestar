import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from "@/services/apiClient";
import { createBorrowingRequest, listMyBorrowingRequests, listMyLoans } from "./borrowingService";

beforeEach(() => vi.clearAllMocks());

describe("live borrowing service", () => {
  it("posts a numeric book id and maps the Server's wrapped request response", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        message: "Borrow request approved.",
        request: {
          id: 41,
          book_id: 12,
          bookTitle: "Example title",
          requested_days: 14,
          request_date: "2026-10-20T12:00:00.000Z",
          status: "Approved",
          pickup_deadline: "2026-10-23T12:00:00.000Z",
        },
      },
    });

    await expect(createBorrowingRequest({
      bookId: "12",
      requestedDurationDays: 14,
    })).resolves.toMatchObject({
      id: "41",
      bookId: "12",
      status: "APPROVED",
      requestedDurationDays: 14,
      message: "Borrow request approved.",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/borrow-requests", {
      book_id: 12,
      requested_days: 14,
    });
  });

  it("fetches all request pages and normalizes Server statuses", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({
        data: {
          requests: [{ id: 2, bookId: 4, bookTitle: "First", status: "Approved", requested_days: 7 }],
          pagination: { totalPages: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          requests: [{ id: 1, bookId: 5, bookTitle: "Second", status: "Fulfilled", requested_days: 14 }],
          pagination: { totalPages: 2 },
        },
      });

    await expect(listMyBorrowingRequests()).resolves.toMatchObject([
      { id: "2", status: "APPROVED", requestedDurationDays: 7 },
      { id: "1", status: "CLAIMED", requestedDurationDays: 14 },
    ]);
    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/borrow-requests/mine", {
      params: { page: 1, limit: 50 },
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/borrow-requests/mine", {
      params: { page: 2, limit: 50 },
    });
  });

  it("uses the database loan status and adapts its nested book/copy fields", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        loans: [{
          borrowId: 18,
          bookId: 4,
          book: { title: "Borrowed title" },
          copyId: 6,
          accessionNo: "ACC-006",
          status: "Borrowed",
          borrowDate: "2026-10-18",
          dueDate: "2026-10-25",
        }],
      },
    });

    await expect(listMyLoans({ status: "ACTIVE" })).resolves.toMatchObject([{
      id: "18",
      bookTitle: "Borrowed title",
      copyBarcode: "ACC-006",
      status: "ACTIVE",
    }]);
    expect(apiClient.get).toHaveBeenCalledWith("/borrowed-books/mine", {
      params: { status: "Borrowed" },
    });
  });
});
