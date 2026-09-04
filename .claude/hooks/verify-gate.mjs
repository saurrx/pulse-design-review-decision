// PreToolUse hook (matcher: Edit|Write|MultiEdit). The ledger
// (design/v0/coverage.json) may only change after this session has opened at
// least two screenshots under changes/DSN-*/shots/ with the Read tool. Exit 2
// blocks the tool call; the message goes back to the model.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", () => {
  let j = {};
  try { j = JSON.parse(input || "{}"); } catch { process.exit(0); }
  const file = String(j?.tool_input?.file_path || "");
  if (!/design\/v0\/coverage\.json$/.test(file)) process.exit(0);
  const log = path.join(os.tmpdir(), `pulse-reads-${j.session_id || "session"}.log`);
  const reads = fs.existsSync(log) ? fs.readFileSync(log, "utf8").split("\n") : [];
  const shots = reads.filter((r) => /changes\/DSN-\d+\/shots\/.*\.png$/.test(r));
  if (shots.length >= 2) process.exit(0);
  console.error(
    `Blocked: design/v0/coverage.json is the ledger. Open at least two screenshots under changes/DSN-NNNN/shots/ with the Read tool and inspect them before flipping a surface's dsn (found ${shots.length}).`
  );
  process.exit(2);
});
