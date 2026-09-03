import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { colors, fontFamily, outline, padding, radius, roles, shadow, size, source, space, type } from "@/styles/tokens.tailwind";

/**
 * V0 foundations (DSN-0001). Everything here is read from the token source,
 * src/styles/tokens.json, through the generated module, so these stories are
 * the living specification of PL-TKN-004 (design/v4/PL-TKN-004.html): a value
 * that is not in the source cannot appear here. Product language follows
 * product-context; the visual treatment follows the specification without
 * reinterpretation. Tagged `redesign`, so the accessibility ratchet holds the
 * stories to zero violations; tagged with the five review widths, so the
 * screenshot runner shoots each at 1280, 1366, 1440, 1920 and 200% zoom.
 */
const stack = (fam: readonly string[]) => fam.map((f) => (f.includes(" ") ? `"${f}"` : f)).join(", ");
const ui = stack(fontFamily.sans), display = stack(fontFamily.display), mono = stack(fontFamily.mono);
const font = (k: keyof typeof type): React.CSSProperties => { const t = type[k]; const fam = t.font === "display" ? display : t.font === "mono" ? mono : ui; return { font: `${t.weight} ${t.size}px/${t.line}px ${fam}`, letterSpacing: `${t.tracking}px`, textTransform: ("transform" in t ? t.transform : "none") as "uppercase" | "none" }; };
const hairline: React.CSSProperties = { outline: outline.hairline.value, outlineOffset: outline.hairline.offset, borderRadius: radius, background: colors.pl.bg };
const strong: React.CSSProperties = { outline: outline.strong.value, outlineOffset: outline.strong.offset, borderRadius: radius, background: colors.pl.bg };
const focus: React.CSSProperties = { outline: outline.focus.value, outlineOffset: outline.focus.offset };
const C = colors.pl;

const Page = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <main style={{ padding: `${space[8]} ${space[10]}`, background: C.bg, color: C.ink, fontFamily: ui, minHeight: "100vh" }}>
    <p style={{ ...font("kicker"), color: C["amber-text"], margin: `0 0 ${space[2]}` }}>{source.file.split("/").pop()?.replace(".html", "")} · {source.release} · {source.status}</p>
    <h1 style={{ ...font("h1-serif"), margin: `0 0 ${space[6]}` }}>{title}</h1>
    {children}
  </main>
);
const Section = ({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: space[8] }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: space[4], paddingBottom: space[2], borderBottom: `1px solid ${C.border}`, marginBottom: space[4] }}>
      <h2 style={{ ...font("h3"), margin: 0 }}>{title}</h2>
      {note && <span style={{ ...font("mono-meta"), color: C["text-3"] }}>{note}</span>}
    </div>
    {children}
  </section>
);
/** A status tag exactly as the specification draws it: white surface, square marker, hairline outline, mono label. */
const Tag = ({ label, family }: { label: string; family: "green" | "blue" | "red" | "amber" | "slate" }) => (
  <span style={{ ...strong, display: "inline-flex", width: "fit-content", justifySelf: "start", alignItems: "center", gap: space[2], padding: padding.tag, color: C[`${family}-text`], ...font("mono-label") }}>
    <span aria-hidden="true" style={{ width: size.marker, height: size.marker, background: family === "amber" ? C.brand : C[family], flexShrink: 0 }} />{label}
  </span>
);
const PrimaryButton = ({ children, hover, disabled }: { children: React.ReactNode; hover?: boolean; disabled?: boolean }) => (
  <button type="button" disabled={disabled} style={{ padding: padding.button, background: disabled ? C["bg-muted"] : hover ? C["brand-deep"] : C.brand, color: disabled ? C["text-4"] : C.ink, border: 0, borderRadius: radius, ...font("button"), cursor: disabled ? "not-allowed" : "pointer" }}>{children}</button>
);
const SecondaryButton = ({ children, hover, focused }: { children: React.ReactNode; hover?: boolean; focused?: boolean }) => (
  <button type="button" style={{ ...strong, ...(focused ? focus : {}), padding: padding.button, background: hover ? C["bg-muted"] : C.bg, color: C.ink, border: 0, ...font("button-secondary"), cursor: "pointer" }}>{children}</button>
);
const InkButton = ({ children }: { children: React.ReactNode }) => (
  <button type="button" style={{ padding: padding["button-sm"], background: C.ink, color: C.bg, border: 0, borderRadius: radius, ...font("button-sm"), cursor: "pointer" }}>{children}</button>
);
const Field = ({ label, value, help, state }: { label: string; value: string; help?: string; state?: "rest" | "focus" | "error" | "disabled" }) => {
  const id = label.toLowerCase().replace(/\W+/g, "-");
  const invalid = state === "error";
  return (
    <div style={{ display: "grid", gap: space["1.5"], maxWidth: 420 }}>
      <label htmlFor={id} style={{ ...font("field-label"), color: C["text-2"] }}>{label}</label>
      <input id={id} defaultValue={value} readOnly disabled={state === "disabled"} aria-invalid={invalid || undefined} aria-describedby={help ? `${id}-help` : undefined}
        style={{ ...strong, ...(state === "focus" ? focus : invalid ? { outline: `1.5px solid ${C.red}`, outlineOffset: outline.focus.offset } : {}), padding: padding.input, border: 0, background: state === "disabled" ? C["bg-muted"] : C.bg, color: state === "disabled" ? C["text-4"] : C.ink, ...font("body"), width: "100%" }} />
      {help && <p id={`${id}-help`} style={{ ...font("help"), color: invalid ? C["red-text"] : C["text-3"], margin: 0 }}>{help}</p>}
    </div>
  );
};

