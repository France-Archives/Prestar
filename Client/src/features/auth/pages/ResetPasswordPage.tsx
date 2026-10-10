import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import { ROUTES } from "@/app/routeConfig";
import AuthLayout from "@/layouts/AuthLayout";
import * as authService from "@/services/authService";
import SetPasswordForm from "../components/SetPasswordForm";

// A7. A successful reset revokes the existing session (server-side in the real backend).
export default function ResetPasswordPage() {
  const token = useSearchParams()[0].get("token");
  const [done, setDone] = useState(false);

  return (
    <AuthLayout title="Choose a new password" footer={<Link to={ROUTES.login}>Back to log in</Link>}>
      {!token ? (
        <Alert kind="error">This link is missing its token. Request a new one.</Alert>
      ) : done ? (
        <div className="stack">
          <Alert kind="ok">Your password was updated.</Alert>
          <Link to={ROUTES.login} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>
            Log in
          </Link>
        </div>
      ) : (
        <SetPasswordForm
          submitLabel="Update password"
          onSubmit={async (password) => {
            await authService.resetPassword({ token, password });
            setDone(true);
          }}
        />
      )}
    </AuthLayout>
  );
}