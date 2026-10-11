import { useState } from "react";
import Alert from "@/components/feedback/Alert";
import Button from "@/components/common/Button";
import ErrorState from "@/components/feedback/ErrorState";
import { InputField, SelectField } from "@/components/forms/FormField";
import LoadingState from "@/components/feedback/LoadingState";
import Modal from "@/components/ui/Modal";
import SearchInput from "@/components/forms/SearchInput";
import Tabs from "@/components/ui/Tabs";
import PageHeader from "@/components/layout/PageHeader";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as reservationsService from "@/services/reservationsService";
import type { AllowedDurationDays, StaffReservation } from "@/types";
import { describeError } from "@/utils/errors";
import ReservationQueue from "../components/ReservationQueue";

type Tab = "active" | "closed";
const DURATIONS: AllowedDurationDays[] = [3, 7, 14, 21, 30, 60];

function ClaimDialog({ reservation, onClose, onDone }: { reservation: StaffReservation; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [barcode, setBarcode] = useState("");
  const [days, setDays] = useState<AllowedDurationDays>(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!barcode.trim()) return setError("Scan or enter the copy barcode.");
    setBusy(true);
    setError(null);
    try {
      await reservationsService.claimReservation(reservation.id, { copyBarcode: barcode.trim(), durationDays: days });
      toast.success("Handover confirmed. The loan has started.");
      onDone();
      onClose();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Hand over reserved copy"
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Confirm handover
          </Button>
        </>
      }
    >
      <p>
        <b>{reservation.bookTitle}</b> for {reservation.student.firstName} {reservation.student.lastName}. Held copy: {reservation.offeredCopy?.barcode ?? "—"}.
      </p>
      <InputField label="Copy barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
      <SelectField label="Loan duration" hint="Where the duration comes from for reservations is TO CONFIRM (TC-12), so staff choose it here." value={days} onChange={(e) => setDays(Number(e.target.value) as AllowedDurationDays)}>
        {DURATIONS.map((d) => (
          <option key={d} value={d}>
            {d} days
          </option>
        ))}
      </SelectField>
      <Alert kind="info">Eligibility is checked again when you confirm.</Alert>
      {error && <Alert kind="error">{error}</Alert>}
    </Modal>
  );
}

export default function ReservationsQueuePage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [claiming, setClaiming] = useState<StaffReservation | null>(null);
  const list = useAsync(() => reservationsService.listStaffReservations({ search: search || undefined }), [search]);

  const all = list.data ?? [];
  const active = all.filter((r) => r.status === "WAITING" || r.status === "OFFERED");
  const closed = all.filter((r) => r.status !== "WAITING" && r.status !== "OFFERED");

  return (
    <div className="page">
      <PageHeader eyebrow="Circulation" title="Reservations queue" description="First-in, first-out by reservation time. An offered copy is held for 3 days, then passed to the next eligible student." />
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search book, student or number…" />
      </div>
      <Tabs<Tab> tabs={[{ key: "active", label: "Active", count: active.length }, { key: "closed", label: "Closed", count: closed.length }]} active={tab} onChange={setTab} />
      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <ReservationQueue rows={tab === "active" ? active : closed} onClaim={tab === "active" ? setClaiming : undefined} />
        </div>
      )}
      {claiming && <ClaimDialog reservation={claiming} onClose={() => setClaiming(null)} onDone={() => void list.reload()} />}
    </div>
  );
}