const meta = { title: "Foundations/Tokens", tags: ["redesign", "viewport:1280x720", "viewport:1366x768", "viewport:1440x900", "viewport:1920x1080", "viewport:640x360@2"], parameters: { pulse: { layout: "public", route: "/" }, layout: "fullscreen" } } satisfies Meta;
export default meta;

const groups: Array<[string, string, Array<keyof typeof C>]> = [
  ["Brand", "Photon identity, applied sparingly", ["brand", "brand-deep", "brand-tint", "navy", "navy-2", "cream"]],
  ["Neutrals", "text, surface and border scale", ["ink", "text-2", "text-3", "text-4", "bg", "bg-subtle", "bg-muted", "border", "border-strong"]],
  ["Semantic", "status families: mark, tint, text", ["green", "green-tint", "green-text", "blue", "blue-tint", "blue-text", "red", "red-tint", "red-text", "amber-tint", "amber-text", "slate", "slate-tint", "slate-text"]],
  ["Chart series", "not on the specification; production's data palette", ["data-cyan", "data-ai"]],
];

export const Color: StoryObj = {
  render: () => (
    <Page title="Colour">
      {groups.map(([name, note, keys]) => (
        <Section key={name} title={name} note={note}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: space[6] }}>
            {keys.map((k) => (
              <li key={k} style={{ display: "grid", gap: space["2.5"] }}>
                <div aria-hidden="true" style={{ height: 84, background: C[k], ...hairline }} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: space[2] }}><span style={{ ...font("mono"), fontWeight: 500, fontSize: 12 }}>pl-{k}</span><span style={{ ...font("table-cell-mono"), color: C["text-3"] }}>{C[k]}</span></div>
                <div style={{ ...font("help"), color: C["text-2"] }}>{roles[k]}</div>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </Page>
  ),
};

const Scale = () => (
  <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "150px 180px 1fr", columnGap: space[6], alignItems: "baseline" }}>
    {(Object.keys(type) as Array<keyof typeof type>).map((k) => {
      const t = type[k];
      const sample = t.font === "display" ? (k === "display" ? "Turn material you already have into a disclosure." : "Every idea, understood before it is filed.") : t.font === "mono" ? (k === "table-header" ? "Reference · Submitted" : "NWI-0042 · 12 Mar 2026 · EP 3 811 902 B1") : k === "caption" ? "Awaiting review · 6 days" : k === "metric-value" ? "18" : "Approve for filing sends this idea to Photon Legal.";
      return (
        <React.Fragment key={k}>
          <dt style={{ ...font("body-sm"), fontWeight: 600, padding: `${space[4]} 0`, borderTop: `1px solid ${C.border}` }}>{k}</dt>
          <dd style={{ ...font("mono-meta"), color: C["text-3"], margin: 0, padding: `${space[4]} 0`, borderTop: `1px solid ${C.border}` }}>{t.font} · {t.size} / {t.line} · {t.weight}{t.tracking ? ` · ${t.tracking}px` : ""}</dd>
          <dd style={{ ...font(k), margin: 0, padding: `${space[4]} 0`, borderTop: `1px solid ${C.border}`, overflowWrap: "anywhere" }}>{sample}</dd>
        </React.Fragment>
      );
    })}
  </dl>
);

