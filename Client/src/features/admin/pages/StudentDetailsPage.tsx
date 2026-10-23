import { useParams } from "react-router-dom";
import Card from "@/components/ui/Card";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Money from "@/components/data-display/Money";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { ROUTES } from "@/app/routeConfig";
import PenaltySummary from "@/features/librarian/components/PenaltySummary";
import { useAsync } from "@/hooks/useAsync";
import * as adminService from "@/services/adminService";
import type { CorVerification, Loan, Reservation, StaffFine } from "@/types";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";

const LOAN_COLS: Column<Loan>[] = [
  { key: "bookTitle", header: "Book" },
  { key: "borrowedAt", header: "Borrowed", render: (l) => formatDate(l.borrowedAt) },
  { key: "dueAt", header: "Due", render: (l) => formatDate(l.dueAt) },
  { key: "returnedAt", header: "Returned", render: (l) => (l.returnedAt ? formatDate(l.returnedAt) : "—") },
  { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
];
const RES_COLS: Column<Reservation>[] = [
  { key: "bookTitle", header: "Book" },
  { key: "reservedAt", header: "Reserved", render: (r) => formatDate(r.reservedAt) },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
];
const FINE_COLS: Column<StaffFine>[] = [
  { key: "bookTitle", header: "Book" },
  { key: "fineType", header: "Type", render: (f) => statusLabel(f.fineType) },
  { key: "amount", header: "Amount", render: (f) => <Money value={f.amount} /> },
  { key: "balance", header: "Balance", render: (f) => <Money value={f.balance} /> },
  { key: "status", header: "Status", render: (f) => <StatusBadge status={f.status} /> },
];
const COR_COLS: Column<CorVerification>[] = [
  { key: "termName", header: "Term" },
  { key: "submittedAt", header: "Submitted", render: (c) => formatDate(c.submittedAt) },
  { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
  { key: "rejectionReason", header: "Reason", render: (c) => c.rejectionReason ?? "—" },
];

export default function StudentDetailsPage() {
  const { studentId = "" } = useParams();
  const details = useAsync(() => adminService.getStudentDetails(studentId), [studentId]);

  if (details.loading && !details.data) return <div className="page"><LoadingState rows={5} /></div>;
  if (details.error || !details.data) return <div className="page"><ErrorState message={details.error ?? "Student not found."} onRetry={() => void details.reload()} /></div>;
  const d = details.data;
  const p = d.profile;

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: "Users", to: ROUTES.admin.users }, { label: `${p.firstName} ${p.lastName}` }]} />
      <PageHeader eyebrow="Student" title={`${p.firstName} ${p.lastName}`} description={`${p.studentNumber} · ${d.user.email}`} />
      <div className="stack">
        <Card title="Profile">
          <dl className="kv">
            <div><dt>Account</dt><dd><StatusBadge status={d.user.accountStatus} /></dd></div>
            <div><dt>Email verified</dt><dd>{d.user.emailVerifiedAt ? formatDate(d.user.emailVerifiedAt) : "No"}</dd></div>
            <div><dt>Program</dt><dd>{p.program ?? "—"}</dd></div>
            <div><dt>Year level</dt><dd>{p.yearLevel ?? "—"}</dd></div>
            <div><dt>Registry status</dt><dd>{p.registryStatus}</dd></div>
            <div><dt>COR (current term)</dt><dd><StatusBadge status={d.cor.status} /></dd></div>
          </dl>
        </Card>
        <Card title="Live eligibility check" note="Computed now by the backend (the mock engine in this demo).">
          <PenaltySummary check={d.penaltyCheck} />
        </Card>
        <Card title="Loans" padded={false}><DataTable columns={LOAN_COLS} rows={d.loans} rowKey={(l) => l.id} empty="No loans." pageSize={5} /></Card>
        <Card title="Reservations" padded={false}><DataTable columns={RES_COLS} rows={d.reservations} rowKey={(r) => r.id} empty="No reservations." pageSize={5} /></Card>
        <Card title="Fines" padded={false}><DataTable columns={FINE_COLS} rows={d.fines} rowKey={(f) => f.id} empty="No fines." pageSize={5} /></Card>
        <Card title="COR submissions" padded={false}><DataTable columns={COR_COLS} rows={d.verifications} rowKey={(c) => c.id} empty="No COR submitted." pageSize={5} /></Card>
      </div>
    </div>
  );
}