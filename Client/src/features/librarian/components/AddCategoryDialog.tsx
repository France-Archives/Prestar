import { useState, type FormEvent } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import { InputField, TextareaField } from "@/components/forms/FormField";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import * as booksService from "@/services/booksService";
import type { CategorySummary } from "@/types";
import { describeError, toApiError } from "@/utils/errors";

export function validateCategoryName(name: string): string | null {
  if (!name.trim()) return "A category name is required.";
  if (name.trim().length > 100) return "Category name must be 100 characters or fewer.";
  return null;
}

export function addCreatedCategory(
  categories: CategorySummary[],
  category: CategorySummary,
): { categories: CategorySummary[]; selectedCategoryId: string } {
  return {
    categories: categories.some((item) => item.id === category.id) ? categories : [...categories, category],
    selectedCategoryId: category.id,
  };
}

export function categoryCreateError(error: unknown): { nameError: string | null; formError: string | null } {
  const apiError = toApiError(error);
  if (apiError.status === 409 || apiError.code === "CONFLICT") {
    return { nameError: "Category already exists.", formError: null };
  }
  if (apiError.status === 400 || apiError.code === "VALIDATION_ERROR") {
    return { nameError: apiError.message, formError: null };
  }
  return { nameError: null, formError: describeError(apiError) };
}

interface AddCategoryDialogProps {
  onClose: () => void;
  onCreated: (category: CategorySummary) => void;
}

export default function AddCategoryDialog({ onClose, onCreated }: AddCategoryDialogProps) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateCategoryName(name);
    setNameError(validationError);
    setFormError(null);
    if (validationError) return;

    setBusy(true);
    try {
      const category = await booksService.createCategory({
        name: name.trim(),
        description: description.trim() || null,
      });
      onCreated(category);
      toast.success("Category added.");
      onClose();
    } catch (error) {
      const mapped = categoryCreateError(error);
      setNameError(mapped.nameError);
      setFormError(mapped.formError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add category"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="add-category-form" loading={busy} disabled={busy}>Save</Button>
        </>
      }
    >
      <form id="add-category-form" className="stack" onSubmit={(event) => void save(event)} noValidate>
        <InputField
          label="Name"
          required
          maxLength={100}
          value={name}
          error={nameError}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(null);
          }}
        />
        <TextareaField
          label="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {formError && <Alert kind="error">{formError}</Alert>}
      </form>
    </Modal>
  );
}
