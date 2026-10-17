import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import AuthLayout from "@/layouts/AuthLayout";
import LoginForm from "../components/LoginForm";

export default function LoginPage() {
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
      <LoginForm />
    </AuthLayout>
  );
}