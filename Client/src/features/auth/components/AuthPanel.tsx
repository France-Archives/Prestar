import { MockTag } from "@/components/feedback/Alert";
import { DEMO_CREDENTIALS, DEMO_PASSWORD } from "@/data/mockUsers";
import { USE_MOCKS } from "@/utils/constants";
import "../styles/auth.css";

// Demo logins. Shown ONLY while the in-browser mock backend is on. Remove with the mock data.
export default function AuthPanel({ onPick }: { onPick: (email: string, password: string) => void }) {
  if (!USE_MOCKS) return null;
  return (
    <div className="demo-panel">
      <div style={{ marginBottom: 6 }}>
        <MockTag>Demo accounts</MockTag> <span className="subtle">Password for all: {DEMO_PASSWORD}</span>
      </div>
      {DEMO_CREDENTIALS.map((c) => (
        <button key={c.email} type="button" onClick={() => onPick(c.email, DEMO_PASSWORD)}>
          <b>{c.role}</b>
          <span className="subtle" style={{ display: "block" }}>
            {c.email} · {c.note}
          </span>
        </button>
      ))}
    </div>
  );
}