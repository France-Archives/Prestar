import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import Card from "@/components/ui/Card";
import { ROUTES } from "@/app/routeConfig";
import { useToast } from "@/hooks/useToast";
import * as adminService from "@/services/adminService";
import type { CreateStaffAccountRequest } from "@/types";
import StaffAccountForm from "../components/StaffAccountForm";

export default function LibrarianManagementPage() {
  const toast = useToast();
  const create = (request: CreateStaffAccountRequest) => adminService.createLibrarian(request);

  return (
    <div className="page">
      <PageHero eyebrow="People" title="Librarians" description="Create a Librarian account." leading={<BackButton fallback={ROUTES.admin.dashboard} />} compact />
      <Card>
        <StaffAccountForm
          role="Librarian"
          onCreate={create}
          onDone={() => toast.success("Librarian account created successfully.")}
        />
      </Card>
    </div>
  );
}