import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/constants")>();
  return { ...actual, USE_MOCKS: false };
});
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from "@/services/apiClient";
import {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
} from "./notificationsService";

beforeEach(() => vi.clearAllMocks());

describe("live notification service", () => {
  it("maps the Server notification page and forwards paging filters", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        items: [{
          id: 41,
          type: "COR_APPROVED",
          title: "COR approved",
          message: "Your COR was approved.",
          relatedEntityType: "STUDENT_VERIFICATION",
          relatedEntityId: 12,
          readAt: null,
          createdAt: "2026-10-24T10:00:00.000Z",
        }],
        total: 1,
        page: 2,
        pageSize: 10,
        totalPages: 1,
      },
    });

    await expect(listNotifications({ page: 2, pageSize: 10, unreadOnly: true })).resolves.toEqual({
      data: [{
        id: "41",
        type: "COR_APPROVED",
        title: "COR approved",
        message: "Your COR was approved.",
        relatedEntityType: "STUDENT_VERIFICATION",
        relatedEntityId: "12",
        readAt: null,
        createdAt: "2026-10-24T10:00:00.000Z",
      }],
      meta: { total: 1, page: 2, pageSize: 10 },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/notifications", {
      params: { page: 2, pageSize: 10, unreadOnly: true },
    });
  });

  it("returns the live unread count", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { unreadCount: 3 } });
    await expect(getUnreadCount()).resolves.toBe(3);
    expect(apiClient.get).toHaveBeenCalledWith("/notifications/unread-count");
  });

  it("maps the notification returned by markRead", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        id: "41",
        type: "COR_APPROVED",
        title: "COR approved",
        message: "Your COR was approved.",
        relatedEntityType: "STUDENT_VERIFICATION",
        relatedEntityId: "12",
        readAt: "2026-10-24T10:05:00.000Z",
        createdAt: "2026-10-24T10:00:00.000Z",
      },
    });

    await expect(markRead("41")).resolves.toEqual({
      id: "41",
      type: "COR_APPROVED",
      title: "COR approved",
      message: "Your COR was approved.",
      relatedEntityType: "STUDENT_VERIFICATION",
      relatedEntityId: "12",
      readAt: "2026-10-24T10:05:00.000Z",
      createdAt: "2026-10-24T10:00:00.000Z",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/notifications/41/read");
  });

  it("posts mark-all-read and ignores the response body", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { message: "All notifications marked as read." } });
    await expect(markAllRead()).resolves.toBeUndefined();
    expect(apiClient.post).toHaveBeenCalledWith("/notifications/read-all");
  });

  it("normalizes live request errors through toApiError", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("request failed"));
    await expect(getUnreadCount()).rejects.toMatchObject({ code: "UNKNOWN", message: "request failed" });
  });
});
