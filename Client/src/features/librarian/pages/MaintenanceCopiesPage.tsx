import { useState } from "react";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import Tabs from "@/components/ui/Tabs";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import * as booksService from "@/services/booksService";
import type { StaffCopyRow } from "@/types";
import CopyForm from "../components/CopyForm";
import CopyStatusTable from "../components/CopyStatusTable";

type Tab = "MAINTENANCE" | "LOST" | "WITHDRAWN";

// Copies out of circulation. Use Edit to put a repaired copy back on the shelf (status Available).
export default function MaintenanceCopiesPage() {
  const [tab, setTab] = useState<Tab>("MAINTENANCE");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<StaffCopyRow | null>(null);
  const list = useAsync(() => booksService.listAllCopies({ search: search || undefined }), [search]);

  const all = list.data ?? [];
  const count = (s: Tab) => all.filter((c) => c.status === s).length;

  return (
    <div className="page">
      <PageHeader eyebrow="Catalog" title="Maintenance copies" description="Damaged, lost and withdrawn copies. A copy returns to circulation only when you set it back to Available." />
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search book or barcode…" />
      </div>
      <Tabs<Tab>
        tabs={[
          { key: "MAINTENANCE", label: "Maintenance", count: count("MAINTENANCE") },
          { key: "LOST", label: "Lost", count: count("LOST") },
          { key: "WITHDRAWN", label: "Withdrawn", count: count("WITHDRAWN") },
        ]}
        active={tab}
        onChange={setTab}
      />
      {list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <CopyStatusTable rows={all.filter((c) => c.status === tab)} showBook onEdit={(c) => setEditing(c as StaffCopyRow)} empty="No copies here." />
        </div>
      )}
      {editing && <CopyForm copy={editing} onClose={() => setEditing(null)} onDone={() => void list.reload()} />}
    </div>
  );
}