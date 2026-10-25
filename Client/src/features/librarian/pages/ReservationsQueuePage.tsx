import { useState } from "react";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import Tabs from "@/components/ui/Tabs";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as reservationsService from "@/services/reservationsService";
import ReservationQueue from "../components/ReservationQueue";

type Tab = "active" | "closed";

export default function ReservationsQueuePage() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const list = useAsync(() => reservationsService.listStaffReservations({ search: search || undefined }), [search]);

  const all = list.data ?? [];
  const active = all.filter((r) => r.status === "WAITING" || r.status === "OFFERED");
  const closed = all.filter((r) => r.status !== "WAITING" && r.status !== "OFFERED");

  return (
    <div className="page">
      <PageHero eyebrow="Circulation" title="Reservations queue" description="First-in, first-out by reservation time. An offered copy is held for 3 days, then passed to the next eligible student." leading={<BackButton fallback={ROUTES.staff.dashboard} />} compact />
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
          <ReservationQueue rows={tab === "active" ? active : closed} />
        </div>
      )}
    </div>
  );
}