import { Outlet } from "react-router-dom";
import PublicNavbar from "@/components/navigation/PublicNavbar";
import PublicFooter from "@/features/public-site/components/PublicFooter";

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}