import DataTable, { type Column } from "@/components/data-display/DataTable";
import Money from "@/components/data-display/Money";
import StatusBadge from "@/components/data-display/StatusBadge";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import BackButton from "@/components/navigation/BackButton";
import PageHero from "@/components/layout/PageHero";
import EmptyState from "@/components/feedback/EmptyState";
import InfoBanner from "@/components/feedback/InfoBanner";
import StatStrip from "@/components/layout/StatStrip";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as finesService from "@/services/finesService";
import type { StaffFine } from "@/types";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import { WalletCards } from "lucide-react";

const COLUMNS: Column<StaffFine>[] = [
  { key: "fineType", header: "Type", render: (fine) => fine.fineTypeLabel ?? statusLabel(fine.fineType) },
  { key: "bookTitle", header: "Book" },
  { key: "amount", header: "Amount", render: (fine) => <Money value={fine.amount} /> },
  { key: "status", header: "Status", render: (fine) => <StatusBadge status={fine.status} /> },
  { key: "recordedAt", header: "Date", render: (fine) => formatDate(fine.recordedAt) },
];

export default function StudentPenaltiesPage() {
  const penalties = useAsync(() => finesService.getMyPenalties(), []);

  return (
    <div className="page">
      <PageHero
        eyebrow="Student"
        title="Penalties"
        description="Penalties are settled in cash at the library counter."
        leading={<BackButton fallback={ROUTES.student.dashboard} />}
      />
      {penalties.loading && !penalties.data ? (
        <LoadingState rows={3} />
      ) : penalties.error ? (
        <ErrorState message={penalties.error} onRetry={() => void penalties.reload()} />
      ) : penalties.data ? (
        <div className="stack student-penalties-content">
          <InfoBanner lead="Cash payments only">{penalties.data.message}</InfoBanner>
          <StatStrip label="Penalty balance" items={[
            { label: "Outstanding balance", value: <Money value={penalties.data.totalBalance} />, hint: "Pay at the library counter", icon: WalletCards, tone: "amber" },
          ]} />
          {penalties.data.fines.length === 0 ? (
            <EmptyState title="No current penalties." />
          ) : (
            <div className="card card-pad student-penalties-table">
              <DataTable columns={COLUMNS} rows={penalties.data.fines} rowKey={(fine) => fine.id} empty="No current penalties." />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
