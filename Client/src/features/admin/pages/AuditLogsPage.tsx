import { useState } from "react";
import Alert, { MockTag } from "@/components/feedback/Alert";
import ErrorState from "@/components/feedback/ErrorState";
import { InputField } from "@/components/forms/FormField";
import LoadingState from "@/components/feedback/LoadingState";
import Pagination from "@/components/data-display/Pagination";
import SearchInput from "@/components/forms/SearchInput";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import * as adminService from "@/services/adminService";
import type { UserRole } from "@/types";
import { statusLabel } from "@/utils/constants";
import AuditLogTable from "../components/AuditLogTable";

const PAGE_SIZE = 15;
const ROLES: UserRole[] = ["ADMIN", "LIBRARIAN", "STUDENT"];
const USING_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

// D12 GET /admin/audit-logs. Audit entries are append-only in the real system; staff and Admin mutations write them.
export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const list = useAsync(
    () => adminService.listAuditLogs({ search: search || undefined, actorRole: role || undefined, from: from || undefined, to: to || undefined, page, pageSize: PAGE_SIZE }),
    [search, role, from, to, page],
  );
  const meta = list.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;
  const reset = () => setPage(1);

  return (
    <div className="page">
      <PageHeader eyebrow="Administration" title="Audit logs" description="Who did what and when: handovers, returns, fines, COR reviews, account and setting changes." />
      {USING_MOCKS ? (
        <Alert kind="warn">
          <MockTag>Mock records</MockTag> These entries are sample and demo records held in browser memory. They are NOT persisted audit logs and reset on refresh. The real backend writes immutable audit rows to the database.
        </Alert>
      ) : (
        <Alert kind="info">Entries are read from the backend audit log. They cannot be edited or deleted here.</Alert>
      )}
      <div className="toolbar" style={{ alignItems: "flex-end" }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); reset(); }} placeholder="Search summary, actor or action…" />
        <select className="select" style={{ width: "auto" }} aria-label="Actor role" value={role} onChange={(e) => { setRole(e.target.value as "" | UserRole); reset(); }}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{statusLabel(r)}</option>)}
        </select>
        <InputField label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); reset(); }} />
        <InputField label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); reset(); }} />
      </div>
      {list.loading && !list.data ? (
        <LoadingState rows={5} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <AuditLogTable rows={list.data?.data ?? []} />
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
  );
}