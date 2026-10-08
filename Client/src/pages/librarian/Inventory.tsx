import { useState } from "react";
import Badge from "../../components/Badge";
import ConfirmDialog from "../../components/ConfirmDialog";
import DataTable, { type Column } from "../../components/DataTable";
import { useAuthedLibrary } from "../../context/LibraryContext";
import { useBusy } from "../../hooks/useBusy";
import { useLive } from "../../hooks/useLive";
import * as api from "../../services/api";
import * as lib from "../../services/librarian";
import type { ConditionStatus, CopyStatus } from "../../types";

// Physical copies only. A copy that is Borrowed can only change through Issue / Returns.
const MOVES: Partial<Record<CopyStatus, { to: CopyStatus; label: string }[]>> = {
  Available: [{ to: "Maintenance", label: "Send to maintenance" }, { to: "Lost", label: "Mark lost" }],
  Maintenance: [{ to: "Available", label: "Back to shelf" }, { to: "Lost", label: "Mark lost" }],
};

const CARD = "bg-[#FBFAF5] border border-[#D9DDD7] rounded-[14px] shadow-[0_1px_2px_rgba(11,61,50,0.05)]";
const LABEL = "text-xs uppercase tracking-[0.08em] text-[#6B756F] font-medium";
const STAT_VALUE = "font-['Playfair_Display',serif] text-[28px] text-[#0B3D32] mt-1.5 leading-[1.1]";
const PANEL_HEADER =
  "flex flex-wrap justify-between items-baseline gap-2 px-5 py-4 border-b border-[#D9DDD7] bg-[#DCE5D7]";
const PANEL_TITLE = "font-['Playfair_Display',serif] text-xl text-[#07352C] m-0";
const PANEL_NOTE = "mt-1 mb-0 text-sm text-[#6B756F]";
const TH = "text-left px-4 py-3 text-xs uppercase tracking-[0.06em] text-[#6B756F] font-medium bg-[#FBFAF5] border-b border-[#D9DDD7] whitespace-nowrap";
const TH_NUM = `${TH} !text-center`;
const TD = "px-4 py-3 border-b border-[#D9DDD7] text-sm text-[#1F2A27] align-middle";
const TD_NUM = `${TD} text-center tabular-nums`;

type Tally = { total: number; available: number; borrowed: number; maintenance: number; lost: number };

const emptyTally = (): Tally => ({ total: 0, available: 0, borrowed: 0, maintenance: 0, lost: 0 });

function tally(t: Tally, status: CopyStatus) {
  t.total += 1;
  if (status === "Available") t.available += 1;
  else if (status === "Borrowed") t.borrowed += 1;
  else if (status === "Maintenance") t.maintenance += 1;
  else if (status === "Lost") t.lost += 1;
}

// Subtle hierarchy: Available (sage, strong), Borrowed (forest), Maintenance (gold), Lost (error), zero values muted.
const TONES = {
  available: "bg-[#DCE5D7] text-[#0B3D32] border-[#6F9B78]",
  borrowed: "bg-[#F5F3EA] text-[#07352C] border-[#D9DDD7]",
  maintenance: "bg-[#F3EAD9] text-[#7A5A2C] border-[#D9C19A]",
  lost: "bg-[#F6E9E7] text-[#8A3B35] border-[#8A3B35]",
};

function Count({ value, tone }: { value: number; tone: keyof typeof TONES }) {
  if (value === 0) return <span className="text-[#6B756F]">0</span>;
  return (
    <span className={`inline-block min-w-7 px-2.5 py-0.5 rounded-full border font-semibold text-[13px] ${TONES[tone]}`}>
      {value}
    </span>
  );
}

