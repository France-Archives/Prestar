import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import type { BookCopy } from "@/types";

type Row = BookCopy & { bookTitle?: string };

interface CopyStatusTableProps {
  rows: Row[];
  showBook?: boolean;
  onEdit?: (c: Row) => void;
  empty?: string;
}

export default function CopyStatusTable({ rows, showBook = false, onEdit, empty = "No copies." }: CopyStatusTableProps) {
  const columns: Column<Row>[] = [];
  if (showBook) columns.push({ key: "bookTitle", header: "Book" });
  columns.push(
    { key: "barcode", header: "Barcode" },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "condition", header: "Condition", render: (c) => <StatusBadge status={c.condition} /> },
    { key: "shelfLocation", header: "Shelf", render: (c) => c.shelfLocation ?? "—" },
    { key: "notes", header: "Notes", render: (c) => c.notes ?? "—" },
  );
  if (onEdit) {
    columns.push({
      key: "actions",
      header: "",
      render: (c) => (
        <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>
          Edit
        </Button>
      ),
    });
  }
  return <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} empty={empty} />;
}