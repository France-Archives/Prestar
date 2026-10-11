import * as booksService from "@/services/booksService";
import { useAsync } from "@/hooks/useAsync";
import NameListManager from "../components/NameListManager";

export default function ManageAuthorsPage() {
  const list = useAsync(() => booksService.listAuthors(), []);
  return (
    <NameListManager
      title="Authors"
      description="Authors can be linked to several titles, and a title can have several authors."
      noun="Author"
      items={list.data}
      loading={list.loading}
      error={list.error}
      onReload={() => void list.reload()}
      onSave={(name, id) => booksService.saveAuthor({ name }, id)}
      onDelete={(id) => booksService.deleteAuthor(id)}
    />
  );
}