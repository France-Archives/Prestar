import { useState } from "react";
import { Tags } from "lucide-react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import DataTable, { type Column } from "@/components/data-display/DataTable";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import SearchInput from "@/components/forms/SearchInput";
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
  const [search, setSearch] = useState("");

  if (!USE_MOCKS) {
    const categories = (list.data ?? []).reduce<CategorySummary[]>((items, category) => (
      addCreatedCategory(items, category).categories
    ), []);
    const mergedCategories = createdCategories.reduce<CategorySummary[]>((items, category) => (
      addCreatedCategory(items, category).categories
    ), categories);
    const visibleCategories = mergedCategories.filter((category) =>
      `${category.name} ${category.description ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    );
    const columns: Column<CategorySummary>[] = [
      { key: "name", header: "Name", className: "category-name-cell", mobilePrimary: true, render: (category) => <span className="category-name-cell__content"><Tags size={18} aria-hidden="true" /><strong>{category.name}</strong></span> },
      { key: "description", header: "Description", className: "category-description-cell", render: (category) => category.description ? <span className="category-description-clamp">{category.description}</span> : <em className="category-no-description">No description</em> },
    ];

    return (
      <div className="page manage-categories-page" style={{ maxWidth: 820 }}>
        <PageHero
          eyebrow="Catalog"
          title="Categories"
          description="Book categories shown in the catalog filters."
          leading={<BackButton fallback={ROUTES.staff.dashboard} />}
          compact
          actions={canManage ? <Button onClick={() => setAddingCategory(true)}>Add category</Button> : undefined}
        />
        <div className="toolbar manage-categories-toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search category name or description…" />
        </div>
        {list.loading ? (
          <LoadingState rows={4} />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={() => void list.reload()} />
        ) : (
          <div className="card">
            <DataTable columns={columns} rows={visibleCategories} rowKey={(category) => category.id} empty={search.trim() ? "No categories match your search." : "No categories yet."} />
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