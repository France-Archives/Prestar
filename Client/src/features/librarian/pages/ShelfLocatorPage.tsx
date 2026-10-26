import { useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2, MapPinned, PackageCheck, X } from "lucide-react";
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
  const [shelfSearch, setShelfSearch] = useState("");
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
  const activeFilters = [
    ...(search.trim() ? [{ key: "search", label: `Search: ${search.trim()}`, clear: () => { setSearch(""); setDebouncedSearch(""); setPage(1); } }] : []),
    ...(shelfLocation ? [{ key: "shelf", label: `Shelf: ${shelfLocation === "unassigned" ? "Unassigned" : shelfLocation}`, clear: () => { setShelfLocation(""); setPage(1); } }] : []),
    ...(status ? [{ key: "status", label: `Status: ${status}`, clear: () => { setStatus(""); setPage(1); } }] : []),
    ...(condition ? [{ key: "condition", label: `Condition: ${condition}`, clear: () => { setCondition(""); setPage(1); } }] : []),
  ];
  const filteredShelves = (overview.data?.shelves ?? []).filter((shelf) => shelf.name.toLocaleLowerCase().includes(shelfSearch.trim().toLocaleLowerCase()));
  const columns: Column<ShelfCopy>[] = [
    ...(canMove ? [{
      key: "select",
      header: "Select",
      headerClassName: "table-column-heading-sr-only",
      className: "shelf-select-cell",
      mobileLabel: "Select",
      render: (copy: ShelfCopy) => <label className="shelf-row-check"><input type="checkbox" aria-label={`Select ${copy.accessionNo}`} checked={selected.includes(copy.id)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, copy.id] : items.filter((id) => id !== copy.id))} /><span className="sr-only">Select {copy.accessionNo}</span></label>,
    }] : []),
    { key: "cover", header: "Cover", headerClassName: "table-column-heading-sr-only", className: "shelf-cover-cell", render: (copy) => copy.book.coverImageUrl
      ? <img className="book-list-cover shelf-table-cover" src={copy.book.coverImageUrl} alt="" loading="lazy" />
      : <span className="book-list-cover shelf-table-cover book-list-cover--empty" aria-label="No cover">—</span> },
    { key: "title", header: "Book", mobilePrimary: true, render: (copy) => <div className="row-title"><b>{copy.book.title}</b><small>{copy.book.author || "Author unavailable"}</small></div> },
    { key: "accessionNo", header: "Accession no.", className: "shelf-accession-cell", render: (copy) => copy.accessionNo },
    { key: "shelfLocation", header: "Shelf", render: (copy) => <span className={`badge ${copy.shelfLocation ? "badge-neutral" : "badge-warn"}`}>{copy.shelfLocation ?? "Unassigned"}</span> },
    { key: "status", header: "Status", render: (copy) => <StatusBadge status={copy.status} /> },
    { key: "conditionStatus", header: "Condition", render: (copy) => <StatusBadge status={copy.conditionStatus} /> },
    { key: "loan", header: "Borrowed by / due", render: (copy) => copy.activeLoan
      ? <span className="shelf-loan-meta">{copy.activeLoan.borrowerName ?? "Borrowed"}{copy.activeLoan.dueDate && <> · <time className={new Date(copy.activeLoan.dueDate).getTime() < Date.now() ? "is-overdue" : undefined} dateTime={copy.activeLoan.dueDate}>{copy.activeLoan.dueDate}</time></>}</span>
      : "—" },
    ...(canMove ? [{ key: "actions", header: "Actions", render: (copy: ShelfCopy) => <Button size="sm" variant="secondary" onClick={() => { setEditing(copy); setNewShelf(copy.shelfLocation ?? ""); setSaveError(null); }}>Change shelf</Button> }] : []),
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
        { label: "Unassigned", value: overview.data.unassigned.totalCopies, hint: "Need a shelf location", icon: PackageCheck, tone: "amber", onClick: () => { setShelfLocation(shelfLocation === "unassigned" ? "" : "unassigned"); setPage(1); }, selected: shelfLocation === "unassigned" },
      ]} />}
      {overview.data && <label className="field shelf-rail-select">
        <span className="label">Filter by shelf</span>
        <select className="select" aria-label="Shelf location" value={shelfLocation} onChange={(event) => { setShelfLocation(event.target.value); setPage(1); }}>
          <option value="">All shelves</option>
          <option value="unassigned">Unassigned ({overview.data.unassigned.totalCopies})</option>
          {overview.data.shelves.map((shelf) => <option key={shelf.name} value={shelf.name}>{shelf.name} ({shelf.totalCopies})</option>)}
        </select>
      </label>}
      <div className="shelf-locator-layout">
        {overview.data && <aside className="shelf-rail" aria-label="Shelf filters">
          <label className="field shelf-rail__search">
            <span className="label">Find a shelf</span>
            <input className="input" value={shelfSearch} onChange={(event) => setShelfSearch(event.target.value)} placeholder="Search shelves…" aria-label="Search shelves" />
          </label>
          <nav className="shelf-rail__items" aria-label="Choose shelf">
            <button type="button" className={`shelf-rail__item${shelfLocation === "" ? " is-selected" : ""}`} aria-pressed={shelfLocation === ""} onClick={() => { setShelfLocation(""); setPage(1); }}>
              <span className="shelf-rail__item-head"><span>All shelves</span><strong>{overview.data.shelves.reduce((sum, shelf) => sum + shelf.totalCopies, 0) + overview.data.unassigned.totalCopies}</strong></span>
              <span className="shelf-rail__progress" aria-hidden="true"><span style={{ width: "100%" }} /></span>
            </button>
            <button type="button" className={`shelf-rail__item shelf-rail__item--unassigned${shelfLocation === "unassigned" ? " is-selected" : ""}`} aria-pressed={shelfLocation === "unassigned"} onClick={() => { setShelfLocation("unassigned"); setPage(1); }}>
              <span className="shelf-rail__item-head"><span><i className="shelf-rail__dot" aria-hidden="true" />Unassigned</span><strong>{overview.data.unassigned.totalCopies}</strong></span>
              <span className="shelf-rail__progress" aria-hidden="true"><span style={{ width: `${overview.data.unassigned.totalCopies ? overview.data.unassigned.availableCopies / overview.data.unassigned.totalCopies * 100 : 0}%` }} /></span>
              <small>{overview.data.unassigned.availableCopies} available</small>
            </button>
            {filteredShelves.map((shelf) => <button type="button" key={shelf.name} className={`shelf-rail__item${shelfLocation === shelf.name ? " is-selected" : ""}`} aria-pressed={shelfLocation === shelf.name} onClick={() => { setShelfLocation(shelf.name); setPage(1); }}>
              <span className="shelf-rail__item-head"><span>{shelf.name}</span><strong>{shelf.totalCopies}</strong></span>
              <span className="shelf-rail__progress" aria-label={`${shelf.availableCopies} of ${shelf.totalCopies} available`}><span style={{ width: `${shelf.totalCopies ? shelf.availableCopies / shelf.totalCopies * 100 : 0}%` }} /></span>
              <small>{shelf.availableCopies} available</small>
            </button>)}
            {filteredShelves.length === 0 && <p className="shelf-rail__empty">No shelves match.</p>}
          </nav>
        </aside>}
        <section className="shelf-locator-results" aria-label="Copy results">
          <div className="toolbar shelf-results-toolbar">
            <SearchInput value={search} onChange={setSearch} placeholder="Search title, author, accession no. or shelf…" />
            <label><span className="sr-only">Copy status</span><select className="select" aria-label="Copy status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{["Available", "Borrowed", "Reserved", "Maintenance", "Lost"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span className="sr-only">Copy condition</span><select className="select" aria-label="Copy condition" value={condition} onChange={(event) => { setCondition(event.target.value); setPage(1); }}><option value="">All conditions</option>{["Good", "Damaged"].map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          <div className="shelf-results-summary">
            <strong>{pagination?.total ?? rows.length} {pagination?.total === 1 || (!pagination && rows.length === 1) ? "copy" : "copies"}</strong>
            {activeFilters.length > 0 && <div className="shelf-active-filters" aria-label="Active filters">
              {activeFilters.map((filter) => <button type="button" key={filter.key} className="shelf-active-filter" onClick={filter.clear}>{filter.label}<X size={14} aria-hidden="true" /><span className="sr-only">Remove filter</span></button>)}
              <button type="button" className="shelf-clear-filters" onClick={() => { setSearch(""); setDebouncedSearch(""); setShelfLocation(""); setStatus(""); setCondition(""); setPage(1); }}>Clear all</button>
            </div>}
          </div>
          {copies.loading ? <LoadingState rows={4} /> : copies.error ? <ErrorState message={copies.error} onRetry={() => void copies.reload()} /> : <div className="card"><DataTable columns={columns} rows={rows} rowKey={(copy) => copy.id} empty="No physical copies match." /></div>}
          {pagination && <Pagination page={pagination.page} totalPages={totalPages} from={pagination.total ? (page - 1) * pagination.limit + 1 : 0} to={Math.min(pagination.total, page * pagination.limit)} total={pagination.total} onPrev={() => setPage(Math.max(1, page - 1))} onNext={() => setPage(Math.min(totalPages, page + 1))} />}
        </section>
      </div>
      {canMove && selected.length > 0 && <div className="shelf-selection-bar" role="region" aria-label="Selected copies actions">
        <strong>{selected.length} selected</strong>
        <Button onClick={() => { setNewShelf(""); setBulkMoveOpen(true); }}>Move to shelf</Button>
        <Button variant="ghost" onClick={() => setSelected([])}>Clear</Button>
      </div>}
      {editing && <Modal size="confirm" title={`Change shelf for ${editing.accessionNo}`} onClose={busy ? () => undefined : () => setEditing(null)} footer={<><Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button><Button onClick={() => void saveSingle()} loading={busy} disabled={busy || !newShelf.trim()}>Save shelf</Button></>}>
        <SelectField label="Shelf location" value={newShelf} onChange={(event) => setNewShelf(event.target.value)} required><option value="">Choose a shelf</option>{(overview.data?.shelves ?? []).map((shelf) => <option key={shelf.name} value={shelf.name}>{shelf.name}</option>)}</SelectField>
        {saveError && <Alert kind="error">{saveError}</Alert>}
      </Modal>}
      {bulkMoveOpen && <Modal size="confirm" title="Move selected copies" onClose={() => setBulkMoveOpen(false)} footer={<><Button variant="ghost" onClick={() => setBulkMoveOpen(false)}>Cancel</Button><Button disabled={!newShelf.trim()} onClick={() => { setBulkMoveOpen(false); setBulkConfirm(true); }}>Review move</Button></>}>
        <label className="field" htmlFor="bulk-shelf">
          <span className="label">Shelf location</span>
          <input id="bulk-shelf" className="input" list="shelf-options" value={newShelf} onChange={(event) => setNewShelf(event.target.value)} required />
          <datalist id="shelf-options">{(overview.data?.shelves ?? []).map((shelf) => <option key={shelf.name} value={shelf.name} />)}</datalist>
        </label>
      </Modal>}
      {bulkConfirm && <ConfirmDialog title={`Move ${selected.length} copies?`} message="All selected copies will be assigned to the chosen shelf." details={[{ label: "Copies", value: selected.length }, { label: "New shelf", value: newShelf }]} loading={busy} onClose={() => setBulkConfirm(false)} onConfirm={() => saveBulk()} />}
    </div>
  );
}