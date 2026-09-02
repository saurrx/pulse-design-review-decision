import { route } from "../runtime/registry";
import { getDb, touched } from "../runtime/db";
import { clock } from "../runtime/clock";
import { mulberry32, seedFrom, uuid } from "../runtime/prng";
import { currentUser } from "./scope";

/** Uploads are same-origin, exactly as production: presign, then PUT the bytes to /v1/files/:id/content. */
const svgLogo = (text: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="#11103c"/><text x="48" y="58" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" fill="#f9b418" text-anchor="middle">${text}</text></svg>`;

export const fileHandlers = [
  route("post", "/v1/files/presign-upload", async ({ body }) => {
    const b = (await body()) as { filename?: string; content_type?: string; size?: number; category?: string; client_id?: string };
    const db = getDb(); const u = currentUser();
    const rng = mulberry32(seedFrom(`${b.filename}|${clock.now()}`));
    const id = uuid(rng);
    const name = String(b.filename ?? "upload.bin");
    db.files.push({ id, client_id: b.client_id ?? u?.client_id ?? null, original_name: name, file_name: `${id}-${name}`, content_type: String(b.content_type ?? "application/octet-stream"), size_bytes: Number(b.size ?? 0), status: "PENDING", category: String(b.category ?? "document"), uploaded_by_id: u?.id ?? "", created_at: clock.iso() });
    touched();
    return { id, original_name: name, file_name: `${id}-${name}`, file_path: `v1/files/${id}/raw`, size: Number(b.size ?? 0), type: String(b.content_type ?? "application/octet-stream"), content_type: String(b.content_type ?? "application/octet-stream"), put_url: `/v1/files/${id}/content` };
  }),
  route("put", "/v1/files/:id/content", ({ params }) => {
    const db = getDb();
    const f = db.files.find((x) => x.id === params.id);
    if (!f) return { status: 404, body: { message: "File not found." } };
    f.status = "STORED"; touched();
    return { id: f.id, status: "STORED" };
  }),
  route("get", "/v1/files/:id/download", ({ params }) => ({ url: `/v1/files/${params.id}/raw` })),
  route("delete", "/v1/files/:id", ({ params }) => {
    const db = getDb();
    db.files = db.files.filter((x) => x.id !== params.id); touched();
    return { ok: true };
  }),
  route("get", "/v1/files/:id/raw", ({ params }) => {
    const db = getDb();
    const client = db.clients.find((c) => c.logo_file_id === params.id);
    const f = db.files.find((x) => x.id === params.id);
    const label = client ? client.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "PL";
    if (f && !f.content_type.startsWith("image/")) return { status: 200, body: { note: `mock file ${f.original_name}` } };
    return new Response(svgLogo(label), { status: 200, headers: { "content-type": "image/svg+xml" } }) as unknown as { status: number };
  }),
];
