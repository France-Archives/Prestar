import { Link } from "react-router-dom";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import { ROUTES } from "@/app/routeConfig";
import type { AdminUserListRow, AdminUserRow } from "@/types";
import { formatDate } from "@/utils/formatDate";

interface Props {
  rows: AdminUserListRow[];
  currentUserId: string | undefined;
  onChangeStatus: (u: AdminUserRow) => void;
  live?: boolean;
}

// The service handles paging for this view; the table only renders the current page.
export default function UserManagementTable({ rows, currentUserId, onChangeStatus, live = false }: Props) {
  const columns: Column<AdminUserListRow>[] = live
    ? [
        { key: "name", header: "Name", render: (u) => <b>{"name" in u ? u.name : u.displayName}</b> },
        { key: "role", header: "Role", render: (u) => <StatusBadge status={u.role} /> },
        { key: "status", header: "Status", render: (u) => <StatusBadge status={"status" in u ? u.status : u.accountStatus} /> },
        {
          key: "actions",
          header: "",
          render: () => <Button variant="ghost" size="sm" disabled title="Not available yet">Change status · Not available yet</Button>,
        },
      ]
    : [
        { key: "displayName", header: "Name", render: (u) => <b>{"displayName" in u ? u.displayName : u.name}</b> },
        { key: "email", header: "Email", render: (u) => "email" in u ? u.email : "—" },
        { key: "role", header: "Role", render: (u) => <StatusBadge status={u.role} /> },
        { key: "number", header: "Number", render: (u) => "studentNumber" in u ? u.studentNumber ?? u.employeeNumber ?? "—" : "—" },
        { key: "accountStatus", header: "Status", render: (u) => <StatusBadge status={"accountStatus" in u ? u.accountStatus : u.status} /> },
        { key: "emailVerifiedAt", header: "Email verified", render: (u) => "emailVerifiedAt" in u && u.emailVerifiedAt ? formatDate(u.emailVerifiedAt) : "No" },
        { key: "createdAt", header: "Created", render: (u) => "createdAt" in u ? formatDate(u.createdAt) : "—" },
        {
          key: "actions",
          header: "",
          render: (u) => "id" in u ? (
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
          ) : null,
        },
      ];
  return <DataTable columns={columns} rows={rows} rowKey={(u) => "id" in u ? u.id : `${u.role}-${u.name}`} empty="No users match." pageSize={100} />;
}