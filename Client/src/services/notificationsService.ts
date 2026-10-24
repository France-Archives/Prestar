import type { NotificationItem, NotificationType, PageParams, Paginated, RelatedEntityType, UUID } from "@/types";
import { apiClient } from "@/services/apiClient";
import { fail, toApiError } from "@/utils/errors";
import { USE_MOCKS } from "@/utils/constants";
import { begin, toNotification } from "./mockEngine";
import { commit, db, nowIso, out, paginate, requireAccount } from "./mockStore";

interface ServerNotification {
  id: string | number;
  type: string;
  title: string;
  message: string;
  relatedEntityType: string | null;
  relatedEntityId: string | number | null;
  readAt: string | null;
  createdAt: string;
}

interface ServerNotificationPage {
  items: ServerNotification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function mapNotification(notification: ServerNotification): NotificationItem {
  return {
    id: String(notification.id),
    type: notification.type as NotificationType,
    title: notification.title,
    message: notification.message,
    relatedEntityType: notification.relatedEntityType as RelatedEntityType | null,
    relatedEntityId: notification.relatedEntityId === null ? null : String(notification.relatedEntityId),
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

const mine = (userId: UUID) => db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** List notifications for the signed-in user. */
export async function listNotifications(params: PageParams & { unreadOnly?: boolean } = {}): Promise<Paginated<NotificationItem>> {
  if (!USE_MOCKS) {
    try {
      const response = await apiClient.get<ServerNotificationPage>("/notifications", {
        params: {
          page: params.page,
          pageSize: params.pageSize,
          unreadOnly: params.unreadOnly,
        },
      });
      return {
        data: response.data.items.map(mapNotification),
        meta: {
          total: response.data.total,
          page: response.data.page,
          pageSize: response.data.pageSize,
        },
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
      const response = await apiClient.get<{ unreadCount: number }>("/notifications/unread-count");
      return response.data.unreadCount;
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
      const response = await apiClient.post<ServerNotification>(`/notifications/${encodeURIComponent(notificationId)}/read`);
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
      await apiClient.post<{ message: string }>("/notifications/read-all");
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