// Server/validators/renewalValidator.js
import { MAX_REQUEST_DAYS } from "../config/libraryRules.js";

function parsePositiveId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const str = String(value).trim();
  if (!/^[1-9]\d*$/.test(str)) return null;
  const num = Number(str);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

export function validateLoanId(req, res, next) {
  const rawId = req.params.loanId ?? req.params.id;
  const id = parsePositiveId(rawId);
  if (id === null) {
    return res.status(400).json({ error: "Loan id must be a positive integer." });
  }
  req.validatedLoanId = id;
  return next();
}

export function validateCreateRenewal(req, res, next) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "A JSON request body is required." });
  }

  const rawDuration =
    req.body.requestedDurationDays ??
    req.body.requested_duration_days ??
    req.body.duration ??
    req.body.days;

  let duration = 7;
  if (rawDuration !== undefined && rawDuration !== null && rawDuration !== "") {
    duration = parsePositiveId(rawDuration);
    if (duration === null || duration < 1 || duration > MAX_REQUEST_DAYS) {
      return res.status(422).json({
        error: `requestedDurationDays must be an integer between 1 and ${MAX_REQUEST_DAYS}.`,
      });
    }
  }

  req.validatedDurationDays = duration;
  return next();
}
