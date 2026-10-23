import { Link } from "react-router-dom";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import { ROUTES } from "@/app/routeConfig";
import type { AdminUserRow } from "@/types";
import { formatDate } from "@/utils/formatDate";

interface Props {
  rows: AdminUserRow[];
  currentUserId: string | undefined;
  onChangeStatus: (u: AdminUserRow) => void;
}

// Rows are already one server page, so the table's own paging is effectively off (pageSize 100).
export default function UserManagementTable({ rows, currentUserId, onChangeStatus }: Props) {
  const columns: Column<AdminUserRow>[] = [
    {
      key: "displayName",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
            {u.displayName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <span className="font-semibold text-slate-900 block truncate leading-tight">
              {u.displayName}
            </span>
            <span className="text-[11px] text-slate-400 block truncate font-normal">
              {u.email}
            </span>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Role", render: (u) => <StatusBadge status={u.role} /> },
    {
      key: "number",
      header: "ID Number",
      render: (u) => (
        <span className="font-mono text-xs text-slate-600">
          {u.studentNumber ?? u.employeeNumber ?? "—"}
        </span>
      ),
    },
    { key: "accountStatus", header: "Status", render: (u) => <StatusBadge status={u.accountStatus} /> },
    {
      key: "emailVerifiedAt",
      header: "Email Verified",
      render: (u) =>
        u.emailVerifiedAt ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Verified
          </span>
        ) : (
          <span className="text-xs text-slate-400">Unverified</span>
        ),
    },
    {
      key: "createdAt",
      header: "Registered",
      render: (u) => <span className="text-xs text-slate-500">{formatDate(u.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <div className="flex items-center justify-end gap-1.5">
          {u.studentId && (
            <Link
              to={ROUTES.admin.studentDetails(u.studentId)}
              className="btn btn-ghost btn-sm text-xs"
              style={{ textDecoration: "none" }}
            >
              Details
            </Link>
          )}
          <Button variant="ghost" size="sm" disabled={u.id === currentUserId} onClick={() => onChangeStatus(u)}>
            Status
          </Button>
        </div>
      ),
    },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(u) => u.id} empty="No users match." pageSize={100} />;
}