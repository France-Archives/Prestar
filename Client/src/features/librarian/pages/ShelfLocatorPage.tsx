import { useState } from "react";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import StatusBadge from "@/components/data-display/StatusBadge";
import Alert from "@/components/feedback/Alert";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as booksService from "@/services/booksService";
import type { StaffCopyRow } from "@/types";
import CopyForm from "../components/CopyForm";

export default function ShelfLocatorPage() {
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