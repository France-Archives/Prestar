import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { PublicOnly, RequireRole } from "./components/RouteGuards";
import { useLibrary } from "./context/LibraryContext";
import Auth from "./pages/Auth";
import Interests from "./pages/Interests";
import Landing from "./pages/Landing";
import { PAGES } from "./pages/registry";
import VerifyEmail from "./pages/VerifyEmail";
import type { UserRole } from "./types";
import { INTEREST_PATH, NAV, ROLE_LIST } from "./utils/constants";

const pageRoutes = (role: UserRole) =>
  NAV[role].map(({ to, label }) => {
    const Page = PAGES[to];
    return <Route key={to} path={to} element={<Page title={label} />} />;
  });

export default function App() {
  const { toast } = useLibrary();
  return (
    <>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Route>
        {ROLE_LIST.map((role) => (
          <Route key={role} element={<RequireRole role={role} />}>
            {/* Book interest screen: full-page card like the auth pages, so it sits outside AppLayout */}
            {role === "Student" && <Route path={INTEREST_PATH} element={<Interests />} />}
            <Route element={<AppLayout />}>{pageRoutes(role)}</Route>
          </Route>
        ))}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <div className={`toast ${toast ? "show" : ""}`} role="status">{toast}</div>
    </>
  );    
}