/** Digits of the interface face must be tabular ("1111" and "8888" set at the same width) and the three vendored faces must be the ones rendering. */
async function facesAndFigures({ canvasElement }: { canvasElement: HTMLElement }) {
  await document.fonts.ready;
  const probe = (text: string, fam: string) => { const s = document.createElement("span"); s.textContent = text; s.style.cssText = `font: 400 13px ${fam}; font-variant-numeric: tabular-nums; position: absolute; visibility: hidden; white-space: pre`; canvasElement.appendChild(s); const w = s.getBoundingClientRect().width; s.remove(); return w; };
  await expect(Math.abs(probe("1111", ui) - probe("8888", ui))).toBeLessThan(0.5);
  await expect(Math.abs(probe("1111", mono) - probe("8888", mono))).toBeLessThan(0.5);
  await expect(document.fonts.check(`400 13px "Schibsted Grotesk"`)).toBe(true);
  await expect(document.fonts.check(`600 56px "Newsreader"`)).toBe(true);
  await expect(document.fonts.check(`600 11px "IBM Plex Mono"`)).toBe(true);
}

export const Typography: StoryObj = {
  render: () => (
    <Page title="Typography">
      <Section title="Three families, one role each" note="Newsreader · Schibsted Grotesk · IBM Plex Mono">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: space[6] }}>
          {[[display, "Newsreader", "Human-authored content: headlines, idea titles, disclosure prose, evaluation prose."], [ui, "Schibsted Grotesk", "Interface chrome: navigation, controls, tables, product copy."], [mono, "IBM Plex Mono", "Machine-tracked identifiers: reference numbers, dates, citations. Never prose, never internal ids."]].map(([fam, name, rule]) => (
            <div key={name} style={{ display: "grid", gap: space["1.5"] }}><div style={{ font: `600 15px/20px ${fam}` }}>{name}</div><div style={{ ...font("help"), color: C["text-3"] }}>{rule}</div></div>
          ))}
        </div>
      </Section>
      <Section title="Scale" note="minimum body size 12px"><Scale /></Section>
      <Section title="Human prose in the display face" note="an evaluation, as the inventor reads it">
        <article style={{ maxWidth: 640, display: "grid", gap: space[3] }}>
          <h3 style={{ ...font("display-2"), margin: 0 }}>Your disclosure appears to contain meaningful differences from the closest prior art.</h3>
          <p style={{ ...font("body"), margin: 0, color: C["text-2"] }}>Strengthen the authority-transfer mechanism with one concrete implementation example. This assessment is AI-assisted and advisory; every score can be submitted for review.</p>
        </article>
      </Section>
    </Page>
  ),
  play: facesAndFigures,
};

