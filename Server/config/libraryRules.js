// Server/config/libraryRules.js
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

function positiveInteger(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

export const PICKUP_WINDOW_DAYS = positiveInteger("PICKUP_WINDOW_DAYS", 3);
export const MAX_REQUEST_DAYS = positiveInteger("MAX_REQUEST_DAYS", 14);
export const MAX_ACTIVE_BORROWS = positiveInteger("MAX_ACTIVE_BORROWS", 10);
export const MAX_COPIES_PER_BOOK = positiveInteger("MAX_COPIES_PER_BOOK", 2);

export const BORROWABLE_COPY_WHERE = Object.freeze({
  status: "Available",
  condition_status: "Good",
});
