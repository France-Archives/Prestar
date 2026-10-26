import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/services/apiClient", () => ({
  apiClient: { get, post },
}));

const liveFine = {
  id: "41",
  penaltyId: "41",
  borrowId: "17",
  returnId: "8",
  fineType: "DAMAGED_BOOK",
  fineTypeLabel: "Damaged Book",
  amount: 200,
  paidAmount: 0,
  balance: 200,
  status: "Unpaid",
  statusEnum: "UNPAID",
  reason: "Water damage",
  recordedAt: "2026-10-24T10:00:00.000Z",
  student: { id: "7", userId: "9", studentNumber: "SN-7", firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
  book: { id: "12", title: "Algorithms", isbn: "9781234567890" },
  bookTitle: "Algorithms",
  waivedAt: null,
  waivedBy: null,
  waiveRemarks: null,
};

describe("finesService live API mapping", () => {
  let service: typeof import("./finesService");

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCKS", "false");
    get.mockReset();
    post.mockReset();
    service = await import("./finesService");
  });

  it("maps fine rows and top-level pagination", async () => {
    get.mockResolvedValue({ data: { data: [liveFine], total: 21, page: 2, limit: 15 } });

    const result = await service.listFinesPage({ status: "UNPAID", search: "Ada", page: 2, pageSize: 15 });

    expect(get).toHaveBeenCalledWith("/fines", {
      params: { status: "Unpaid", search: "Ada", page: 2, limit: 15 },
    });

    expect(result).toEqual({
      data: [expect.objectContaining({
        id: "41",
        penaltyId: "41",
        loanId: "17",
        fineTypeLabel: "Damaged Book",
        status: "UNPAID",
        amount: 200,
        balance: 200,
        bookTitle: "Algorithms",
      })],
      meta: { page: 2, pageSize: 15, total: 21 },
    });
  });

  it("maps the student's penalties and cash-only message", async () => {
    get.mockResolvedValue({
      data: {
        message: "Please pay in cash at the library counter. The library accepts cash only in full.",
        data: [liveFine],
        fines: [liveFine],
        totalBalance: 200,
      },
    });

    const result = await service.getMyPenalties();

    expect(get).toHaveBeenCalledWith("/me/penalties");
    expect(result).toMatchObject({
      totalBalance: 200,
      message: "Please pay in cash at the library counter. The library accepts cash only in full.",
      fines: [expect.objectContaining({ id: "41", status: "UNPAID" })],
    });
  });

  it("maps settled payments and forwards search and pagination", async () => {
    get.mockResolvedValue({
      data: {
        data: [{
          id: "5", paymentId: "5", fineId: "41", penaltyId: "41", amount: 200,
          receiptNo: "OR-123", referenceNumber: "OR-123", paidAt: "2026-10-24T11:00:00.000Z",
          recordedByUserId: "3", recordedByName: "Staff", fineType: "DAMAGED_BOOK",
          fineTypeLabel: "Damaged Book", bookTitle: "Algorithms", remarks: null,
          student: liveFine.student,
        }],
        total: 3, page: 1, limit: 15,
      },
    });

    const result = await service.listPaymentsPage({ search: "OR-123", page: 1, pageSize: 15 });

    expect(get).toHaveBeenCalledWith("/fines/payments", {
      params: { search: "OR-123", page: 1, limit: 15 },
    });
    expect(result.data[0]).toMatchObject({
      id: "5", fineId: "41", amount: 200, paymentMethod: "CASH",
      receiptNo: "OR-123", recordedByName: "Staff", student: { id: "7" },
    });
    expect(result.meta).toEqual({ page: 1, pageSize: 15, total: 3 });
  });

  it("records a full cash payment with the official receipt number", async () => {
    post.mockResolvedValue({
      data: {
        message: "Payment recorded.",
        payment: { id: "5", amount: 200, receiptNo: "OR-123", paymentMethod: "Cash", paidAt: "2026-10-24T11:00:00.000Z" },
        fine: { id: "41", status: "Paid", balance: 0, paidAmount: 200 },
      },
    });

    await service.recordPayment("41", { amount: 200, receiptNo: "OR-123", remarks: "Counter" });

    expect(post).toHaveBeenCalledWith("/fines/41/payments", {
      amount: 200, receiptNo: "OR-123", remarks: "Counter",
    });
  });

  it("waives a fine with the required reason", async () => {
    post.mockResolvedValue({ data: { message: "Waived.", fine: liveFine } });

    const result = await service.waiveFine("41", { reason: "Duplicate assessment" });

    expect(post).toHaveBeenCalledWith("/fines/41/waive", { reason: "Duplicate assessment" });
    expect(result.status).toBe("UNPAID");
  });

  it.each([
    [400, "PARTIAL_PAYMENT_NOT_ALLOWED", "Partial payments are not accepted."],
    [409, "CONFLICT", "This official receipt number already exists."],
    [400, "INVALID_STATE", "This penalty has already been settled."],
  ])("surfaces payment error %s %s", async (status, code, message) => {
    post.mockRejectedValue({
      isAxiosError: true,
      message,
      response: { status, data: { code, message } },
    });

    await expect(service.recordPayment("41", { amount: 100, receiptNo: "OR-123" }))
      .rejects.toMatchObject({ message, status });
  });

  it("surfaces waiver conflicts", async () => {
    post.mockRejectedValue({
      isAxiosError: true,
      message: "Already settled.",
      response: { status: 409, data: { code: "INVALID_STATE", message: "Already settled." } },
    });

    await expect(service.waiveFine("41", { reason: "Reason" }))
      .rejects.toMatchObject({ message: "Already settled.", status: 409 });
  });

  it("rejects malformed live list payloads instead of falling back", async () => {
    get.mockResolvedValue({ data: { data: "invalid", total: 0, page: 1, limit: 15 } });

    await expect(service.listFinesPage()).rejects.toThrow("invalid list");
  });
});
