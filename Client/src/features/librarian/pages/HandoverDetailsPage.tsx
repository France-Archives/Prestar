import { useParams } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import StatusBadge from "@/components/data-display/StatusBadge";
import Timeline from "@/components/data-display/Timeline";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as librarianService from "@/services/librarianService";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import HandoverChecklist from "../components/HandoverChecklist";

export default function HandoverDetailsPage() {
  const { requestId = "" } = useParams();
  const details = useAsync(() => librarianService.getHandoverDetails(requestId), [requestId]);

  if (details.loading && !details.data) return <div className="page"><LoadingState rows={4} /></div>;
  if (details.error || !details.data) return <div className="page"><ErrorState message={details.error ?? "Request not found."} onRetry={() => void details.reload()} /></div>;
  const { item, request, attempts } = details.data;

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <Breadcrumbs items={[{ label: "Books to Release", to: ROUTES.staff.booksToRelease }, { label: "Handover" }]} />
      <PageHero eyebrow="Circulation" title={request.bookTitle} description={`Requested by ${request.student.firstName} ${request.student.lastName} (${request.student.studentNumber})`} leading={<BackButton fallback={ROUTES.staff.booksToRelease} />} compact />
      <div className="stack">
        <Alert kind="info">Please ask the student to present their school ID before handover.</Alert>
        <div className="handover-grid">
          <Card title="Request summary" className="handover-request-card">
            <dl className="kv">
              <div><dt>Status</dt><dd><StatusBadge status={request.status} /></dd></div>
              <div><dt>Loan duration</dt><dd>{request.requestedDurationDays ? `${request.requestedDurationDays} days` : "Not provided yet"}</dd></div>
              <div><dt>Assigned copy</dt><dd>{request.copy?.barcode ?? "Not assigned yet"}</dd></div>
              <div><dt>Requested</dt><dd>{formatDate(request.requestedAt)}</dd></div>
              <div><dt>Pickup deadline</dt><dd>{request.pickupDeadline ? formatDate(request.pickupDeadline) : "—"}</dd></div>
              {request.decisionReason && <div><dt>Note</dt><dd>{request.decisionReason}</dd></div>}
            </dl>
          </Card>
          {item ? (
            <HandoverChecklist item={item} onChanged={() => void details.reload()} />
          ) : (
            <Alert kind="info">This request is {statusLabel(request.status).toLowerCase()} and is no longer awaiting release.</Alert>
          )}
        </div>
        {details.data.attemptsAvailable ? (
          <Card title="Handover history" note="Every check, hold, rejection and claim is recorded.">
            <Timeline
              empty="No handover attempts yet."
              items={attempts.map((a) => ({
                id: a.id,
                title: statusLabel(a.action),
                meta: `${a.staffName} · ${formatDate(a.createdAt)}${a.reasonCode ? ` · ${a.reasonCode}` : ""}`,
                detail: a.notes,
              }))}
            />
          </Card>
        ) : (
          <p className="subtle handover-history-note">Handover history isn't available yet.</p>
        )}
      </div>
    </div>
  );
}