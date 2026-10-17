import HeroSection from "../components/HeroSection";
import HowItWorks from "../components/HowItWorks";
import FeaturedBooks from "../components/FeaturedBooks";
import WhyPrestar from "../components/WhyPrestar";
import TestimonialsSection from "../components/TestimonialsSection";
import FAQSection from "../components/FAQSection";
import CTABanner from "../components/CTABanner";
import SnapLanding from "../components/SnapLanding";

// Screen order for snap scroll and dot navigation
// Each id must match the id= attribute on the corresponding section element
const SNAP_SECTIONS = [
  { id: "snap-hero",         label: "Hero" },
  { id: "snap-books",        label: "Browse the collection" },
  { id: "snap-how",          label: "How it works" },
  { id: "snap-why",          label: "Why PRESTAR" },
  { id: "snap-testimonials", label: "Student testimonials" },
  { id: "snap-faq",          label: "FAQ" },
  { id: "snap-cta",          label: "Get started" },
];

export default function LandingPage() {
  return (
    <SnapLanding sections={SNAP_SECTIONS}>
      {/* Screen 1: Hero (includes stats row inside HeroSection) */}
      <div id="snap-hero" className="snap-screen">
        <HeroSection />
      </div>

      {/* Screen 2: Browse the collection */}
      <div id="snap-books" className="snap-screen">
        <FeaturedBooks />
      </div>

      {/* Screen 3: How it works */}
      <div id="snap-how" className="snap-screen snap-screen--dark">
        <HowItWorks />
      </div>

      {/* Screen 4: Why PRESTAR */}
      <div id="snap-why" className="snap-screen snap-screen--mist">
        <WhyPrestar />
      </div>

      {/* Screen 5: Testimonials */}
      <div id="snap-testimonials" className="snap-screen">
        <TestimonialsSection />
      </div>

      {/* Screen 6: FAQ */}
      <div id="snap-faq" className="snap-screen snap-screen--paper">
        <FAQSection />
      </div>

      {/* Screen 7: CTA + compact footer (shared screen) */}
      <div id="snap-cta" className="snap-screen snap-screen--final">
        <CTABanner />
      </div>
    </SnapLanding>
  );
}