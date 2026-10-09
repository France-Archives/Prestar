// System Activity: derived from the existing who/when columns. There is no audit_logs table.
import { useState } from "react";
import DataTable, { type Column } from "../../components/DataTable";
import { useLive } from "../../hooks/useLive";
import { activityFeed, type ActivityEvent, type ActivityKind } from "../../services/reports";

const KINDS: ActivityKind[] = ["Lending", "Returns", "Requests", "Penalties", "Suspensions", "Signups"];

// Semantic tone per activity type (PRESTAR palette).
const TONES: Record<string, { chip: string; rail: string }> = {
  Lending: { chip: "bg-[#DCE5D7] text-[#0B3D32] border-[#6F9B78]", rail: "border-l-[#0B3D32]" },
  Returns: { chip: "bg-[#DCE5D7] text-[#0B3D32] border-[#6F9B78]", rail: "border-l-[#6F9B78]" },
  Requests: { chip: "bg-[#F5F3EA] text-[#07352C] border-[#D9DDD7]", rail: "border-l-[#D9C19A]" },
  Penalties: { chip: "bg-[#F3EAD9] text-[#7A5A2C] border-[#D9C19A]", rail: "border-l-[#B98A4A]" },
  Suspensions: { chip: "bg-[#F6E9E7] text-[#8A3B35] border-[#8A3B35]", rail: "border-l-[#8A3B35]" },
  Signups: { chip: "bg-[#F5F3EA] text-[#07352C] border-[#D9C19A]", rail: "border-l-[#07352C]" },
};
const FALLBACK = { chip: "bg-[#F5F3EA] text-[#07352C] border-[#D9DDD7]", rail: "border-l-[#D9DDD7]" };

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const PANEL_HEADER =
  "flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]";
const PANEL_TITLE = "font-['Playfair_Display',serif] text-xl text-[#07352C] m-0";
const PANEL_NOTE = "mt-1 mb-0 text-sm text-[#6B756F]";
const PAGE = 15;

function KindChip({ kind }: { kind: string }) {
  const tone = TONES[kind] ?? FALLBACK;
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${tone.chip}`}
    >
      {kind}
    </span>
  );
}

const COLUMNS: Column<ActivityEvent>[] = [
  { key: "when", label: "When" },
  { key: "who", label: "Who" },
  { key: "kind", label: "Type", render: (e) => <KindChip kind={String(e.kind)} /> },
  { key: "text", label: "What happened" },
];

export default function Activity() {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  const feed = useLive(activityFeed);
  const term = q.trim().toLowerCase();
  const rows = feed.filter((e) => (kind === "all" || e.kind === kind) && (!term || `${e.who} ${e.text}`.toLowerCase().includes(term)));
  const hasFilters = Boolean(term || kind !== "all");

  return (
    <>
      <span className="eyebrow">ADMIN</span>
      <h1 className="page-title">System Activity</h1>
      <p className="text-[#6B756F] mt-1 mb-5 max-w-[680px] leading-relaxed">
        A running record of lending, returns, requests, penalties, suspensions and signups across the library.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {KINDS.map((k) => {
          const n = feed.filter((e) => e.kind === k).length;
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(active ? "all" : k);
                setShown(PAGE);
              }}
              aria-pressed={active}
              className={`${CARD} ${(TONES[k] ?? FALLBACK).rail} border-l-4 text-left cursor-pointer px-4 py-3.5 transition-colors hover:bg-[#F5F3EA] ${
                active ? "!border-[#0B3D32] ring-1 ring-[#0B3D32]" : ""
              }`}
            >
              <div className={LABEL}>{k}</div>
              <div className="font-['Playfair_Display',serif] text-2xl text-[#0B3D32] mt-1 leading-none">{n}</div>
            </button>
          );
        })}
      </div>

      <div className={`toolbar ${CARD} px-[18px] py-3.5 mb-5 flex flex-wrap items-center gap-3`}>
        <input
          className="input grow"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search by person or action…"
        />
        <select
          className="input"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setShown(PAGE);
          }}
        >
          <option value="all">All types</option>
          {KINDS.map((k) => <option key={k}>{k}</option>)}
        </select>
      </div>

      <section className={`${CARD} overflow-hidden`}>
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE}>Activity log</h2>
            <p className={PANEL_NOTE}>Most recent events first, as recorded by the system.</p>
          </div>
          <span className="text-[13px] font-medium text-[#1F2A27]">
            {rows.length} {rows.length === 1 ? "event" : "events"}
            {hasFilters ? " (filtered)" : ""}
          </span>
        </header>

        {/* Desktop and tablet: audit table */}
        <div className="hidden md:block overflow-x-auto">
          <DataTable columns={COLUMNS} rows={rows} pageSize={15} empty="No activity yet." />
        </div>

        {/* Mobile: timeline */}
        <div className="md:hidden px-4 py-4">
          {rows.length === 0 ? (
            <p className="muted text-center py-6 m-0">No activity yet.</p>
          ) : (
            <ol className="list-none m-0 p-0 grid gap-3">
              {rows.slice(0, shown).map((e) => (
                <li
                  key={e.id}
                  className={`bg-[#FBFAF5] border border-[#D9DDD7] border-l-4 ${(TONES[String(e.kind)] ?? FALLBACK).rail} rounded-[12px] px-4 py-3`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <b className="font-['Playfair_Display',serif] text-base text-[#0B3D32] leading-snug">{e.who}</b>
                    <KindChip kind={String(e.kind)} />
                  </div>
                  <p className="mt-1.5 mb-0 text-sm text-[#1F2A27] leading-normal">{e.text}</p>
                  <div className="mt-2 pt-2 border-t border-[#D9DDD7] text-[13px] text-[#6B756F]">{e.when}</div>
                </li>
              ))}
            </ol>
          )}
          {rows.length > shown && (
            <div className="text-center mt-4">
              <button className="btn ghost sm" onClick={() => setShown(shown + PAGE)}>
                Show more ({rows.length - shown} remaining)
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}