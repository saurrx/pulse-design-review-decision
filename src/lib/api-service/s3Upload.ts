import { rawApi } from "@/lib/apiConfig";

/**
 * Real file upload, through the API's own origin.
 *
 *   1. ask the API to presign — this validates type and size and creates the
 *      PENDING row
 *   2. PUT the bytes to /v1/files/:id/content, which streams them into Spaces
 *      and flips the row to STORED once the object is provably there
 *
 * Step 2 used to PUT straight at the presigned DigitalOcean Spaces URL, and
 * that never worked in a browser here. It is cross-origin, so it needs a CORS
 * rule on the bucket AND a `connect-src` entry for the bucket host in
 * vercel.json's CSP. Neither existed: measured 2026-09-01, the preflight
 * returned 403 with no Access-Control-Allow-Origin, and the CSP blocked the
 * connection before even that. Every upload in the product failed the same
 * way — portfolio imports, idea attachments, client logos — and, because a CSP
 * block produces an Error with no HTTP response, every one of them surfaced as
 * the generic "An error occurred while uploading the file" (F-062).
 *
 * Same-origin is not a workaround, it is the same decision the app already
 * makes for cookies (see CLAUDE.md §3): /v1/* is proxied on this origin, so
 * there is no preflight to satisfy, no bucket CORS to configure from a control
 * panel nobody can script, and no external host in the CSP.
 *
 * The return shape is the FileRecord the screens already read (file_path,
 * original_name, …), so no call site changed when this stopped being a mock.
 *
 * `rawApi` is used deliberately rather than the adapter: these are new /v1
 * endpoints, so there is nothing to translate.
 */

/**
 * The upload result the screens read. Carries BOTH dialects deliberately: some
 * components read file_path/original_name/type, others the old camelCase
 * key/originalName/contentType. Rather than touch either set of call sites, the
 * record answers to both — the aliases are filled from the canonical fields.
 */
export interface FileRecord {
  id: string;
  original_name: string;
  file_name: string;
  file_path: string;
  size: number;
  type: string;
  // legacy aliases the mock exposed; some screens still read these
  key: string;
  originalName: string;
  contentType: string;
}

/** Fill the legacy aliases from the API's snake_case payload. */
function withAliases(r: any): FileRecord {
  return {
    id: r.id, original_name: r.original_name, file_name: r.file_name ?? r.original_name,
    file_path: r.file_path, size: r.size, type: r.type,
    key: r.file_path, originalName: r.original_name, contentType: r.type,
  };
}

async function presign(file: File, category: "image" | "idea" | "patent", clientId?: string) {
  const { data } = await rawApi.post("/v1/files/presign-upload", {
    filename: file.name,
    content_type: file.type || "application/octet-stream",
    size: file.size,
    category,
    // Whose file this is. Without it the API falls back to the CALLER's client,
    // which is null for a Photon-side user — so a portfolio uploaded for a
    // client by a PHOTON_ADMIN landed under `photon/` with no client_id, fenced
    // to nobody and invisible on the client's own page.
    ...(clientId ? { client_id: clientId } : {}),
  });
  return withAliases(data);
}

/**
 * The bytes, same-origin.
 *
 * `application/octet-stream` is required by the route and is not a formality:
 * Nest's global json parser would consume a body labelled application/json
 * before the handler ran, leaving an empty stream behind. What the file
 * actually IS was settled at presign, against the server's allowlist.
 */
async function putContent(id: string, file: File) {
  await rawApi.put(`/v1/files/${id}/content`, file, {
    headers: { "content-type": "application/octet-stream" },
    // Axios would otherwise try to be helpful with a File.
    transformRequest: [(body) => body],
  });
}

export async function s3Upload(
  file: File,
  category: "image" | "idea" | "patent" = "image",
  clientId?: string,
): Promise<FileRecord> {
  const p = await presign(file, category, clientId);
  // No separate confirm step: the content route only answers once the bytes are
  // in storage, so a successful PUT IS the confirmation. The old three-hop
  // version could leave a PENDING row behind whenever the third call was the
  // one that failed.
  await putContent(p.id, file);
  return p;
}

export async function s3UploadMultiple(
  files: File[],
  category: "image" | "idea" | "patent" = "image",
): Promise<FileRecord[]> {
  // Sequential on purpose: a Spaces account has per-second limits, and an
  // import of a few dozen files does not need the concurrency badly enough to
  // risk throttling mid-batch.
  const out: FileRecord[] = [];
  for (const f of files) out.push(await s3Upload(f, category));
  return out;
}

/** Import path used the "ForImport" name; keep it pointing at the real upload.
 *  Takes the client explicitly: a portfolio belongs to the client it describes,
 *  not to whoever happened to upload it. */
export const s3UploadForImport = (
  file: File, category: "patent" | "idea" = "patent", clientId?: string,
) => s3Upload(file, category, clientId);
