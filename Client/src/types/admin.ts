import type { ISODateTime, PageParams, UUID } from "./api";
import type { AccountStatus, LibrarianPermission, SettingValueType, UserRole } from "./enums";

// system_settings -> Setting (derived)
export interface Setting {
  key: string;
  value: string | number | boolean | Record<string, unknown>;
  valueType: SettingValueType;
  description: string;
  updatedAt: ISODateTime;
}

/** D8 PATCH /admin/settings/:key */
export interface UpdateSettingRequest {
  value: Setting["value"];
}

/** D5 GET /admin/users row. Exact shape not defined in the source. TO CONFIRM. */
export interface AdminUserRow {
  id: UUID;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerifiedAt: ISODateTime | null;
  displayName: string;
  studentId: UUID | null;
  studentNumber: string | null;
  employeeNumber: string | null;
  createdAt: ISODateTime;
}

export interface AdminUserListParams extends PageParams {
  search?: string;
  role?: UserRole;
  accountStatus?: AccountStatus;
}

/** D6 PATCH /admin/users/:userId/status (reason required, history row written). */
export interface UpdateUserStatusRequest {
  status: AccountStatus;
  reason: string;
}

/** A9 POST /admin/librarians/invitations. Body is not defined in the source. TO CONFIRM. */
export interface InviteLibrarianRequest {
  email: string;
  firstName: string;
  lastName: string;
  employeeNumber?: string | null;
  permissions?: LibrarianPermission[];
}

/** Librarian list row (Admin). Invitation acceptance flow is TO CONFIRM (TC-19). */
export interface LibrarianAccount {
  userId: UUID;
  email: string;
  displayName: string;
  employeeNumber: string | null;
  accountStatus: AccountStatus;
  permissions: LibrarianPermission[];
  invitation: "PENDING" | "ACCEPTED";
  createdAt: ISODateTime;
}

/** P15 PUT /admin/librarians/:userId/permissions */
export interface UpdateLibrarianPermissionsRequest {
  permissions: LibrarianPermission[];
}

/** D12 GET /admin/audit-logs row. Field list is not in the source. Proposed. TO CONFIRM. */
export interface AuditLog {
  id: UUID;
  actorUserId: UUID;
  actorName: string;
  actorRole: UserRole;
  action: string; // e.g. HANDOVER_CLAIMED, FINE_WAIVED
  entityType: string;
  entityId: UUID | null;
  summary: string;
  createdAt: ISODateTime;
}

export interface AuditLogParams extends PageParams {
  search?: string;
  actorRole?: UserRole;
  action?: string;
  from?: string; // YYYY-MM-DD
  to?: string;
}