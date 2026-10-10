// Placeholder for the librarian layout.
import AppShell from "./AppShell";

// Librarian and Admin both use this area. Admin passes every staff capability, so Admin sees every Librarian screen.
export default function StaffLayout() {
  return <AppShell areaLabel="Library staff" />;
}