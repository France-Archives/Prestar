import { Link, Navigate } from "react-router-dom";
import { ClipboardCheck, PackageCheck } from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import OperationalCountCards from "@/features/dashboard/OperationalCountCards";
import { DashboardLiveStatus } from "@/features/dashboard/DashboardVisuals";
import { ROUTES } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";

export default function LibrarianDashboardPage() {
  const { user } = useAuth();
  const adminView = user?.role === "ADMIN";

  if (adminView) return <Navigate to={ROUTES.admin.dashboard} replace />;

  return (
    <div className="page librarian-dashboard-page">
      <PageHero
        eyebrow={adminView ? "Admin · circulation" : "Librarian"}
        title="Circulation dashboard"
        description="Current circulation counts from the live Server API."
        leading={<BackButton fallback={ROUTES.staff.dashboard} />}
        actions={
          <div className="dashboard-actions">
            <Link to={ROUTES.staff.booksToRelease}><PackageCheck size={15} aria-hidden="true" /> Books to release</Link>
            <Link to={ROUTES.staff.requests}><ClipboardCheck size={15} aria-hidden="true" /> Borrowing requests</Link>
            <DashboardLiveStatus />
          </div>
        }
      />
      <OperationalCountCards />
    </div>
  );
}