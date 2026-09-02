import React from "react";
import { createRoot } from "react-dom/client";
import { SCENARIOS } from "../scenarios";
import { getDb, clearSnapshot } from "./db";
import { clock } from "./clock";
import { stats } from "./registry";
import { writeSelection, writeSessionCookie, clearSessionCookie, clearProductionStorage, readSessionUser } from "./session";

/**
 * The persona and scenario switcher. Mounted OUTSIDE #root, styled inline so it
 * needs nothing from the app's stylesheet, and never part of a patch. Switching
 * writes the session cookie exactly as production's login does, then reloads.
 */
const box: React.CSSProperties = { position: "fixed", left: 12, bottom: 12, zIndex: 2147483000, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, color: "#0c0c0c", background: "#fff", border: "1px solid #c8c8c8", borderRadius: 2, padding: "8px 10px", boxShadow: "0 1px 2px rgba(0,0,0,.05)", display: "grid", gap: 6, minWidth: 260 };
const label: React.CSSProperties = { letterSpacing: ".08em", textTransform: "uppercase", color: "#727272", fontSize: 10 };
const select: React.CSSProperties = { font: "inherit", border: "1px solid #c8c8c8", borderRadius: 2, padding: "3px 6px", background: "#fff", width: "100%" };
const button: React.CSSProperties = { font: "inherit", border: "1px solid #c8c8c8", borderRadius: 2, padding: "3px 8px", background: "#fafafa", cursor: "pointer" };
const badge = (bg: string): React.CSSProperties => ({ display: "inline-block", padding: "1px 6px", borderRadius: 2, background: bg, color: "#0c0c0c", fontWeight: 600 });

function Chip({ scenario }: { scenario: string }) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  const [open, setOpen] = React.useState(true);
  React.useEffect(() => { const t = setInterval(tick, 1000); return () => clearInterval(t); }, []);
  const db = getDb();
  const def = SCENARIOS[scenario];
  const session = readSessionUser();
  const persona = db.users.find((u) => u.email === session?.email) ?? null;

  const switchPersona = (email: string) => {
    const u = db.users.find((x) => x.email === email);
    if (!u) return;
    clearProductionStorage();
    writeSessionCookie(u, db);
    writeSelection({ scenario, persona: email });
    location.assign("/");
  };
  const switchScenario = (name: string) => {
    clearProductionStorage();
    clearSessionCookie();
    writeSelection({ scenario: name, persona: null });
    location.assign("/login");
  };
  const reset = () => { clearSnapshot(scenario); clearProductionStorage(); location.reload(); };
  const signOut = () => { clearSessionCookie(); clearProductionStorage(); location.assign("/login"); };

  if (!open) return <button style={{ ...box, minWidth: 0, cursor: "pointer" }} onClick={() => setOpen(true)} aria-label="Open design tools"><span style={badge("#fdf3dc")}>MOCK</span></button>;
  return (
    <div style={box} role="region" aria-label="Design tools">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span><span style={badge("#fdf3dc")}>MOCK</span> <span style={label}>{def?.title ?? scenario}</span></span>
        <button style={button} onClick={() => setOpen(false)} aria-label="Collapse design tools">×</button>
      </div>
      <label style={label}>Scenario
        <select style={select} value={scenario} onChange={(e) => switchScenario(e.target.value)}>
          {Object.values(SCENARIOS).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
      </label>
      <label style={label}>Persona
        <select style={select} value={persona?.email ?? ""} onChange={(e) => switchPersona(e.target.value)}>
          <option value="">signed out</option>
          {db.users.filter((u) => (def?.personas ?? []).includes(u.email) || u.role.startsWith("PHOTON") || u.role === "CASE_OWNER").map((u) => <option key={u.email} value={u.email}>{u.role.toLowerCase().replace("_", " ")} · {u.name}</option>)}
        </select>
      </label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={label}>clock {clock.iso().slice(0, 16).replace("T", " ")}</span>
        <button style={button} onClick={() => { clock.advance(10_000); tick(); }}>+10s</button>
        <button style={button} onClick={() => { clock.advance(86_400_000); tick(); }}>+1d</button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button style={button} onClick={reset}>Reset scenario</button>
        <button style={button} onClick={signOut}>Sign out</button>
      </div>
      {stats.proposedHits.length > 0 && <div style={badge("#f7edeb")}>needs backend: {[...new Set(stats.proposedHits)].join(", ")}</div>}
      {stats.unhandled.length > 0 && <div style={badge("#f7edeb")}>unhandled /v1: {[...new Set(stats.unhandled)].join(", ")}</div>}
      {stats.blocked.length > 0 && <div style={badge("#f7edeb")}>blocked hosts: {[...new Set(stats.blocked)].join(", ")}</div>}
      <div style={label}>{stats.served} requests served · scenario {db.scenario}</div>
    </div>
  );
}

export function mountChip(scenario: string) {
  let host = document.getElementById("design-tools");
  if (!host) { host = document.createElement("div"); host.id = "design-tools"; document.body.appendChild(host); }
  createRoot(host).render(<Chip scenario={scenario} />);
}
