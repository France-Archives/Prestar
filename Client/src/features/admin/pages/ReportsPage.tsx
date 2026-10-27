import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Search, Wallet } from "lucide-react";
import { useLocation, useSearchParams } from "react-router-dom";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Money from "@/components/data-display/Money";
import StatusBadge from "@/components/data-display/StatusBadge";
import Tabs from "@/components/ui/Tabs";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import Pagination from "@/components/data-display/Pagination";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as reportsService from "@/services/reportsService";
import type { BorrowingReportRow, FinesReportRow, OverdueReportRow } from "@/types";
import { statusLabel } from "@/utils/constants";
import { calendarDaysBetween, formatDate } from "@/utils/formatDate";
import { formatPeso } from "@/utils/formatCurrency";
import { ActivityChart } from "@/features/admin/components/SystemActivityChart";
import { ChartPanel, DashboardNumber, DonutChart } from "@/features/dashboard/DashboardVisuals";
import ReportsFilters from "../components/ReportsFilters";
import {
  buildActivityBuckets,
  formatBucketLabel,
  guessReportGroup,
  isValidDateKey,
  isWithinRange,
  previousDateRange,
  rangeForPreset,
  type ActivityBucket,
  type DateRange,
  type ReportGroup,
  type ReportPreset,
} from "../utils/reportsModel";
import "./reports.css";

type Tab = "borrowing" | "overdue" | "fines";
type ReportRow = BorrowingReportRow | OverdueReportRow | FinesReportRow;
type SortValue = string | number;

interface TableColumn<T> {
  key: string;
  header: string;
  value: (row: T) => SortValue;
  render: (row: T) => ReactNode;
}

