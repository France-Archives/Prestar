import { describe, expect, it } from "vitest";
import type { BorrowingReportRow } from "@/types";
import {
  buildActivityBuckets,
  guessReportGroup,
  rangeForPreset,
  type DateRange,
} from "./reportsModel";

describe("reportsModel", () => {
  it("builds calendar-aware preset ranges", () => {
    expect(rangeForPreset("last7", "2026-03-15")).toEqual({ from: "2026-03-09", to: "2026-03-15" });
    expect(rangeForPreset("lastMonth", "2026-03-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(rangeForPreset("thisQuarter", "2026-03-15")).toEqual({ from: "2026-01-01", to: "2026-03-15" });
  });

  it("chooses a sensible default grouping for the range length", () => {
    expect(guessReportGroup({ from: "2026-01-01", to: "2026-01-31" })).toBe("daily");
    expect(guessReportGroup({ from: "2026-01-01", to: "2026-03-01" })).toBe("weekly");
    expect(guessReportGroup({ from: "2026-01-01", to: "2026-08-01" })).toBe("monthly");
    expect(guessReportGroup({ from: "2020-01-01", to: "2026-01-01" })).toBe("yearly");
  });

  it("creates gap-free buckets and places returns by returned date", () => {
    const rows: BorrowingReportRow[] = [
      {
        loanId: "loan-1",
        studentName: "Ada Reader",
        studentNumber: "S-1",
        bookTitle: "A Book",
        borrowedAt: "2026-09-30T12:00:00.000Z",
        dueAt: "2026-10-10T12:00:00.000Z",
        returnedAt: "2026-10-02T12:00:00.000Z",
        status: "RETURNED",
      },
    ];
    const range: DateRange = { from: "2026-10-01", to: "2026-10-03" };

    expect(buildActivityBuckets(rows, range, "daily")).toEqual([
      { date: "2026-10-01", loansIssued: 0, returns: 0 },
      { date: "2026-10-02", loansIssued: 0, returns: 1 },
      { date: "2026-10-03", loansIssued: 0, returns: 0 },
    ]);
  });

  it("starts weekly buckets on Monday and includes empty periods", () => {
    const buckets = buildActivityBuckets([], { from: "2026-10-01", to: "2026-10-15" }, "weekly");
    expect(buckets.map((bucket) => bucket.date)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(buckets.every((bucket) => bucket.loansIssued === 0 && bucket.returns === 0)).toBe(true);
  });
});
