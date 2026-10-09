import type { AvailabilityInfo, User } from "../types";

export const indexBy = <T extends object, K extends keyof T>(rows: T[], key: K): Record<string, T> =>
  Object.fromEntries(rows.map((r) => [String(r[key]), r]));

export const fullName = (u: Pick<User, "first_name" | "last_name"> | undefined) =>
  u ? `${u.first_name} ${u.last_name}` : "—";

// Availability text shown on cards and details (derived, never stored on the book)
export const availabilityText = ({ free, queueLength, circulating }: AvailabilityInfo) => {
  if (!circulating) return "No copies in circulation";
  if (free > 0) return `${free} ${free === 1 ? "copy" : "copies"} available`;
  return `All copies out${queueLength ? `, ${queueLength} waiting` : ""}`;
};