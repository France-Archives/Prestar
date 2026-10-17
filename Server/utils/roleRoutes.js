// Server/utils/roleRoutes.js

export const ROLE_DASHBOARDS = Object.freeze({
  Admin: "/admin/dashboard",
  Librarian: "/librarian/dashboard",
  Student: "/student/dashboard",
});

/**
 * Returns the corresponding frontend dashboard route for a given user role.
 * @param {string} [role] - User role (Admin, Librarian, Student)
 * @returns {string} Dashboard URL path
 */
export function getDashboardRoute(role) {
  return ROLE_DASHBOARDS[role] ?? "/student/dashboard";
}

export default getDashboardRoute;
