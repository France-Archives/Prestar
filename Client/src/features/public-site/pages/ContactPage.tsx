import Alert from "@/components/feedback/Alert";

// PLACEHOLDER contact details: replace with the library's real information.
export default function ContactPage() {
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1>Contact the library</h1>
      <div className="stack" style={{ marginTop: 16 }}>
        <Alert kind="info">These details are placeholders until the library provides its real contact information.</Alert>
        <dl className="kv card card-pad">
          <div><dt>Visit</dt><dd>Main Library, University campus (hours to be confirmed)</dd></div>
          <div><dt>Email</dt><dd>library@university.edu (placeholder)</dd></div>
          <div><dt>Phone</dt><dd>To be confirmed</dd></div>
        </dl>
        <p className="subtle">Fines, returns and book pickups are handled in person at the library desk.</p>
      </div>
    </div>
  );
}