import PageHeader from "@/components/layout/PageHeader";
import OperationalCountCards from "@/features/dashboard/OperationalCountCards";
import { useAuth } from "@/hooks/useAuth";

export default function LibrarianDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="page">
      <PageHeader eyebrow={user?.role === "ADMIN" ? "Admin · staff view" : "Librarian"} title="Circulation dashboard" description="Current circulation counts from the live Server API." />
      <OperationalCountCards />
    </div>
  );
}