import * as booksService from "@/services/booksService";
import { useAsync } from "@/hooks/useAsync";
import NameListManager from "../components/NameListManager";

export default function ManageCategoriesPage() {
  const list = useAsync(() => booksService.listCategories(), []);
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