// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const getMyPenalties = vi.hoisted(() => vi.fn());

vi.mock("@/services/finesService", () => ({ getMyPenalties }));

import StudentPenaltiesPage from "./StudentPenaltiesPage";

const penalty = {
  id: "penalty-1",
  amount: 200,
  paidAmount: 0,
  balance: 200,
  status: "UNPAID",
  fineType: "DAMAGED_BOOK",
  fineTypeLabel: "Damaged book",
  recordedAt: "2026-10-24T10:00:00.000Z",
  student: { id: "student-1", studentNumber: "S-1", firstName: "Ada", lastName: "Lovelace" },
  bookTitle: "Algorithms",
  notes: null,
};

function renderPage() {
  return render(<MemoryRouter><StudentPenaltiesPage /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("student penalties page", () => {
  it("shows a loading state while the penalties request is pending", () => {
    getMyPenalties.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("shows the Server cash-only message, balance, and penalty details", async () => {
    getMyPenalties.mockResolvedValue({
      fines: [penalty],
      totalBalance: 200,
      message: "Please pay in cash at the library counter. The library accepts cash only in full.",
    });
    renderPage();

    expect(await screen.findByText(/library accepts cash only in full/)).toBeTruthy();
    expect(screen.getByText("Outstanding balance:")).toBeTruthy();
    expect(screen.getByText("Damaged book")).toBeTruthy();
    expect(screen.getByText("Algorithms")).toBeTruthy();
    expect(screen.getByText(/unpaid/i)).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Date" })).toBeTruthy();
  });

  it("shows the empty state when there are no penalties", async () => {
    getMyPenalties.mockResolvedValue({ fines: [], totalBalance: 0, message: "Cash only." });
    renderPage();

    expect(await screen.findByText("No current penalties.")).toBeTruthy();
  });

  it("shows a retryable error", async () => {
    getMyPenalties.mockRejectedValueOnce(new Error("Could not load penalties."))
      .mockResolvedValueOnce({ fines: [], totalBalance: 0, message: "Cash only." });
    renderPage();

    expect(await screen.findByText("Could not load penalties.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("No current penalties.")).toBeTruthy();
    expect(getMyPenalties).toHaveBeenCalledTimes(2);
  });
});
