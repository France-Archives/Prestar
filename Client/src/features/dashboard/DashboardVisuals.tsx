import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { AdminDashboardData, BookCopyStatus } from "@/types";
import { ROUTES } from "@/app/routeConfig";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
import { formatPeso } from "@/utils/formatCurrency";
import { useCountUp } from "@/hooks/useCountUp";
import { useInView } from "@/hooks/useInView";
import "./dashboard.css";

type Tone = "forest" | "green" | "amber" | "teal" | "brick";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  to?: string;
  tone?: Tone;
  alert?: boolean;
  index?: number;
}

function CountValue({ value }: { value: string | number }) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
  return numeric === null
    ? <span className="dashboard-kpi__value">{value}</span>
    : <DashboardNumber value={numeric} className="dashboard-kpi__value" />;
}

export function DashboardNumber({
  value,
  currency = false,
  className,
}: {
  value: number;
  currency?: boolean;
  className?: string;
}) {
  const { value: shown, ref } = useCountUp<HTMLSpanElement>(value, 1150);
  const displayValue = currency ? formatPeso(shown) : Math.round(shown).toLocaleString();
  return <span ref={ref} className={className}>{displayValue}</span>;
}

function DashboardSvgNumber({
  value,
  x,
  y,
  className,
  suffix = "",
}: {
  value: number;
  x: number;
  y: number;
  className: string;
  suffix?: string;
}) {
  const { value: shown, ref } = useCountUp<SVGTextElement>(value, 900);
  return <text ref={ref} x={x} y={y} className={className}>{Math.round(shown).toLocaleString()}{suffix}</text>;
}

const AdminCount = ({ value, currency = false }: { value: number; currency?: boolean }) => (
  <DashboardNumber value={value} currency={currency} />
);

