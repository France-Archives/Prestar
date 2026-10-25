import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import EmptyState from "@/components/feedback/EmptyState";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import Tabs from "@/components/ui/Tabs";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import { matchesSearch, useSearchTerm } from "@/hooks/useSearchTerm";
import { useToast } from "@/hooks/useToast";
import * as reservationsService from "@/services/reservationsService";
import type { Reservation } from "@/types";
import { statusLabel } from "@/utils/constants";
import ReservationStatus from "../components/ReservationStatus";

type Tab = "active" | "closed";

export default function MyReservationsPage() {
  const toast = useToast();
  const list = useAsync(() => reservationsService.listMyReservations(), []);
  const [q] = useSearchTerm(); // from the navbar search box (?q=)
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("active");
  const [target, setTarget] = useState<Reservation | null>(null);
  const reservationId = searchParams.get("reservationId");

  useEffect(() => {
    const reservation = list.data?.find((r) => r.id === reservationId);
    if (!reservation) return;
    setTab(reservation.status === "WAITING" || reservation.status === "OFFERED" ? "active" : "closed");
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`reservation-${reservation.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reservationId, list.data]);

  // Search runs on the loaded reservations; the tab counts follow the search.
  const rows = (list.data ?? []).filter((r) => r.id === reservationId || matchesSearch(q, r.bookTitle, statusLabel(r.status)));
  const active = rows.filter((r) => r.status === "WAITING" || r.status === "OFFERED");
  const closed = rows.filter((r) => r.status !== "WAITING" && r.status !== "OFFERED");
  const shown = tab === "active" ? active : closed;
  const searching = Boolean(q.trim());

  const cancel = async () => {
    if (!target) return;
    await reservationsService.cancelMyReservation(target.id);
    toast.success("Reservation cancelled.");
    await list.reload();
  };

  return (
    <div className="page">
      <PageHero eyebrow="Student" title="Reservations" description="Reservations are first-in, first-out and exist only when no copy is available. An offered copy is held for 3 days." leading={<BackButton fallback={ROUTES.student.dashboard} />} />
      <Tabs<Tab> tabs={[{ key: "active", label: "Active", count: active.length }, { key: "closed", label: "Closed", count: closed.length }]} active={tab} onChange={setTab} />
      {list.loading ? (
        <LoadingState rows={3} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : shown.length === 0 ? (
        <EmptyState
          title={searching ? "No reservations match your search" : "No reservations here"}
          text={searching ? "Clear the search box or check the other tab." : "Reserve a book when every copy is out."}
          action={<Link to={ROUTES.student.books} className="btn btn-primary" style={{ textDecoration: "none", color: "#fff" }}>Browse books</Link>}
        />
      ) : (
        <div className="stack">{shown.map((r) => <ReservationStatus key={r.id} reservation={r} onCancel={setTarget} highlighted={r.id === reservationId} />)}</div>
      )}
      {target && (
        <ConfirmDialog
          title={`Cancel your reservation for ${target.bookTitle}?`}
          message={`You will lose your place in the queue${target.status === "OFFERED" ? " and the held copy will be passed on" : ""}.`}
          details={[{ label: "Book", value: target.bookTitle }, { label: "Status", value: statusLabel(target.status) }]}
          variant="destructive"
          confirmLabel="Cancel reservation"
          onConfirm={cancel}
          onClose={() => setTarget(null)}
        >
        </ConfirmDialog>
      )}
    </div>
  );
}