export default function Inventory() {
  const { user, act } = useAuthedLibrary();
  const copies = useLive(() => lib.getCopyRows());
  const books = useLive(lib.getCatalogRows);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);
  const [bookId, setBookId] = useState("");
  const [accession, setAccession] = useState("");
  const [condition, setCondition] = useState<ConditionStatus>("Good");
  const [error, setError] = useState<string | null>(null);
  const [busy, wrap] = useBusy();

  const term = q.trim().toLowerCase();
  const rows = copies.filter((c) => (status === "all" || c.status === status) && (!term || c.book.toLowerCase().includes(term) || c.accessionNo.toLowerCase().includes(term)));

  // Totals are derived directly from the existing copy records.
  const overall = emptyTally();
  copies.forEach((c) => tally(overall, c.status));

  const perBook = new Map<string, Tally>();
  copies.forEach((c) => {
    if (term && !c.book.toLowerCase().includes(term) && !c.accessionNo.toLowerCase().includes(term)) return;
    if (!perBook.has(c.book)) perBook.set(c.book, emptyTally());
    tally(perBook.get(c.book)!, c.status);
  });
  const bookSummary = Array.from(perBook.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const add = wrap(async () => {
    const res = await act(api.addCopy(user.user_id, { bookId: Number(bookId), accessionNo: accession, condition }), "Copy added.");
    if (!res.ok) return setError(res.error);
    setAdding(false);
    setAccession("");
  });
  const move = (copyId: number, to: CopyStatus) => act(api.updateCopy(user.user_id, copyId, { status: to }), `Copy marked ${to}.`);
  const setCond = (copyId: number, c: ConditionStatus) => act(api.updateCopy(user.user_id, copyId, { condition_status: c }), "Condition updated.");

  const columns: Column<lib.CopyRow>[] = [
    { key: "accessionNo", label: "Copy ID" },
    { key: "book", label: "Book" },
    { key: "location", label: "Location" },
    {
      key: "condition",
      label: "Condition",
      render: (c) => (
        <select className="input" value={c.condition} onChange={(e) => setCond(c.id, e.target.value as ConditionStatus)} aria-label={`Condition of ${c.accessionNo}`}>
          <option>Good</option>
          <option>Damaged</option>
        </select>
      ),
    },
    { key: "status", label: "Status", render: (c) => <Badge status={c.status} /> },
    { key: "borrower", label: "Borrowed by" },
    {
      key: "actions",
      label: "",
      render: (c) => (
        <div className="row-actions">
          {(MOVES[c.status] ?? []).map((m) => (
            <button key={m.to} className="btn ghost sm" onClick={() => move(c.id, m.to)}>{m.label}</button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <>
      <span className="eyebrow">LIBRARIAN</span>
      <h1 className="page-title">Inventory</h1>
      <p className="text-[#6B756F] mt-1 mb-5 max-w-[640px] leading-relaxed">
        Track physical copies across the collection, review availability by title and manage individual copies.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-5">
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#0B3D32]`}>
          <div className={LABEL}>Total copies</div>
          <div className={STAT_VALUE}>{overall.total}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#6F9B78]`}>
          <div className={LABEL}>Available</div>
          <div className={STAT_VALUE}>{overall.available}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#07352C]`}>
          <div className={LABEL}>Borrowed</div>
          <div className={STAT_VALUE}>{overall.borrowed}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#B98A4A]`}>
          <div className={LABEL}>Maintenance</div>
          <div className={STAT_VALUE}>{overall.maintenance}</div>
        </div>
        <div className={`${CARD} px-5 py-[18px] border-l-4 border-l-[#8A3B35]`}>
          <div className={LABEL}>Lost</div>
          <div className={`${STAT_VALUE} ${overall.lost ? "!text-[#8A3B35]" : ""}`}>{overall.lost}</div>
        </div>
      </div>

      <div className={`toolbar ${CARD} px-[18px] py-3.5 mb-5 flex flex-wrap items-center gap-3`}>
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search book or copy ID…" />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option>Available</option>
          <option>Borrowed</option>
          <option>Maintenance</option>
          <option>Lost</option>
        </select>
        <button className="btn primary sm" onClick={() => { setAdding(true); setError(null); }}>Add copy</button>
      </div>

      <section className={`${CARD} overflow-hidden mb-6`}>
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE}>Stock by title</h2>
            <p className={PANEL_NOTE}>Copy counts for each book, based on current copy records.</p>
          </div>
          <span className="text-[13px] font-medium text-[#1F2A27]">
            {bookSummary.length} {bookSummary.length === 1 ? "title" : "titles"}
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[620px]">
            <thead>
              <tr>
                <th className={TH}>Book</th>
                <th className={TH_NUM}>Total</th>
                <th className={TH_NUM}>Available</th>
                <th className={TH_NUM}>Borrowed</th>
                <th className={TH_NUM}>Maintenance</th>
                <th className={TH_NUM}>Lost</th>
              </tr>
            </thead>
            <tbody>
              {bookSummary.length === 0 && (
                <tr>
                  <td className={`${TD} text-center !text-[#6B756F]`} colSpan={6}>No copies match.</td>
                </tr>
              )}
              {bookSummary.map(([title, t]) => (
                <tr key={title}>
                  <td className={`${TD} font-medium`}>{title}</td>
                  <td className={`${TD_NUM} font-semibold !text-[#0B3D32]`}>{t.total}</td>
                  <td className={TD_NUM}><Count value={t.available} tone="available" /></td>
                  <td className={TD_NUM}><Count value={t.borrowed} tone="borrowed" /></td>
                  <td className={TD_NUM}><Count value={t.maintenance} tone="maintenance" /></td>
                  <td className={TD_NUM}><Count value={t.lost} tone="lost" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${CARD} overflow-hidden`}>
        <header className={PANEL_HEADER}>
          <div>
            <h2 className={PANEL_TITLE}>Physical copies</h2>
            <p className={PANEL_NOTE}>Update condition or move individual copies. Borrowed copies change through Issue and Returns.</p>
          </div>
          <span className="text-[13px] font-medium text-[#1F2A27]">
            {rows.length} {rows.length === 1 ? "copy" : "copies"}
          </span>
        </header>
        <div className="overflow-x-auto">
          <DataTable columns={columns} rows={rows} empty="No copies match." />
        </div>
      </section>

      {adding && (
        <ConfirmDialog title="Add a physical copy" confirmLabel="Add copy" busy={busy} onConfirm={add} onClose={() => setAdding(false)}>
          <label className="field">
            <span>Book</span>
            <select value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">Choose…</option>
              {books.filter((b) => b.status === "Active").map((b) => <option key={b.book_id} value={b.book_id}>{b.title}</option>)}
            </select>
          </label>
          <div className="row">
            <label className="field"><span>Accession / barcode</span><input value={accession} onChange={(e) => setAccession(e.target.value)} /></label>
            <label className="field">
              <span>Condition</span>
              <select value={condition} onChange={(e) => setCondition(e.target.value as ConditionStatus)}>
                <option>Good</option>
                <option>Damaged</option>
              </select>
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
        </ConfirmDialog>
      )}
    </>
  );
}