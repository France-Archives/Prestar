import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { useToast } from "@/hooks/useToast";
import * as adminService from "@/services/adminService";
import type { Setting } from "@/types";
import { POLICY_SETTINGS } from "@/utils/constants";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";

// Edits one system_settings row. Numeric values are range-checked by the server; the limits shown come from POLICY_SETTINGS.
// Changes are audited. TEMPORARY MOCK: the mock engine reads these values immediately.
export function SettingRow({ setting, onSaved }: { setting: Setting; onSaved: () => void }) {
  const toast = useToast();
  const meta = POLICY_SETTINGS.find((p) => p.key === setting.key);
  const [value, setValue] = useState(String(setting.value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== String(setting.value);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = setting.valueType === "NUMBER" ? Number(value) : setting.valueType === "BOOLEAN" ? value === "true" : value;
      await adminService.updateSetting(setting.key, { value: next } as Parameters<typeof adminService.updateSetting>[1]);
      toast.success(`${setting.key} saved.`);
      onSaved();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad" style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <b style={{ color: "var(--color-forest)" }}>{setting.key}</b>
          <p className="subtle">{setting.description}</p>
        </div>
        <span className="subtle">Updated {formatDate(setting.updatedAt)}</span>
      </div>
      <div className="row-actions" style={{ alignItems: "center" }}>
        <input
          className="input"
          style={{ width: 140 }}
          aria-label={setting.key}
          type={setting.valueType === "NUMBER" ? "number" : "text"}
          min={meta?.min}
          max={meta?.max}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {meta && <span className="subtle">Allowed: {meta.min} to {meta.max} · default {meta.defaultValue}</span>}
        <Button size="sm" onClick={save} loading={busy} disabled={!dirty}>Save</Button>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
    </div>
  );
}

export default function SystemSettingsForm({ settings, onSaved, empty }: { settings: Setting[]; onSaved: () => void; empty: string }) {
  if (settings.length === 0) return <p className="subtle">{empty}</p>;
  return (
    <div className="stack">
      {settings.map((s) => (
        <SettingRow key={s.key} setting={s} onSaved={onSaved} />
      ))}
    </div>
  );
}