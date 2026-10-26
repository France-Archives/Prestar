import type { DateRange, ReportGroup, ReportPreset } from "../utils/reportsModel";

const PRESETS: { key: ReportPreset; label: string }[] = [
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "thisQuarter", label: "This quarter" },
  { key: "thisYear", label: "This year" },
  { key: "custom", label: "Custom" },
];

const GROUPS: { key: ReportGroup; label: string; minimumDays: number }[] = [
  { key: "daily", label: "Daily", minimumDays: 1 },
  { key: "weekly", label: "Weekly", minimumDays: 7 },
  { key: "monthly", label: "Monthly", minimumDays: 31 },
  { key: "yearly", label: "Yearly", minimumDays: 365 },
];

interface Props {
  range: DateRange;
  preset: ReportPreset;
  group: ReportGroup;
  onRangeChange: (range: DateRange) => void;
  onPresetChange: (preset: ReportPreset) => void;
  onGroupChange: (group: ReportGroup) => void;
  canClear: boolean;
  rangeError: string | null;
  rangeDays: number;
}

export default function ReportsFilters({
  range,
  preset,
  group,
  onRangeChange,
  onPresetChange,
  onGroupChange,
  canClear,
  rangeError,
  rangeDays,
}: Props) {
  return (
    <section className="reports-filters" aria-label="Report filters">
      <div className="reports-filters__presets" role="group" aria-label="Date range presets">
        {PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={preset === item.key ? "is-active" : ""}
            aria-pressed={preset === item.key}
            onClick={() => onPresetChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="reports-filters__dates">
        <label>
          <span>From</span>
          <input
            type="date"
            value={range.from}
            aria-invalid={!!rangeError}
            aria-describedby={rangeError ? "reports-range-error" : undefined}
            onChange={(event) => onRangeChange({ ...range, from: event.target.value })}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={range.to}
            aria-invalid={!!rangeError}
            aria-describedby={rangeError ? "reports-range-error" : undefined}
            onChange={(event) => onRangeChange({ ...range, to: event.target.value })}
          />
        </label>
        <button type="button" className="reports-filters__clear" disabled={!canClear} onClick={() => onPresetChange("last30")}>
          Clear dates
        </button>
      </div>
      {rangeError && <p className="reports-filters__error" id="reports-range-error" role="alert">{rangeError}</p>}
      <div className="reports-filters__group">
        <span className="reports-filters__label" id="reports-group-label">Group by</span>
        <div role="group" aria-labelledby="reports-group-label" className="reports-filters__segments">
          {GROUPS.map(({ key, label, minimumDays }) => {
            const disabled = rangeDays < minimumDays;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={group === key}
                aria-label={disabled ? `${label} grouping unavailable for ranges under ${minimumDays} days` : label}
                title={disabled ? `Choose a range of at least ${minimumDays} days to group by ${label.toLowerCase()}.` : undefined}
                disabled={disabled}
                className={group === key ? "is-active" : ""}
                onClick={() => onGroupChange(key)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
