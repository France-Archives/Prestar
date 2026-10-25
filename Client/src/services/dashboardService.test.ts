import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn() },
}));

import { apiClient } from "@/services/apiClient";
import { getOperationalDashboardCounts } from "./dashboardService";

beforeEach(() => vi.clearAllMocks());

describe("operational dashboard counts", () => {
  it("loads live counts from the requested API endpoints", async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ data: { pagination: { total: 4 } } } as never)
      .mockResolvedValueOnce({ data: { pagination: { total: 3 } } } as never)
      .mockResolvedValueOnce({ data: { pagination: { total: 9 } } } as never)
      .mockResolvedValueOnce({ data: [{ id: "cor-1" }, { id: "cor-2" }] } as never)
      .mockResolvedValueOnce({ data: { reservations: [{ id: "reservation-1" }] } } as never);

    await expect(getOperationalDashboardCounts()).resolves.toEqual({
      pendingRequests: { value: 4, error: null },
      booksToRelease: { value: 3, error: null },
      activeLoans: { value: 9, error: null },
      pendingCor: { value: 2, error: null },
      waitingReservations: { value: 1, error: null },
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(1, "/borrow-requests", { params: { status: "Pending", limit: 1 } });
    expect(apiClient.get).toHaveBeenNthCalledWith(2, "/borrowed-books", { params: { status: "Reserved", limit: 1 } });
    expect(apiClient.get).toHaveBeenNthCalledWith(3, "/borrowed-books", { params: { status: "Borrowed", limit: 1 } });
    expect(apiClient.get).toHaveBeenNthCalledWith(4, "/staff/verifications", { params: { status: "Pending" } });
    expect(apiClient.get).toHaveBeenNthCalledWith(5, "/reservations", { params: { status: "Waiting" } });
  });

  it("keeps individual card errors separate from successful counts", async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(new Error("requests unavailable"))
      .mockResolvedValueOnce({ data: { pagination: { total: 3 } } } as never)
      .mockResolvedValueOnce({ data: { pagination: { total: 9 } } } as never)
      .mockResolvedValueOnce({ data: [] } as never)
      .mockResolvedValueOnce({ data: [] } as never);

    const counts = await getOperationalDashboardCounts();
    expect(counts.pendingRequests.value).toBeNull();
    expect(counts.pendingRequests.error).toBe("requests unavailable");
    expect(counts.booksToRelease).toEqual({ value: 3, error: null });
    expect(counts.activeLoans).toEqual({ value: 9, error: null });
  });
});
