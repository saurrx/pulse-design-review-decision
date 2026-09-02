/**
 * The mock clock. Every date the mock emits and every "now" the app computes
 * comes from here, so screenshots and structural baselines are stable, and the
 * full app can advance time from the chip (evaluation timelines run on this
 * clock, never on request counts).
 */
const RealDate = Date;
let base = RealDate.parse("2026-09-03T09:00:00.000Z");
let offset = 0;

export const clock = {
  now: () => base + offset,
  iso: () => new RealDate(base + offset).toISOString(),
  set(iso: string) { base = RealDate.parse(iso); offset = 0; },
  advance(ms: number) { offset += ms; },
  daysAgo: (n: number) => new RealDate(base + offset - n * 86_400_000).toISOString(),
  hoursAgo: (n: number) => new RealDate(base + offset - n * 3_600_000).toISOString(),
  daysAhead: (n: number) => new RealDate(base + offset + n * 86_400_000).toISOString(),
};

let installed = false;
/** Make `new Date()` and `Date.now()` read the mock clock. Explicit arguments still work. */
export function installFakeDate() {
  if (installed) return;
  installed = true;
  class MockDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(clock.now());
      else super(...(args as [number]));
    }
    static now() { return clock.now(); }
  }
  Object.defineProperty(MockDate, "name", { value: "Date" });
  (globalThis as { Date: DateConstructor }).Date = MockDate as unknown as DateConstructor;
}
export function uninstallFakeDate() {
  if (!installed) return;
  (globalThis as { Date: DateConstructor }).Date = RealDate;
  installed = false;
}
