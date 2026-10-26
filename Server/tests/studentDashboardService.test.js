import test from "node:test";
import assert from "node:assert/strict";
import { effectiveCorStatus } from "../services/studentDashboardService.js";

test("student dashboard COR status reflects approved validity dates", () => {
  assert.equal(effectiveCorStatus({ status: "Approved", valid_from: "2026-10-01", valid_until: "2026-12-31" }, "2026-10-18"), "APPROVED");
  assert.equal(effectiveCorStatus({ status: "Approved", valid_from: "2026-11-01", valid_until: "2026-12-31" }, "2026-10-18"), "NOT_YET_EFFECTIVE");
  assert.equal(effectiveCorStatus({ status: "Approved", valid_from: "2026-08-01", valid_until: "2026-09-30" }, "2026-10-18"), "EXPIRED");
  assert.equal(effectiveCorStatus({ status: "Pending" }, "2026-10-18"), "PENDING");
  assert.equal(effectiveCorStatus(null, "2026-10-18"), "MISSING");
});
