import type { NotificationItem, PageParams, Paginated, UUID } from "@/types";
import { fail } from "@/utils/errors";
import { begin, toNotification } from "./mockEngine";
import { commit, db, nowIso, out, paginate, requireAccount } from "./mockStore";

// TEMPORARY MOCK IMPLEMENTATION: Replace with the real notification API (S6 to S8).
// The BACKEND creates notifications, only after the business transaction commits. The frontend only reads them.
// The source defines the notification endpoints for students; the staff feed (COR awaiting review) reuses the
// same calls for Admin and Librarians in the mock. TO CONFIRM.

const mine = (userId: UUID) => db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** S6 GET /me/notifications */
export async function listNotifications(params: PageParams & { unreadOnly?: boolean } = {}): Promise<Paginated<NotificationItem>> {
  await begin();
  const account = requireAccount();
  const rows = mine(account.user.id).filter((n) => !params.unreadOnly || n.readAt === null);
  return out(paginate(rows.map(toNotification), params.page, params.pageSize));
}

/** Derived from S6 (unread = readAt null). Drives the bell badge. */
export async function getUnreadCount(): Promise<number> {
  await begin();
  const account = requireAccount();
  return mine(account.user.id).filter((n) => n.readAt === null).length;
}

/** S7 PATCH /me/notifications/:notificationId/read */
export async function markRead(notificationId: UUID): Promise<NotificationItem> {
  await begin();
  const account = requireAccount();
  const n = db.notifications.find((x) => x.id === notificationId && x.userId === account.user.id);
  if (!n) fail("NOT_FOUND", "We could not find that notification.");
  n.readAt ??= nowIso();
  commit();
  return out(toNotification(n));
}

/** S8 PATCH /me/notifications/read-all */
export async function markAllRead(): Promise<void> {
  await begin();
  const account = requireAccount();
  const now = nowIso();
  db.notifications.forEach((n) => {
    if (n.userId === account.user.id && n.readAt === null) n.readAt = now;
  });
  commit();
}