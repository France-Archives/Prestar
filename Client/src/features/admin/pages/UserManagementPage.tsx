import { useState } from "react";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Pagination from "@/components/data-display/Pagination";
import SearchInput from "@/components/forms/SearchInput";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import * as adminService from "@/services/adminService";
import type { AccountStatus, AdminUserRow, UserRole } from "@/types";
import { statusLabel, USE_MOCKS } from "@/utils/constants";
import Alert from "@/components/feedback/Alert";
import AccountStatusDialog from "../components/AccountStatusDialog";
import UserManagementTable from "../components/UserManagementTable";

const PAGE_SIZE = 10;
const ROLES: UserRole[] = ["STUDENT", "LIBRARIAN", "ADMIN"];
const STATUSES: AccountStatus[] = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "DISABLED"];

// D5 GET /admin/users and D6 PATCH /admin/users/:id/status.
export default function UserManagementPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [status, setStatus] = useState<"" | AccountStatus>("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AdminUserRow | null>(null);
  const list = useAsync(
    () => adminService.listUsers({ search: search || undefined, role: role || undefined, accountStatus: status || undefined, page, pageSize: PAGE_SIZE }),
    [search, role, status, page],
  );
  const meta = list.data?.meta;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / meta.pageSize)) : 1;

  return (
    <div className="page">
      <PageHero
        eyebrow="People"
        title="Users"
        description={USE_MOCKS
          ? "Students, Librarians and Admins. Suspending an account blocks new borrowing but never changes existing loans or due dates."
          : "Browse student, librarian, and admin accounts by name, role, and status."}
        leading={<BackButton fallback={ROUTES.admin.dashboard} />}
        compact
      />
      {!USE_MOCKS && <Alert kind="info">The live list includes names, roles and statuses only. Search matches names; account status changes are not available through this API.</Alert>}
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder={USE_MOCKS ? "Search name, email or number…" : "Search names…"} />
        <select className="select" style={{ width: "auto" }} aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value as "" | UserRole); setPage(1); }}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{statusLabel(r)}</option>)}
        </select>
        <select className="select" style={{ width: "auto" }} aria-label="Account status" value={status} onChange={(e) => { setStatus(e.target.value as "" | AccountStatus); setPage(1); }}>
          <option value="">All statuses</option>
          {(USE_MOCKS ? STATUSES : STATUSES.filter((s) => s !== "PENDING_VERIFICATION")).map((s) => (
            <option key={s} value={s}>{!USE_MOCKS && s === "DISABLED" ? "Inactive" : statusLabel(s)}</option>
          ))}
        </select>
      </div>
      {list.loading && !list.data ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <UserManagementTable rows={list.data?.data ?? []} currentUserId={user?.id} onChangeStatus={setTarget} live={!USE_MOCKS} />
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
      {target && <AccountStatusDialog user={target} onClose={() => setTarget(null)} onDone={() => void list.reload()} />}
    </div>
  );
}