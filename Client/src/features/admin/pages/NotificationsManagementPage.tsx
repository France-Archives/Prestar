import { useState } from "react";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import Card from "@/components/ui/Card";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import { InputField, SelectField, TextareaField } from "@/components/forms/FormField";
import LoadingState from "@/components/feedback/LoadingState";
import Pagination from "@/components/data-display/Pagination";
import SearchInput from "@/components/forms/SearchInput";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as adminService from "@/services/adminService";
import type { AdminNotificationRow, BroadcastAudience } from "@/services/adminService";
import { statusLabel } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";

const PAGE_SIZE = 10;
const AUDIENCES: { value: BroadcastAudience; label: string }[] = [
  { value: "ALL_STUDENTS", label: "All students" },
  { value: "ALL_STAFF", label: "All staff" },
  { value: "EVERYONE", label: "Everyone" },
];

// These two features have NO endpoint in the source (TO CONFIRM). Normal notifications are created by the backend
// after transactions commit; the broadcast sends a GENERAL in-app notice only.
export default function NotificationsManagementPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ audience: "ALL_STUDENTS" as BroadcastAudience, title: "", message: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const list = useAsync(() => adminService.listAllNotifications({ search: search || undefined, page, pageSize: PAGE_SIZE }), [search, page]);
  const meta = list.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await adminService.broadcastNotification(form);
      toast.success(`Notice sent to ${res.recipients} recipients.`);
      setForm({ ...form, title: "", message: "" });
      await list.reload();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AdminNotificationRow>[] = [
    { key: "createdAt", header: "Sent", render: (n) => formatDate(n.createdAt) },
    { key: "recipientName", header: "Recipient" },
    { key: "type", header: "Type", render: (n) => <StatusBadge status="CHECKED" label={statusLabel(n.type)} /> },
    { key: "title", header: "Title", render: (n) => <b>{n.title}</b> },
    { key: "message", header: "Message" },
    { key: "readAt", header: "Read", render: (n) => (n.readAt ? "Yes" : "No") },
  ];

  return (
    <div className="page">
      <PageHeader eyebrow="System" title="Notifications management" description="Review notifications and send a general in-app notice." />
      <div className="stack">
        <Card title="Send a notice" note="Appears in the recipients' notification bell. No email is sent.">
          <div className="stack">
            <Alert kind="warn"><MockTag>Simulated</MockTag> Broadcast notices are a demo feature with no documented endpoint yet.</Alert>
            <SelectField label="Audience" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as BroadcastAudience })}>
              {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </SelectField>
            <InputField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <TextareaField label="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
            {error && <Alert kind="error">{error}</Alert>}
            <div><Button onClick={send} loading={busy} disabled={!form.title.trim() || !form.message.trim()}>Send notice</Button></div>
          </div>
        </Card>
        <div className="toolbar" style={{ margin: 0 }}>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search title, message or recipient…" />
        </div>
        {list.loading && !list.data ? <LoadingState rows={4} /> : list.error ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : (
          <div className="card">
            <DataTable columns={columns} rows={list.data?.data ?? []} rowKey={(n) => n.id} empty="No notifications." pageSize={100} />
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
          </div>
        )}
      </div>
    </div>
  );
}