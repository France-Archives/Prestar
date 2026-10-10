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

function booleanValue(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

export const MAX_ACTIVE_BORROWS = positiveInteger("MAX_ACTIVE_BORROWS", 10);
export const MAX_COPIES_PER_BOOK = positiveInteger("MAX_COPIES_PER_BOOK", 2);
export const LOAN_PERIOD_DAYS = positiveInteger("LOAN_PERIOD_DAYS", 7);
export const PICKUP_WINDOW_DAYS = positiveInteger("PICKUP_WINDOW_DAYS", 3);
export const BLOCK_ON_ANY_UNPAID_PENALTY = booleanValue("BLOCK_ON_ANY_UNPAID_PENALTY", true);

export const BORROWABLE_COPY_WHERE = Object.freeze({
  status: "Available",
  condition_status: "Good",
});
