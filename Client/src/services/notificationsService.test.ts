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
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
} from "./notificationsService";

beforeEach(() => vi.clearAllMocks());

describe("live notification service", () => {
  it("rejects notification operations instead of reading or mutating mock data", async () => {
    const operations = [
      listNotifications(),
      getUnreadCount(),
      markRead("notification-id"),
      markAllRead(),
    ];

    for (const operation of operations) {
      await expect(operation).rejects.toMatchObject({ code: "UNSUPPORTED_OPERATION" });
    }
    expect(begin).not.toHaveBeenCalled();
  });
});
