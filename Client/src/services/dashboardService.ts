import { apiClient } from "@/services/apiClient";
import { ApiError, describeError } from "@/utils/errors";

export interface DashboardCount {
  value: number | null;
  error: string | null;
}

export interface OperationalDashboardCounts {
  pendingRequests: DashboardCount;
  booksToRelease: DashboardCount;
  activeLoans: DashboardCount;
  pendingCor: DashboardCount;
  waitingReservations: DashboardCount;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function paginatedCount(url: string, status: string): Promise<number> {
  const response: unknown = (await apiClient.get<unknown>(url, { params: { status, limit: 1 } })).data;
  if (!isRecord(response) || !isRecord(response.pagination) || response.pagination.total == null) {
    throw new ApiError("UNKNOWN", `The Server returned invalid pagination data for ${url}.`);
  }
  const total = Number(response.pagination.total);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new ApiError("UNKNOWN", `The Server returned an invalid total for ${url}.`);
  }
  return total;
}

async function arrayCount(url: string, status: string, collection: string): Promise<number> {
  const response: unknown = (await apiClient.get<unknown>(url, { params: { status } })).data;
  if (Array.isArray(response)) return response.length;
  if (isRecord(response) && Array.isArray(response[collection])) return response[collection].length;
  throw new ApiError("UNKNOWN", `The Server returned an invalid ${collection} list.`);
}

function countResult(result: PromiseSettledResult<number>): DashboardCount {
  return result.status === "fulfilled"
    ? { value: result.value, error: null }
    : { value: null, error: describeError(result.reason) };
}

// Temporary Client-side dashboard counts until the backend provides a real dashboard endpoint.
export async function getOperationalDashboardCounts(): Promise<OperationalDashboardCounts> {
  const [pendingRequests, booksToRelease, activeLoans, pendingCor, waitingReservations] = await Promise.allSettled([
    paginatedCount("/borrow-requests", "Pending"),
    paginatedCount("/borrowed-books", "Reserved"),
    paginatedCount("/borrowed-books", "Borrowed"),
    arrayCount("/staff/verifications", "Pending", "verifications"),
    arrayCount("/reservations", "Waiting", "reservations"),
  ]);

  return {
    pendingRequests: countResult(pendingRequests),
    booksToRelease: countResult(booksToRelease),
    activeLoans: countResult(activeLoans),
    pendingCor: countResult(pendingCor),
    waitingReservations: countResult(waitingReservations),
  };
}
