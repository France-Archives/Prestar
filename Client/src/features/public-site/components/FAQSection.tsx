import React, { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useScreenEnter } from "@/hooks/useScreenEnter";
import { animTo, fadeIn } from "@/lib/motion";
import "../styles/landing.css";

interface FAQItem { question: string; answer: string; }

const FAQS: FAQItem[] = [
  { question: "How do I borrow a book?",                    answer: "Register for an account using your campus email, upload your current semester Certificate of Registration (COR), and wait for library staff verification. Once approved, you can browse catalog holdings and click 'Request'. When your book is ready at the circulation counter, simply present your student ID to claim your loan." },
  { question: "What is a COR and why do I need it?",        answer: "The Certificate of Registration (COR) verifies your enrollment status and academic standing for the active term. Submitting your COR each semester ensures library books and reserve materials remain reserved exclusively for actively enrolled students and faculty." },
  { question: "What happens when the book I want is unavailable?", answer: "If all physical copies are currently checked out, you can join the automated reservation queue. As soon as a borrower returns a copy to the desk, PRESTAR automatically reserves and holds it for you for 24 hours while sending an instant email alert." },
  { question: "How does the renewal process work?",          answer: "You can request an extension directly through your student dashboard before your due date, provided that no other student has reserved the title in the queue. Staff review and grant the extension instantly." },
  { question: "When do fines apply?",                        answer: "Fines accumulate on a daily basis if an item is kept past its due date without renewal. Outstanding balances can be settled in person at the circulation desk before submitting subsequent loan requests." },
  { question: "Can I cancel a request or reservation?",      answer: "Yes, absolutely. You can cancel pending pickup requests or remove yourself from any reservation waiting list at any time from your dashboard under 'My Requests' with zero penalty." },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const toggle = (idx: number) => setOpenIndex(curr => curr === idx ? null : idx);

  const sectionRef = useScreenEnter(
    useCallback(async (el: HTMLElement, reduced: boolean) => {
      const heading = el.querySelector<HTMLElement>(".land-header");
      const items   = el.querySelectorAll<HTMLElement>(".faq-item");

      if (heading) { heading.style.opacity = "0"; heading.style.transform = "translateY(18px)"; }
      Array.from(items).forEach(i => { i.style.opacity = "0"; i.style.transform = "translateY(16px)"; });

      if (reduced) {
        if (heading) fadeIn(heading, 0);
        Array.from(items).forEach((i, idx) => fadeIn(i, idx * 0.06));
        return;
      }

      // Heading first
      if (heading) await animTo(heading, { opacity: 1, transform: "none" }, { duration: 0.5, delay: 0.05 });

      // Items one by one
      for (let i = 0; i < items.length; i++) {
        animTo(items[i], { opacity: 1, transform: "none" }, { duration: 0.48, delay: i * 0.09 });
      }
    }, []),
    0.5
  );

  return (
    <section
      className="land-section faq-section"
      aria-label="Frequently Asked Questions"
      ref={el => { (sectionRef as React.MutableRefObject<HTMLElement | null>).current = el; }}
    >
      <div className="land-container">
        <div className="land-header" style={{ opacity: 0, transform: "translateY(18px)" }}>
          <h2 className="land-title">Frequently Asked <em>Questions</em></h2>
          <p className="land-subtitle">Everything you need to know about borrowing privileges, semester registration, and circulation policies.</p>
        </div>

        <div className="faq-list">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.question}
                className={`faq-item${isOpen ? " faq-item--open" : ""}`}
                style={{ opacity: 0, transform: "translateY(16px)" }}
              >
                <button
                  type="button"
                  className="faq-trigger"
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                >
                  <span>{faq.question}</span>
                  <span className="faq-icon" aria-hidden="true"><Plus size={18} /></span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-answer-${idx}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="faq-answer"><p>{faq.answer}</p></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
