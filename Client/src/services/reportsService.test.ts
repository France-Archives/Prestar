import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({ apiGet: vi.fn() }));

import { apiGet } from "@/services/apiClient";
import { getStudentDashboard } from "@/services/reportsService";
import type { StudentDashboardData } from "@/types";

beforeEach(() => vi.clearAllMocks());

describe("live student dashboard", () => {
  it("loads and normalizes the Server dashboard response", async () => {
    const dashboard = {
      accountStatus: "ACTIVE",
      emailVerified: true,
      cor: { status: "APPROVED", currentTerm: { id: 4, name: "Second Semester" } },
      commitments: { active: 2, max: 5 },
      pickupWaiting: [{ id: 7, status: "On Hold" }],
      activeLoans: [{ id: 8, bookTitle: "Example", status: "ACTIVE", dueAt: "2026-10-22" }],
      reservations: [{ id: 9, status: "Ready" }],
      recentNotifications: null,
      unreadCount: null,
      recommended: null,
      mostBorrowed: [{
        id: 13,
        bookId: 13,
        title: "Popular book",
        loanCount: "3",
        book: {
          id: 13,
          title: "Popular book",
          authors: [{ id: 5, name: "Author" }],
          availability: { availableCopies: "2", totalUsableCopies: 4 },
        },
      }],
    } as unknown as StudentDashboardData;
    vi.mocked(apiGet).mockResolvedValue(dashboard);

    await expect(getStudentDashboard()).resolves.toMatchObject({
      accountStatus: "ACTIVE",
      cor: { status: "APPROVED", currentTerm: { id: "4", name: "Second Semester" } },
      pickupWaiting: [{ id: "7", status: "ON_HOLD" }],
      reservations: [{ id: "9", status: "OFFERED" }],
      recentNotifications: null,
      unreadCount: null,
      recommended: null,
      mostBorrowed: [{
        bookId: "13",
        loanCount: 3,
        book: {
          id: "13",
          authors: [{ id: "5", name: "Author" }],
          availability: { availableCopies: 2, totalUsableCopies: 4 },
        },
      }],
    });
    expect(apiGet).toHaveBeenCalledWith("/me/dashboard");

    vi.mocked(apiGet).mockResolvedValue({
      ...dashboard,
      mostBorrowed: dashboard.mostBorrowed.map((row) => ({ ...row, loanCount: 0 })),
    } as unknown as StudentDashboardData);
    await expect(getStudentDashboard()).resolves.toMatchObject({
      mostBorrowed: [{ loanCount: 0 }],
    });

    vi.mocked(apiGet).mockResolvedValue({
      ...dashboard,
      recentNotifications: undefined,
      unreadCount: undefined,
    });
    await expect(getStudentDashboard()).resolves.toMatchObject({
      recentNotifications: null,
      unreadCount: null,
    });

  });

  it("maps real dashboard recommendations and rejects invalid values", async () => {
    vi.mocked(apiGet).mockResolvedValue({
      accountStatus: "ACTIVE",
      emailVerified: true,
      cor: { status: "APPROVED", currentTerm: null },
      commitments: { active: 0, max: 10 },
      pickupWaiting: [],
      activeLoans: [],
      reservations: [],
      recentNotifications: null,
      unreadCount: null,
      recommended: [{
        id: 7,
        bookId: 7,
        title: "Systems Thinking",
        category: { id: 2, name: "Science" },
        availability: { availableCopies: 2, totalUsableCopies: 4 },
      }],
      mostBorrowed: [],
    });

    await expect(getStudentDashboard()).resolves.toMatchObject({
      recommended: [{
        id: "7",
        title: "Systems Thinking",
        category: { id: "2", name: "Science" },
        availability: { availableCopies: 2, totalUsableCopies: 4 },
      }],
    });

    vi.mocked(apiGet).mockResolvedValue({
      accountStatus: "ACTIVE",
      emailVerified: true,
      cor: { status: "APPROVED" },
      commitments: { active: 0, max: 10 },
      pickupWaiting: [],
      activeLoans: [],
      reservations: [],
      recentNotifications: null,
      unreadCount: null,
      recommended: [{ id: 7, title: "Missing availability" }],
      mostBorrowed: [],
    });
    await expect(getStudentDashboard()).rejects.toThrow("The Server returned a recommended book with invalid fields.");
  });
});
