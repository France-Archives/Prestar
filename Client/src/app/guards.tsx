import { Link, Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { can, type Capability } from "@/utils/permissions";
import { ROUTES, homePathFor, safeNext } from "./routeConfig";

// Route guards are a UX convenience only. Every endpoint is authorized again by the backend.

export function PageLoading() {
  return (
    <div className="page" role="status" aria-live="polite">
      <div className="skeleton" style={{ height: 28, width: 220, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 160 }} />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function SessionUnavailable() {
  const { refresh, sessionError } = useAuth();
  return (
    <div className="page" role="alert">
      <div className="empty">
        <h1>Unable to check your session</h1>
        <p className="subtle">{sessionError ?? "The Server could not be reached. Your session has not been cleared."}</p>
        <button className="btn btn-primary" type="button" onClick={() => void refresh()}>Try again</button>
      </div>
    </div>
  );
}

/** Requires a signed-in user. Others go to /login?next=. */
export function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === "loading") return <PageLoading />;
  if (status === "error") return <SessionUnavailable />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${ROUTES.login}?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** Redirects obsolete staff routes to the dashboard for the signed-in user's role. */
export function RoleDashboardRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homePathFor(user) : ROUTES.login} replace />;
}

/** Login, signup and forgot-password are for signed-out visitors only. */
export function GuestOnly() {
  const { status, user } = useAuth();
  const [params] = useSearchParams();
  if (status === "loading") return <PageLoading />;
  if (status === "error") return <SessionUnavailable />;
  if (user) return <Navigate to={safeNext(params.get("next")) ?? homePathFor(user)} replace />;
  return <Outlet />;
}

function Forbidden() {
  const { user } = useAuth();
  return (
    <div className="page">
      <div className="empty">
        <h1>You do not have access to this page</h1>
        <p className="subtle">Your account does not have the permission this screen needs. Ask an Admin if you think this is a mistake.</p>
        <Link className="btn btn-primary" to={user ? homePathFor(user) : ROUTES.home}>
          Go to my dashboard
        </Link>
      </div>
    </div>
  );
}

/** Requires a capability (Admin passes every staff capability). Wrap routes with <RequireCapability capability="..." />. */
export function RequireCapability({ capability }: { capability: Capability }) {
  const { user } = useAuth();
  if (
    user?.role === "STUDENT"
    && capability === "STUDENT_AREA"
    && ((!user.emailVerifiedAt && user.accountStatus !== "ACTIVE") || user.accountStatus === "PENDING_VERIFICATION")
  ) {
    return <Navigate to={ROUTES.verificationPending} replace state={{ email: user.email }} />;
  }
  if (!user || !can(user, capability)) return <Forbidden />;
  return <Outlet />;
}
