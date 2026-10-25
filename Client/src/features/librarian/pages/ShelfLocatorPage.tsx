import { useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2, MapPinned, PackageCheck } from "lucide-react";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import Alert from "@/components/feedback/Alert";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Pagination from "@/components/data-display/Pagination";
import SearchInput from "@/components/forms/SearchInput";
import { SelectField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import StatStrip from "@/components/layout/StatStrip";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as booksService from "@/services/booksService";
import type { StaffCopyRow } from "@/types";
import CopyForm from "../components/CopyForm";
import { USE_MOCKS } from "@/utils/constants";
import { useAuth } from "@/hooks/useAuth";
import { can } from "@/utils/permissions";
import type { ShelfCopy } from "@/services/booksService";

export default function ShelfLocatorPage() {
  if (!USE_MOCKS) return <LiveShelfLocatorPage />;
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StaffCopyRow | null>(null);
  const copies = useAsync(() => booksService.listAllCopies({ search: search || undefined }), [search]);

  const columns: Column<StaffCopyRow>[] = [
    { key: "bookTitle", header: "Title" },
    { key: "barcode", header: "Barcode" },
    { key: "id", header: "Copy ID" },
    { key: "status", header: "Copy status", render: (copy) => <StatusBadge status={copy.status} /> },
    { key: "shelfLocation", header: "Physical location", render: (copy) => copy.shelfLocation || "Not set" },
    { key: "notes", header: "Location notes", render: (copy) => copy.notes || "—" },
    { key: "actions", header: "", render: (copy) => <Button variant="ghost" size="sm" onClick={() => setEditing(copy)}>Update location</Button> },
  ];

  return (
    <div className="page">
      <PageHero eyebrow="Catalog" title="Shelf Locator" description="Find individual physical copies and update their recorded location." leading={<BackButton fallback={ROUTES.staff.dashboard} />} compact />
      <Alert kind="info">Search includes title, author, ISBN, barcode, copy ID, and location. Current shelf codes are mock values; only one shelf-location field is modeled.</Alert>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, author, ISBN, barcode, copy ID or location…" />
      </div>
      {copies.loading ? (
        <LoadingState rows={4} />
      ) : copies.error ? (
        <ErrorState message={copies.error} onRetry={() => void copies.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={copies.data ?? []} rowKey={(copy) => copy.id} empty="No physical copies match." />
        </div>
      )}
      {editing && <CopyForm copy={editing} onClose={() => setEditing(null)} onDone={() => void copies.reload()} />}
    </div>
  );
}

function LiveShelfLocatorPage() {
  const { user } = useAuth();
  const canMove = can(user, "CATALOG_MANAGE");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [shelfLocation, setShelfLocation] = useState("");
  const [status, setStatus] = useState("");
  const [condition, setCondition] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<ShelfCopy | null>(null);
  const [newShelf, setNewShelf] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const copies = useAsync(() => booksService.listShelfLocator({
    search: debouncedSearch || undefined,
    shelfLocation: shelfLocation || undefined,
    status: status || undefined,
    conditionStatus: condition || undefined,
    page,
    limit: 20,
  }), [debouncedSearch, shelfLocation, status, condition, page]);
  const overview = useAsync(() => booksService.listShelfOverview(), []);
  const rows = copies.data?.data ?? [];
  const pagination = copies.data?.pagination;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const columns: Column<ShelfCopy>[] = [
    ...(canMove ? [{
      key: "select",
      header: "",
      render: (copy: ShelfCopy) => <input type="checkbox" aria-label={`Select ${copy.accessionNo}`} checked={selected.includes(copy.id)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, copy.id] : items.filter((id) => id !== copy.id))} />,
    }] : []),
    { key: "cover", header: "", render: (copy) => copy.book.coverImageUrl
      ? <img className="book-list-cover" src={copy.book.coverImageUrl} alt="" loading="lazy" />
      : <span className="book-list-cover book-list-cover--empty" aria-label="No cover">—</span> },
    { key: "title", header: "Book", render: (copy) => <div className="row-title"><b>{copy.book.title}</b><small>{copy.book.author || "Author unavailable"}</small></div> },
    { key: "accessionNo", header: "Accession no.", render: (copy) => copy.accessionNo },
    { key: "shelfLocation", header: "Shelf", render: (copy) => <span className="badge badge-neutral">{copy.shelfLocation ?? "Unassigned"}</span> },
    { key: "status", header: "Status", render: (copy) => <StatusBadge status={copy.status} /> },
    { key: "conditionStatus", header: "Condition", render: (copy) => <StatusBadge status={copy.conditionStatus} /> },
    { key: "loan", header: "Borrowed by / due", render: (copy) => copy.activeLoan ? `${copy.activeLoan.borrowerName ?? "Borrowed"}${copy.activeLoan.dueDate ? ` · ${copy.activeLoan.dueDate}` : ""}` : "—" },
    ...(canMove ? [{ key: "actions", header: "", render: (copy: ShelfCopy) => <Button size="sm" variant="ghost" onClick={() => { setEditing(copy); setNewShelf(copy.shelfLocation ?? ""); setSaveError(null); }}>Change shelf</Button> }] : []),
  ];
  const refresh = () => { void copies.reload(); void overview.reload(); setSelected([]); };
  const saveSingle = async () => {
    if (!editing || !newShelf.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      await booksService.updateCopyShelf(editing.id, newShelf);
      setEditing(null);
      refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to update the shelf.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const saveBulk = async () => {
    if (!selected.length || !newShelf.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await booksService.updateCopiesShelf({ copyIds: selected, shelfLocation: newShelf });
      setBulkConfirm(false);
      refresh();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <PageHero eyebrow="Catalog" title="Shelf Locator" description="Find physical copies, check their status, and update shelf locations." leading={<BackButton fallback={ROUTES.staff.dashboard} />} compact />
      {overview.error && <ErrorState message={overview.error} onRetry={() => void overview.reload()} />}
      {overview.data && <StatStrip label="Shelf overview" items={[
        { label: "Shelves", value: overview.data.totalShelves, hint: "Distinct locations", icon: MapPinned },
        { label: "Copies", value: overview.data.shelves.reduce((sum, shelf) => sum + shelf.totalCopies, 0) + overview.data.unassigned.totalCopies, hint: "Across all locations", icon: BookOpen },
        { label: "Available", value: overview.data.shelves.reduce((sum, shelf) => sum + shelf.availableCopies, 0) + overview.data.unassigned.availableCopies, hint: "Ready to borrow", icon: CheckCircle2, tone: "green" },
        { label: "Unassigned", value: overview.data.unassigned.totalCopies, hint: "Need a shelf location", icon: PackageCheck, tone: "amber" },
      ]} />}
      {overview.data && <nav className="toolbar" aria-label="Filter by shelf">
        <Button size="sm" variant={shelfLocation === "" ? "primary" : "ghost"} onClick={() => { setShelfLocation(""); setPage(1); }}>All shelves</Button>
        {overview.data.shelves.map((shelf) => <Button key={shelf.name} size="sm" variant={shelfLocation === shelf.name ? "primary" : "ghost"} onClick={() => { setShelfLocation(shelf.name); setPage(1); }}>{shelf.name} · {shelf.totalCopies}</Button>)}
        <Button size="sm" variant={shelfLocation === "unassigned" ? "primary" : "ghost"} onClick={() => { setShelfLocation("unassigned"); setPage(1); }}>Unassigned · {overview.data.unassigned.totalCopies}</Button>
      </nav>}
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, author, accession no. or shelf…" />
        <label><span className="sr-only">Shelf location</span><select className="select" aria-label="Shelf location" value={shelfLocation} onChange={(event) => { setShelfLocation(event.target.value); setPage(1); }}><option value="">All shelves</option>{(overview.data?.shelves ?? []).map((shelf) => <option key={shelf.name} value={shelf.name}>{shelf.name}</option>)}<option value="unassigned">Unassigned</option></select></label>
        <label><span className="sr-only">Copy status</span><select className="select" aria-label="Copy status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{["Available", "Borrowed", "Reserved", "Maintenance", "Lost"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className="sr-only">Copy condition</span><select className="select" aria-label="Copy condition" value={condition} onChange={(event) => { setCondition(event.target.value); setPage(1); }}><option value="">All conditions</option>{["Good", "Damaged"].map((item) => <option key={item}>{item}</option>)}</select></label>
        {canMove && selected.length > 0 && <Button onClick={() => { setNewShelf(""); setBulkMoveOpen(true); }}>Move selected ({selected.length})</Button>}
      </div>
      {copies.loading ? <LoadingState rows={4} /> : copies.error ? <ErrorState message={copies.error} onRetry={() => void copies.reload()} /> : <div className="card"><DataTable columns={columns} rows={rows} rowKey={(copy) => copy.id} empty="No physical copies match." /></div>}
      {pagination && <Pagination page={pagination.page} totalPages={totalPages} from={pagination.total ? (page - 1) * pagination.limit + 1 : 0} to={Math.min(pagination.total, page * pagination.limit)} total={pagination.total} onPrev={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(Math.min(totalPages, page + 1))} />}
      {editing && <Modal title={`Change shelf for ${editing.accessionNo}`} onClose={busy ? () => undefined : () => setEditing(null)} footer={<><Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button onClick={() => void saveSingle()} loading={busy} disabled={busy || !newShelf.trim()}>Save shelf</Button></>}>
        <SelectField label="Shelf location" value={newShelf} onChange={(event) => setNewShelf(event.target.value)} required><option value="">Choose a shelf</option>{(overview.data?.shelves ?? []).map((shelf) => <option key={shelf.name} value={shelf.name}>{shelf.name}</option>)}</SelectField>
        {saveError && <Alert kind="error">{saveError}</Alert>}
      </Modal>}
      {bulkMoveOpen && <Modal title="Move selected copies" onClose={() => setBulkMoveOpen(false)} footer={<><Button variant="ghost" onClick={() => setBulkMoveOpen(false)}>Cancel</Button><Button disabled={!newShelf.trim()} onClick={() => { setBulkMoveOpen(false); setBulkConfirm(true); }}>Review move</Button></>}>
        <SelectField label="Shelf location" value={newShelf} onChange={(event) => setNewShelf(event.target.value)} required><option value="">Choose a shelf</option>{(overview.data?.shelves ?? []).map((shelf) => <option key={shelf.name} value={shelf.name}>{shelf.name}</option>)}</SelectField>
      </Modal>}
      {bulkConfirm && <ConfirmDialog title={`Move ${selected.length} copies?`} message="All selected copies will be assigned to the chosen shelf." details={[{ label: "Copies", value: selected.length }, { label: "New shelf", value: newShelf }]} loading={busy} onClose={() => setBulkConfirm(false)} onConfirm={() => saveBulk()} />}
    </div>
  );
}