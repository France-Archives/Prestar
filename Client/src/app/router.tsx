import { Navigate, Route, Routes } from "react-router-dom";

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <main className="app-shell">
            <h1>PRESTAR</h1>
            <p>Frontend structure prepared. Features will be implemented later.</p>
          </main>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
