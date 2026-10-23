import { Link } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/hooks/useAuth";
import * as booksService from "@/services/booksService";
import * as reportsService from "@/services/reportsService";
import * as authService from "@/services/authService";
import RequestStatusCard from "../components/RequestStatusCard";
import CORStatusCard from "../components/CORStatusCard";
import DueDateAlert from "../components/DueDateAlert";
import MostBorrowedBooks from "../components/MostBorrowedBooks";
import MyActiveLoans from "../components/MyActiveLoans";
import RecentActivity from "../components/RecentActivity";
import RecommendedBooks from "../components/RecommendedBooks";
import ReservationStatus from "../components/ReservationStatus";
import StudentStats from "../components/StudentStats";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const dash = useAsync(() => reportsService.getStudentDashboard(), []);
  const profile = useAsync(() => authService.getMyProfile(), []);
  void booksService;

  if (dash.loading) return <div className="page"><LoadingState rows={5} /></div>;
  if (dash.error || !dash.data) return <div className="page"><ErrorState message={dash.error ?? "Could not load the dashboard."} onRetry={() => void dash.reload()} /></div>;
  const d = dash.data;
  const noInterests = (profile.data?.interests.length ?? 3) < 3;

  return (
    <div className="page">
      <PageHeader eyebrow="Student" title={`Welcome, ${user?.displayName.split(" ")[0] ?? ""}`} description="Your loans, requests, reservations and notices at a glance." />
      <div className="stack">
        {d.accountStatus === "SUSPENDED" && <Alert kind="warn">Your account is suspended. You can browse and see your history, but you cannot start new borrowing.</Alert>}
        {d.accountStatus === "PENDING_VERIFICATION" && <Alert kind="warn">Verify your email to activate borrowing. Check the verification link we sent you.</Alert>}
        {noInterests && (
          <Alert kind="info">
            Choose 3 reading interests for better recommendations. <Link to={ROUTES.student.interests}>Choose interests</Link>
          </Alert>
        )}
        <DueDateAlert loans={d.activeLoans} />
        <StudentStats data={d} />
        <div className="grid gap-4 lg:grid-cols-2">
          <CORStatusCard cor={d.cor} />
          <Card title="Waiting for pickup" note="Approved requests are not loans until staff hand over the book.">
            {d.pickupWaiting.length === 0 ? (
              <p className="subtle">Nothing to pick up.</p>
            ) : (
              <div className="stack">{d.pickupWaiting.map((r) => <RequestStatusCard key={r.id} request={r} />)}</div>
            )}
          </Card>
        </div>
        <Card title="Active loans" actions={<Link to={ROUTES.student.borrowings} className="link-btn">Manage loans</Link>}>
          <MyActiveLoans loans={d.activeLoans} compact />
        </Card>
        <Card title="Reservations">
          {d.reservations.length === 0 ? <p className="subtle">No reservations.</p> : <div className="stack">{d.reservations.map((r) => <ReservationStatus key={r.id} reservation={r} />)}</div>}
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentActivity items={d.recentNotifications} />
          <MostBorrowedBooks books={d.mostBorrowed} />
        </div>
        <RecommendedBooks books={d.recommended} />
      </div>
    </div>
  );
}