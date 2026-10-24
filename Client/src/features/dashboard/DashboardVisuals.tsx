import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AdminDashboardData, BookCopyStatus } from "@/types";
import { statusLabel } from "@/utils/constants";
import { formatDate } from "@/utils/formatDate";
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

export function ActivityChart({ days }: { days: ActivityDay[] | null }) {
  const reducedMotion = useReducedMotion();
  if (!days?.length) return <UnavailableChart label="7-day activity" />;

  const max = Math.max(1, ...days.flatMap((day) => [day.loansIssued, day.returns]));
  const plot = { left: 36, top: 12, width: 640, height: 176 };
  const step = plot.width / days.length;
  const barWidth = Math.min(23, step * 0.28);

  return (
    <div className="dashboard-chart">
      <svg
        className="dashboard-activity-chart"
        viewBox="0 0 700 238"
        role="img"
        aria-label={`Loans issued and returns over ${days.length} days`}
      >
        <line x1={plot.left} y1={plot.top + plot.height} x2={plot.left + plot.width} y2={plot.top + plot.height} className="dashboard-chart__axis" />
        {[0, 0.5, 1].map((ratio) => {
          const y = plot.top + plot.height * (1 - ratio);
          return <line key={ratio} x1={plot.left} y1={y} x2={plot.left + plot.width} y2={y} className="dashboard-chart__gridline" />;
        })}
        {days.map((day, index) => {
          const center = plot.left + step * (index + 0.5);
          const issuedHeight = Math.max(0, (day.loansIssued / max) * plot.height);
          const returnsHeight = Math.max(0, (day.returns / max) * plot.height);
          return (
            <g key={day.date}>
              <motion.rect
                x={center - barWidth - 2}
                y={plot.top + plot.height - issuedHeight}
                width={barWidth}
                height={issuedHeight}
                rx="4"
                className="dashboard-chart__bar dashboard-chart__bar--forest"
                initial={reducedMotion ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.36, delay: reducedMotion ? 0 : index * 0.035 }}
                style={{ transformOrigin: "center bottom" }}
              >
                <title>{`${formatDate(day.date)}: ${day.loansIssued} loans issued`}</title>
              </motion.rect>
              <motion.rect
                x={center + 2}
                y={plot.top + plot.height - returnsHeight}
                width={barWidth}
                height={returnsHeight}
                rx="4"
                className="dashboard-chart__bar dashboard-chart__bar--amber"
                initial={reducedMotion ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.36, delay: reducedMotion ? 0 : index * 0.035 }}
                style={{ transformOrigin: "center bottom" }}
              >
                <title>{`${formatDate(day.date)}: ${day.returns} returns`}</title>
              </motion.rect>
              <text x={center} y={plot.top + plot.height + 22} textAnchor="middle" className="dashboard-chart__label">
                {day.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="dashboard-chart__legend">
        <span><i className="dashboard-legend-dot dashboard-legend-dot--forest" /> Loans issued</span>
        <span><i className="dashboard-legend-dot dashboard-legend-dot--amber" /> Returns</span>
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
  if (!counts) return <UnavailableChart label="Copies by status" />;
  const entries = Object.entries(counts) as [BookCopyStatus, number][];
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const circumference = 2 * Math.PI * 54;
  let offset = 0;

  return (
    <div className="dashboard-donut">
      <svg
        viewBox="0 0 140 140"
        role="img"
        aria-label={`Copies by status: ${entries.map(([status, count]) => `${statusLabel(status)} ${count}`).join(", ")}`}
      >
        <circle cx="70" cy="70" r="54" className="dashboard-donut__track" />
        {entries.map(([status, count]) => {
          const segment = total > 0 ? (count / total) * circumference : 0;
          const circle = (
            <circle
              key={status}
              cx="70"
              cy="70"
              r="54"
              className={`dashboard-donut__segment dashboard-donut__segment--${STATUS_TONES[status]}`}
              strokeDasharray={`${segment} ${circumference - segment}`}
              strokeDashoffset={-offset}
            >
              <title>{`${statusLabel(status)}: ${count}`}</title>
            </circle>
          );
          offset += segment;
          return circle;
        })}
        <text x="70" y="67" className="dashboard-donut__total">{total.toLocaleString()}</text>
        <text x="70" y="83" className="dashboard-donut__caption">copies</text>
      </svg>
      <ul className="dashboard-donut__legend">
        {entries.map(([status, count]) => (
          <li key={status}>
            <i className={`dashboard-legend-dot dashboard-legend-dot--${STATUS_TONES[status]}`} />
            <span>{statusLabel(status)}</span>
            <b>{count.toLocaleString()}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankedBars({ books }: { books: AdminDashboardData["popularBooks"] | null }) {
  if (!books?.length) return <UnavailableChart label="Popular books" />;
  const max = Math.max(1, ...books.map((book) => book.loanCount));

  return (
    <div className="dashboard-ranked-bars" role="img" aria-label={`Popular books ranked by loans: ${books.map((book) => `${book.title}, ${book.loanCount}`).join("; ")}`}>
      {books.map((book, index) => (
        <div className="dashboard-ranked-bars__row" key={book.bookId}>
          <span className="dashboard-ranked-bars__rank">{String(index + 1).padStart(2, "0")}</span>
          {book.book?.coverImageUrl
            ? <img className="dashboard-ranked-bars__cover" src={book.book.coverImageUrl} alt="" loading="lazy" />
            : <span className="dashboard-ranked-bars__cover dashboard-ranked-bars__cover--empty" aria-hidden="true" />}
          <span className="dashboard-ranked-bars__title">{book.title}</span>
          <span className="dashboard-ranked-bars__track" aria-hidden="true">
            <i style={{ width: `${Math.max(0, (book.loanCount / max) * 100)}%` }} />
          </span>
          <b>{book.loanCount.toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
}

export function RatioRing({ active: _active, overdue: _overdue }: { active: number | null; overdue: number | null }) {
  if (_active === null || _overdue === null) return <UnavailableChart label="Overdue vs active loans" />;
  const active = Math.max(0, _active);
  const overdue = Math.max(0, _overdue);
  const overdueRatio = active > 0 ? Math.min(1, overdue / active) : 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="dashboard-ratio">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${overdue} overdue loans and ${active} active loans`}>
        <circle cx="60" cy="60" r={radius} className="dashboard-donut__track" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="dashboard-donut__segment dashboard-donut__segment--brick"
          strokeDasharray={`${circumference * overdueRatio} ${circumference * (1 - overdueRatio)}`}
        />
        <text x="60" y="57" className="dashboard-donut__total">{Math.round(overdueRatio * 100)}%</text>
        <text x="60" y="74" className="dashboard-donut__caption">overdue</text>
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
