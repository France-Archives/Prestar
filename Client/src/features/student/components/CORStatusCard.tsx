import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/data-display/StatusBadge";
import { ROUTES } from "@/app/routeConfig";
import type { CorSummary } from "@/types";
import { formatDate } from "@/utils/formatDate";

const MESSAGE: Record<string, string> = {
  APPROVED: "Your COR is approved for the current term. You can borrow, reserve and renew.",
  PENDING: "Your COR is waiting for review. You cannot borrow until it is approved.",
  REJECTED: "Your COR was not approved. Upload a corrected document.",
  MISSING: "Submit your COR for the current term to start borrowing.",
  EXPIRED: "Your COR has expired. Submit a COR for the current term to borrow again.",
  NOT_YET_EFFECTIVE: "Your approved COR is for a later term and is not in effect yet.",
  SUPERSEDED: "Your earlier COR was replaced by a newer submission.",
};

// Browsing, history, profile and notifications always stay available. Only NEW borrowing, reservations and renewals need a COR.
export default function CORStatusCard({ cor }: { cor: CorSummary }) {
  const ok = cor.status === "APPROVED";
  return (
    <Card
      title="Certificate of Registration"
      note={cor.currentTerm ? `${cor.currentTerm.name} · COR deadline ${formatDate(cor.currentTerm.corDeadline)}` : "No active academic term"}
      actions={<StatusBadge status={cor.status} />}
    >
      <div className="stack" style={{ gap: 10 }}>
        <Alert kind={ok ? "ok" : cor.status === "PENDING" ? "info" : "warn"}>{MESSAGE[cor.status] ?? "Check your COR status."}</Alert>
        {cor.latest?.status === "REJECTED" && cor.latest.rejectionReason && (
          <p className="subtle">Reason: {cor.latest.rejectionReason}</p>
        )}
        {!ok && cor.status !== "PENDING" && (
          <div>
            <Link to={ROUTES.student.uploadCor} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>
              Submit COR
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}