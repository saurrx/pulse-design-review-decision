import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { colors, outline, padding, radius, space, type } from "@/styles/tokens.tailwind";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Radius scale (DSN-0003). Five steps from src/styles/tokens.json, one token
 * per element class; the rules the record names are rendered here so a corner
 * that drifts is visible: nested radius is outer minus padding, a top rule
 * clips to the corner, grouped controls round only their outer corners, table
 * cells stay square, and a skeleton keeps the shape of what it stands for.
 * Tagged `redesign` and with the five review widths like Foundations/Tokens.
 */
const C = colors.pl;
const ui = '"Schibsted Grotesk", system-ui, sans-serif';
const font = (k: keyof typeof type): React.CSSProperties => { const t = type[k]; return { font: `${t.weight} ${t.size}px/${t.line}px ${t.font === "mono" ? '"IBM Plex Mono", monospace' : ui}`, letterSpacing: t.tracking, textTransform: t.transform as React.CSSProperties["textTransform"] }; };
const hairline: React.CSSProperties = { outline: outline.hairline.value, outlineOffset: outline.hairline.offset, background: C.bg };
const Section = ({ title, note, children }: { title: string; note: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: space[8] }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: space[4], paddingBottom: space[2], borderBottom: `1px solid ${C.border}`, marginBottom: space[4] }}>
      <h2 style={{ ...font("h3"), margin: 0 }}>{title}</h2>
      <span style={{ ...font("mono-meta"), color: C["text-3"] }}>{note}</span>
    </div>
    {children}
  </section>
);

const STEPS = [
  ["xs", "chips, badges, tags, row hover, tooltips"],
  ["sm", "buttons, inputs, selects, segmented toggles, menu items"],
  ["md", "cards, panels, stat boxes, sidebar active item, tables"],
  ["lg", "dialogs, popovers, menus, toasts"],
  ["full", "avatars, count badges, status dots, circular icon buttons"],
] as const;

const meta = { title: "Foundations/Radius", tags: ["redesign", "viewport:1280x720", "viewport:1366x768", "viewport:1440x900", "viewport:1920x1080", "viewport:640x360@2"], parameters: { pulse: { layout: "public", route: "/" }, layout: "fullscreen" } } satisfies Meta;
export default meta;

