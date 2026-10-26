import {
  NOTIFICATION_TYPES,
  RELATED_ENTITY_TYPES,
  type NotificationItem,
  type NotificationType,
  type PageParams,
  type Paginated,
  type RelatedEntityType,
  type UUID,
} from "@/types";
import { apiClient } from "@/services/apiClient";
import { ApiError, fail, toApiError } from "@/utils/errors";
import { USE_MOCKS } from "@/utils/constants";
import { begin, toNotification } from "./mockEngine";
import { commit, db, nowIso, out, paginate, requireAccount } from "./mockStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapNotification(value: unknown): NotificationItem {
  if (!isRecord(value)
    || (typeof value.id !== "string" && typeof value.id !== "number")
    || typeof value.type !== "string"
    || !NOTIFICATION_TYPES.includes(value.type as NotificationType)
    || typeof value.title !== "string" || !value.title.trim()
    || typeof value.message !== "string" || !value.message.trim()
    || (value.relatedEntityType !== null && (typeof value.relatedEntityType !== "string"
      || !RELATED_ENTITY_TYPES.includes(value.relatedEntityType as RelatedEntityType)))
    || (value.relatedEntityId !== null && typeof value.relatedEntityId !== "string" && typeof value.relatedEntityId !== "number")
    || (value.readAt !== null && typeof value.readAt !== "string")
    || typeof value.createdAt !== "string" || !value.createdAt.trim()) {
    throw new ApiError("UNKNOWN", "The Server returned an invalid notification.");
  }
  return {
    id: String(value.id),
    type: value.type as NotificationType,
    title: value.title,
    message: value.message,
    relatedEntityType: value.relatedEntityType as RelatedEntityType | null,
    relatedEntityId: value.relatedEntityId === null ? null : String(value.relatedEntityId),
    readAt: value.readAt,
    createdAt: value.createdAt,
  };
}

const mine = (userId: UUID) => db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** List notifications for the signed-in user. */
export async function listNotifications(params: PageParams & { unreadOnly?: boolean } = {}): Promise<Paginated<NotificationItem>> {
  if (!USE_MOCKS) {
    try {
      const response = await apiClient.get<unknown>("/notifications", {
        params: {
          page: params.page,
          pageSize: params.pageSize,
          unreadOnly: params.unreadOnly,
        },
      });
      const page = response.data;
      if (!isRecord(page)
        || !Array.isArray(page.items)
        || !Number.isInteger(page.total)
        || !Number.isInteger(page.page)
        || !Number.isInteger(page.pageSize)
        || (page.total as number) < 0
        || (page.page as number) < 1
        || (page.pageSize as number) < 1) {
        throw new ApiError("UNKNOWN", "The Server returned an invalid notification list.");
      }
      return {
        data: page.items.map(mapNotification),
        meta: { total: page.total as number, page: page.page as number, pageSize: page.pageSize as number },
      };
    } catch (error) {
      throw toApiError(error);
    }
  }
  await begin();
  const account = requireAccount();
  const rows = mine(account.user.id).filter((n) => !params.unreadOnly || n.readAt === null);
  return out(paginate(rows.map(toNotification), params.page, params.pageSize));
}

/** Count unread notifications for the signed-in user. */
export async function getUnreadCount(): Promise<number> {
  if (!USE_MOCKS) {
    try {
      const response = await apiClient.get<unknown>("/notifications/unread-count");
      if (!isRecord(response.data) || !Number.isInteger(response.data.unreadCount) || (response.data.unreadCount as number) < 0) {
        throw new ApiError("UNKNOWN", "The Server returned an invalid unread notification count.");
      }
      return response.data.unreadCount as number;
    } catch (error) {
      throw toApiError(error);
    }
  }
  await begin();
  const account = requireAccount();
  return mine(account.user.id).filter((n) => n.readAt === null).length;
}

/** Mark one notification as read. */
export async function markRead(notificationId: UUID): Promise<NotificationItem> {
  if (!USE_MOCKS) {
    try {
      const response = await apiClient.post<unknown>(`/notifications/${encodeURIComponent(notificationId)}/read`);
      return mapNotification(response.data);
    } catch (error) {
      throw toApiError(error);
    }
  }
  await begin();
  const account = requireAccount();
  const n = db.notifications.find((x) => x.id === notificationId && x.userId === account.user.id);
  if (!n) fail("NOT_FOUND", "We could not find that notification.");
  n.readAt ??= nowIso();
  commit();
  return out(toNotification(n));
}

/** Mark all notifications as read. */
export async function markAllRead(): Promise<void> {
  if (!USE_MOCKS) {
    try {
      const response = await apiClient.post<unknown>("/notifications/read-all");
      if (!isRecord(response.data) || typeof response.data.message !== "string") {
        throw new ApiError("UNKNOWN", "The Server returned an invalid mark-read response.");
      }
      return;
    } catch (error) {
      throw toApiError(error);
    }
  }
  await begin();
  const account = requireAccount();
  const now = nowIso();
  db.notifications.forEach((n) => {
    if (n.userId === account.user.id && n.readAt === null) n.readAt = now;
  });
  commit();
}