import { Link } from "react-router-dom";
import { ROUTES } from "@/app/routeConfig";
import AuthLayout from "@/layouts/AuthLayout";
import SignupForm from "../components/SignupForm";

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Student accounts only. You will verify your email, then submit your COR before borrowing."
      footer={
        <>
          Already registered? <Link to={ROUTES.login}>Log in</Link>
        </>
      }
    >
      <SignupForm />
    </AuthLayout>
  );
}