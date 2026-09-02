import type { Db, ScenarioDef } from "./types";

/**
 * The in-memory store. Rebuilt from a scenario on every boot; in the full app
 * it also snapshots to local storage so a click-through survives a reload and
 * a reset is one button. In Storybook and in CI persistence is off and every
 * story rebuilds it (frames share one origin, so a shared snapshot would leak
 * one story's mutations into the next).
 */
export const SEED_VERSION = 1;
let db: Db | null = null;
let persist = false;
let saveTimer: number | undefined;

const key = (scenario: string) => `pulse-design.db.v${SEED_VERSION}.${scenario}`;

export function resetDb(scenario: ScenarioDef, options: { persist: boolean; fresh?: boolean }): Db {
  persist = options.persist;
  if (persist && !options.fresh) {
    try {
      const raw = localStorage.getItem(key(scenario.name));
      if (raw) {
        const parsed = JSON.parse(raw) as Db;
        if (parsed.seedVersion === SEED_VERSION && parsed.scenario === scenario.name) { db = parsed; return db; }
      }
    } catch { /* storage unavailable: fall through to a fresh seed */ }
  }
  db = { scenario: scenario.name, seedVersion: SEED_VERSION, ...scenario.build() };
  if (persist) save();
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("[pulse-design] mock store used before a scenario was seeded");
  return db;
}

/** Call after every mutation. Debounced snapshot when persistence is on. */
export function touched() {
  if (!persist || !db) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 300);
}

function save() {
  if (!db) return;
  try { localStorage.setItem(key(db.scenario), JSON.stringify(db)); } catch { /* quota or private mode */ }
}

export function clearSnapshot(scenario: string) {
  try { localStorage.removeItem(key(scenario)); } catch { /* ignore */ }
}
