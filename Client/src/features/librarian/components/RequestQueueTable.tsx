import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import type { BookToRelease } from "@/types";
import { formatDate } from "@/utils/formatDate";

interface RequestQueueTableProps {
  rows: BookToRelease[];
  onOpen: (request: BookToRelease) => void;
  pageSize?: number;
}

export default function RequestQueueTable({ rows, onOpen, pageSize }: RequestQueueTableProps) {
  const columns: Column<BookToRelease>[] = [
    { key: "student", header: "Student", render: (request) => `${request.student.firstName} ${request.student.lastName} (${request.student.studentNumber})` },
    { key: "book", header: "Book", render: (request) => request.book.title },
    { key: "copy", header: "Copy", render: (request) => request.copy.barcode },
    { key: "requestedDurationDays", header: "Duration", render: (request) => `${request.requestedDurationDays} days` },
    { key: "approvedAt", header: "Approved", render: (request) => formatDate(request.approvedAt) },
    { key: "pickupDeadline", header: "Pickup deadline", render: (request) => formatDate(request.pickupDeadline) },
    { key: "status", header: "Status", render: (request) => <StatusBadge status={request.status} /> },
    {
      key: "actions",
      header: "",
      render: (request) => (
        <Button size="sm" onClick={() => onOpen(request)}>
          Open
        </Button>
      ),
    },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(request) => request.requestId} empty="No books waiting for release." pageSize={pageSize} />;
}