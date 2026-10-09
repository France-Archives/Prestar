import { Link } from "react-router-dom";
import Logo from "../components/Logo";

// PLACEHOLDER LANDING PAGE: replace with the real landing page (design document, Part 4.1).
export default function Landing() {
  return (
    <main className="auth-page relative flex min-h-screen flex-col overflow-hidden bg-[#F5F3EA] font-sans text-[#1F2A27]">
      <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-[#DCE5D7]/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[460px] w-[460px] rounded-full bg-[#D9C19A]/40 blur-3xl" />

      <header className="auth-top relative z-10 mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-5 sm:px-6 sm:py-6 lg:px-12">
        <div className="font-serif text-[#0B3D32]">
          <Logo />
        </div>
        <Link
          to="/login"
          className="muted-link rounded-[10px] px-4 py-2 font-sans text-[13px] font-medium text-[#0B3D32] transition-colors duration-200 hover:bg-[#DCE5D7] hover:text-[#07352C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78]"
        >
          Log in
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-1 items-center px-4 pb-16 pt-6 sm:px-6 sm:pb-24 lg:px-12">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="plain-card animate-[rise_0.6s_cubic-bezier(.22,.8,.3,1)_both]">
            <span className="mb-4 inline-flex items-center gap-2 font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">
              <span className="h-px w-8 bg-[#B98A4A]" />
              University Library
            </span>
            <h1 className="font-serif text-[clamp(38px,6.5vw,68px)] font-medium leading-[1.05] tracking-[-0.01em] text-[#0B3D32]">
              Find it. Reserve it. Borrow it.
            </h1>
            <p className="mt-5 max-w-[48ch] font-sans text-[16px] leading-relaxed text-[#6B756F] sm:text-[17px]">
              PRESTAR is your university library, online.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="btn primary inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-[#0B3D32] px-8 font-sans text-[14px] font-medium text-white shadow-[0_6px_14px_rgba(11,61,50,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07352C] hover:shadow-[0_10px_22px_rgba(11,61,50,0.28)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto"
                to="/signup"
              >
                Create account
              </Link>
              <Link
                className="btn ghost inline-flex h-12 w-full items-center justify-center rounded-[10px] border border-[#D9DDD7] bg-[#FBFAF5] px-8 font-sans text-[14px] font-medium text-[#0B3D32] transition-all duration-200 hover:border-[#6F9B78] hover:bg-white active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6F9B78] sm:w-auto"
                to="/login"
              >
                Log in
              </Link>
            </div>
          </div>

          <div className="relative mx-auto hidden h-[420px] w-full max-w-[420px] lg:block" aria-hidden="true">
            <div className="absolute left-2 top-10 h-[300px] w-[200px] -rotate-6 rounded-[14px] bg-[#0B3D32] shadow-[0_24px_48px_rgba(7,53,44,0.3)] transition-transform duration-500 hover:-rotate-3">
              <div className="m-4 h-[calc(100%-32px)] rounded-[8px] border border-[#B98A4A]/60 p-4">
                <div className="h-px w-10 bg-[#B98A4A]" />
                <p className="mt-3 font-serif text-[18px] leading-tight text-[#F5F3EA]">Library</p>
              </div>
            </div>
            <div className="absolute left-[130px] top-0 h-[300px] w-[200px] rotate-3 rounded-[14px] bg-[#6F9B78] shadow-[0_24px_48px_rgba(7,53,44,0.25)] transition-transform duration-500 hover:rotate-1">
              <div className="m-4 h-[calc(100%-32px)] rounded-[8px] border border-[#FBFAF5]/50 p-4">
                <div className="h-px w-10 bg-[#FBFAF5]" />
                <p className="mt-3 font-serif text-[18px] leading-tight text-[#FBFAF5]">Reserve</p>
              </div>
            </div>
            <div className="absolute bottom-6 left-6 h-[160px] w-[190px] rotate-[-2deg] rounded-[14px] border border-[#D9DDD7] bg-[#FBFAF5] p-5 shadow-[0_12px_30px_rgba(7,53,44,0.12)]">
              <p className="font-sans text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#B98A4A]">Borrow</p>
              <p className="mt-2 font-serif text-[20px] leading-tight text-[#0B3D32]">Your next read is waiting</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[4px] rounded-full bg-[#D9C19A]/80" />
          </div>
        </div>
      </section>
    </main>
  );
}