export const Spacing: StoryObj = {
  render: () => (
    <Page title="Spacing">
      <Section title="Scale" note="a 2px-stepped scale on a 4px rhythm">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: space[2] }}>
          {(Object.keys(space) as Array<keyof typeof space>).map((k) => (
            <li key={k} style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: space[4] }}>
              <span style={{ ...font("mono-meta"), color: C["text-3"] }}>space-{k} · {space[k]}</span>
              <span aria-hidden="true" style={{ display: "block", height: 12, width: space[k], background: C.brand }} />
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Component paddings and sizes" note="from the specification's components and table">
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: space[4] }}>
          {[...Object.entries(padding).map(([k, v]) => [`pad-${k}`, v]), ...Object.entries(size).map(([k, v]) => [k, v])].map(([k, v]) => (
            <div key={k} style={{ ...hairline, padding: padding.card }}><dt style={{ ...font("metric-label"), color: C["text-3"] }}>{k}</dt><dd style={{ ...font("mono"), margin: `${space[1]} 0 0` }}>{v}</dd></div>
          ))}
        </dl>
      </Section>
    </Page>
  ),
};

export const RadiusAndBorders: StoryObj = {
  name: "Radius and borders",
  render: () => (
    <Page title="Radius and borders">
      <Section title={`Radius ${radius}`} note="squared everywhere except circular markers">
        <div style={{ display: "flex", gap: space[4], flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ ...hairline, width: 160, height: 72, display: "grid", placeItems: "center", ...font("body-sm") }}>card</div>
          <div style={{ ...strong, width: 160, height: 72, display: "grid", placeItems: "center", ...font("body-sm") }}>input, tag, secondary</div>
          <PrimaryButton>Approve &amp; send</PrimaryButton>
          <div style={{ width: 40, height: 40, background: C["navy-2"], color: C.bg, borderRadius: "50%", display: "grid", placeItems: "center", ...font("caption") }}>AS</div>
        </div>
      </Section>
      <Section title="Outlines, not shadows" note="every surface is separated by an inset hairline">
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: space[6] }}>
          {(Object.keys(outline) as Array<keyof typeof outline>).map((k) => (
            <div key={k} style={{ outline: outline[k].value, outlineOffset: outline[k].offset, borderRadius: radius, padding: padding.card, background: C.bg }}>
              <dt style={{ ...font("mono-label"), color: C["text-3"] }}>outline-{k}</dt>
              <dd style={{ ...font("mono"), margin: `${space[1]} 0 ${space[2]}` }}>{outline[k].value} · offset {outline[k].offset}</dd>
              <dd style={{ ...font("help"), color: C["text-2"], margin: 0 }}>{outline[k].role}</dd>
            </div>
          ))}
        </dl>
        <p style={{ ...font("help"), color: C["text-3"], margin: `${space[4]} 0 0` }}>shadow.card = {shadow.card} · shadow.elevated = {shadow.elevated}</p>
      </Section>
      <Section title="Emphasis edges" note="a brand edge on a banner, a brand rule under a section">
        <div style={{ display: "grid", gap: space[4] }}>
          <div style={{ background: C["amber-tint"], borderLeft: `${size["banner-edge"]} solid ${C.brand}`, borderRadius: radius, padding: padding.banner, display: "flex", justifyContent: "space-between", alignItems: "center", gap: space[3] }}>
            <div><div style={{ ...font("body"), fontWeight: 600 }}>Instruction needed: renewal due in 12 days</div><div style={{ ...font("body-sm"), color: C["text-2"] }}>EP 3 811 902 B1 · Northwind Instruments · owned by Devika Nair</div></div>
            <InkButton>Open Actions</InkButton>
          </div>
          <div aria-hidden="true" style={{ height: size["brand-rule"], background: C.brand }} />
        </div>
      </Section>
    </Page>
  ),
};

