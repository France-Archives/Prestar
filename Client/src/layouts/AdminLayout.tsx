import AppShell from "./AppShell";

// The sidebar comes from getNavSections(user), which gives Admin the Librarian sections plus the Admin sections.
export default function AdminLayout() {
  return <AppShell areaLabel="Admin" />;
}