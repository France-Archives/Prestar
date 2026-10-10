import type { ApiErrorBody, ClientErrorCode, ErrorCode } from "@/types";
import { ERROR_ACTIONS } from "@/utils/constants";

// One error type for the whole app. Services THROW ApiError; pages catch it and show describeError().
// The mock services throw the same type, so swapping in real Axios calls changes nothing in the pages.

export class ApiError extends Error {
  readonly code: ErrorCode | ClientErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(
    code: ErrorCode | ClientErrorCode,
    message: string,
    status = 0,
    details?: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

// Fallback text when the server sends no message.
const FALLBACK: Partial<Record<ErrorCode | ClientErrorCode, string>> = {
  UNAUTHENTICATED: "Please log in to continue.",
  FORBIDDEN: "You are not allowed to do this.",
  VALIDATION_ERROR: "Please check the highlighted fields and try again.",
  NOT_FOUND: "We could not find what you were looking for.",
  CONFLICT: "This changed while you were working. The page has been refreshed; please try again.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
  INVALID_CREDENTIALS: "Incorrect email or password.",
  ACCOUNT_DISABLED: "This account is disabled. Please contact the library.",
  ACCOUNT_SUSPENDED: "Your account is suspended. You cannot start new borrowing until it is reactivated.",
  EMAIL_NOT_VERIFIED: "Verify your email before borrowing.",
  TOKEN_INVALID_OR_EXPIRED: "This link is invalid or has expired.",
  COR_REQUIRED: "An approved COR for the current academic term is required.",
  COR_EXPIRED: "Your COR has expired. Submit a COR for the current term.",
  COR_NOT_YET_EFFECTIVE: "Your COR is approved but not yet in effect.",
  OVERDUE_GRACE_EXCEEDED: "A loan is overdue beyond the 3-day grace period. Return it first.",
  UNPAID_FINE: "An assessed fine has an unpaid balance. Pay it at the library.",
  COMMITMENT_LIMIT_REACHED: "You have reached the maximum number of active commitments.",
  SAME_TITLE_LIMIT_REACHED: "You have reached the limit for this title.",
  INVALID_DURATION: "Choose 3, 7, 14, 21, 30 or 60 days.",
  NO_COPY_AVAILABLE: "No copy is available. You can reserve this book instead.",
  COPY_AVAILABLE: "A copy is available. You can request it now.",
  INVALID_STATE: "This item changed state. Please refresh and try again.",
  ELIGIBILITY_FAILED: "Eligibility check failed.",
  RENEWAL_LIMIT_REACHED: "This loan has reached its renewal limit.",
  RENEWAL_BLOCKED_BY_QUEUE: "Another student is waiting for this book.",
  FILE_TYPE_NOT_ALLOWED: "Only PDF, JPG or PNG files are allowed.",
  FILE_TOO_LARGE: "That file is too large.",
  NETWORK_ERROR: "Cannot reach the server. Check your connection and try again.",
  UNKNOWN: "Something went wrong. Please try again.",
};

interface AxiosLike {
  isAxiosError?: boolean;
  message?: string;
  response?: { status?: number; data?: Partial<ApiErrorBody> | undefined };
}

/** Normalise anything thrown (ApiError, Axios error, Error, string) into an ApiError. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (typeof e === "object" && e !== null) {
    const ax = e as AxiosLike;
    if (ax.isAxiosError) {
      const body = ax.response?.data?.error;
      if (body) return new ApiError(body.code, body.message, ax.response?.status ?? 0, body.details, body.requestId);
      if (!ax.response) return new ApiError("NETWORK_ERROR", FALLBACK.NETWORK_ERROR!);
      return new ApiError("UNKNOWN", ax.message ?? FALLBACK.UNKNOWN!, ax.response.status ?? 0);
    }
  }
  if (e instanceof Error) return new ApiError("UNKNOWN", e.message || FALLBACK.UNKNOWN!);
  return new ApiError("UNKNOWN", FALLBACK.UNKNOWN!);
}

export interface ErrorView {
  code: ErrorCode | ClientErrorCode;
  message: string;
  action?: { label: string; to: string };
  requestId?: string;
}

/** Rich view of an error: message, optional call-to-action, request id (for 500s). */
export function describeErrorView(e: unknown): ErrorView {
  const err = toApiError(e);
  const action = err.code in ERROR_ACTIONS ? ERROR_ACTIONS[err.code as ErrorCode] : undefined;
  return {
    code: err.code,
    message: err.message || FALLBACK[err.code] || FALLBACK.UNKNOWN!,
    action,
    requestId: err.status >= 500 || err.code === "INTERNAL_ERROR" ? err.requestId : undefined,
  };
}

/** The text a page shows for an error. Returns a plain string so it can go straight into state or <Alert>. */
export function describeError(e: unknown): string {
  return describeErrorView(e).message;
}

export const errorMessage = describeError;

/** Helper for mock services: throw a spec-shaped error. */
export function fail(code: ErrorCode, message?: string, status?: number, details?: Record<string, unknown>): never {
  const defaultStatus: Partial<Record<ErrorCode, number>> = {
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    VALIDATION_ERROR: 422,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INVALID_STATE: 409,
    NO_COPY_AVAILABLE: 409,
    COPY_AVAILABLE: 409,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    INVALID_DURATION: 422,
    COR_REQUIRED: 403,
    COR_EXPIRED: 403,
    COR_NOT_YET_EFFECTIVE: 403,
    OVERDUE_GRACE_EXCEEDED: 403,
    UNPAID_FINE: 403,
    COMMITMENT_LIMIT_REACHED: 403,
    SAME_TITLE_LIMIT_REACHED: 403,
    ELIGIBILITY_FAILED: 403,
    INVALID_CREDENTIALS: 401,
    TOKEN_INVALID_OR_EXPIRED: 400,
    FILE_TYPE_NOT_ALLOWED: 422,
    FILE_TOO_LARGE: 422,
  };
  throw new ApiError(code, message ?? FALLBACK[code] ?? "Request failed.", status ?? defaultStatus[code] ?? 400, details);
}