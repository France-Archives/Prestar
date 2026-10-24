import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAuth } from "@/hooks/useAuth";
import * as booksService from "@/services/booksService";
import { useAsync } from "@/hooks/useAsync";
import type { CategorySummary } from "@/types";
import { USE_MOCKS } from "@/utils/constants";
import { can } from "@/utils/permissions";
import AddCategoryDialog, { addCreatedCategory } from "../components/AddCategoryDialog";
import NameListManager from "../components/NameListManager";

export default function ManageCategoriesPage() {
  const list = useAsync(() => booksService.listCategories(), []);
  const { user } = useAuth();
  const canManage = can(user, "CATALOG_MANAGE");
  const [createdCategories, setCreatedCategories] = useState<CategorySummary[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);

  if (!USE_MOCKS) {
    const categories = (list.data ?? []).reduce<CategorySummary[]>((items, category) => (
      addCreatedCategory(items, category).categories
    ), []);
    const mergedCategories = createdCategories.reduce<CategorySummary[]>((items, category) => (
      addCreatedCategory(items, category).categories
    ), categories);
    const columns: Column<CategorySummary>[] = [
      { key: "name", header: "Name" },
      { key: "description", header: "Description", render: (category) => category.description || "—" },
    ];

    return (
      <div className="page" style={{ maxWidth: 820 }}>
        <PageHero
          eyebrow="Catalog"
          title="Categories"
          description="Book categories shown in the catalog filters."
          leading={<BackButton fallback={ROUTES.staff.dashboard} />}
          compact
          actions={canManage ? <Button onClick={() => setAddingCategory(true)}>Add category</Button> : undefined}
        />
        {list.loading ? (
          <LoadingState rows={4} />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={() => void list.reload()} />
        ) : (
          <div className="card">
            <DataTable columns={columns} rows={mergedCategories} rowKey={(category) => category.id} empty="No categories yet." />
          </div>
        )}
        {!canManage && <Alert kind="info">You do not have catalog management access.</Alert>}
        {addingCategory && canManage && (
          <AddCategoryDialog
            onClose={() => setAddingCategory(false)}
            onCreated={(category) => {
              setCreatedCategories((current) => addCreatedCategory(current, category).categories);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <NameListManager
      title="Categories"
      description="Book categories shown in the catalog filters."
      noun="Category"
      items={list.data}
      loading={list.loading}
      error={list.error}
      onReload={() => void list.reload()}
      onSave={(name, id) => booksService.saveCategory({ name }, id)}
      onDelete={(id) => booksService.deleteCategory(id)}
    />
  );
}