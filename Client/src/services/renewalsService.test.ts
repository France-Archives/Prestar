import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("./mockEngine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./mockEngine")>();
  return { ...actual, begin: vi.fn() };
});

import { begin } from "./mockEngine";
import {
  createRenewal,
  listLoanRenewals,
  listMyRenewals,
  listStaffRenewals,
} from "./renewalsService";

beforeEach(() => vi.clearAllMocks());

describe("live renewal service", () => {
  it("rejects renewal operations instead of reading or mutating mock data", async () => {
    const operations = [
      createRenewal("loan-id", { requestedDurationDays: 7 }),
      listMyRenewals(),
      listLoanRenewals("loan-id"),
      listStaffRenewals(),
    ];

    for (const operation of operations) {
      await expect(operation).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
    }
    expect(begin).not.toHaveBeenCalled();
  });
});
