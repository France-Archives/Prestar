import { useState } from "react";
import Button from "@/components/common/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import Tabs from "@/components/ui/Tabs";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as librarianService from "@/services/librarianService";
import type { ReturnResult, StaffLoan } from "@/types";
import { formatDate } from "@/utils/formatDate";
import { USE_MOCKS } from "@/utils/constants";
import ReturnConditionForm from "../components/ReturnConditionForm";
import Alert from "@/components/feedback/Alert";

type Tab = "active" | "overdue" | "closed";
type Dialog = { kind: "return" | "lost"; loan: StaffLoan } | null;

export default function ReturnsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const list = useAsync(() => librarianService.listStaffLoans(), []);

  const all = list.data ?? [];
  const needle = search.trim().toLocaleLowerCase();
  const matching = all.filter((loan) => (
    `${loan.student.firstName} ${loan.student.lastName}`.toLocaleLowerCase().includes(needle)
    || loan.student.studentNumber.toLocaleLowerCase().includes(needle)
  ));
  const active = matching.filter((l) => l.status === "ACTIVE");
  const overdue = active.filter((l) => l.overdueDays > 0);
  const closed = matching.filter((l) => l.status !== "ACTIVE");
  const rows = tab === "active" ? active : tab === "overdue" ? overdue : closed;
  const groups = new Map<string, StaffLoan[]>();
  for (const loan of rows) {
    const key = loan.student.id || loan.student.studentNumber;
    groups.set(key, [...(groups.get(key) ?? []), loan]);
  }
  const onReturned = (r: ReturnResult) => {
    const where =
      r.offeredToReservationId !== null
        ? "The copy was offered to the next student in the queue."
        : r.copyStatus === "AVAILABLE"
          ? "The copy is back on the shelf."
          : r.copyStatus === "MAINTENANCE"
            ? "The copy was sent to maintenance."
            : "The copy was withdrawn.";
    toast.success(`Return recorded. ${where}`);
    void list.reload();
  };

  return (
    <div className="page">
      <PageHero eyebrow="Circulation" title="Returns and loans" description="Confirm returns and record the copy condition. Returns are never blocked by overdue, fines or suspension. Overdue never becomes lost by itself." leading={<BackButton fallback={ROUTES.staff.dashboard} />} compact />
      {!USE_MOCKS && <Alert kind="info">Returning and marking copies as lost isn't available yet. You can still search students and view loan details.</Alert>}
      <div className="toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search student number or name…" />
      </div>
      <Tabs<Tab>
        tabs={[
          { key: "active", label: "Active loans", count: active.length },
          { key: "overdue", label: "Overdue", count: overdue.length },
          { key: "closed", label: "Closed", count: closed.length },
        ]}
        active={tab}
        onChange={setTab}
      />
      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="stack">
          {groups.size === 0 ? <p className="card card-pad subtle">No loans here.</p> : [...groups.entries()].map(([studentKey, loans]) => {
            const student = loans[0].student;
            const expanded = expandedStudent === studentKey;
            return (
              <section className="card" key={studentKey}>
                <button
                  type="button"
                  className="card-pad"
                  aria-expanded={expanded}
                  onClick={() => setExpandedStudent(expanded ? null : studentKey)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, textAlign: "left", background: "transparent", border: 0, cursor: "pointer" }}
                >
                  <span>
                    <strong>{student.firstName} {student.lastName}</strong>
                    <span className="subtle" style={{ display: "block" }}>Student number: {student.studentNumber}</span>
                  </span>
                  <span className="badge badge-neutral">{loans.length} loan{loans.length === 1 ? "" : "s"}</span>
                </button>
                {expanded && (
                  <div className="stack card-pad" style={{ paddingTop: 0 }}>
                    {loans.map((loan) => (
                      <article className="card card-pad stack" key={loan.id}>
                        <div>
                          <strong>{loan.bookTitle}</strong>
                          <p className="subtle">Copy {loan.copyBarcode} · Borrowed {formatDate(loan.borrowedAt)} · Due {formatDate(loan.dueAt)}</p>
                          <p className="subtle">{loan.status === "ACTIVE" ? loan.overdueDays > 0 ? `${loan.overdueDays} days overdue` : "Active loan" : `${loan.status.toLowerCase()} loan`}</p>
                        </div>
                        {loan.status === "ACTIVE" && (
                          <div className="row-actions">
                            <Button size="sm" onClick={() => setDialog({ kind: "return", loan })}>Return</Button>
                            {USE_MOCKS && <Button variant="ghost" size="sm" onClick={() => setDialog({ kind: "lost", loan })}>Mark lost</Button>}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {dialog?.kind === "return" && <ReturnConditionForm loan={dialog.loan} onClose={() => setDialog(null)} onDone={onReturned} />}
      {dialog?.kind === "lost" && (
        <ConfirmDialog
          title={`Mark ${dialog.loan.bookTitle} lost?`}
          message={`This marks copy ${dialog.loan.copyBarcode} lost and records the lost-book fine for ${dialog.loan.student.firstName} ${dialog.loan.student.lastName}.`}
          details={[
            { label: "Book", value: dialog.loan.bookTitle },
            { label: "Student", value: `${dialog.loan.student.firstName} ${dialog.loan.student.lastName}` },
            { label: "Copy", value: dialog.loan.copyBarcode },
            { label: "Fine", value: "₱500 lost-book fine" },
          ]}
          variant="destructive"
          confirmLabel="Mark as lost"
          reasonLabel="Notes (confirm you spoke with the student)"
          onClose={() => setDialog(null)}
          onConfirm={async (notes) => {
            await librarianService.markLoanLost(dialog.loan.id, { notes });
            toast.success("Loan marked lost. A ₱500 lost-book fine was recorded.");
            await list.reload();
          }}
        />
      )}
    </div>
  );
}