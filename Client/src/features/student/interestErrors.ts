import { describeError, toApiError } from "@/utils/errors";

export function interestUpdateError(error: unknown): string {
  const apiError = toApiError(error);
  if (apiError.status === 400) return "Pick at least one interest before saving.";
  if (apiError.status === 422) {
    return apiError.message || "One or more selected categories are unavailable. Review your choices and try again.";
  }
  return describeError(error);
}
