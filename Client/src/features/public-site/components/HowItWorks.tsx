import "../styles/landing.css";

const STEPS = [
  { title: "Sign up and verify", text: "Create a student account and verify your email." },
  { title: "Submit your COR", text: "Upload your Certificate of Registration each term. Staff review it." },
  { title: "Request or reserve", text: "Eligible requests are approved automatically when a copy is available. Otherwise join the queue." },
  { title: "Pick up at the library", text: "Staff check eligibility and hand the book over. That is when the loan starts." },
  { title: "Return and renew", text: "Renew when nobody is waiting. Staff confirm returns, and fines are paid in person." },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-8">
      <h2 style={{ fontSize: "1.6rem", marginBottom: 24 }}>How it works</h2>
      <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 22 }}>
        {STEPS.map((s, i) => (
          <article key={s.title} className="card card-pad step-card">
            <span className="num">{i + 1}</span>
            <h3>{s.title}</h3>
            <p className="subtle" style={{ marginTop: 6 }}>
              {s.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}