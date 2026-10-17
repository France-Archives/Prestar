import { TermsContent } from "@/features/auth/components/LegalContent";

export default function TermsPage() {
  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <h1>Terms of use</h1>
      <div style={{ marginTop: 16 }}>
        <TermsContent />
      </div>
    </div>
  );
}