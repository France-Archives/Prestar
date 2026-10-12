import { useEffect } from "react";
import FeaturedBooks from "../components/FeaturedBooks";
import HeroSection from "../components/HeroSection";
import HowItWorks from "../components/HowItWorks";

export default function LandingPage() {
  // Full-screen snap scrolling applies to this page only.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("landing-snap");
    return () => root.classList.remove("landing-snap");
  }, []);

  return (
    <>
      <HeroSection />
      <HowItWorks />
      <FeaturedBooks />
    </>
  );
}