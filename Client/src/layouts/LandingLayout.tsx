import { Outlet } from "react-router-dom";
import PublicNavbar from "@/components/navigation/PublicNavbar";

/**
 * Layout for the landing page only.
 * No footer (footer lives inside the CTA snap screen).
 * No paddingTop on main (the snap container manages its own viewport sizing).
 * ScrollProgress is rendered by SnapLanding itself — do NOT add it here.
 */
export default function LandingLayout() {
  return (
    <>
      <PublicNavbar />
      <Outlet />
    </>
  );
}
