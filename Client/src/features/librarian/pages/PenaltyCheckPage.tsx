import { useState } from "react";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import StatusBadge from "@/components/data-display/StatusBadge";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import * as librarianService from "@/services/librarianService";
import PenaltySummary from "../components/PenaltySummary";

// F3 GET /staff/students/:studentId/penalty-check. The result is computed live by the backend.
export default function PenaltyCheckPage() {
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const students = useAsync(() => librarianService.listStudents({ search: search || undefined }), [search]);
  const check = useAsync(() => (studentId ? librarianService.getPenaltyCheck(studentId) : Promise.resolve(null)), [studentId]);

  return (
    <div className="page">
      <PageHeader eyebrow="Circulation" title="Check Penalties" description="Look up a student and run a live eligibility check: account, email, COR, overdue loans, unpaid fines and commitments." />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card title="Students">
          <div className="stack" style={{ gap: 10 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Name, number or email…" label="Search students" />
            {students.loading ? (
              <LoadingState rows={3} />
            ) : students.error ? (
              <ErrorState message={students.error} onRetry={() => void students.reload()} />
            ) : (
              <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 6, maxHeight: 420, overflowY: "auto" }}>
                {(students.data ?? []).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setStudentId(s.id)}
                      className="card"
                      aria-pressed={studentId === s.id}
                      style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderLeft: studentId === s.id ? "4px solid var(--color-forest)" : undefined }}
                    >
                      <b>{s.firstName} {s.lastName}</b> <StatusBadge status={s.accountStatus} />
                      <span className="subtle" style={{ display: "block" }}>{s.studentNumber} · {s.program ?? "No program"}</span>
                    </button>
                  </li>
                ))}
                {(students.data ?? []).length === 0 && <li className="subtle">No students match.</li>}
              </ul>
            )}
          </div>
        </Card>
        <Card title="Result">
          {!studentId ? (
            <p className="subtle">Choose a student to run the check.</p>
          ) : check.loading ? (
            <LoadingState rows={3} />
          ) : check.error || !check.data ? (
            <ErrorState message={check.error ?? "No result."} onRetry={() => void check.reload()} />
          ) : (
            <PenaltySummary check={check.data} />
          )}
        </Card>
      </div>
    </div>
  );
}