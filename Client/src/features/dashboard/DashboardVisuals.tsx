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
  const reducedMotion = useReducedMotion();
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : null;
  const [shown, setShown] = useState(numeric?.toLocaleString() ?? value);

  useEffect(() => {
    if (numeric === null || reducedMotion) {
      setShown(numeric?.toLocaleString() ?? value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const update = (now: number) => {
      const progress = Math.min(1, (now - start) / 620);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(numeric * eased).toLocaleString());
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [numeric, reducedMotion, value]);

  return <span className="dashboard-kpi__value">{shown}</span>;
}

function AdminCount({ value, currency = false }: { value: number; currency?: boolean }) {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const update = (now: number) => {
      const progress = Math.min(1, (now - start) / 1300);
      setShown(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, value]);

  const displayValue = currency ? formatPeso(shown) : Math.round(shown).toLocaleString();
  return <span>{displayValue}</span>;
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
        <span className="admin-kpi__label">Active loans</span>
        <strong className="admin-kpi__number"><AdminCount value={data.activeLoans} /></strong>
        {data.activityLast7Days.length ? (
          <span className="admin-kpi__spark" role="img" aria-label="Loans issued during the last seven days">
            {data.activityLast7Days.map((day, index) => (
              <i
                key={day.date}
                className={index === data.activityLast7Days.length - 1 ? "is-latest" : ""}
                style={{ height: `${(day.loansIssued / maxIssued) * 100}%` }}
                title={`${formatDate(day.date)}: ${day.loansIssued} issued`}
              />
            ))}
          </span>
        ) : <span className="admin-kpi__spark-empty">No activity data yet</span>}
      </Link>
      <Link className="admin-kpi admin-kpi--overdue" to={ROUTES.staff.returns}>
        <span className="admin-kpi__label">Overdue loans</span>
        <strong className="admin-kpi__number"><AdminCount value={data.overdueLoans} /></strong>
        <svg className="admin-kpi__mini-ring" viewBox="0 0 40 40" role="img" aria-label={`${Math.round(ratio * 100)} percent of active loans are overdue`}>
          <circle cx="20" cy="20" r="16" />
          <circle cx="20" cy="20" r="16" strokeDasharray={`${sparkCircumference * ratio} ${sparkCircumference * (1 - ratio)}`} />
        </svg>
      </Link>
      <Link className="admin-kpi admin-kpi--students" to={ROUTES.admin.users}>
        <span className="admin-kpi__label">Students</span>
        <strong className="admin-kpi__number"><AdminCount value={data.totalStudents} /></strong>
        <span className="admin-kpi__caption">registered readers</span>
      </Link>
      <Link className="admin-kpi admin-kpi--librarians" to={ROUTES.admin.librarians}>
        <span className="admin-kpi__label">Librarians</span>
        <strong className="admin-kpi__number"><AdminCount value={data.totalLibrarians} /></strong>
        <span className="admin-kpi__caption">library team</span>
      </Link>
      <div className="admin-kpi admin-kpi--cor">
        <span className="admin-kpi__cor-dot" aria-hidden="true" />
        <span className="admin-kpi__label">Pending COR</span>
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
      <Link to={to}>Review fines and payments</Link>
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
  return (
    <section className={`dashboard-panel ${className}`}>
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
}: {
  days: ActivityDay[] | null;
  selectedDay?: string | null;
  onSelectDay?: (date: string) => void;
}) {
  const [mode, setMode] = useState<ActivityMode>("Both");
  if (!days?.length) return <UnavailableChart label="7-day activity" />;

  const max = Math.max(1, ...days.flatMap((day) => [day.loansIssued, day.returns]));
  const plot = { left: 50, top: 28, width: 676, height: 174 };
  const step = plot.width / days.length;
  const selectedIndex = Math.max(0, days.findIndex((day) => day.date === (selectedDay ?? days[days.length - 1].date)));
  const selected = days[selectedIndex];
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
  const tooltipX = Math.min(610, Math.max(54, selectedX - 78));
  const yTicks = [...new Set([0, Math.ceil(max / 2), max])];

  return (
    <div className="dashboard-chart admin-activity-chart">
      <div className="admin-chart-toggle" role="group" aria-label="Activity chart series">
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
        {yTicks.map((value) => {
          const y = plot.top + plot.height - (value / max) * plot.height;
          return (
            <g key={`${value}-${y}`}>
              <line x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} className="dashboard-chart__gridline" />
              <text x={plot.left - 12} y={y + 4} textAnchor="end" className="admin-activity-chart__ylabel">{value}</text>
            </g>
          );
        })}
        <path d={area(issuedPoints)} className={`admin-activity-chart__area admin-activity-chart__area--issued${mode === "Returns" ? " is-dimmed" : ""}`} />
        <path d={area(returnsPoints)} className={`admin-activity-chart__area admin-activity-chart__area--returns${mode === "Issued" ? " is-dimmed" : ""}`} />
        <path d={line(issuedPoints)} pathLength="1" className={`admin-activity-chart__line admin-activity-chart__line--issued${mode === "Returns" ? " is-dimmed" : ""}`} />
        <path d={line(returnsPoints)} pathLength="1" className={`admin-activity-chart__line admin-activity-chart__line--returns${mode === "Issued" ? " is-dimmed" : ""}`} />
        <line x1={selectedX} y1={plot.top} x2={selectedX} y2={plot.top + plot.height} className="admin-activity-chart__crosshair" />
        {[{ point: issuedPoints[selectedIndex], kind: "issued" }, { point: returnsPoints[selectedIndex], kind: "returns" }].map(({ point, kind }) => (
          <circle key={kind} cx={point.x} cy={point.y} r="4.5" className={`admin-activity-chart__point admin-activity-chart__point--${kind}`} />
        ))}
        {[{ point: issuedPoints[days.length - 1], kind: "issued" }, { point: returnsPoints[days.length - 1], kind: "returns" }].map(({ point, kind }) => (
          <circle key={`latest-${kind}`} cx={point.x} cy={point.y} r="7" className={`admin-activity-chart__latest admin-activity-chart__latest--${kind}`} />
        ))}
        <g className="admin-activity-chart__tooltip" transform={`translate(${tooltipX} 34)`}>
          <rect width="158" height="62" rx="10" />
          <text x="12" y="18" className="admin-activity-chart__tooltip-date">{formatDate(selected.date)}</text>
          <text x="12" y="37"><tspan className="admin-activity-chart__tooltip-issued">●</tspan><tspan dx="6">Issued {selected.loansIssued}</tspan></text>
          <text x="12" y="54"><tspan className="admin-activity-chart__tooltip-returns">●</tspan><tspan dx="6">Returns {selected.returns}</tspan></text>
        </g>
        {days.map((day, index) => {
          const center = plot.left + step * (index + 0.5);
          return (
            <g key={day.date}>
              <text x={center} y={plot.top + plot.height + 24} textAnchor="middle" className={`dashboard-chart__label${selectedIndex === index ? " is-selected" : ""}`}>
                {day.date.slice(5)}
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

export function DonutChart({ counts }: { counts: Record<BookCopyStatus, number> | null }) {
  const [hovered, setHovered] = useState<BookCopyStatus | null>(null);
  const [pinned, setPinned] = useState<BookCopyStatus | null>(null);
  if (!counts) return <UnavailableChart label="Copies by status" />;
  const entries = Object.entries(counts) as [BookCopyStatus, number][];
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const circumference = 2 * Math.PI * 52;
  const activeStatus = hovered ?? pinned;
  const activeEntry = activeStatus ? entries.find(([status]) => status === activeStatus) : null;
  let offset = 0;
  const positiveEntries = entries.filter(([, count]) => count > 0);

  return (
    <div className="dashboard-donut admin-dashboard-donut">
      <svg
        viewBox="0 0 140 140"
        role="group"
        aria-label={`Copies by status: ${entries.map(([status, count]) => `${statusLabel(status)} ${count}`).join(", ")}`}
      >
        <circle cx="70" cy="70" r="52" className="dashboard-donut__track" />
        {positiveEntries.map(([status, count]) => {
          const segment = total > 0 ? (count / total) * circumference : 0;
          const gap = Math.min(5, segment);
          const dashLength = Math.max(0, segment - gap);
          const isActive = activeStatus === status;
          const circle = (
            <circle
              key={status}
              cx="70"
              cy="70"
              r={isActive ? 54 : 52}
              className={`dashboard-donut__segment dashboard-donut__segment--${STATUS_TONES[status]}${activeStatus && !isActive ? " is-dimmed" : ""}`}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-offset}
              onPointerEnter={() => setHovered(status)}
              onPointerLeave={() => setHovered(null)}
            >
              <title>{`${statusLabel(status)}: ${count}`}</title>
            </circle>
          );
          offset += segment;
          return circle;
        })}
        <text x="70" y="67" className="dashboard-donut__total">{(activeEntry?.[1] ?? total).toLocaleString()}</text>
        <text x="70" y="83" className="dashboard-donut__caption">
          {activeEntry ? `${Math.round((activeEntry[1] / (total || 1)) * 100)}%` : "copies"}
        </text>
      </svg>
      <ul className="dashboard-donut__legend">
        {entries.map(([status, count]) => (
          <li key={status}>
            <button
              type="button"
              className={`admin-dashboard-donut__legend-button${activeStatus === status ? " is-active" : ""}`}
              onMouseEnter={() => setHovered(status)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(status)}
              onBlur={() => setHovered(null)}
              onClick={() => setPinned((current) => current === status ? null : status)}
              aria-pressed={pinned === status}
            >
              <i className={`dashboard-legend-dot dashboard-legend-dot--${STATUS_TONES[status]}`} />
              <span>{statusLabel(status)}</span>
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
  const rows = [
    { label: "Issued", key: "loansIssued" as const, tone: "forest" },
    { label: "Returns", key: "returns" as const, tone: "amber" },
  ];
  return (
    <div className="admin-heat" role="group" aria-label="Seven-day activity intensity. Select a day to inspect it in the activity chart.">
      <div className="admin-heat__days" aria-hidden="true">
        <span />
        {days.map((day) => <span key={day.date}>{day.date.slice(5)}</span>)}
      </div>
      {rows.map((row) => (
        <div className="admin-heat__row" key={row.key}>
          <span className="admin-heat__label">{row.label}</span>
          <div className="admin-heat__cells">
            {days.map((day) => {
              const value = day[row.key];
              return (
                <button
                  key={day.date}
                  type="button"
                  className={`admin-heat__cell admin-heat__cell--${row.tone}${selectedDay === day.date ? " is-selected" : ""}`}
                  style={{ "--heat-intensity": value === 0 ? 0.06 : 0.18 + (value / max) * 0.72 } as CSSProperties}
                  onMouseEnter={() => onSelectDay(day.date)}
                  onFocus={() => onSelectDay(day.date)}
                  onClick={() => onSelectDay(day.date)}
                  aria-label={`${row.label}, ${formatDate(day.date)}: ${value}`}
                  aria-pressed={selectedDay === day.date}
                >
                  {value.toLocaleString()}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RankedBars({ books }: { books: AdminDashboardData["popularBooks"] | null }) {
  if (!books?.length) return <UnavailableChart label="Popular books" />;
  const max = Math.max(1, ...books.map((book) => book.loanCount));

  return (
    <div className="dashboard-ranked-bars" role="img" aria-label={`Popular books ranked by loans: ${books.map((book) => `${book.title}, ${book.loanCount}`).join("; ")}`}>
      {books.map((book, index) => {
        const share = max > 0 ? Math.round((book.loanCount / max) * 100) : 0;
        return (
        <div className="dashboard-ranked-bars__row admin-ranked-row" key={book.bookId} title={`${share}% of the top title's loan count`}>
          <span className="dashboard-ranked-bars__rank">{String(index + 1).padStart(2, "0")}</span>
          {book.book?.coverImageUrl
            ? <img className="dashboard-ranked-bars__cover" src={book.book.coverImageUrl} alt="" loading="lazy" />
            : <span className={`dashboard-ranked-bars__cover dashboard-ranked-bars__cover--empty admin-ranked-row__cover--tone-${index % 4}`} aria-hidden="true" />}
          <span className="admin-ranked-row__title-wrap">
            <span className="dashboard-ranked-bars__title">{book.title}</span>
            <small>{share}% of top title</small>
          </span>
          <span className="dashboard-ranked-bars__track" aria-hidden="true">
            <i style={{ width: `${Math.max(0, (book.loanCount / max) * 100)}%` }} />
          </span>
          <b>{book.loanCount.toLocaleString()}</b>
        </div>
        );
      })}
    </div>
  );
}

export function RatioRing({ active: _active, overdue: _overdue }: { active: number | null; overdue: number | null }) {
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
      <svg viewBox="0 0 200 124" role="img" aria-label={`${Math.round(overdueRatio * 100)} percent overdue: ${overdue} overdue loans of ${active} active loans`}>
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
        <text x="100" y="81" className="admin-ratio__percent">{Math.round(overdueRatio * 100)}%</text>
        <text x="100" y="99" className="admin-ratio__caption">overdue</text>
      </svg>
      <p><b>{overdue.toLocaleString()}</b> overdue of <b>{active.toLocaleString()}</b> active loans</p>
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
