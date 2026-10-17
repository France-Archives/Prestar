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
    { key: "displayName", header: "Name", render: (u) => <b>{u.displayName}</b> },
    { key: "email", header: "Email" },
    { key: "role", header: "Role", render: (u) => <StatusBadge status={u.role} /> },
    { key: "number", header: "Number", render: (u) => u.studentNumber ?? u.employeeNumber ?? "—" },
    { key: "accountStatus", header: "Status", render: (u) => <StatusBadge status={u.accountStatus} /> },
    { key: "emailVerifiedAt", header: "Email verified", render: (u) => (u.emailVerifiedAt ? formatDate(u.emailVerifiedAt) : "No") },
    { key: "createdAt", header: "Created", render: (u) => formatDate(u.createdAt) },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <div className="row-actions">
          {u.studentId && (
            <Link to={ROUTES.admin.studentDetails(u.studentId)} className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
              Details
            </Link>
          )}
          <Button variant="ghost" size="sm" disabled={u.id === currentUserId} onClick={() => onChangeStatus(u)}>
            Change status
          </Button>
        </div>
      ),
    },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(u) => u.id} empty="No users match." pageSize={100} />;
}