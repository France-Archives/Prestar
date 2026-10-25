import Alert, { MockTag } from "@/components/feedback/Alert";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as adminService from "@/services/adminService";
import BorrowingPolicyForm from "../components/BorrowingPolicyForm";

const USING_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

// D7 GET /admin/settings, D8 PATCH /admin/settings/:key.
export default function SystemSettingsPage() {
  const list = useAsync(() => adminService.listSettings(), []);

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <PageHero eyebrow="System" title="System settings" description="Configured values. Every change is audited." leading={<BackButton fallback={ROUTES.admin.dashboard} />} />
      <div className="stack">
        <Card title="Environment">
          <dl className="kv">
            <div><dt>Data source</dt><dd>{USING_MOCKS ? <><MockTag>Mock data</MockTag> in-memory demo</> : "Backend API"}</dd></div>
            <div><dt>API base URL</dt><dd>{import.meta.env.VITE_API_BASE_URL ?? "/api/v1"}</dd></div>
            <div><dt>Display time zone</dt><dd>Asia/Manila</dd></div>
            <div><dt>Timestamps</dt><dd>UTC ISO 8601</dd></div>
          </dl>
        </Card>
        {USING_MOCKS && <Alert kind="warn">Settings saved here live only in browser memory and reset on refresh.</Alert>}
        {list.loading && !list.data ? <LoadingState rows={2} /> : list.error ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : (
          <BorrowingPolicyForm settings={list.data ?? []} onSaved={() => void list.reload()} />
        )}
      </div>
    </div>
  );
}