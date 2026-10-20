import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from "@/services/apiClient";
import { cancelMyReservation, createReservation, listMyReservations } from "./reservationsService";

beforeEach(() => vi.clearAllMocks());

describe("live reservations service", () => {
  it("creates a reservation with the Server's snake_case request fields", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        reservation: {
          id: 20,
          bookId: 3,
          bookTitle: "Queued title",
          status: "Waiting",
          queuePosition: 2,
          reservedAt: "2026-10-20T12:00:00.000Z",
        },
      },
    });

    await expect(createReservation({
      bookId: "3",
      requestedDurationDays: 14,
    })).resolves.toMatchObject({
      id: "20",
      bookId: "3",
      status: "WAITING",
      queuePosition: 2,
      requestedDurationDays: 14,
    });
    expect(apiClient.post).toHaveBeenCalledWith("/reservations", {
      book_id: 3,
      requested_days: 14,
    });
  });

  it("normalizes reservation status and returned IDs", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        reservations: [{
          id: 22,
          bookId: 3,
          bookTitle: "Ready title",
          status: "Ready",
          queuePosition: null,
          reservedAt: "2026-10-18T12:00:00.000Z",
          pickupDeadline: "2026-10-21T12:00:00.000Z",
        }],
      },
    });

    await expect(listMyReservations()).resolves.toMatchObject([{
      id: "22",
      status: "OFFERED",
      pickupDeadline: "2026-10-21T12:00:00.000Z",
    }]);
    expect(apiClient.get).toHaveBeenCalledWith("/reservations/mine");
  });

  it("persists cancellation and returns the refreshed Server record", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { status: "Cancelled" } });
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        reservations: [{
          id: 24,
          bookId: 8,
          bookTitle: "Cancelled title",
          status: "Cancelled",
          reservedAt: "2026-10-18T12:00:00.000Z",
        }],
      },
    });

    await expect(cancelMyReservation("24")).resolves.toMatchObject({
      id: "24",
      status: "CANCELLED",
      bookTitle: "Cancelled title",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/reservations/24/cancel");
    expect(apiClient.get).toHaveBeenCalledWith("/reservations/mine");
  });
});
