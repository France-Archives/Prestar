import { useRef, useState } from "react";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import Alert from "@/components/feedback/Alert";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import { SelectField } from "@/components/forms/FormField";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import * as booksService from "@/services/booksService";
import type { ShelfCopy } from "@/services/booksService";
import { can } from "@/utils/permissions";

interface Props {
  bookId: string;
  onClose?: () => void;
}

export default function BookCopiesPanel({ bookId }: Props) {
  const { user } = useAuth();
  const canMove = can(user, "CATALOG_MANAGE");
  const copies = useAsync(() => booksService.getBookCopies(bookId), [bookId]);
  const overview = useAsync(() => booksService.listShelfOverview(), []);
  const [shelfByCopy, setShelfByCopy] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkShelf, setBulkShelf] = useState("");
  const [bulkMode, setBulkMode] = useState<"selected" | "book" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const refresh = async () => {
    setSelected([]);
    await copies.reload();
  };

  const moveOne = async (copy: ShelfCopy) => {
    const shelf = shelfByCopy[copy.id]?.trim();
    if (!shelf || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await booksService.updateCopyShelf(copy.id, shelf);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this copy.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const moveBulk = async () => {
    if (!bulkMode || submitting.current) return;
    if (!bulkShelf.trim()) throw new Error("Choose a shelf location before confirming.");
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await booksService.updateCopiesShelf(bulkMode === "book"
        ? { bookId, shelfLocation: bulkShelf }
        : { copyIds: selected, shelfLocation: bulkShelf });
      setBulkMode(null);
      setBulkShelf("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update the selected copies.");
      throw reason;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const rows = copies.data?.copies ?? [];
  const columns: Column<ShelfCopy>[] = [
    ...(canMove ? [{
      key: "select",
      header: "",
      render: (copy: ShelfCopy) => <input type="checkbox" aria-label={`Select ${copy.accessionNo}`} checked={selected.includes(copy.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, copy.id] : current.filter((id) => id !== copy.id))} />,
    }] : []),
    { key: "accessionNo", header: "Accession no.", render: (copy) => <b>{copy.accessionNo}</b> },
    { key: "shelfLocation", header: "Shelf", render: (copy) => copy.shelfLocation ?? "Unassigned" },
    { key: "status", header: "Status", render: (copy) => <StatusBadge status={copy.status} /> },
    { key: "conditionStatus", header: "Condition", render: (copy) => <StatusBadge status={copy.conditionStatus} /> },
    { key: "loan", header: "Active loan", render: (copy) => copy.activeLoan ? `${copy.activeLoan.borrowerName ?? "Borrowed"}${copy.activeLoan.dueDate ? ` · Due ${copy.activeLoan.dueDate}` : ""}` : "—" },
    ...(canMove ? [{
      key: "actions",
      header: "Change shelf",
      render: (copy: ShelfCopy) => <div className="row-actions">
        <select className="select" aria-label={`New shelf for ${copy.accessionNo}`} value={shelfByCopy[copy.id] ?? copy.shelfLocation ?? ""} onChange={(event) => setShelfByCopy((current) => ({ ...current, [copy.id]: event.target.value }))}>
          <option value="">Choose a shelf</option>
          {(overview.data?.shelves ?? []).map((shelf) => <option key={shelf.name} value={shelf.name}>{shelf.name}</option>)}
        </select>
        <Button size="sm" onClick={() => void moveOne(copy)} disabled={busy || !(shelfByCopy[copy.id] ?? copy.shelfLocation)}>Move</Button>
      </div>,
    }] : []),
  ];

  if ((copies.loading || overview.loading) && !copies.data) return <LoadingState rows={4} />;
  if (copies.error || overview.error) return <ErrorState message={copies.error ?? overview.error ?? "Copies are unavailable."} onRetry={() => { void copies.reload(); void overview.reload(); }} />;

  return (
    <section className="book-copies-panel" aria-label={`Copies of ${copies.data?.bookTitle ?? "book"}`}>
      <div className="toolbar">
        <span>{copies.data?.availableCopies ?? 0} available of {copies.data?.totalCopies ?? rows.length} copies</span>
        {canMove && selected.length > 0 && <Button onClick={() => { setBulkShelf(""); setBulkMode("selected"); }}>Move selected ({selected.length})</Button>}
        {canMove && rows.length > 0 && <Button variant="ghost" onClick={() => { setBulkShelf(""); setBulkMode("book"); }}>Move all copies of this book</Button>}
      </div>
      {canMove && <Alert kind="info">A shelf location is required. This Server API does not document an empty value for unassigned copies.</Alert>}
      {!canMove && <Alert kind="info">Copy locations are read-only for your account.</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      <DataTable columns={columns} rows={rows} rowKey={(copy) => copy.id} empty="This title has no copies yet." />
      {bulkMode && <ConfirmDialog
        title={bulkMode === "book" ? "Move all copies of this book?" : `Move ${selected.length} copies?`}
        message="Shelf location is the only copy detail that can be changed here."
        details={[
          { label: "Copies", value: bulkMode === "book" ? copies.data?.totalCopies ?? rows.length : selected.length },
          { label: "New shelf", value: bulkShelf || "Choose a shelf" },
        ]}
        loading={busy}
        onClose={() => setBulkMode(null)}
        onConfirm={() => moveBulk()}
      >
        <SelectField label="New shelf location" value={bulkShelf} onChange={(event) => setBulkShelf(event.target.value)} required>
          <option value="">Choose a shelf</option>
          {(overview.data?.shelves ?? []).map((shelf) => <option key={shelf.name} value={shelf.name}>{shelf.name}</option>)}
        </SelectField>
      </ConfirmDialog>}
    </section>
  );
}