const ideaStates: Array<[string, "green" | "blue" | "red" | "amber" | "slate", string]> = [
  ["Draft", "slate", "no judgment yet"], ["Awaiting review", "amber", "action pending for the Workspace Admin"], ["Changes requested", "amber", "action pending for the inventor"], ["Rejected", "red", "blocking; paired with resubmission"],
  ["Sent to Photon Legal", "blue", "in flight, no client action"], ["Filed", "blue", "in flight"], ["Granted", "green", "terminal success"], ["Closed", "slate", "archived"],
];
const actionStates: Array<[string, "green" | "blue" | "red" | "amber" | "slate"]> = [["Action required", "amber"], ["Saved draft", "slate"], ["Submitted", "blue"], ["Acknowledged", "blue"], ["In progress", "blue"], ["Completed", "green"], ["Declined", "red"]];
const dateStates: Array<[string, "green" | "blue" | "red" | "amber" | "slate"]> = [["Upcoming", "blue"], ["Due soon", "amber"], ["Overdue", "red"], ["Completed", "green"]];

export const StatusSemantics: StoryObj = {
  name: "Status semantics",
  render: () => (
    <Page title="Status semantics">
      <Section title="The tag" note="white surface · square marker · hairline outline · mono label">
        <p style={{ ...font("body-sm"), color: C["text-2"], maxWidth: 720, margin: `0 0 ${space[4]}` }}>Green is terminal success only. Blue is informational and in flight. Amber is attention with an action pending. Red is blocking or failed and is always paired with a recovery action. Slate is no judgment yet. No tinted pills: meaning is carried by the marker and the word, never by a wash of colour.</p>
      </Section>
      <Section title="Idea lifecycle" note="product-context/WORKFLOWS.md">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: space[4] }}>
          {ideaStates.map(([label, fam, why]) => <li key={label} style={{ display: "grid", gap: space[2] }}><Tag label={label} family={fam} /><span style={{ ...font("help"), color: C["text-3"] }}>{fam} · {why}</span></li>)}
        </ul>
      </Section>
      <Section title="Actions" note="the client's instruction and Photon's response">
        <div style={{ display: "flex", gap: space["2.5"], flexWrap: "wrap" }}>{actionStates.map(([label, fam]) => <Tag key={label} label={label} family={fam} />)}</div>
      </Section>
      <Section title="Due dates" note="Case Owner and Photon Admin; Workspace Admin inside Actions and patent detail">
        <div style={{ display: "flex", gap: space["2.5"], flexWrap: "wrap" }}>{dateStates.map(([label, fam]) => <Tag key={label} label={label} family={fam} />)}</div>
      </Section>
    </Page>
  ),
};

export const ButtonsAndInputs: StoryObj = {
  name: "Buttons and inputs",
  render: () => (
    <Page title="Buttons and inputs">
      <Section title="Actions" note="pl-brand · pl-ink · pl-radius 2">
        <div style={{ display: "flex", gap: space[3], flexWrap: "wrap", alignItems: "center" }}>
          <PrimaryButton>Approve &amp; send</PrimaryButton>
          <SecondaryButton>Save draft</SecondaryButton>
          <PrimaryButton hover>Approve &amp; send</PrimaryButton>
          <SecondaryButton hover>Save draft</SecondaryButton>
          <InkButton>Open Actions</InkButton>
          <a href="#review" style={{ ...font("link"), color: C["blue-text"], textDecoration: "none" }}>Open review ›</a>
        </div>
        <p style={{ ...font("help"), color: C["text-3"], margin: `${space[3]} 0 0` }}>primary, secondary, primary hover, secondary hover, ink action, link</p>
      </Section>
      <Section title="Input field" note="rest strong outline · focus pl-blue 1.5px">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: space[6] }}>
          <Field label="Idea title" value="Adaptive beam-steering array for lidar" help="A short title your colleagues will recognise." />
          <Field label="Idea title" value="Adaptive beam-steering array for lidar" help="A short title your colleagues will recognise." state="focus" />
        </div>
      </Section>
      <Section title="Metric cards" note="pl-bg · hairline outline · mono deltas">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: space[5] }}>
          {[["Ideas submitted this quarter", "18", "+6 vs last quarter", C["green-text"]], ["Awaiting your review", "6", "oldest 33 days", C["amber-text"]], ["Sent to Photon Legal", "4", "2 filed", C["blue-text"]]].map(([label, value, delta, color]) => (
            <div key={label} style={{ ...hairline, padding: padding.card, display: "grid", gap: space["2.5"] }}><div style={{ ...font("metric-label"), color: C["text-3"] }}>{label}</div><div style={{ ...font("metric-value") }}>{value}</div><div style={{ ...font("mono-delta"), color }}>{delta}</div></div>
          ))}
        </div>
      </Section>
      <Section title="Idea card" note="hairline surface · tag · link">
        <div style={{ ...hairline, padding: padding.card, maxWidth: 560, display: "grid", gap: space["3.5"] }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ ...font("table-cell-mono"), color: C["text-3"] }}>NWI-0042</span><Tag label="Awaiting review" family="amber" /></div>
          <div style={{ ...font("card-title") }}>On-device speculative decoding cache for edge inference</div>
          <div style={{ ...font("body-sm"), color: C["text-2"] }}>Evaluation available: 14 references compared, no blocking disclosure found. Novelty 6.8 / 10. Every score can be submitted for review.</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ ...font("help"), color: C["text-3"] }}>Anika Sharma · submitted 6 days ago</span><a href="#review" style={{ ...font("link"), color: C["blue-text"], textDecoration: "none" }}>Open review ›</a></div>
        </div>
      </Section>
    </Page>
  ),
};

