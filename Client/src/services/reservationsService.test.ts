import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from "@/services/apiClient";
import { cancelMyReservation, createReservation, listMyReservations, listStaffReservations } from "./reservationsService";

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

  it("maps cancellation's response shape without an extra list request", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        message: "Reservation cancelled successfully.",
        reservationId: 24,
        status: "Cancelled",
      },
    });

    await expect(cancelMyReservation("24")).resolves.toMatchObject({
      reservationId: "24",
      status: "CANCELLED",
      message: "Reservation cancelled successfully.",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/reservations/24/cancel");
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("maps the staff queue response and computes FIFO positions", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        reservations: [
          {
            reservation_id: 22,
            book_id: 3,
            status: "Waiting",
            reservation_date: "2026-10-18T12:00:00.000Z",
            remarks: "Requested loan duration: 14 days",
            book: { book_id: 3, title: "Queued title" },
            student: { user_id: 8, first_name: "Ari", last_name: "Reader", email: "student@example.test" },
          },
        ],
      },
    });

    await expect(listStaffReservations()).resolves.toMatchObject([{
      id: "22",
      bookId: "3",
      bookTitle: "Queued title",
      requestedDurationDays: 14,
      status: "WAITING",
      queuePosition: 1,
      student: { id: "8", firstName: "Ari", lastName: "Reader", studentNumber: null },
      offeredCopy: null,
    }]);
    expect(apiClient.get).toHaveBeenCalledWith("/reservations");
  });
});
