import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import { InputField } from "@/components/forms/FormField";
import LoadingState from "@/components/feedback/LoadingState";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/layout/PageHeader";
import { useToast } from "@/hooks/useToast";
import { describeError } from "@/utils/errors";

interface Item {
  id: string;
  name: string;
}

interface NameListManagerProps {
  title: string;
  description: string;
  noun: string;
  items: Item[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onSave: (name: string, id?: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

// Shared by the Categories and Authors pages. These management endpoints are not in the source: mock only (TO CONFIRM).
export default function NameListManager({ title, description, noun, items, loading, error, onReload, onSave, onDelete }: NameListManagerProps) {
  const toast = useToast();
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openForm = (target: Item | "new") => {
    setEditing(target);
    setName(target === "new" ? "" : target.name);
    setFormError(null);
  };

  const save = async () => {
    if (!name.trim()) return setFormError("A name is required.");
    setBusy(true);
    setFormError(null);
    try {
      await onSave(name.trim(), editing && editing !== "new" ? editing.id : undefined);
      toast.success(`${noun} saved.`);
      setEditing(null);
      onReload();
    } catch (e) {
      setFormError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Item>[] = [
    { key: "name", header: "Name" },
    {
      key: "actions",
      header: "",
      render: (i) => (
        <div className="row-actions">
          <Button variant="ghost" size="sm" onClick={() => openForm(i)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleting(i)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <PageHeader eyebrow="Catalog" title={title} description={description} actions={<Button onClick={() => openForm("new")}>Add {noun.toLowerCase()}</Button>} />
      {loading ? (
        <LoadingState rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={onReload} />
      ) : (
        <div className="card">
          <DataTable columns={columns} rows={items ?? []} rowKey={(i) => i.id} empty={`No ${noun.toLowerCase()}s yet.`} />
        </div>
      )}
      {editing && (
        <Modal
          title={editing === "new" ? `Add ${noun.toLowerCase()}` : `Edit ${noun.toLowerCase()}`}
          onClose={busy ? () => undefined : () => setEditing(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={save} loading={busy}>
                Save
              </Button>
            </>
          }
        >
          <InputField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          {formError && <Alert kind="error">{formError}</Alert>}
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${noun.toLowerCase()}?`}
          danger
          confirmLabel="Delete"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await onDelete(deleting.id);
            toast.success(`${noun} deleted.`);
            onReload();
          }}
        >
          <p>{deleting.name} will be removed. A {noun.toLowerCase()} that is still linked to a title cannot be deleted.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}