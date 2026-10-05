import axios from "axios";
import type { ApiResult } from "../types";

// Central HTTP client for the future Node.js backend. The URL comes from VITE_API_URL only
// (never hard-code it elsewhere). No database credentials, SQL or connection code belongs in the frontend.
//
// BACKEND REPLACEMENT: today every service function in services/api.ts is a mock. When the backend exists,
// each mock function body becomes one call to get/post/patch below, with the same ApiResult return shape,
// so the pages keep working unchanged.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // the backend owns the session (httpOnly cookie) or returns a token
  headers: { "Content-Type": "application/json" },
});

async function call<T>(request: () => Promise<{ data: T }>): Promise<ApiResult<T>> {
  try {
    return { ok: true, data: (await request()).data };
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const body = e.response?.data as { error?: string } | undefined;
      return { ok: false, error: body?.error ?? e.message };
    }
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export const get = <T>(url: string, params?: Record<string, unknown>) => call<T>(() => http.get<T>(url, { params }));
export const post = <T>(url: string, body?: unknown) => call<T>(() => http.post<T>(url, body));
export const patch = <T>(url: string, body?: unknown) => call<T>(() => http.patch<T>(url, body));