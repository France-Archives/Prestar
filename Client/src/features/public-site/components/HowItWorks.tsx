import { BookOpen, FileText, Landmark, RefreshCw, User, type LucideIcon } from "lucide-react";
import "../styles/landing.css";

const STEPS: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Sign up and verify", text: "Create a student account and verify your email.", icon: User },
  { title: "Submit your COR", text: "Upload your Certificate of Registration each term. Staff review it.", icon: FileText },
  { title: "Request or reserve", text: "Eligible requests are approved automatically when a copy is available. Otherwise join the queue.", icon: BookOpen },
  { title: "Pick up at the library", text: "Staff check eligibility and hand the book over. That is when the loan starts.", icon: Landmark },
  { title: "Return and renew", text: "Renew when nobody is waiting. Staff confirm returns, and fines are paid in person.", icon: RefreshCw },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="land-screen land-how">
      <span className="land-eyebrow">How it works</span>
      <h2>A simpler way to borrow books</h2>
      <p className="land-how__lead">From browsing to pick up, here is how PRESTAR works.</p>
      <ol className="land-steps">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="land-step">
              <span className="land-step__num">{String(i + 1).padStart(2, "0")}</span>
              <span className="land-step__icon">
                <Icon size={26} aria-hidden="true" />
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}