import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import Button from "@/components/common/Button";
import { CheckboxField } from "@/components/forms/FormField";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as adminService from "@/services/adminService";
import { LIBRARIAN_PERMISSIONS, type AdminUserRow, type LibrarianAccount, type LibrarianPermission } from "@/types";
import { describeError } from "@/utils/errors";
import { formatDate } from "@/utils/formatDate";
import { USE_MOCKS } from "@/utils/constants";
import AccountStatusDialog from "../components/AccountStatusDialog";
import CreateLibrarianDialog from "../components/CreateLibrarianDialog";
import { PERMISSION_LABELS } from "../components/StaffAccountForm";

function PermissionsDialog({ librarian, onClose, onDone }: { librarian: LibrarianAccount; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [perms, setPerms] = useState<LibrarianPermission[]>(librarian.permissions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const toggle = (p: LibrarianPermission) => setPerms((c) => (c.includes(p) ? c.filter((x) => x !== p) : [...c, p]));

  const save = async () => {
    setConfirming(true);
  };

  const updatePermissions = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminService.updateLibrarianPermissions(librarian.userId, { permissions: perms });
      toast.success("Permissions updated.");
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      throw e;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Modal
      title={`Permissions: ${librarian.displayName}`}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy}>Save permissions</Button>
        </>
      }
    >
      <p className="subtle">Every Librarian can run circulation. These permissions unlock more. Admin always has all of them. Enforced by the backend.</p>
      {LIBRARIAN_PERMISSIONS.map((p) => (
        <CheckboxField key={p} label={PERMISSION_LABELS[p] ?? p} checked={perms.includes(p)} onChange={() => toggle(p)} />
      ))}
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
      {confirming && (
        <ConfirmDialog
          title={`Save permissions for ${librarian.displayName}?`}
          message={`These permissions change the staff capabilities available to ${librarian.displayName}.`}
          details={[
            { label: "Librarian", value: librarian.displayName },
            { label: "Permissions", value: perms.length ? perms.map((permission) => PERMISSION_LABELS[permission]?.split(" (")[0] ?? permission).join(", ") : "Circulation only" },
          ]}
          confirmLabel="Save permissions"
          loading={busy}
          onClose={() => setConfirming(false)}
          onConfirm={updatePermissions}
        />
      )}
    </>
  );
}

// A9 invitation, P15 permissions (proposed, TC-08), D6 status.
export default function LibrarianManagementPage() {
  const list = useAsync(() => adminService.listLibrarians(), [], USE_MOCKS);
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
    ...(USE_MOCKS ? [{ key: "invitation", header: "Invitation", render: (l: LibrarianAccount) => <StatusBadge status={l.invitation === "PENDING" ? "PENDING" : "ACCEPTED"} /> }] : []),
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
      <PageHero eyebrow="People" title="Librarians" description="Create Librarian accounts and manage access." leading={<BackButton fallback={ROUTES.admin.dashboard} />} compact actions={<Button onClick={() => setDialog({ kind: "invite" })}>Create Librarian</Button>} />
      {!USE_MOCKS ? (
        <Alert kind="info">The Librarian list is not available yet.</Alert>
      ) : list.loading && !list.data ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={list.data ?? []} rowKey={(l) => l.userId} empty="No Librarians yet." />
        </div>
      )}
      {dialog?.kind === "invite" && <CreateLibrarianDialog onClose={() => setDialog(null)} onDone={() => { if (USE_MOCKS) void list.reload(); }} />}
      {USE_MOCKS && dialog?.kind === "perms" && <PermissionsDialog librarian={dialog.l} onClose={() => setDialog(null)} onDone={() => void list.reload()} />}
      {USE_MOCKS && dialog?.kind === "status" && <AccountStatusDialog user={asUserRow(dialog.l)} onClose={() => setDialog(null)} onDone={() => void list.reload()} />}
    </div>
  );
}