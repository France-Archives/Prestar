import axios, { type AxiosRequestConfig } from "axios";
import type { ApiData, Paginated } from "@/types";
import { API_BASE_URL } from "@/utils/constants";
import { toApiError } from "@/utils/errors";

// Axios client for the future backend. Not used while the services run on mocks (VITE_USE_MOCKS=true).
// When connecting a service: replace the body of each mock function with ONE call to apiGet/apiPost/... below.
// Function names, parameters and return types stay the same, so pages do not change.
//
// Auth mechanism (cookie session vs JWT) is TO CONFIRM (TC-01). withCredentials supports httpOnly cookies;
// if the team picks bearer tokens, attach the Authorization header in the request interceptor instead.
export const UNAUTHENTICATED_EVENT = "prestar:unauthenticated";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const err = toApiError(error);
    // 401 UNAUTHENTICATED: AuthContext listens and redirects to /login?next=. (A failed login is INVALID_CREDENTIALS.)
    if (err.code === "UNAUTHENTICATED") window.dispatchEvent(new CustomEvent(UNAUTHENTICATED_EVENT));
    return Promise.reject(err);
  },
);

/** Single-record endpoints: unwraps { data }. */
export async function apiGet<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.get<ApiData<T>>(url, { ...config, params });
  return res.data.data;
}

/** List endpoints: returns { data[], meta }. */
export async function apiGetPage<T>(url: string, params?: Record<string, unknown>): Promise<Paginated<T>> {
  const res = await apiClient.get<Paginated<T>>(url, { params });
  return res.data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.post<ApiData<T>>(url, body, config);
  return res.data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.patch<ApiData<T>>(url, body);
  return res.data.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.put<ApiData<T>>(url, body);
  return res.data.data;
}