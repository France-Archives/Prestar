import { useState } from "react";
import Tabs from "@/components/ui/Tabs";
import PageHero from "@/components/layout/PageHero";
import BackButton from "@/components/navigation/BackButton";
import { ROUTES } from "@/app/routeConfig";
import FinesManagementPage from "@/features/librarian/pages/FinesManagementPage";
import PaymentRecordingPage from "@/features/librarian/pages/PaymentRecordingPage";

type Tab = "fines" | "payments";

// Admin can assess fines, record payments (in person) and waive fines (Admin only, audited).
export default function FinesAndPaymentsPage() {
  const [tab, setTab] = useState<Tab>("fines");
  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <PageHero eyebrow="System" title="Fines and payments" description="No online payments exist: payments are made in person and recorded by staff." leading={<BackButton fallback={ROUTES.admin.dashboard} />} compact />
        <Tabs<Tab> tabs={[{ key: "fines", label: "Fines" }, { key: "payments", label: "Payment recording" }]} active={tab} onChange={setTab} />
      </div>
      {tab === "fines" ? <FinesManagementPage /> : <PaymentRecordingPage />}
    </>
  );
}