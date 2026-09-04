// PostToolUse hook (matcher: Read). Records every file the session opened so
// verify-gate.mjs can require evidence before the ledger changes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(input || "{}");
    const file = j?.tool_input?.file_path;
    if (!file) return;
    const log = path.join(os.tmpdir(), `pulse-reads-${j.session_id || "session"}.log`);
    fs.appendFileSync(log, file + "\n");
  } catch { /* never block on a tracking failure */ }
});
