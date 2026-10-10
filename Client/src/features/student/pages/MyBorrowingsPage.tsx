import { Link } from "react-router-dom";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { matchesSearch, useSearchTerm } from "@/hooks/useSearchTerm";
import * as borrowingService from "@/services/borrowingService";
import DueDateAlert from "../components/DueDateAlert";
import MyActiveLoans from "../components/MyActiveLoans";

export default function MyBorrowingsPage() {
  const loans = useAsync(() => borrowingService.listMyLoans({ status: "ACTIVE" }), []);
  const [q] = useSearchTerm(); // from the navbar search box (?q=)

  const all = loans.data ?? [];
  // The search only narrows the list below. Due/overdue alerts always use ALL active loans.
  const shown = all.filter((l) => matchesSearch(q, l.bookTitle, l.copyBarcode));
  const noMatch = Boolean(q.trim()) && all.length > 0 && shown.length === 0;

  return (
    <div className="page">
      <PageHeader eyebrow="Student" title="My loans" description="Returns are confirmed by library staff at the desk. Bring the book to the library." actions={<Link to={ROUTES.student.history} className="link-btn">Borrowing history</Link>} />
      {loans.loading ? (
        <LoadingState rows={3} />
      ) : loans.error ? (
        <ErrorState message={loans.error} onRetry={() => void loans.reload()} />
      ) : (
        <div className="stack">
          <DueDateAlert loans={all} />
          <Card title="Active loans" note="Fines are paid in person at the library. You will see fine notices in your notifications.">
            {noMatch ? (
              <EmptyState title="No loans match your search." text="Clear the search box to see all your loans." />
            ) : (
              <MyActiveLoans loans={shown} onChanged={() => void loans.reload()} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}