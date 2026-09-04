import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".map": "application/json", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

/** Serve a static directory on a port. Storybook's static build needs nothing more. */
export function serveStatic(dir, port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let file = path.join(dir, decodeURIComponent(url.pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(() => new Promise((r) => server.close(r)))));
}

/** Story ids from Storybook's index, type "story" only, with source and tags. */
export function storiesFrom(dir) {
  const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8"));
  return Object.values(index.entries).filter((e) => e.type === "story").map((e) => ({ id: e.id, title: e.title, name: e.name, tags: e.tags ?? [], importPath: e.importPath ?? "" }));
}

/** Abort any request that would leave the machine; return the list of blocked hosts. */
export async function blockEgress(context) {
  const blocked = [];
  await context.route("**/*", (route) => {
    const host = new URL(route.request().url()).host;
    if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return route.continue();
    blocked.push(host);
    return route.abort("blockedbyclient");
  });
  return blocked;
}