const rows: Array<[string, string, string, [string, "green" | "blue" | "red" | "amber" | "slate"], string, string]> = [
  ["NWI-0042", "Sparse attention accelerator for on-device inference", "Anika Sharma", ["Awaiting review", "amber"], "6.8 / 10", "12 Mar 2026"],
  ["NWI-0039", "Photonic interconnect for chiplet-based neural fabrics", "Mateo Ruiz", ["Sent to Photon Legal", "blue"], "8.1 / 10", "02 Mar 2026"],
  ["NWI-0031", "Federated gradient compression with differential privacy", "Ines Duarte", ["Filed", "blue"], "7.7 / 10", "18 Jan 2026"],
  ["NWI-0027", "Thermal-aware scheduling for stacked memory controllers", "Anika Sharma", ["Granted", "green"], "—", "09 Sep 2025"],
  ["NWI-0019", "Neuromorphic event-camera denoising pipeline", "Mateo Ruiz", ["Rejected", "red"], "2.3 / 10", "18 Nov 2025"],
];

export const DenseTables: StoryObj = {
  name: "Dense tables and tabular figures",
  render: () => (
    <Page title="Dense tables and tabular figures">
      <Section title="Ideas" note={`row ${size["row-height"]} · cell ${padding.cell} · header ${padding["table-header"]}`}>
        <div style={{ ...hairline, overflowX: "auto" }}>
          <table data-testid="figures" style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ background: C["bg-subtle"] }}>{["Reference", "Idea", "Inventor", "Status", "Novelty", "Submitted"].map((h, i) => <th key={h} scope="col" style={{ textAlign: i >= 4 ? "right" : "left", padding: padding["table-header"], ...font("table-header"), color: C["text-3"] }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(([ref, title, who, [label, fam], score, date], i) => (
                <tr key={ref} style={{ background: i === 1 ? C["brand-tint"] : undefined, borderTop: `1px solid ${C.border}`, height: size["row-height"] }}>
                  <td style={{ padding: padding.cell, ...font("mono"), whiteSpace: "nowrap" }}>{ref}</td>
                  <td style={{ padding: padding.cell, font: `400 14px/20px ${display}` }}>{title}</td>
                  <td style={{ padding: padding.cell, font: `400 13px/18px ${display}`, color: C["text-2"], whiteSpace: "nowrap" }}>{who}</td>
                  <td style={{ padding: padding.cell }}><Tag label={label} family={fam} /></td>
                  <td style={{ padding: padding.cell, ...font("table-cell-mono"), color: C["text-2"], textAlign: "right", whiteSpace: "nowrap" }}>{score}</td>
                  <td style={{ padding: padding.cell, ...font("table-cell-mono"), color: C["text-2"], textAlign: "right", whiteSpace: "nowrap" }}>{date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...font("help"), color: C["text-3"], margin: `${space[3]} 0 0` }}>Reference numbers and dates in the mono face; idea titles and names in the display face; the selected row carries the brand tint.</p>
      </Section>
      <Section title="Figures align" note="tabular digits in both the interface and the mono face">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, max-content)", gap: `${space[1]} ${space[8]}`, ...font("body-sm"), fontVariantNumeric: "tabular-nums" }}>
          {["1,111,111", "8,888,888", "1,000,000", "9,999,999"].map((n) => <React.Fragment key={n}><span>{n}</span><span style={{ fontFamily: mono }}>{n}</span></React.Fragment>)}
        </div>
      </Section>
    </Page>
  ),
  play: facesAndFigures,
};

export const States: StoryObj = {
  name: "Focus, disabled, loading and error states",
  render: () => (
    <Page title="Focus, disabled, loading and error states">
      <Section title="Focus" note="pl-blue 1.5px inset, on every control">
        <div style={{ display: "flex", gap: space[3], flexWrap: "wrap", alignItems: "center" }}><SecondaryButton focused>Save draft</SecondaryButton><span style={{ ...focus, borderRadius: radius, padding: `${space[2]} ${space[3]}`, ...font("link"), color: C["blue-text"] }}>Open review ›</span></div>
      </Section>
      <Section title="Disabled" note="muted fill, text-4, no outline change">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: space[6], alignItems: "start" }}>
          <div><PrimaryButton disabled>Approve &amp; send</PrimaryButton></div>
          <Field label="Reference" value="NWI-0042" help="Assigned by Pulse; cannot be edited." state="disabled" />
        </div>
      </Section>
      <Section title="Loading" note="the label stays; activity shows beside it; no spinner for trivial waits">
        <div style={{ display: "flex", gap: space[3], flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" aria-busy="true" style={{ padding: padding.button, background: C.brand, color: C.ink, border: 0, borderRadius: radius, ...font("button"), display: "inline-flex", alignItems: "center", gap: space[2] }}><span aria-hidden="true" style={{ width: 12, height: 12, border: `2px solid ${C.ink}`, borderRightColor: "transparent", borderRadius: "50%", display: "inline-block" }} />Sending to Photon Legal</button>
          <div role="status" style={{ display: "grid", gap: space[2], width: 320 }}><span style={{ ...font("help"), color: C["text-3"] }}>Organising your material</span><span aria-hidden="true" style={{ display: "block", height: 8, background: C["bg-muted"], borderRadius: radius, overflow: "hidden" }}><span style={{ display: "block", width: "45%", height: "100%", background: C.brand }} /></span></div>
          <div aria-hidden="true" style={{ display: "grid", gap: space[2], width: 320 }}>{[100, 80, 60].map((w) => <span key={w} style={{ display: "block", height: 12, width: `${w}%`, background: C["bg-muted"], borderRadius: radius }} />)}</div>
        </div>
      </Section>
      <Section title="Error" note="explained beside the field, entered work preserved, a recovery action named">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: space[6], alignItems: "start" }}>
          <Field label="Co-inventor email" value="mateo.ruiz@northwind" help="Enter a work email at northwind.test, for example mateo.ruiz@northwind.test." state="error" />
          <div role="alert" style={{ background: C["red-tint"], borderLeft: `${size["banner-edge"]} solid ${C.red}`, borderRadius: radius, padding: padding.banner, display: "flex", justifyContent: "space-between", alignItems: "center", gap: space[3] }}>
            <div><div style={{ ...font("body"), fontWeight: 600 }}>Your draft was not saved</div><div style={{ ...font("body-sm"), color: C["text-2"] }}>The connection dropped. Your answers are kept on this page.</div></div>
            <InkButton>Try again</InkButton>
          </div>
        </div>
      </Section>
    </Page>
  ),
};
