import { useState } from "react";
import { Link } from "react-router-dom";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Tabs from "@/components/ui/Tabs";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { useToast } from "@/hooks/useToast";
import * as reservationsService from "@/services/reservationsService";
import type { Reservation } from "@/types";
import ReservationStatus from "../components/ReservationStatus";

type Tab = "active" | "closed";

export default function MyReservationsPage() {
  const toast = useToast();
  const list = useAsync(() => reservationsService.listMyReservations(), []);
  const [tab, setTab] = useState<Tab>("active");
  const [target, setTarget] = useState<Reservation | null>(null);

  const rows = list.data ?? [];
  const active = rows.filter((r) => r.status === "WAITING" || r.status === "OFFERED");
  const closed = rows.filter((r) => r.status !== "WAITING" && r.status !== "OFFERED");
  const shown = tab === "active" ? active : closed;

  const cancel = async () => {
    if (!target) return;
    await reservationsService.cancelMyReservation(target.id);
    toast.success("Reservation cancelled.");
    await list.reload();
  };

  return (
    <div className="page">
      <PageHeader eyebrow="Student" title="Reservations" description="Reservations are first-in, first-out and exist only when no copy is available. An offered copy is held for 3 days." />
      <Tabs<Tab> tabs={[{ key: "active", label: "Active", count: active.length }, { key: "closed", label: "Closed", count: closed.length }]} active={tab} onChange={setTab} />
      {list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : shown.length === 0 ? (
        <EmptyState title="No reservations here" text="Reserve a book when every copy is out." action={<Link to={ROUTES.student.books} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>Browse books</Link>} />
      ) : (
        <div className="stack">{shown.map((r) => <ReservationStatus key={r.id} reservation={r} onCancel={setTarget} />)}</div>
      )}
      {target && (
        <ConfirmDialog title="Cancel this reservation?" danger confirmLabel="Cancel reservation" onConfirm={cancel} onClose={() => setTarget(null)}>
          <p>{target.bookTitle}: you will lose your place in the queue{target.status === "OFFERED" ? " and the held copy will be passed on" : ""}.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}