import axios, { type AxiosRequestConfig } from "axios";
import type { ApiData, Paginated } from "@/types";
import { API_BASE_URL } from "@/utils/constants";
import { toApiError } from "@/utils/errors";

// Shared Axios client for live service calls. Cookie sessions are sent with every request.
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
    const isLoginRequest = axios.isAxiosError(error)
      && error.config?.method?.toLowerCase() === "post"
      && error.config.url === "/auth/login";
    if (err.code === "UNAUTHENTICATED" && !isLoginRequest) {
      window.dispatchEvent(new CustomEvent(UNAUTHENTICATED_EVENT));
    }
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