import { Outlet } from "react-router-dom";
import PublicNavbar from "@/components/navigation/PublicNavbar";
import PublicFooter from "@/features/public-site/components/PublicFooter";
import ScrollProgress from "@/components/ui/ScrollProgress";

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollProgress />
      <PublicNavbar />
      <main className="flex-1" style={{ paddingTop: "4.25rem" }}>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}