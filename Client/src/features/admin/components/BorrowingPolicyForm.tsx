import Alert from "@/components/feedback/Alert";
import Card from "@/components/ui/Card";
import type { Setting } from "@/types";
import { ALLOWED_DURATIONS, FINE_AMOUNTS, statusLabel } from "@/utils/constants";
import { formatPeso } from "@/utils/formatCurrency";
import SystemSettingsForm from "./SystemSettingsForm";

// Policy limits (10 commitments, 2 per title, 3-day holds, 3-day grace, renewal limit) are editable settings.
// Fine amounts and allowed durations are fixed by the agreements/database CHECK constraints, so they are read-only here (TC-15).
export default function BorrowingPolicyForm({ settings, onSaved }: { settings: Setting[]; onSaved: () => void }) {
  return (
    <div className="stack">
      <Alert kind="info">The backend enforces every limit. This screen only edits the configured values.</Alert>
      <SystemSettingsForm settings={settings} onSaved={onSaved} empty="No policy settings are configured." />
      <Card title="Fixed by the agreements" note="Not editable in the UI.">
        <dl className="kv">
          <div><dt>Allowed durations</dt><dd>{ALLOWED_DURATIONS.join(", ")} days</dd></div>
          {Object.entries(FINE_AMOUNTS).map(([type, amount]) => (
            <div key={type}><dt>{statusLabel(type)}</dt><dd>{formatPeso(amount)}</dd></div>
          ))}
          <div><dt>Daily overdue fine</dt><dd>None</dd></div>
        </dl>
      </Card>
    </div>
  );
}