const BORROWING: TableColumn<BorrowingReportRow>[] = [
  { key: "studentName", header: "Student", value: (r) => `${r.studentName} ${r.studentNumber}`, render: (r) => `${r.studentName} (${r.studentNumber})` },
  { key: "bookTitle", header: "Book", value: (r) => r.bookTitle, render: (r) => r.bookTitle },
  { key: "borrowedAt", header: "Borrowed", value: (r) => r.borrowedAt, render: (r) => formatDate(r.borrowedAt) },
  { key: "dueAt", header: "Due", value: (r) => r.dueAt, render: (r) => formatDate(r.dueAt) },
  { key: "returnedAt", header: "Returned", value: (r) => r.returnedAt ?? "", render: (r) => (r.returnedAt ? formatDate(r.returnedAt) : "—") },
  { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
];

const OVERDUE: TableColumn<OverdueReportRow>[] = [
  { key: "studentName", header: "Student", value: (r) => `${r.studentName} ${r.studentNumber}`, render: (r) => `${r.studentName} (${r.studentNumber})` },
  { key: "bookTitle", header: "Book", value: (r) => r.bookTitle, render: (r) => r.bookTitle },
  { key: "dueAt", header: "Due", value: (r) => r.dueAt, render: (r) => formatDate(r.dueAt) },
  { key: "overdueDays", header: "Days overdue", value: (r) => r.overdueDays, render: (r) => r.overdueDays },
  { key: "restricted", header: "Restricted", value: (r) => r.overdueDays > 3 ? 1 : 0, render: (r) => (r.overdueDays > 3 ? "Yes" : "Grace period") },
];

const FINES: TableColumn<FinesReportRow>[] = [
  { key: "studentName", header: "Student", value: (r) => `${r.studentName} ${r.studentNumber}`, render: (r) => `${r.studentName} (${r.studentNumber})` },
  { key: "fineType", header: "Type", value: (r) => r.fineType, render: (r) => statusLabel(r.fineType) },
  { key: "amount", header: "Amount", value: (r) => r.amount, render: (r) => <Money value={r.amount} /> },
  { key: "paidAmount", header: "Paid", value: (r) => r.paidAmount, render: (r) => <Money value={r.paidAmount} /> },
  { key: "balance", header: "Balance", value: (r) => r.balance, render: (r) => <Money value={r.balance} /> },
  { key: "status", header: "Status", value: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  { key: "recordedAt", header: "Recorded", value: (r) => r.recordedAt, render: (r) => formatDate(r.recordedAt) },
];

function ReportTable<T extends ReportRow>({
  rows,
  columns,
  rowKey,
  search,
  onReset,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  search: string;
  onReset: () => void;
}) {
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" }>(() => {
    const dateColumn = columns.find((column) => ["borrowedAt", "dueAt", "recordedAt"].includes(column.key));
    return { key: dateColumn?.key ?? columns[0]?.key ?? "", direction: dateColumn ? "desc" : "asc" };
  });
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    const matched = term
      ? rows.filter((row) => {
        const values = "bookTitle" in row
          ? [row.studentName, row.studentNumber, row.bookTitle]
          : [row.studentName, row.studentNumber, "fineType" in row ? row.fineType : ""];
        return values.join(" ").toLocaleLowerCase().includes(term);
      })
      : rows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return matched;
    return [...matched].sort((a, b) => {
      const left = column.value(a);
      const right = column.value(b);
      const result = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, rows, search, sort]);
  const totalPages = Math.ceil(filtered.length / pageSize);
  const activePage = Math.min(page, Math.max(1, totalPages));
  const pageRows = filtered.slice((activePage - 1) * pageSize, activePage * pageSize);

  useEffect(() => setPage(1), [search, rows]);

  if (!filtered.length) {
    return (
      <div className="reports-no-records">
        <p>{search.trim() ? "No matching records." : "No records for this period."}</p>
        <button type="button" onClick={onReset}>Reset range to Last 30 days</button>
      </div>
    );
  }
  return (
    <>
      <div className="table-wrap reports-table-wrap">
        <table className="table reports-table">
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort.key === column.key;
                const sortOrder = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
                return (
                  <th key={column.key} scope="col" aria-sort={sortOrder}>
                    <button
                      type="button"
                      onClick={() => {
                        setSort((current) => ({
                          key: column.key,
                          direction: current.key === column.key && current.direction === "asc" ? "desc" : "asc",
                        }));
                        setPage(1);
                      }}
                    >
                      {column.header}
                      <span aria-hidden="true">{active ? (sort.direction === "asc" ? " ↑" : " ↓") : " ↕"}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => <td key={column.key} data-label={column.header}>{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={activePage}
        totalPages={totalPages}
        from={(activePage - 1) * pageSize + 1}
        to={Math.min(activePage * pageSize, filtered.length)}
        total={filtered.length}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
      />
    </>
  );
}

function parseUrlState(params: URLSearchParams): { range: DateRange; preset: ReportPreset; group: ReportGroup; tab: Tab } {
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const range = from || to ? { from, to } : rangeForPreset("last30");
  const preset: ReportPreset = from || to ? "custom" : "last30";
  const requestedGroup = params.get("group");
  const group = requestedGroup === "daily" || requestedGroup === "weekly" || requestedGroup === "monthly" || requestedGroup === "yearly"
    ? requestedGroup
    : guessReportGroup(range);
  const requestedTab = params.get("tab");
  const tab: Tab = requestedTab === "overdue" || requestedTab === "fines" ? requestedTab : "borrowing";
  return { range, preset, group, tab };
}

function makeQuery(range: DateRange, group: ReportGroup, tab: Tab) {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  params.set("group", group);
  params.set("tab", tab);
  return params;
}

function periodDescription(range: DateRange) {
  return range.from && range.to ? `${formatDate(range.from)} – ${formatDate(range.to)} · Asia/Manila` : "Select a date range to review library activity.";
}

function deltaSummary(current: number, previous: number) {
  const difference = current - previous;
  const Icon = difference > 0 ? ArrowUpRight : difference < 0 ? ArrowDownRight : Minus;
  const changeText = previous === 0
    ? difference === 0 ? "No change from previous period" : `${difference > 0 ? "+" : ""}${difference.toLocaleString()} from previous period`
    : `${difference > 0 ? "+" : ""}${Math.round((difference / previous) * 100)}% vs previous period`;
  return <span className="reports-kpi__delta"><Icon size={15} aria-hidden="true" />{changeText}</span>;
}

function countStatuses(rows: BorrowingReportRow[], overdueRows: OverdueReportRow[]) {
  const overdueIds = new Set(overdueRows.map((row) => row.loanId));
  const counts = { borrowed: 0, returned: 0, overdue: 0, lost: 0, reserved: 0 };
  rows.forEach((row) => {
    const status = row.status.toUpperCase();
    if (overdueIds.has(row.loanId) || status.includes("OVERDUE")) counts.overdue += 1;
    else if (status.includes("LOST")) counts.lost += 1;
    else if (status.includes("RESERVED")) counts.reserved += 1;
    else if (row.returnedAt || status.includes("RETURN")) counts.returned += 1;
    else counts.borrowed += 1;
  });
  return [
    { key: "borrowed", label: "Borrowed", count: counts.borrowed, tone: "forest" as const },
    { key: "returned", label: "Returned", count: counts.returned, tone: "teal" as const },
    { key: "overdue", label: "Overdue", count: counts.overdue, tone: "amber" as const },
    { key: "lost", label: "Lost", count: counts.lost, tone: "brick" as const },
    { key: "reserved", label: "Reserved", count: counts.reserved, tone: "green" as const },
  ];
}

function rowDateInRange(value: string | null | undefined, range: DateRange) {
  return isWithinRange(value, range);
}

function changeRangeLength(range: DateRange) {
  return isValidDateKey(range.from) && isValidDateKey(range.to) && range.to >= range.from
    ? calendarDaysBetween(range.from, range.to) + 1
    : 1;
}

function humanDateRangeError(range: DateRange) {
  if ((range.from && !isValidDateKey(range.from)) || (range.to && !isValidDateKey(range.to))) {
    return "Enter valid From and To dates.";
  }
  if (range.from && range.to && range.to < range.from) return "To date must be the same as or later than From date.";
  return null;
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const initial = parseUrlState(searchParams);
  const [range, setRange] = useState(initial.range);
  const [preset, setPreset] = useState(initial.preset);
  const [group, setGroup] = useState<ReportGroup>(initial.group);
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [search, setSearch] = useState("");
  const [rankingLimit, setRankingLimit] = useState(5);
  const validRange = !!range.from && !!range.to && !humanDateRangeError(range);
  const rangeError = humanDateRangeError(range);
  const reportData = useAsync(async () => {
    const [borrowing, overdue, fines] = await Promise.all([
      reportsService.getBorrowingReport(),
      reportsService.getOverdueReport(),
      reportsService.getFinesReport(),
    ]);
    return { borrowing, overdue, fines };
  }, []);
  const ranking = useAsync(() => reportsService.getTopBorrowedBooks(rankingLimit), [rankingLimit]);
  const allData = reportData.data;
  const topTotal = ranking.data?.reduce((total, item) => total + item.loanCount, 0) ?? 0;

  useEffect(() => {
    if (location.hash === "#most-borrowed") {
      document.getElementById("most-borrowed")?.scrollIntoView({ block: "start" });
    }
  }, [location.hash]);

  useEffect(() => {
    const parsed = parseUrlState(searchParams);
    setRange(parsed.range);
    setPreset(parsed.preset);
    setGroup(parsed.group);
    setTab(parsed.tab);
  }, [searchParams]);

  const updateUrl = (nextRange: DateRange, nextGroup: ReportGroup, nextTab: Tab, replace = false) => {
    setSearchParams(makeQuery(nextRange, nextGroup, nextTab), { replace });
  };

  const onPresetChange = (nextPreset: ReportPreset) => {
    const nextRange = nextPreset === "custom" ? range : rangeForPreset(nextPreset);
    const nextGroup = nextPreset === "custom" ? group : guessReportGroup(nextRange);
    setPreset(nextPreset);
    setRange(nextRange);
    setGroup(nextGroup);
    updateUrl(nextRange, nextGroup, tab);
  };

  const onRangeChange = (nextRange: DateRange) => {
    const nextGroup = guessReportGroup(nextRange);
    setPreset("custom");
    setRange(nextRange);
    setGroup(nextGroup);
    updateUrl(nextRange, nextGroup, tab, true);
  };

  const onGroupChange = (nextGroup: ReportGroup) => {
    setGroup(nextGroup);
    updateUrl(range, nextGroup, tab);
  };

  const onTabChange = (nextTab: Tab) => {
    setTab(nextTab);
    updateUrl(range, group, nextTab);
  };

  const currentBorrowing = useMemo(() => (allData?.borrowing ?? []).filter((row) => rowDateInRange(row.borrowedAt, range)), [allData, range]);
  const previousRange = previousDateRange(range);
  const previousBorrowing = useMemo(() => (allData?.borrowing ?? []).filter((row) => rowDateInRange(row.borrowedAt, previousRange)), [allData, previousRange]);
  const currentOverdue = useMemo(() => (allData?.overdue ?? []).filter((row) => rowDateInRange(row.dueAt, range)), [allData, range]);
  const previousOverdue = useMemo(() => (allData?.overdue ?? []).filter((row) => rowDateInRange(row.dueAt, previousRange)), [allData, previousRange]);
  const currentFines = useMemo(() => (allData?.fines ?? []).filter((row) => rowDateInRange(row.recordedAt, range)), [allData, range]);
  const previousFines = useMemo(() => (allData?.fines ?? []).filter((row) => rowDateInRange(row.recordedAt, previousRange)), [allData, previousRange]);
  const currentReturns = (allData?.borrowing ?? []).filter((row) => rowDateInRange(row.returnedAt, range)).length;
  const previousReturns = (allData?.borrowing ?? []).filter((row) => rowDateInRange(row.returnedAt, previousRange)).length;
  const currentFineTotal = currentFines.reduce((sum, row) => sum + row.amount, 0);
  const previousFineTotal = previousFines.reduce((sum, row) => sum + row.amount, 0);
  const activity: ActivityBucket[] = useMemo(() => buildActivityBuckets(allData?.borrowing ?? [], range, group), [allData, range, group]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  useEffect(() => setSelectedBucket(null), [activity]);
  const statuses = useMemo(() => countStatuses(currentBorrowing, currentOverdue), [currentBorrowing, currentOverdue]);
  const allPeriodRows = currentBorrowing.length + currentOverdue.length + currentFines.length;
  const chartLabel = (value: string) => formatBucketLabel(value, group);
  const titleDescription = validRange ? `Library activity for ${periodDescription(range)}.` : "Reports for the selected period.";
  const defaultRange = rangeForPreset("last30");
  const canClear = preset !== "last30" || range.from !== defaultRange.from || range.to !== defaultRange.to;
  const rangeDays = changeRangeLength(range);
  const searchPlaceholder = tab === "fines" ? "Search student or fine type" : "Search student or book";

  return (
    <div className="page admin-dashboard admin-reports">
      <PageHero
        eyebrow="Admin"
        title="Reports"
        description={titleDescription}
        leading={<BackButton fallback={ROUTES.admin.dashboard} />}
        compact
      />
      <ReportsFilters
        range={range}
        preset={preset}
        group={group}
        onRangeChange={onRangeChange}
        onPresetChange={onPresetChange}
        onGroupChange={onGroupChange}
        canClear={canClear}
        rangeError={rangeError}
        rangeDays={rangeDays}
      />
      <section className="reports-ranking" id="most-borrowed" aria-labelledby="most-borrowed-title">
        <div className="reports-section-heading">
          <div>
            <h2 id="most-borrowed-title">Most borrowed</h2>
            <p className="reports-ranking__scope">All time · Based on loans with status Borrowed or Returned.</p>
          </div>
          <label className="reports-ranking__limit">
            <span>Show</span>
            <select
              aria-label="Number of most borrowed books"
              value={rankingLimit}
              onChange={(event) => setRankingLimit(Number(event.target.value))}
            >
              {[5, 10, 25, 50].map((limit) => <option key={limit} value={limit}>Top {limit}</option>)}
            </select>
          </label>
        </div>
        <div className="card reports-ranking__card" aria-live="polite" aria-busy={ranking.loading}>
          {ranking.loading && !ranking.data ? (
            <div className="reports-ranking__skeleton" aria-label="Loading most borrowed books">
              {Array.from({ length: 5 }, (_, index) => <div className="reports-ranking__skeleton-row" key={index} />)}
            </div>
          ) : ranking.error && !ranking.data ? (
            <div className="reports-ranking__message">
              <p>{ranking.error}</p>
              <button type="button" onClick={() => void ranking.reload()}>Retry loading most borrowed books</button>
            </div>
          ) : !ranking.data?.length ? (
            <p className="reports-ranking__message">No ranked books are available yet.</p>
          ) : (
            <ol className="reports-ranking__list">
              {ranking.data.map((book, index) => {
                const share = topTotal > 0 ? book.loanCount / topTotal : 0;
                return (
                  <li className="reports-ranking__row" key={book.bookId}>
                    <span className="reports-ranking__rank" aria-label={`Rank ${index + 1}`}>{index + 1}</span>
                    {book.coverImageUrl ? <img className="reports-ranking__cover" src={book.coverImageUrl} alt="" /> : <span className="reports-ranking__cover reports-ranking__cover--empty" aria-hidden="true">—</span>}
                    <div className="reports-ranking__details">
                      <span className="reports-ranking__title" tabIndex={0} title={book.title}>{book.title}</span>
                      <div className="reports-ranking__bar" role="img" aria-label={`${Math.round(share * 100)} percent of the displayed top total`}>
                        <span style={{ width: `${share * 100}%` }} />
                      </div>
                    </div>
                    <span className="reports-ranking__count">{book.loanCount.toLocaleString()} loans</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>
      {reportData.loading && !allData ? (
        <div className="reports-skeleton" aria-label="Loading reports">
          <LoadingState rows={3} />
          <div className="reports-skeleton__charts"><LoadingState rows={5} /><LoadingState rows={4} /></div>
        </div>
      ) : reportData.error || !allData ? (
        <ErrorState message={reportData.error ?? "Could not load the reports."} onRetry={() => void reportData.reload()} />
      ) : !validRange ? (
        <p className="reports-range-prompt">Choose a valid date range to show report data.</p>
      ) : (
        <div className="dashboard-layout reports-layout">
          <section aria-labelledby="reports-kpis-title">
            <div className="reports-section-heading">
              <h2 id="reports-kpis-title">Selected-period summary</h2>
              <details className="reports-definitions">
                <summary aria-label="KPI definitions">ⓘ KPI definitions</summary>
                <p>Loans use borrowed date, returns use returned date, overdue uses due date, and fines use recorded date.</p>
              </details>
            </div>
            <div className="admin-reports__kpis">
              <article className="admin-kpi admin-kpi--active">
                <span className="admin-kpi__label"><i />Loans issued</span>
                <strong className="admin-kpi__number"><DashboardNumber value={currentBorrowing.length} /></strong>
                {deltaSummary(currentBorrowing.length, previousBorrowing.length)}
              </article>
              <article className="admin-kpi admin-kpi--students">
                <span className="admin-kpi__label"><i />Returns</span>
                <strong className="admin-kpi__number"><DashboardNumber value={currentReturns} /></strong>
                {deltaSummary(currentReturns, previousReturns)}
              </article>
              <article className="admin-kpi admin-kpi--overdue">
                <span className="admin-kpi__label"><i />Overdue</span>
                <strong className="admin-kpi__number"><DashboardNumber value={currentOverdue.length} /></strong>
                {deltaSummary(currentOverdue.length, previousOverdue.length)}
              </article>
              <article className="admin-kpi admin-kpi--fines">
                <span className="admin-kpi__label"><Wallet size={14} aria-hidden="true" />Fines</span>
                <strong className="admin-kpi__number reports-kpi__money">{formatPeso(currentFineTotal)}</strong>
                <span className="reports-kpi__count">{currentFines.length.toLocaleString()} fines</span>
                {deltaSummary(currentFineTotal, previousFineTotal)}
              </article>
            </div>
          </section>
          <div className="dashboard-grid-main admin-dashboard__charts reports-chart-grid">
            <ChartPanel title="Library activity" note={`${group[0].toUpperCase()}${group.slice(1)} totals for loans issued and returns.`} className="dashboard-panel--feature admin-dashboard__activity-panel">
              <ActivityChart days={activity} selectedDay={selectedBucket ?? activity[activity.length - 1]?.date ?? null} onSelectDay={setSelectedBucket} formatBucket={chartLabel} />
              {activity.length > 0 && activity.every((bucket) => bucket.loansIssued === 0 && bucket.returns === 0) && (
                <p className="reports-chart-empty">No circulation activity in this period. Buckets are shown as zero.</p>
              )}
            </ChartPanel>
            <ChartPanel title="Loans by status" note="Current status of loans issued during this range." className="admin-dashboard__copies-panel">
              <DonutChart counts={null} items={statuses} caption="loans" />
            </ChartPanel>
          </div>
          <section className="reports-table-section">
            <div className="reports-table-heading">
              <div>
                <h2>Report records</h2>
                <p>{allPeriodRows.toLocaleString()} records across all report categories</p>
              </div>
              <label className="reports-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search student or book</span>
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} />
              </label>
            </div>
            <Tabs<Tab>
              tabs={[
                { key: "borrowing", label: "Borrowing", count: currentBorrowing.length },
                { key: "overdue", label: "Overdue", count: currentOverdue.length },
                { key: "fines", label: "Fines", count: currentFines.length },
              ]}
              active={tab}
              onChange={onTabChange}
            />
            <div className="card reports-table-card" aria-live="polite">
              {allPeriodRows === 0 ? (
                <div className="reports-no-records">
                  <p>No records for this period.</p>
                  <button type="button" onClick={() => onPresetChange("last30")}>Reset range to Last 30 days</button>
                </div>
              ) : (
                <>
                  {tab === "borrowing" && <ReportTable rows={currentBorrowing} columns={BORROWING} rowKey={(row) => row.loanId} search={search} onReset={() => onPresetChange("last30")} />}
                  {tab === "overdue" && <ReportTable rows={currentOverdue} columns={OVERDUE} rowKey={(row) => row.loanId} search={search} onReset={() => onPresetChange("last30")} />}
                  {tab === "fines" && <ReportTable rows={currentFines} columns={FINES} rowKey={(row) => row.fineId} search={search} onReset={() => onPresetChange("last30")} />}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
