import { useState } from "react";
import { Link } from "react-router-dom";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Tabs from "@/components/ui/Tabs";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { matchesSearch, useSearchTerm } from "@/hooks/useSearchTerm";
import { useToast } from "@/hooks/useToast";
import * as borrowingService from "@/services/borrowingService";
import type { BorrowingRequest } from "@/types";
import { statusLabel } from "@/utils/constants";
import RequestStatusCard from "../components/RequestStatusCard";

type Tab = "open" | "closed";
const OPEN = ["PENDING", "APPROVED", "ON_HOLD"];

export default function MyRequestsPage() {
  const toast = useToast();
  const list = useAsync(() => borrowingService.listMyBorrowingRequests(), []);
  const [q] = useSearchTerm(); // from the navbar search box (?q=)
  const [tab, setTab] = useState<Tab>("open");
  const [target, setTarget] = useState<BorrowingRequest | null>(null);

  // Search runs on the loaded requests; the tab counts follow the search.
  const rows = (list.data ?? []).filter((r) => matchesSearch(q, r.bookTitle, statusLabel(r.status), r.decisionReason));
  const open = rows.filter((r) => OPEN.includes(r.status));
  const closed = rows.filter((r) => !OPEN.includes(r.status));
  const shown = tab === "open" ? open : closed;
  const searching = Boolean(q.trim());

  const cancel = async () => {
    if (!target) return;
    await borrowingService.cancelBorrowingRequest(target.id);
    toast.success("Request cancelled. The held copy was released.");
    await list.reload();
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Student" title="My requests" description="An approved request holds a copy for pickup. It becomes a loan only after staff hand it over." />
      <Tabs<Tab> tabs={[{ key: "open", label: "Open", count: open.length }, { key: "closed", label: "Closed", count: closed.length }]} active={tab} onChange={setTab} />
      {list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={searching ? "No requests match your search" : "No requests here"}
          text={searching ? "Clear the search box or check the other tab." : undefined}
          action={<Link to={ROUTES.student.books} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>Browse books</Link>}
        />
      ) : (
        <div className="stack">{shown.map((r) => <RequestStatusCard key={r.id} request={r} onCancel={setTarget} />)}</div>
      )}
      {target && (
        <ConfirmDialog title="Cancel this request?" danger confirmLabel="Cancel request" onConfirm={cancel} onClose={() => setTarget(null)}>
          <p>{target.bookTitle}: the copy held for you will be released.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}