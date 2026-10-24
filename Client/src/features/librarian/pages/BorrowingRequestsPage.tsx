import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as librarianService from "@/services/librarianService";
import type { BorrowingRequestStatus, StaffBorrowingRequest } from "@/types";
import { statusLabel, USE_MOCKS } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";

const STATUSES: BorrowingRequestStatus[] = ["PENDING", "APPROVED", "ON_HOLD", "RELEASE_REJECTED", "CLAIMED", "EXPIRED", "CANCELLED"];
type Action = { kind: "cancel" | "expire" | "approve" | "reject"; row: StaffBorrowingRequest };

// Hold, Reject Handover, Cancel Request and Expire Request are four DISTINCT actions. Hold and Reject live on the handover page.
export default function BorrowingRequestsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | BorrowingRequestStatus>("");
  const [action, setAction] = useState<Action | null>(null);
  const list = useAsync(() => librarianService.listStaffBorrowingRequests({ status: status || undefined, search: search || undefined }), [status, search]);
  const visibleStatuses = USE_MOCKS ? STATUSES : STATUSES.filter((item) => item !== "ON_HOLD");

  const columns: Column<StaffBorrowingRequest>[] = [
    { key: "student", header: "Student", render: (r) => `${r.student.firstName} ${r.student.lastName} (${r.student.studentNumber})` },
    { key: "bookTitle", header: "Book" },
    { key: "copy", header: "Copy", render: (r) => r.copy?.barcode ?? "—" },
    { key: "requestedDurationDays", header: "Loan", render: (r) => `${r.requestedDurationDays} days` },
    { key: "requestedAt", header: "Requested", render: (r) => formatDate(r.requestedAt) },
    { key: "pickupDeadline", header: "Pickup by", render: (r) => (r.pickupDeadline ? formatDate(r.pickupDeadline) : "—") },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "",
      render: (r) => {
        const open = r.status === "APPROVED" || r.status === "ON_HOLD";
        return (
          <div className="row-actions">
            {!USE_MOCKS && r.status === "PENDING" && (
              <>
                <Button size="sm" onClick={() => setAction({ kind: "approve", row: r })}>
                  Approve
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAction({ kind: "reject", row: r })}>
                  Reject
                </Button>
              </>
            )}
            {open && (
              <Button size="sm" onClick={() => navigate(ROUTES.staff.handover(r.id))}>
                Handover
              </Button>
            )}
            {USE_MOCKS && open && (
              <Button variant="ghost" size="sm" onClick={() => setAction({ kind: "cancel", row: r })}>
                Cancel
              </Button>
            )}
            {USE_MOCKS && open && (
              <Button variant="ghost" size="sm" onClick={() => setAction({ kind: "expire", row: r })}>
                Expire
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="page">
      <PageHero eyebrow="Circulation" title="Borrowing requests" description="Eligible requests are approved automatically when a copy is available. Staff handle the pickup, not the approval." leading={<BackButton fallback={ROUTES.staff.dashboard} />} compact />
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search student, book or barcode…" />
        <select className="select" style={{ width: "auto" }} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as "" | BorrowingRequestStatus)}>
          <option value="">All statuses</option>
          {visibleStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={list.data ?? []} rowKey={(r) => r.id} empty="No requests match." />
        </div>
      )}
      {action?.kind === "cancel" && (
        <ConfirmDialog
          title="Cancel this request?"
          danger
          confirmLabel="Cancel request"
          reasonLabel="Reason (kept in the audit log)"
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            await librarianService.cancelBorrowingRequestAsStaff(action.row.id, reason);
            toast.success("Request cancelled. The held copy was released.");
            await list.reload();
          }}
        >
          <p>{action.row.bookTitle} for {action.row.student.firstName} {action.row.student.lastName}.</p>
        </ConfirmDialog>
      )}
      {action?.kind === "expire" && (
        <ConfirmDialog
          title="Expire this request?"
          danger
          confirmLabel="Expire request"
          onClose={() => setAction(null)}
          onConfirm={async () => {
            await librarianService.expireBorrowingRequest(action.row.id);
            toast.success("Request expired. The copy was released.");
            await list.reload();
          }}
        >
          <p>The system normally expires requests when the 3-day pickup deadline passes. Expire manually only when needed (behaviour TO CONFIRM).</p>
        </ConfirmDialog>
      )}
      {(action?.kind === "approve" || action?.kind === "reject") && (
        <ConfirmDialog
          title={action.kind === "approve" ? "Approve this request?" : "Reject this request?"}
          danger={action.kind === "reject"}
          confirmLabel={action.kind === "approve" ? "Approve request" : "Reject request"}
          reasonLabel={action.kind === "reject" ? "Reason for rejection" : undefined}
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            await librarianService.reviewBorrowingRequest(
              action.row.id,
              action.kind === "approve" ? "approve" : "reject",
              reason,
            );
            toast.success(action.kind === "approve" ? "Request approved." : "Request rejected.");
            await list.reload();
          }}
        >
          <p>{action.row.bookTitle} for {action.row.student.firstName} {action.row.student.lastName}.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}