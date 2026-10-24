import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as adminService from "@/services/adminService";
import { POLICY_SETTINGS } from "@/utils/constants";
import BorrowingPolicyForm from "../components/BorrowingPolicyForm";

export default function BorrowingPoliciesPage() {
  const list = useAsync(() => adminService.listSettings(), []);
  const keys = new Set(POLICY_SETTINGS.map((p) => p.key));
  const policies = (list.data ?? []).filter((s) => keys.has(s.key));
  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <PageHero eyebrow="System" title="Borrowing policies" description="Commitment limits, hold periods, overdue grace and the renewal limit (renewal limit of 1 is TO CONFIRM, TC-07)." leading={<BackButton fallback={ROUTES.admin.dashboard} />} />
      {list.loading && !list.data ? <LoadingState rows={4} /> : list.error ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : (
        <BorrowingPolicyForm settings={policies} onSaved={() => void list.reload()} />
      )}
    </div>
  );
}