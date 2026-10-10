import type { ErrorCode } from "./enums";

// Scalar aliases used by every contract type.
export type UUID = string;
/** ISO 8601 UTC timestamp, e.g. 2026-10-09T04:15:00.000Z. Display in Asia/Manila. */
export type ISODateTime = string;
/** Calendar date YYYY-MM-DD (term dates, COR deadline, acquisition date). */
export type ISODate = string;

/** Single-record envelope: { data }. */
export interface ApiData<T> {
  data: T;
}

export interface PageMeta {
  page: number; // 1-based
  pageSize: number; // 1..100, default 20
  total: number;
}

/** List envelope: { data[], meta }. */
export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

/** Error envelope: { error: {...} }. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

export interface PageParams {
  page?: number;
  pageSize?: number;
}

/** Codes created by the client itself (no server response). */
export type ClientErrorCode = "NETWORK_ERROR" | "UNKNOWN";