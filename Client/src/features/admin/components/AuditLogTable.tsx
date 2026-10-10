import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import type { AuditLog } from "@/types";
import { formatDate } from "@/utils/formatDate";

// Rows are already one server page (pageSize 100 disables the table's own paging).
export default function AuditLogTable({ rows }: { rows: AuditLog[] }) {
  const columns: Column<AuditLog>[] = [
    { key: "createdAt", header: "When", render: (l) => formatDate(l.createdAt) },
    { key: "actorName", header: "Actor", render: (l) => <b>{l.actorName}</b> },
    { key: "actorRole", header: "Role", render: (l) => <StatusBadge status={l.actorRole} /> },
    { key: "action", header: "Action", render: (l) => <code style={{ fontSize: "0.75rem" }}>{l.action}</code> },
    { key: "entityType", header: "Entity" },
    { key: "summary", header: "Summary" },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(l) => l.id} empty="No audit entries match." pageSize={100} />;
}