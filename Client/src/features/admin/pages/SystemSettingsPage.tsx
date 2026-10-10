import Alert, { MockTag } from "@/components/feedback/Alert";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import * as adminService from "@/services/adminService";
import { POLICY_SETTINGS } from "@/utils/constants";
import SystemSettingsForm from "../components/SystemSettingsForm";

const USING_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";

// D7 GET /admin/settings, D8 PATCH /admin/settings/:key. Borrowing limits are on the Borrowing policies page.
export default function SystemSettingsPage() {
  const list = useAsync(() => adminService.listSettings(), []);
  const policyKeys = new Set(POLICY_SETTINGS.map((p) => p.key));
  const other = (list.data ?? []).filter((s) => !policyKeys.has(s.key));

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <PageHeader eyebrow="System" title="System settings" description="Other configured values. Every change is audited." />
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
          <SystemSettingsForm settings={other} onSaved={() => void list.reload()} empty="No other settings. Borrowing limits are edited under Borrowing policies." />
        )}
      </div>
    </div>
  );
}