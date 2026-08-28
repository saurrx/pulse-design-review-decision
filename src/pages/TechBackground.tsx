import { Check, FileCheck2, ShieldCheck } from "lucide-react";

const proofPoints = [
  {
    icon: ShieldCheck,
    title: "Human authorship, made visible",
    description: "Keep inventor input and AI-assisted work clearly distinguished.",
  },
  {
    icon: Check,
    title: "Decisions move faster",
    description: "Review evidence, request updates, and hand work to counsel in one place.",
  },
  {
    icon: FileCheck2,
    title: "A filing-ready record",
    description: "Preserve the history behind every disclosure and filing decision.",
  },
];

export const TechBackground = () => (
  <section className="pulse-auth-brand-panel relative flex h-full w-full items-center overflow-hidden bg-[#11103d] px-12 py-16 text-white">
    <div
      className="absolute inset-0 opacity-70"
      aria-hidden="true"
      style={{
        background:
          "radial-gradient(circle at 18% 18%, rgba(249,180,24,.22), transparent 28%), radial-gradient(circle at 88% 72%, rgba(56,189,183,.18), transparent 34%), linear-gradient(145deg, transparent 35%, rgba(112,87,199,.18))",
      }}
    />
    <div
      className="absolute inset-0 opacity-[0.12]"
      aria-hidden="true"
      style={{
        backgroundImage:
          "radial-gradient(rgba(255,255,255,.8) 0.75px, transparent 0.75px)",
        backgroundSize: "22px 22px",
      }}
    />

    <div className="relative mx-auto w-full max-w-xl">
      <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-white/85">
        <span className="h-2 w-2 rounded-full bg-[#F9B418]" />
        Photon Legal intelligence
      </div>

      <h2 className="max-w-lg text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-white xl:text-5xl">
        From disclosure to filing, with the evidence intact.
      </h2>
      <p className="mt-5 max-w-lg text-base leading-7 text-white/65">
        A focused workspace for inventors, in-house teams, and outside counsel
        to move valuable ideas forward with confidence.
      </p>

      <div className="mt-10 space-y-3">
        {proofPoints.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F9B418] text-[#171528]">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-1 text-sm leading-5 text-white/55">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
