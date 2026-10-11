import { useState } from "react";
import { Link } from "react-router-dom";
import Alert, { MockTag } from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { CheckboxField, InputField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { ROUTES } from "@/app/routeConfig";
import * as adminService from "@/services/adminService";
import { LIBRARIAN_PERMISSIONS, type LibrarianPermission } from "@/types";
import { describeError } from "@/utils/errors";
import { validateEmail, validateName } from "@/utils/validators";

export const PERMISSION_LABELS: Record<string, string> = {
  COR_REVIEW: "Review CORs",
  CATALOG_MANAGE: "Manage the catalog (books, copies, categories, authors)",
  FINE_PAYMENT: "Assess fines and record payments",
};

interface Props {
  onClose: () => void;
  onDone: () => void;
}

// Librarians are created ONLY by Admin invitation (A9). MOCK: the invitation token is shown so the demo can continue;
// a real backend emails the link and never returns the token.
export default function CreateLibrarianDialog({ onClose, onDone }: Props) {
  const [v, setV] = useState({ firstName: "", lastName: "", email: "", employeeNumber: "" });
  const [perms, setPerms] = useState<LibrarianPermission[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const text = (k: keyof typeof v) => ({ value: v[k], error: errors[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value }) });
  const toggle = (p: LibrarianPermission) => setPerms((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]));

  const submit = async () => {
    const found: Record<string, string> = {};
    const checks: [string, string | null][] = [
      ["firstName", validateName(v.firstName, "First name")],
      ["lastName", validateName(v.lastName, "Last name")],
      ["email", validateEmail(v.email)],
    ];
    checks.forEach(([k, m]) => m && (found[k] = m));
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const res = await adminService.inviteLibrarian({
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        email: v.email.trim(),
        employeeNumber: v.employeeNumber.trim() || undefined,
        permissions: perms,
      } as Parameters<typeof adminService.inviteLibrarian>[0]);
      setToken(res.mockInvitationToken);
      onDone();
    } catch (e) {
      setFormError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  if (token) {
    return (
      <Modal title="Invitation created" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
        <Alert kind="ok">The Librarian account was created and is waiting for the invitation to be accepted.</Alert>
        <Alert kind="warn">
          <MockTag>Simulated</MockTag> No email was sent. A real backend emails the invitation link and never shows the token. For this demo, open the link yourself:
        </Alert>
        <Link to={`${ROUTES.acceptInvitation}?token=${encodeURIComponent(token)}`} className="btn btn-ghost" style={{ textDecoration: "none" }} onClick={onClose}>
          Open invitation link (demo)
        </Link>
      </Modal>
    );
  }

  return (
    <Modal
      title="Invite a Librarian"
      wide
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy}>Send invitation</Button>
        </>
      }
    >
      <div className="form-row">
        <InputField label="First name" required {...text("firstName")} />
        <InputField label="Last name" required {...text("lastName")} />
      </div>
      <div className="form-row">
        <InputField label="Email" type="email" required {...text("email")} />
        <InputField label="Employee number" {...text("employeeNumber")} />
      </div>
      <fieldset className="stack" style={{ gap: 6 }}>
        <legend style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-forest)" }}>
          Extra permissions <span className="subtle">(storage and exact keys are TO CONFIRM, TC-08)</span>
        </legend>
        {LIBRARIAN_PERMISSIONS.map((p) => (
          <CheckboxField key={p} label={PERMISSION_LABELS[p] ?? p} checked={perms.includes(p)} onChange={() => toggle(p)} />
        ))}
      </fieldset>
      {formError && <Alert kind="error">{formError}</Alert>}
    </Modal>
  );
}