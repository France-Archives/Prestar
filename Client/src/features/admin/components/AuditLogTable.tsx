import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import type { AuditLog } from "@/types";
import { formatDate } from "@/utils/formatDate";

// Rows are already one server page (pageSize 100 disables the table's own paging).
export default function AuditLogTable({ rows }: { rows: AuditLog[] }) {
  const columns: Column<AuditLog>[] = [
    {
      key: "createdAt",
      header: "Timestamp",
      render: (l) => (
        <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
          {formatDate(l.createdAt)}
        </span>
      ),
    },
    {
      key: "actorName",
      header: "Actor",
      render: (l) => (
        <span className="font-semibold text-slate-900 block truncate">
          {l.actorName}
        </span>
      ),
    },
    {
      key: "actorRole",
      header: "Role",
      render: (l) => <StatusBadge status={l.actorRole} />,
    },
    {
      key: "action",
      header: "Action",
      render: (l) => (
        <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700">
          {l.action}
        </span>
      ),
    },
    {
      key: "entityType",
      header: "Entity",
      render: (l) => (
        <span className="text-xs font-medium text-slate-600">
          {l.entityType}
        </span>
      ),
    },
    {
      key: "summary",
      header: "Summary",
      render: (l) => (
        <span className="text-xs text-slate-700 leading-snug">
          {l.summary}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(l) => l.id}
      empty="No audit log entries match the current filters."
      pageSize={100}
    />
  );
}