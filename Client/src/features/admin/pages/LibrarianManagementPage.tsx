import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { CheckboxField } from "@/components/forms/FormField";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as adminService from "@/services/adminService";
import { LIBRARIAN_PERMISSIONS, type AdminUserRow, type LibrarianAccount, type LibrarianPermission } from "@/types";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";
import AccountStatusDialog from "../components/AccountStatusDialog";
import CreateLibrarianDialog, { PERMISSION_LABELS } from "../components/CreateLibrarianDialog";

function PermissionsDialog({ librarian, onClose, onDone }: { librarian: LibrarianAccount; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [perms, setPerms] = useState<LibrarianPermission[]>(librarian.permissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (p: LibrarianPermission) => setPerms((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminService.updateLibrarianPermissions(librarian.userId, { permissions: perms });
      toast.success("Permissions updated.");
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Permissions: ${librarian.displayName}`}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} loading={busy}>Save permissions</Button>
        </>
      }
    >
      <p className="subtle">Every Librarian can run circulation. These permissions unlock more. Admin always has all of them. Enforced by the backend.</p>
      {LIBRARIAN_PERMISSIONS.map((p) => (
        <CheckboxField key={p} label={PERMISSION_LABELS[p] ?? p} checked={perms.includes(p)} onChange={() => toggle(p)} />
      ))}
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}

// A9 invitation, P15 permissions (proposed, TC-08), D6 status.
export default function LibrarianManagementPage() {
  const list = useAsync(() => adminService.listLibrarians(), []);
  const [dialog, setDialog] = useState<{ kind: "invite" } | { kind: "perms"; l: LibrarianAccount } | { kind: "status"; l: LibrarianAccount } | null>(null);

  const asUserRow = (l: LibrarianAccount): AdminUserRow => ({
    id: l.userId,
    email: l.email,
    role: "LIBRARIAN",
    accountStatus: l.accountStatus,
    emailVerifiedAt: null,
    displayName: l.displayName,
    studentId: null,
    studentNumber: null,
    employeeNumber: l.employeeNumber,
    createdAt: l.createdAt,
  });

  const columns: Column<LibrarianAccount>[] = [
    { key: "displayName", header: "Name", render: (l) => <b>{l.displayName}</b> },
    { key: "email", header: "Email" },
    { key: "employeeNumber", header: "Employee no.", render: (l) => l.employeeNumber ?? "—" },
    { key: "accountStatus", header: "Status", render: (l) => <StatusBadge status={l.accountStatus} /> },
    { key: "invitation", header: "Invitation", render: (l) => <StatusBadge status={l.invitation === "PENDING" ? "PENDING" : "ACCEPTED"} /> },
    {
      key: "permissions",
      header: "Permissions",
      render: (l) => (l.permissions.length ? l.permissions.map((p) => PERMISSION_LABELS[p]?.split(" (")[0] ?? p).join(", ") : "Circulation only"),
    },
    { key: "createdAt", header: "Created", render: (l) => formatDate(l.createdAt) },
    {
      key: "actions",
      header: "",
      render: (l) => (
        <div className="row-actions">
          <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "perms", l })}>Permissions</Button>
          <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "status", l })}>Status</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <PageHeader eyebrow="People" title="Librarians" description="Librarians are created only by Admin invitation. The invitation acceptance flow is proposed (TC-19)." actions={<Button onClick={() => setDialog({ kind: "invite" })}>Invite a Librarian</Button>} />
      {list.loading && !list.data ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={list.data ?? []} rowKey={(l) => l.userId} empty="No Librarians yet." />
        </div>
      )}
      {dialog?.kind === "invite" && <CreateLibrarianDialog onClose={() => setDialog(null)} onDone={() => void list.reload()} />}
      {dialog?.kind === "perms" && <PermissionsDialog librarian={dialog.l} onClose={() => setDialog(null)} onDone={() => void list.reload()} />}
      {dialog?.kind === "status" && <AccountStatusDialog user={asUserRow(dialog.l)} onClose={() => setDialog(null)} onDone={() => void list.reload()} />}
    </div>
  );
}