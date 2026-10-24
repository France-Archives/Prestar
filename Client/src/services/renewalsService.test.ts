import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("./mockEngine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./mockEngine")>();
  return { ...actual, begin: vi.fn() };
});

import { apiClient } from "@/services/apiClient";
import { begin } from "./mockEngine";
import {
  createRenewal,
  listLoanRenewals,
  listMyRenewals,
  listStaffRenewals,
} from "./renewalsService";

beforeEach(() => vi.clearAllMocks());

const renewal = {
  id: "1",
  loanId: "45",
  bookTitle: "Clean Architecture",
  requestedDurationDays: 7,
  status: "APPROVED",
  requestedAt: "2026-10-23T10:30:00.000Z",
  approvedAt: "2026-10-23T10:30:00.000Z",
  oldDueAt: "2026-10-25T00:00:00.000Z",
  newDueAt: "2026-10-30T00:00:00.000Z",
  decisionReason: null,
};

describe("live renewal service", () => {
  it("posts the requested duration and returns the Server's automatic decision", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { ...renewal, status: "REJECTED", newDueAt: null, decisionReason: "Another student is waiting for this title." } });

    await expect(createRenewal("45", { requestedDurationDays: 7 })).resolves.toMatchObject({
      id: "1",
      loanId: "45",
      status: "REJECTED",
      decisionReason: "Another student is waiting for this title.",
      newDueAt: null,
    });
    expect(apiClient.post).toHaveBeenCalledWith("/borrowed-books/45/renew", { requestedDurationDays: 7 });
    expect(begin).not.toHaveBeenCalled();
  });

  it("maps the student's bare-array renewal history", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [renewal] });

    await expect(listMyRenewals()).resolves.toMatchObject([{
      id: "1",
      loanId: "45",
      bookTitle: "Clean Architecture",
      status: "APPROVED",
    }]);
    expect(apiClient.get).toHaveBeenCalledWith("/renewals/mine");
  });

  it("returns an empty list for an empty renewal history", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

    await expect(listMyRenewals()).resolves.toEqual([]);
  });

  it("accepts a data-wrapped renewal list without inventing rows", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [renewal] } });

    await expect(listMyRenewals()).resolves.toMatchObject([{ id: "1", loanId: "45" }]);
  });

  it("rejects an invalid renewal list payload", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [renewal] } });

    await expect(listMyRenewals()).rejects.toThrow("The Server returned an invalid renewal list.");
  });

  it("maps a rejected renewal response with its decision reason", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        ...renewal,
        status: "REJECTED",
        approvedAt: null,
        newDueAt: null,
        decisionReason: "Another student is waiting for this title.",
      },
    });

    await expect(createRenewal("45", { requestedDurationDays: 7 })).resolves.toMatchObject({
      status: "REJECTED",
      decisionReason: "Another student is waiting for this title.",
      approvedAt: null,
      newDueAt: null,
    });
  });

  it("maps loan renewal history", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [renewal] });

    await expect(listLoanRenewals("45")).resolves.toHaveLength(1);
    expect(apiClient.get).toHaveBeenCalledWith("/renewals/loan/45");
  });

  it("passes staff search to the Server and maps the student fields", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [{
        ...renewal,
        student: {
          id: "10",
          userId: "9001",
          firstName: "Juan",
          lastName: "Dela Cruz",
          studentNumber: "2024-00123",
        },
      }],
    });

    await expect(listStaffRenewals({ search: "Juan" })).resolves.toMatchObject([{
      id: "1",
      student: {
        id: "10",
        firstName: "Juan",
        lastName: "Dela Cruz",
        studentNumber: "2024-00123",
      },
    }]);
    expect(apiClient.get).toHaveBeenCalledWith("/renewals", { params: { search: "Juan" } });
    expect(begin).not.toHaveBeenCalled();
  });
});
