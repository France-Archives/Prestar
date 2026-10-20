import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from "@/services/apiClient";
import { reviewBorrowingRequest } from "./librarianService";

beforeEach(() => vi.clearAllMocks());

describe("live librarian service", () => {
  it("submits request-review decisions to the Server contract", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { status: "Rejected" } });

    await expect(reviewBorrowingRequest("41", "reject", "Eligibility documents incomplete")).resolves.toBeUndefined();
    expect(apiClient.post).toHaveBeenCalledWith("/borrow-requests/41/review", {
      decision: "reject",
      remarks: "Eligibility documents incomplete",
    });
  });

  it("does not send a rejection without its required reason", async () => {
    await expect(reviewBorrowingRequest("41", "reject")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
