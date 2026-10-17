import { PrivacyContent } from "@/features/auth/components/LegalContent";

export default function PrivacyPage() {
  return (
    <div className="page" style={{ maxWidth: 780 }}>
      <h1>Privacy</h1>
      <div style={{ marginTop: 16 }}>
        <PrivacyContent />
      </div>
    </div>
  );
}