export const Scale: StoryObj = {
  render: () => (
    <main style={{ padding: `${space[8]} ${space[10]}`, background: C.bg, color: C.ink, fontFamily: ui, minHeight: "100vh" }}>
      <p style={{ ...font("kicker"), color: C["amber-text"], margin: `0 0 ${space[2]}` }}>DSN-0003 · radius scale</p>
      <h1 style={{ ...font("h1-serif"), margin: `0 0 ${space[6]}` }}>Radius</h1>

      <Section title="Scale" note="src/styles/tokens.json → --pl-radius-* → rounded-*">
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: space[6] }}>
          {STEPS.map(([k, role]) => (
            <div key={k} data-testid={`radius-${k}`}>
              <div aria-hidden="true" style={{ height: 72, width: k === "full" ? 72 : "100%", background: C["navy-2"], borderRadius: radius[k] }} />
              <dt style={{ ...font("mono-label"), color: C["text-3"], marginTop: space[3] }}>radius-{k}</dt>
              <dd style={{ ...font("mono"), margin: `${space[1]} 0 ${space[2]}` }}>{radius[k]}</dd>
              <dd style={{ ...font("help"), color: C["text-2"], margin: 0 }}>{role}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Nested" note="inner radius = outer radius − padding, floored at xs">
        <Card className="max-w-md" data-testid="nested-card">
          <CardHeader><CardTitle>Awaiting review</CardTitle></CardHeader>
          <CardContent style={{ display: "grid", gap: space[3] }}>
            <Input aria-label="Title" defaultValue="Thermal cycling for coated substrates" data-testid="nested-input" />
            <div style={{ display: "flex", gap: space[2], alignItems: "center" }}>
              <Button data-testid="nested-button">Approve &amp; send</Button>
              <Button variant="outline">Save draft</Button>
              <Badge data-testid="nested-badge" variant="secondary">Draft</Badge>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Top rule" note="the coloured rule clips to the rounded corner">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: space[4], maxWidth: 680 }}>
          {[["Awaiting review", "7", C.brand], ["Actions due", "3", C.red], ["Granted", "112", C.green]].map(([label, value, rule]) => (
            <div key={label} data-testid="top-rule" style={{ ...hairline, borderRadius: radius.md, overflow: "hidden" }}>
              <div aria-hidden="true" style={{ height: 3, background: rule }} />
              <div style={{ padding: padding.card }}>
                <div style={{ ...font("caption"), color: C["text-2"] }}>{label}</div>
                <div style={{ ...font("metric-value"), marginTop: space[1] }}>{value}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Grouped" note="outer corners only; inner joins square">
        <div style={{ display: "flex", flexWrap: "wrap", gap: space[6], alignItems: "center" }}>
          <div role="group" aria-label="View" data-testid="grouped" style={{ display: "inline-flex" }}>
            {["List", "Board", "Timeline"].map((label, i, all) => (
              <button key={label} type="button" aria-pressed={i === 0} style={{ ...font("button-sm"), padding: padding["button-sm"], background: i === 0 ? C.ink : C.bg, color: i === 0 ? C.bg : C.ink, border: `1px solid ${C["border-strong"]}`, marginLeft: i ? -1 : 0, borderRadius: i === 0 ? `${radius.sm} 0 0 ${radius.sm}` : i === all.length - 1 ? `0 ${radius.sm} ${radius.sm} 0` : 0, cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          <div style={{ display: "inline-flex" }}>
            <input aria-label="Invite by email" placeholder="name@northwind.test" style={{ ...font("body-sm"), padding: padding.input, border: `1px solid ${C["border-strong"]}`, borderRight: 0, borderRadius: `${radius.sm} 0 0 ${radius.sm}`, minWidth: 220 }} />
            <button type="button" style={{ ...font("button"), padding: padding.button, background: C.brand, color: C.ink, border: 0, borderRadius: `0 ${radius.sm} ${radius.sm} 0`, cursor: "pointer" }}>Send invite</button>
          </div>
        </div>
      </Section>

      <Section title="Table" note="container md, row hover xs, cells square">
        <div data-testid="table-container" style={{ ...hairline, borderRadius: radius.md, overflow: "hidden", maxWidth: 560 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", ...font("body-sm") }}>
            <thead><tr style={{ background: C["bg-subtle"] }}><th style={{ textAlign: "left", padding: padding.cell, ...font("mono-label"), color: C["text-3"] }}>Title</th><th style={{ textAlign: "left", padding: padding.cell, ...font("mono-label"), color: C["text-3"] }}>Status</th></tr></thead>
            <tbody>
              {[["Thermal cycling for coated substrates", "Awaiting review"], ["Low-drift reference oscillator", "Draft"]].map(([t, s], i) => (
                <tr key={t} style={{ background: i === 0 ? C["bg-muted"] : "transparent", borderRadius: i === 0 ? radius.xs : 0 }}><td style={{ padding: padding.cell, borderTop: `1px solid ${C.border}` }}>{t}</td><td style={{ padding: padding.cell, borderTop: `1px solid ${C.border}` }}>{s}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Skeleton" note="the placeholder keeps the shape of what it stands for">
        <div aria-hidden="true" style={{ display: "flex", gap: space[4], alignItems: "flex-start" }}>
          <span style={{ display: "block", width: 40, height: 40, background: C["bg-muted"], borderRadius: radius.full }} />
          <div style={{ display: "grid", gap: space[2], width: 320 }}>
            {[100, 80].map((w) => <span key={w} style={{ display: "block", height: 12, width: `${w}%`, background: C["bg-muted"], borderRadius: radius.xs }} />)}
            <span style={{ display: "block", height: 36, width: 140, background: C["bg-muted"], borderRadius: radius.sm }} />
          </div>
          <span style={{ display: "block", width: 200, height: 96, background: C["bg-muted"], borderRadius: radius.md }} />
        </div>
      </Section>
    </main>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const r = (el: HTMLElement) => getComputedStyle(el).borderRadius;
    // The primitives read the scale: card md, input and button sm, badge xs.
    await expect(r(c.getByTestId("nested-card"))).toBe(radius.md);
    await expect(r(c.getByTestId("nested-input"))).toBe(radius.sm);
    await expect(r(c.getByTestId("nested-button"))).toBe(radius.sm);
    await expect(r(c.getByTestId("nested-badge"))).toBe(radius.xs);
    // The control inside the card is tighter than the card.
    await expect(parseFloat(r(c.getByTestId("nested-button")))).toBeLessThan(parseFloat(r(c.getByTestId("nested-card"))));
    // Top rules clip: the container hides overflow.
    for (const box of c.getAllByTestId("top-rule")) await expect(getComputedStyle(box).overflow).toBe("hidden");
    // Grouped controls: only the outer corners are rounded.
    const [first, middle, last] = [...c.getByTestId("grouped").querySelectorAll("button")].map((b) => getComputedStyle(b));
    await expect(first.borderTopLeftRadius).toBe(radius.sm); await expect(first.borderTopRightRadius).toBe("0px");
    await expect(middle.borderTopLeftRadius).toBe("0px"); await expect(middle.borderTopRightRadius).toBe("0px");
    await expect(last.borderTopRightRadius).toBe(radius.sm); await expect(last.borderTopLeftRadius).toBe("0px");
    // Cells stay square.
    for (const cell of c.getByTestId("table-container").querySelectorAll("td, th")) await expect(getComputedStyle(cell).borderRadius).toBe("0px");
  },
};
