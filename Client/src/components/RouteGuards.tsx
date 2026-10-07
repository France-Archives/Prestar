import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useLibrary } from "../context/LibraryContext";
import { useInterests } from "../hooks/useInterests";
import type { UserRole } from "../types";
import { HOME_BY_ROLE, INTEREST_PATH } from "../utils/constants";

// Login / signup / verify pages: logged-in users go to their own dashboard.
export function PublicOnly() {
  const { user } = useLibrary();
  const { state } = useLocation();
  if (!user) return <Outlet />;
  const from = (state as { from?: string } | null)?.from;
  const area = `/${user.role.toLowerCase()}`;
  const back = from?.startsWith(area) ? from : HOME_BY_ROLE[user.role];
  return <Navigate to={back} replace />;
}

// UX guard only. The real protection is role checks on every API endpoint.
export function RequireRole({ role }: { role: UserRole }) {
  const { user } = useLibrary();
  const { pathname } = useLocation();
  // Hooks must run before any early return. null means "not a student", so there is nothing to look up.
  const interests = useInterests(user?.role === "Student" ? user.user_id : null);

  if (!user) return <Navigate to="/login" replace state={{ from: pathname }} />;
  if (user.role !== role) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  // First login: a student with no saved interests must pick them once before using the app.
  // The interest screen itself is exempt, otherwise this would redirect forever.
  if (role === "Student" && interests.length === 0 && pathname !== INTEREST_PATH) {
    return <Navigate to={INTEREST_PATH} replace />;
  }
  return <Outlet />;
}