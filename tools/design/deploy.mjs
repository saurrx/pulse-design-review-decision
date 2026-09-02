/**
 * Preview deployments: the app and Storybook as two Vercel projects, deployed
 * prebuilt from dist/ and storybook-static/ so what is deployed is exactly what
 * the gates tested. Preview deployments carry Vercel Authentication by default,
 * so only the account owner sees them until protection is relaxed in the
 * project settings. Nothing here builds on Vercel and nothing needs an
 * environment variable.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const sh = (cmd, args, cwd) => { const r = spawnSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed:\n${r.stderr || r.stdout}`); return (r.stdout || "").trim(); };
const scope = process.env.VERCEL_SCOPE ? ["--scope", process.env.VERCEL_SCOPE] : [];
const targets = [
  { project: "pulse-design", dir: "dist", build: ["npm", ["run", "build:design"]], config: { rewrites: [{ source: "/((?!assets/|mockServiceWorker\\.js$).*)", destination: "/index.html" }], headers: [{ source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] }, { source: "/mockServiceWorker.js", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "Service-Worker-Allowed", value: "/" }] }] } },
  { project: "pulse-design-storybook", dir: "storybook-static", build: ["npm", ["run", "storybook:build"]], config: { headers: [{ source: "/mockServiceWorker.js", headers: [{ key: "Cache-Control", value: "no-store" }] }] } },
];
const out = [];
for (const t of targets) {
  if (!process.argv.includes("--no-build")) sh(t.build[0], t.build[1]);
  fs.writeFileSync(path.join(t.dir, "vercel.json"), JSON.stringify(t.config, null, 2) + "\n");
  fs.writeFileSync(path.join(t.dir, ".vercelignore"), "");
  // Create the project if it does not exist, then link the output directory to it and deploy.
  const list = sh("vercel", ["project", "ls", "--format", "json", ...scope]).trim();
  const exists = list.includes(`"name":"${t.project}"`) || list.includes(`"name": "${t.project}"`);
  if (!exists) sh("vercel", ["project", "add", t.project, ...scope]);
  sh("vercel", ["link", "--yes", "--project", t.project, ...scope], t.dir);
  const url = sh("vercel", ["deploy", "--yes", ...scope], t.dir).split("\n").filter((l) => l.startsWith("https://")).at(-1);
  out.push({ project: t.project, url });
  console.log(`${t.project}: ${url}`);
}
fs.writeFileSync("changes/SPIKE/previews.json", JSON.stringify({ deployed: new Date().toISOString(), previews: out }, null, 2) + "\n");
