import ManageBooksPage from "@/features/librarian/pages/ManageBooksPage";

// Admin can do everything a Librarian can, so book management is the same screen. The backend lets Admin through
// the catalog permission check automatically (C4 to C7).
export default function BookManagementPage() {
  return <ManageBooksPage />;
}