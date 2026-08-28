import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * Renders the inventor questionnaire as a clean reading pane for review.
 * Left-aligned UI typography (Inter); mono reserved for the ref id and
 * dates. Sections are collapsible groups, expanded by default.
 */

type Question = { id: string; text: string; answer: string };
type Section = { id: string; title: string; description?: string; questions: Question[] };

// Map questionnaire sections to disclosure headings, in order.
const SPEC_ORDER: { heading: string; sectionIds: string[] }[] = [
  { heading: "Field of the Invention", sectionIds: ["background"] },
  { heading: "Background and Technical Problem", sectionIds: ["problem"] },
  { heading: "Summary of the Invention", sectionIds: ["solution"] },
  { heading: "Advantages of the Invention", sectionIds: ["advantages"] },
  { heading: "Detailed Description and Embodiments", sectionIds: ["implementation"] },
];

const DisclosureSection = ({
  heading,
  questions,
}: {
  heading: string;
  questions: Question[];
}) => {
  const [open, setOpen] = React.useState(true);
  return (
    <section className="border-t border-[#E8E8E8] first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-4 text-left"
      >
        <h2 className="text-base font-semibold text-[#0C0C0C]">{heading}</h2>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#727272] transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open && (
        <div className="space-y-5 pb-6">
          {questions.map((q) => (
            <div key={q.id}>
              <div className="mb-1 text-xs font-medium text-[#727272]">
                {q.text}
              </div>
              <p className="text-sm leading-[1.7] text-[#0C0C0C]">
                {q.answer.trim()}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const PatentPaperView = ({
  title,
  irn,
  inventors,
  submissionDate,
  sections,
  panelLabel = "Disclosure",
}: {
  title?: string;
  irn?: string;
  inventors?: string[];
  submissionDate?: string;
  sections: Section[];
  panelLabel?: string;
}) => {
  const byId = Object.fromEntries(sections.map((s) => [s.id, s]));
  const groups = SPEC_ORDER.map(({ heading, sectionIds }) => ({
    heading,
    questions: sectionIds
      .flatMap((id) => byId[id]?.questions ?? [])
      .filter((q) => q.answer && q.answer.trim().length > 0),
  })).filter((g) => g.questions.length > 0);

  return (
    <div className="w-full rounded-2xl border border-[var(--pulse-line)] bg-[var(--pulse-surface)] font-sans">
      {/* Panel header — title/ref/date/inventor live in the page header,
          so the panel keeps only its label (screen view; export templates
          keep the full caption block). */}
      <div className="border-b border-[#E8E8E8] px-6 py-5">
        <div className="text-xs font-semibold uppercase tracking-[1px] text-[#727272]">
          {panelLabel}
        </div>
      </div>

      {/* Sections */}
      <div className="px-6">
        {groups.map((g) => (
          <DisclosureSection
            key={g.heading}
            heading={g.heading}
            questions={g.questions}
          />
        ))}
        {groups.length === 0 && (
          <p className="py-8 text-sm text-[#727272]">
            No disclosure content has been drafted yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default PatentPaperView;
