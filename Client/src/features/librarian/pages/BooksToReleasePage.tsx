import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorState from "@/components/feedback/ErrorState";
import LoadingState from "@/components/feedback/LoadingState";
import SearchInput from "@/components/forms/SearchInput";
import PageHeader from "@/components/layout/PageHeader";
import { ROUTES } from "@/app/routeConfig";
import { useAsync } from "@/hooks/useAsync";
import * as librarianService from "@/services/librarianService";
import RequestQueueTable from "../components/RequestQueueTable";

export default function BooksToReleasePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const list = useAsync(() => librarianService.listBooksToRelease({ search: search || undefined }), [search]);

  return (
    <div className="page">
      <PageHeader eyebrow="Circulation" title="Books to Release" description="Approved requests and held pickups. Open one to check penalties and confirm the handover. A request is not a loan until you confirm." />
      <div className="toolbar" style={{ marginTop: 0 }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search student, number, book or barcode…" />
      </div>
      {list.loading ? (
        <LoadingState rows={4} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={() => void list.reload()} />
      ) : (
        <div className="card">
          <RequestQueueTable rows={list.data ?? []} onOpen={(r) => navigate(ROUTES.staff.handover(r.requestId))} />
        </div>
      )}
    </div>
  );
}