import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import Card from "@/components/ui/Card";
import { ROUTES } from "@/app/routeConfig";
import * as adminService from "@/services/adminService";
import type { CreateStaffAccountRequest } from "@/types";
import StaffAccountForm from "../components/StaffAccountForm";

export default function CreateAdminPage() {
  const create = (request: CreateStaffAccountRequest) => adminService.createAdmin(request);

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <PageHero
        eyebrow="Administration"
        title="Create admin"
        description="Create an account with full administrative access."
        leading={<BackButton fallback={ROUTES.admin.dashboard} />}
        compact
      />
      <Card>
        <StaffAccountForm role="Admin" onCreate={create} requireConfirmation />
      </Card>
    </div>
  );
}
