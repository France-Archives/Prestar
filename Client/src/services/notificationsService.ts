import type { NotificationItem, PageParams, Paginated, UUID } from "@/types";
import { fail, unsupportedOperation } from "@/utils/errors";
import { USE_MOCKS } from "@/utils/constants";
import { begin, toNotification } from "./mockEngine";
import { commit, db, nowIso, out, paginate, requireAccount } from "./mockStore";

// Mock-only: the current Server does not expose notification endpoints.

const mine = (userId: UUID) => db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** List mock notifications for the signed-in user. */
export async function listNotifications(params: PageParams & { unreadOnly?: boolean } = {}): Promise<Paginated<NotificationItem>> {
  if (!USE_MOCKS) unsupportedOperation("Notifications");
  await begin();
  const account = requireAccount();
  const rows = mine(account.user.id).filter((n) => !params.unreadOnly || n.readAt === null);
  return out(paginate(rows.map(toNotification), params.page, params.pageSize));
}

/** Count unread mock notifications for the signed-in user. */
export async function getUnreadCount(): Promise<number> {
  if (!USE_MOCKS) unsupportedOperation("Notifications");
  await begin();
  const account = requireAccount();
  return mine(account.user.id).filter((n) => n.readAt === null).length;
}

/** Mark one mock notification as read. */
export async function markRead(notificationId: UUID): Promise<NotificationItem> {
  if (!USE_MOCKS) unsupportedOperation("Notifications");
  await begin();
  const account = requireAccount();
  const n = db.notifications.find((x) => x.id === notificationId && x.userId === account.user.id);
  if (!n) fail("NOT_FOUND", "We could not find that notification.");
  n.readAt ??= nowIso();
  commit();
  return out(toNotification(n));
}

/** Mark all mock notifications as read. */
export async function markAllRead(): Promise<void> {
  if (!USE_MOCKS) unsupportedOperation("Notifications");
  await begin();
  const account = requireAccount();
  const now = nowIso();
  db.notifications.forEach((n) => {
    if (n.userId === account.user.id && n.readAt === null) n.readAt = now;
  });
  commit();
}