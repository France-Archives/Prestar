import { useState } from "react";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import StatusBadge from "@/components/data-display/StatusBadge";
import Tabs from "@/components/ui/Tabs";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import * as verificationService from "@/services/verificationService";
import type { StaffCorVerification, VerificationStatus } from "@/types";
import { formatDate } from "@/utils/formatDate";
import CORReviewPanel from "../components/CORReviewPanel";

type Tab = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

// Also used by the Admin COR administration page. Needs Admin or a Librarian with the COR_REVIEW permission.
export default function CORReviewPage() {
  const [tab, setTab] = useState<Tab>("PENDING");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<StaffCorVerification | null>(null);
  const list = useAsync(() => verificationService.listCorQueue({ search: search || undefined }), [search]);

  const all = list.data ?? [];
  const count = (s: VerificationStatus) => all.filter((c) => c.status === s).length;
  const rows = tab === "ALL" ? all : all.filter((c) => c.status === tab);

  const columns: Column<StaffCorVerification>[] = [
    { key: "student", header: "Student", render: (c) => `${c.student.name} (${c.student.studentNumber})` },
    { key: "termName", header: "Term" },
    { key: "originalFileName", header: "File" },
    { key: "submittedAt", header: "Submitted", render: (c) => formatDate(c.submittedAt) },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <Button size="sm" variant={c.status === "PENDING" ? "primary" : "ghost"} onClick={() => setOpen(c)}>
          {c.status === "PENDING" ? "Review" : "View"}
        </Button>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader eyebrow="Verification" title="COR review" description="Approve or reject each student's Certificate of Registration. A rejection needs a reason, and the student may resubmit." />
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search student, number, term or file…" />
      </div>
      <Tabs<Tab>
        tabs={[
          { key: "PENDING", label: "Pending", count: count("PENDING") },
          { key: "APPROVED", label: "Approved", count: count("APPROVED") },
          { key: "REJECTED", label: "Rejected", count: count("REJECTED") },
          { key: "ALL", label: "All", count: all.length },
        ]}
        active={tab}
        onChange={setTab}
      />
      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} empty="No submissions here." />
        </div>
      )}
      {open && <CORReviewPanel item={open} onClose={() => setOpen(null)} onDone={() => void list.reload()} />}
    </div>
  );
}