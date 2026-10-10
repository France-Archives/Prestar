import { useState } from "react";
import Button from "@/components/common/Button";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Pagination from "@/components/data-display/Pagination";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/useToast";
import * as notificationsService from "@/services/notificationsService";
import { describeError } from "@/utils/errors";
import NotificationList from "../components/NotificationList";

const PAGE_SIZE = 10;

// Shared by Student, Librarian and Admin. The backend creates notifications; this page only reads and marks them.
export default function NotificationsPage() {
  const { user } = useAuth();
  const { unreadCount, refresh } = useNotifications();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useAsync(() => notificationsService.listNotifications({ page, pageSize: PAGE_SIZE, unreadOnly }), [page, unreadOnly]);

  if (!user) return null;

  const read = async (id: string) => {
    try {
      await notificationsService.markRead(id);
      await Promise.all([list.reload(), refresh()]);
    } catch (e) {
      toast.error(describeError(e));
    }
  };

  const readAll = async () => {
    try {
      await notificationsService.markAllRead();
      await Promise.all([list.reload(), refresh()]);
    } catch (e) {
      toast.error(describeError(e));
    }
  };

  const meta = list.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <PageHeader
        eyebrow="Library"
        title="Notifications"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}>
              {unreadOnly ? "Show all" : "Unread only"}
            </Button>
            <Button size="sm" disabled={unreadCount === 0} onClick={readAll}>
              Mark all read
            </Button>
          </>
        }
      />
      <p className="subtle" style={{ marginBottom: 12 }}>{unreadCount} unread</p>
      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <>
          <NotificationList items={list.data?.data ?? []} role={user.role} onRead={(id) => void read(id)} />
          {meta && (
            <Pagination
              page={meta.page}
              totalPages={totalPages}
              from={meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1}
              to={Math.min(meta.total, meta.page * meta.pageSize)}
              total={meta.total}
              onPrev={() => setPage(Math.max(1, page - 1))}
              onNext={() => setPage(Math.min(totalPages, page + 1))}
            />
          )}
        </>
      )}
    </div>
  );
}