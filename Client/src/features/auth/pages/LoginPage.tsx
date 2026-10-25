import { Link, useLocation } from "react-router-dom";
import Alert from "@/components/feedback/Alert";
import { ROUTES } from "@/app/routeConfig";
import AuthLayout from "@/layouts/AuthLayout";
import LoginForm from "../components/LoginForm";

export default function LoginPage() {
  const location = useLocation();
  const notice = (location.state as { notice?: unknown } | null)?.notice;
  return (
    <AuthLayout
      title="Log in to PRESTAR"
      subtitle="Use your school email."
      footer={
        <>
          New here? <Link to={ROUTES.signup}>Create a student account</Link>
        </>
      }
    >
      {typeof notice === "string" && <Alert kind="ok">{notice}</Alert>}
      <LoginForm />
    </AuthLayout>
  );
}