export function DashboardLiveStatus() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span className="dashboard-live-status" aria-label={`Live dashboard data, updated ${seconds} seconds ago`}>
      <i aria-hidden="true" />
      <span>Live · updated {seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`} ago</span>
    </span>
  );
}

export function AdminKpiStrip({ data }: { data: AdminDashboardData }) {
  const maxIssued = Math.max(1, ...data.activityLast7Days.map((day) => day.loansIssued));
  const active = Math.max(0, data.activeLoans);
  const overdue = Math.max(0, data.overdueLoans);
  const ratio = active > 0 ? Math.min(1, overdue / active) : 0;
  const sparkCircumference = 2 * Math.PI * 16;

  return (
    <div className="admin-dashboard__kpis" role="group" aria-label="Library key performance indicators">
      <Link className="admin-kpi admin-kpi--active" to={ROUTES.staff.returns}>
        <span className="admin-kpi__label"><i />Active loans</span>
        <strong className="admin-kpi__number"><AdminCount value={data.activeLoans} /></strong>
        {data.activityLast7Days.length ? (
          <span className="admin-kpi__spark" role="img" aria-label="Loans issued during the last seven days">
            {data.activityLast7Days.map((day, index) => (
              <i
                key={day.date}
                className={index === data.activityLast7Days.length - 1 ? "is-latest" : ""}
                style={{ height: `${(day.loansIssued / maxIssued) * 100}%`, "--i": index } as CSSProperties}
                title={`${formatDate(day.date)}: ${day.loansIssued} issued`}
              />
            ))}
          </span>
        ) : <span className="admin-kpi__spark-empty">No activity data yet</span>}
      </Link>
      <Link className="admin-kpi admin-kpi--overdue" to={ROUTES.staff.returns}>
        <span className="admin-kpi__label"><i />Overdue loans</span>
        <strong className="admin-kpi__number"><AdminCount value={data.overdueLoans} /></strong>
        <svg className={`admin-kpi__mini-ring${overdue === 0 ? " is-clear" : ""}`} viewBox="0 0 40 40" role="img" aria-label={overdue === 0 ? "All clear: no overdue loans" : `${Math.round(ratio * 100)} percent of active loans are overdue`}>
          <circle cx="20" cy="20" r="16" />
          <circle cx="20" cy="20" r="16" style={{ strokeDasharray: sparkCircumference, strokeDashoffset: sparkCircumference * (1 - (overdue === 0 ? 1 : ratio)) }} />
        </svg>
        <span className="admin-kpi__caption">{overdue === 0 ? "All clear" : "needs attention"}</span>
      </Link>
      <Link className="admin-kpi admin-kpi--students" to={ROUTES.admin.users}>
        <span className="admin-kpi__label"><i />Students</span>
        <strong className="admin-kpi__number"><AdminCount value={data.totalStudents} /></strong>
        <span className="admin-kpi__caption">registered readers</span>
        <svg className="admin-kpi__mini-ring admin-kpi__mini-ring--quiet" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" /><circle cx="20" cy="20" r="16" /></svg>
      </Link>
      <Link className="admin-kpi admin-kpi--librarians" to={ROUTES.admin.librarians}>
        <span className="admin-kpi__label"><i />Librarians</span>
        <strong className="admin-kpi__number"><AdminCount value={data.totalLibrarians} /></strong>
        <span className="admin-kpi__caption">library team</span>
        <svg className="admin-kpi__mini-ring admin-kpi__mini-ring--quiet" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" /><circle cx="20" cy="20" r="16" /></svg>
      </Link>
      <div className="admin-kpi admin-kpi--cor">
        <span className="admin-kpi__cor-dot" aria-hidden="true" />
        <span className="admin-kpi__label"><i />Pending COR</span>
        <strong className="admin-kpi__number"><AdminCount value={data.pendingCorReviews} /></strong>
        <Link to={ROUTES.staff.corReview}>Review now <span aria-hidden="true">→</span></Link>
      </div>
    </div>
  );
}

export function AdminMoneyFigure({ amount, to }: { amount: number; to: string }) {
  return (
    <div className="admin-dashboard__fines-figure">
      <strong><AdminCount value={amount} currency /></strong>
      <Link to={to}><span>Review fines and payments</span><i aria-hidden="true" /></Link>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  to,
  tone = "forest",
  alert = false,
  index = 0,
}: KpiCardProps) {
  const reducedMotion = useReducedMotion();
  const content = (
    <>
      <span className="dashboard-kpi__topline">
        <span className="dashboard-kpi__icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
        <span className="dashboard-kpi__label">{label}</span>
      </span>
      <CountValue value={value} />
    </>
  );
  const animation = reducedMotion
    ? { initial: false as const, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };
  const commonProps = {
    ...animation,
    whileHover: reducedMotion ? undefined : { y: -2 },
    transition: { duration: 0.24, delay: reducedMotion ? 0 : Math.min(index, 6) * 0.055 },
    className: `dashboard-kpi dashboard-kpi--${tone}${alert ? " dashboard-kpi--alert" : ""}`,
  };

  return to ? (
    <motion.div {...commonProps}>
      <Link to={to} className="dashboard-kpi__link">
        {content}
      </Link>
    </motion.div>
  ) : (
    <motion.div {...commonProps} aria-label={`${label}: ${value}`}>
      {content}
    </motion.div>
  );
}

export function ChartPanel({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: ReactNode;
  className?: string;
}) {
  const { ref, isInView } = useInView<HTMLElement>();
  return (
    <section ref={ref} className={`dashboard-panel dashboard-reveal${isInView ? " is-visible" : ""} ${className}`}>
      <div className="dashboard-panel__head">
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function UnavailableChart({ label }: { label: string }) {
  return (
    <div className="dashboard-unavailable" role="status">
      <span aria-hidden="true">—</span>
      <p>{label}: Not available yet</p>
    </div>
  );
}

type ActivityDay = AdminDashboardData["activityLast7Days"][number];

type ActivityMode = "Both" | "Issued" | "Returns";

function smoothLine(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  const slopes = points.slice(0, -1).map((point, index) =>
    (points[index + 1].y - point.y) / (points[index + 1].x - point.x));
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[slopes.length - 1];
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) return 0;
    return (2 * before * after) / (before + after);
  });

  return points.slice(0, -1).reduce((path, point, index) => {
    const next = points[index + 1];
    const third = (next.x - point.x) / 3;
    return `${path} C ${point.x + third} ${point.y + tangents[index] * third}, ${next.x - third} ${next.y - tangents[index + 1] * third}, ${next.x} ${next.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

export function ActivityChart({
  days,
  selectedDay,
  onSelectDay,
  formatBucket,
}: {
  days: ActivityDay[] | null;
  selectedDay?: string | null;
  onSelectDay?: (date: string) => void;
  formatBucket?: (date: string) => string;
}) {
  const [mode, setMode] = useState<ActivityMode>("Both");
  if (!days?.length) return <UnavailableChart label="7-day activity" />;
  const labelForDate = formatBucket ?? ((date: string) => date.slice(5));

  const max = Math.max(1, ...days.flatMap((day) => [day.loansIssued, day.returns]));
  const plot = { left: 50, top: 28, width: 676, height: 174 };
  const step = plot.width / days.length;
  const selectedIndex = Math.max(0, days.findIndex((day) => day.date === (selectedDay ?? days[days.length - 1].date)));
  const selected = days[selectedIndex];
  const previous = days[Math.max(0, selectedIndex - 1)];
  const issuedDelta = selected.loansIssued - previous.loansIssued;
  const returnsDelta = selected.returns - previous.returns;
  const makePoints = (key: "loansIssued" | "returns") => days.map((day, index) => ({
    x: plot.left + step * (index + 0.5),
    y: plot.top + plot.height - (day[key] / max) * plot.height,
  }));
  const issuedPoints = makePoints("loansIssued");
  const returnsPoints = makePoints("returns");
  const line = (points: { x: number; y: number }[]) => smoothLine(points);
  const area = (points: { x: number; y: number }[]) =>
    `${line(points)} L ${points[points.length - 1].x} ${plot.top + plot.height} L ${points[0].x} ${plot.top + plot.height} Z`;
  const selectedX = plot.left + step * (selectedIndex + 0.5);
  const tooltipX = Math.min(576, Math.max(54, selectedX - 78));
  const yTicks = [...new Set([0, Math.ceil(max / 2), max])];
  const isIdle = days.every((day) => day.loansIssued === 0 && day.returns === 0);

  return (
    <div className={`dashboard-chart admin-activity-chart${isIdle ? " is-idle" : ""}`}>
      <div className={`admin-chart-toggle admin-chart-toggle--${mode.toLowerCase()}`} role="group" aria-label="Activity chart series">
        <span className="admin-chart-toggle__pill" aria-hidden="true" />
        {(["Both", "Issued", "Returns"] as const).map((option) => (
          <button key={option} type="button" aria-pressed={mode === option} onClick={() => setMode(option)}>
            {option}
          </button>
        ))}
      </div>
      <svg
        className="dashboard-activity-chart admin-activity-chart__svg"
        viewBox="0 0 760 250"
        role="group"
        aria-label={`Loans issued and returns over ${days.length} days. Selected ${formatDate(selected.date)}: ${selected.loansIssued} issued, ${selected.returns} returned.`}
      >
        <defs>
          <clipPath id="admin-activity-area-clip">
            <rect x={plot.left} y={plot.top} width={plot.width} height={plot.height} className="admin-activity-chart__area-clip" />
          </clipPath>
        </defs>
        {yTicks.map((value) => {
          const y = plot.top + plot.height - (value / max) * plot.height;
          return (
            <g key={`${value}-${y}`}>
              <line x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} className="dashboard-chart__gridline" />
              <text x={plot.left - 12} y={y + 4} textAnchor="end" className="admin-activity-chart__ylabel">{value}</text>
            </g>
          );
        })}
        <path d={area(issuedPoints)} clipPath="url(#admin-activity-area-clip)" className={`admin-activity-chart__area admin-activity-chart__area--issued${mode === "Returns" ? " is-dimmed" : ""}`} />
        <path d={area(returnsPoints)} clipPath="url(#admin-activity-area-clip)" className={`admin-activity-chart__area admin-activity-chart__area--returns${mode === "Issued" ? " is-dimmed" : ""}`} />
        <path d={line(issuedPoints)} pathLength="1" className={`admin-activity-chart__line admin-activity-chart__line--issued${mode === "Returns" ? " is-dimmed" : ""}`} />
        <path d={line(returnsPoints)} pathLength="1" className={`admin-activity-chart__line admin-activity-chart__line--returns${mode === "Issued" ? " is-dimmed" : ""}`} />
        <g className="admin-activity-chart__crosshair-wrap" transform={`translate(${selectedX} 0)`}>
          <line y1={plot.top} y2={plot.top + plot.height} className="admin-activity-chart__crosshair" />
        </g>
        {[{ point: issuedPoints[selectedIndex], kind: "issued" }, { point: returnsPoints[selectedIndex], kind: "returns" }].map(({ point, kind }) => (
          <g key={kind} className={`admin-activity-chart__selected-point admin-activity-chart__selected-point--${kind}`}>
            <circle cx={point.x} cy={point.y} r="10" className="admin-activity-chart__halo" />
            <circle cx={point.x} cy={point.y} r="5.5" className={`admin-activity-chart__point admin-activity-chart__point--${kind}`} />
          </g>
        ))}
        {[{ point: issuedPoints[days.length - 1], kind: "issued" }, { point: returnsPoints[days.length - 1], kind: "returns" }].map(({ point, kind }) => (
          <circle key={`latest-${kind}`} cx={point.x} cy={point.y} r="7" className={`admin-activity-chart__latest admin-activity-chart__latest--${kind}`} />
        ))}
        <g className="admin-activity-chart__tooltip" style={{ transform: `translate(${tooltipX}px, 34px)` }}>
          <rect width="174" height="76" rx="10" />
          <text x="12" y="18" className="admin-activity-chart__tooltip-date">{formatDate(selected.date)}</text>
          <text x="12" y="37"><tspan className="admin-activity-chart__tooltip-issued">●</tspan><tspan dx="6">Issued {selected.loansIssued} ({issuedDelta > 0 ? "+" : ""}{issuedDelta})</tspan></text>
          <text x="12" y="54"><tspan className="admin-activity-chart__tooltip-returns">●</tspan><tspan dx="6">Returns {selected.returns} ({returnsDelta > 0 ? "+" : ""}{returnsDelta})</tspan></text>
          {isIdle && <text x="12" y="69">No activity yet</text>}
        </g>
        {days.map((day, index) => {
          const center = plot.left + step * (index + 0.5);
          return (
            <g key={day.date}>
              <text x={center} y={plot.top + plot.height + 24} textAnchor="middle" className={`dashboard-chart__label${selectedIndex === index ? " is-selected" : ""}`}>
                {labelForDate(day.date)}
              </text>
              <foreignObject x={plot.left + step * index} y={plot.top} width={step} height={plot.height + 32}>
                <button
                  type="button"
                  className="admin-activity-chart__hit"
                  aria-label={`${formatDate(day.date)}: ${day.loansIssued} loans issued, ${day.returns} returns`}
                  aria-pressed={selectedIndex === index}
                  onMouseEnter={() => onSelectDay?.(day.date)}
                  onFocus={() => onSelectDay?.(day.date)}
                  onClick={() => onSelectDay?.(day.date)}
                />
              </foreignObject>
            </g>
          );
        })}
      </svg>
      <div className="dashboard-chart__legend">
        <span className={mode === "Returns" ? "is-dimmed" : ""}><i className="dashboard-legend-dot dashboard-legend-dot--forest" /> Loans issued</span>
        <span className={mode === "Issued" ? "is-dimmed" : ""}><i className="dashboard-legend-dot dashboard-legend-dot--amber" /> Returns</span>
      </div>
      <details className="dashboard-chart__data">
        <summary>View activity data</summary>
        <table>
          <thead><tr><th>Date</th><th>Loans issued</th><th>Returns</th></tr></thead>
          <tbody>
            {days.map((day) => <tr key={day.date}><th scope="row">{formatDate(day.date)}</th><td>{day.loansIssued}</td><td>{day.returns}</td></tr>)}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const STATUS_TONES: Record<BookCopyStatus, Tone> = {
  AVAILABLE: "forest",
  RESERVED: "amber",
  ON_LOAN: "teal",
  MAINTENANCE: "brick",
  LOST: "brick",
  WITHDRAWN: "teal",
};

export interface DonutChartItem {
  key: string;
  label: string;
  count: number;
  tone: Tone;
}

export function DonutChart({
  counts,
  items,
  caption = "copies",
}: {
  counts: Record<BookCopyStatus, number> | null;
  items?: DonutChartItem[];
  caption?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  if (!items && !counts) return <UnavailableChart label="Copies by status" />;
  const entries: DonutChartItem[] = items ?? (Object.entries(counts ?? {}) as [BookCopyStatus, number][]).map(([status, count]) => ({
    key: status,
    label: statusLabel(status),
    count,
    tone: STATUS_TONES[status],
  }));
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  const circumference = 2 * Math.PI * 52;
  const activeStatus = hovered ?? pinned;
  const activeEntry = activeStatus ? entries.find((entry) => entry.key === activeStatus) : null;
  let offset = 0;
  const positiveEntries = entries.filter((entry) => entry.count > 0);

  return (
    <div className="dashboard-donut admin-dashboard-donut">
      <svg
        viewBox="0 0 140 140"
        role="group"
      aria-label={`Status breakdown: ${entries.map((entry) => `${entry.label} ${entry.count}`).join(", ")}`}
      >
        <circle cx="70" cy="70" r="52" className="dashboard-donut__track" />
      {positiveEntries.map((entry, index) => {
        const { key, count, tone, label } = entry;
        const segment = total > 0 ? (count / total) * circumference : 0;
          const gap = Math.min(5, segment);
          const dashLength = Math.max(segment < 4 ? 2 : 0, segment - gap);
          const isActive = activeStatus === key;
          const segmentOffset = -offset;
          const angle = -Math.PI / 2 + ((offset + segment / 2) / circumference) * Math.PI * 2;
          const marker = { x: 70 + 52 * Math.cos(angle), y: 70 + 52 * Math.sin(angle) };
          const segmentElement = (
            <g
              key={key}
              className={`admin-dashboard-donut__segment-group${isActive ? " is-active" : ""}${activeStatus && !isActive ? " is-dimmed" : ""}`}
              style={{ "--i": index, "--segment-end": `${segmentOffset}`, "--segment-start": `${segmentOffset - dashLength}` } as CSSProperties}
              onPointerEnter={() => setHovered(key)}
              onPointerLeave={() => setHovered(null)}
            >
              <circle
                cx="70"
                cy="70"
                r={isActive ? 54 : 52}
                className={`dashboard-donut__segment dashboard-donut__segment--${tone}`}
                strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                strokeDashoffset={segmentOffset}
              >
                <title>{`${label}: ${count}`}</title>
              </circle>
              {segment < 5 && <circle cx={marker.x} cy={marker.y} r="2.6" className={`admin-dashboard-donut__marker dashboard-donut__segment--${tone}`} aria-hidden="true" />}
            </g>
          );
          offset += segment;
          return segmentElement;
        })}
        <DashboardSvgNumber x={70} y={67} className="dashboard-donut__total" value={activeEntry?.count ?? total} />
        <text x="70" y="83" className="dashboard-donut__caption">
          {activeEntry ? `${Math.round((activeEntry.count / (total || 1)) * 100)}%` : caption}
        </text>
      </svg>
      <ul className="dashboard-donut__legend">
        {entries.map(({ key, label, tone, count }) => (
          <li key={key}>
            <button
              type="button"
              className={`admin-dashboard-donut__legend-button${activeStatus === key ? " is-active" : ""}`}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(key)}
              onBlur={() => setHovered(null)}
              onClick={() => setPinned((current) => current === key ? null : key)}
              aria-pressed={pinned === key}
            >
              <i className={`dashboard-legend-dot dashboard-legend-dot--${tone}`} />
              <span>{label}</span>
              <b>{count.toLocaleString()}</b>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ActivityHeatStrip({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: ActivityDay[] | null;
  selectedDay: string | null;
  onSelectDay: (date: string) => void;
}) {
  if (!days?.length) return <UnavailableChart label="Seven-day activity intensity" />;
  const max = Math.max(1, ...days.flatMap((day) => [day.loansIssued, day.returns]));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const rows = [
    { label: "Issued", key: "loansIssued" as const, tone: "forest" },
    { label: "Returns", key: "returns" as const, tone: "amber" },
  ];
  return (
    <div className="admin-heat" role="group" aria-label="Seven-day activity intensity. Select a day to inspect it in the activity chart.">
      <div className="admin-heat__days" aria-hidden="true">
        <span />
        {days.map((day) => <span key={day.date} className={day.date === today ? "is-today" : ""}>{day.date === today ? "Today" : day.date.slice(5)}</span>)}
      </div>
      {rows.map((row) => (
        <div className={`admin-heat__row admin-heat__row--${row.tone}`} key={row.key}>
          <span className="admin-heat__label">{row.label}</span>
          {days.map((day, index) => {
            const value = day[row.key];
            const intensity = value === 0 ? 0.08 : 0.3 + (value / max) * 0.7;
            return (
              <button
                key={day.date}
                type="button"
                className={`admin-heat__cell admin-heat__cell--${row.tone}${day.date === today ? " is-today" : ""}${selectedDay === day.date ? " is-selected" : ""}`}
                style={{ "--heat-intensity": intensity, "--bar-scale": value === 0 ? 0.04 : Math.max(0.12, value / max), "--i": index } as CSSProperties}
                onMouseEnter={() => onSelectDay(day.date)}
                onFocus={() => onSelectDay(day.date)}
                onClick={() => onSelectDay(day.date)}
                aria-label={`${row.label}, ${formatDate(day.date)}: ${value}`}
                aria-pressed={selectedDay === day.date}
                title={`${row.label} · ${formatDate(day.date)}: ${value.toLocaleString()}`}
              >
                <i aria-hidden="true" />
                <b>{value.toLocaleString()}</b>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function RankedBars({ books }: { books: AdminDashboardData["popularBooks"] | null }) {
  if (!books?.length) return <UnavailableChart label="Popular books" />;
  const max = Math.max(1, ...books.map((book) => book.loanCount));

  return (
    <div className="dashboard-ranked-bars" role="list" aria-label={`Popular books ranked by loans: ${books.map((book) => `${book.title}, ${book.loanCount}`).join("; ")}`}>
      {books.map((book, index) => {
        const share = max > 0 ? Math.round((book.loanCount / max) * 100) : 0;
        return (
        <div className={`dashboard-ranked-bars__row admin-ranked-row${book.loanCount === 0 ? " is-zero" : ""}`} key={book.bookId} title={`${share}% of the top title's loan count`} style={{ "--i": index } as CSSProperties} role="listitem">
          <span className="dashboard-ranked-bars__rank">{String(index + 1).padStart(2, "0")}</span>
          {book.book?.coverImageUrl
            ? <span className={`admin-ranked-row__cover-wrap admin-ranked-row__medal-${index < 3 ? index + 1 : "none"}`}><img className="dashboard-ranked-bars__cover" src={book.book.coverImageUrl} alt="" loading="lazy" /></span>
            : <span className={`admin-ranked-row__cover-wrap admin-ranked-row__medal-${index < 3 ? index + 1 : "none"}`}><span className={`dashboard-ranked-bars__cover dashboard-ranked-bars__cover--empty admin-ranked-row__cover--tone-${index % 4}`} aria-hidden="true" /></span>}
          <span className="admin-ranked-row__title-wrap">
            <span className="dashboard-ranked-bars__title">{book.title}</span>
            <small>{share}% of top title</small>
          </span>
          <span className="dashboard-ranked-bars__track" aria-hidden="true">
            <i style={{ "--bar-progress": book.loanCount > 0 ? Math.max(0.02, book.loanCount / max) : 0, "--i": index } as CSSProperties} />
          </span>
          <b><DashboardNumber value={book.loanCount} /></b>
        </div>
        );
      })}
    </div>
  );
}

export function RatioRing({ active: _active, overdue: _overdue, maintenance = 0 }: { active: number | null; overdue: number | null; maintenance?: number }) {
  if (_active === null || _overdue === null) return <UnavailableChart label="Overdue vs active loans" />;
  const active = Math.max(0, _active);
  const overdue = Math.max(0, _overdue);
  const overdueRatio = active > 0 ? Math.min(1, overdue / active) : 0;
  const arcLength = Math.PI * 76;
  const angle = Math.PI - overdueRatio * Math.PI;
  const knob = { x: 100 + 76 * Math.cos(angle), y: 100 - 76 * Math.sin(angle) };
  const reducedMotion = useReducedMotion();

  return (
    <div className="dashboard-ratio admin-dashboard-ratio">
      <svg viewBox="0 0 200 124" role="img" aria-label={overdue === 0 ? `All clear: no overdue loans of ${active} active loans` : `${Math.round(overdueRatio * 100)} percent overdue: ${overdue} overdue loans of ${active} active loans`}>
        <path d="M 24 100 A 76 76 0 0 1 176 100" className="admin-ratio__track" />
        <motion.path
          d="M 24 100 A 76 76 0 0 1 176 100"
          pathLength={arcLength}
          className="admin-ratio__value"
          strokeDasharray={`${arcLength * overdueRatio} ${arcLength}`}
          initial={reducedMotion ? false : { strokeDashoffset: arcLength * overdueRatio }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: reducedMotion ? 0 : 1.1, ease: "easeOut" }}
        />
        <circle cx={knob.x} cy={knob.y} r="6" className="admin-ratio__knob" />
        {overdue === 0 ? (
          <>
            <path d="m85 77 10 10 21-23" className="admin-ratio__check" pathLength="1" />
            <text x="100" y="101" className="admin-ratio__caption">All clear</text>
          </>
        ) : (
          <>
            <DashboardSvgNumber x={100} y={81} className="admin-ratio__percent" value={Math.round(overdueRatio * 100)} suffix="%" />
            <text x="100" y="99" className="admin-ratio__caption">overdue</text>
          </>
        )}
      </svg>
      <p><b>{overdue.toLocaleString()}</b> overdue of <b>{active.toLocaleString()}</b> active loans</p>
      <div className="admin-dashboard-ratio__maintenance"><span>Maintenance copies</span><b><DashboardNumber value={maintenance} /></b></div>
    </div>
  );
}

export function AttentionList({
  items,
}: {
  items: { label: string; count: number | null; to: string }[];
}) {
  const attention = items.filter((item) => item.count !== null && item.count > 0);
  if (attention.length === 0) {
    const unknown = items.some((item) => item.count === null);
    return <p className="dashboard-attention__empty">{unknown ? "Some circulation counts are not available yet." : "No circulation items need attention."}</p>;
  }
  return (
    <ul className="dashboard-attention">
      {attention.map((item) => (
        <li key={item.label}>
          <Link to={item.to}>
            <span>{item.label}</span>
            <b>{item.count?.toLocaleString()}</b>
          </Link>
        </li>
      ))}
    </ul>
  );
}
