import { rawApi } from "@/lib/apiConfig";

/**
 * Real file upload against DigitalOcean Spaces, via the API's presign flow.
 *
 * Bytes go straight from the browser to Spaces, never through the API:
 *   1. ask the API for a presigned PUT url (this also creates the DB row)
 *   2. PUT the file to Spaces directly
 *   3. tell the API to confirm — the row flips to STORED
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

async function presign(file: File, category: "image" | "idea" | "patent") {
  const { data } = await rawApi.post("/v1/files/presign-upload", {
    filename: file.name,
    content_type: file.type || "application/octet-stream",
    size: file.size,
    category,
  });
  return { ...withAliases(data), put_url: (data as any).put_url } as FileRecord & { put_url: string };
}

async function putToSpaces(url: string, file: File) {
  // A bare PUT with the file body — the presigned url carries the auth. No
  // credentials header, and no cookies (this is cross-origin to the bucket).
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

export async function s3Upload(
  file: File,
  category: "image" | "idea" | "patent" = "image",
): Promise<FileRecord> {
  const p = await presign(file, category);
  await putToSpaces(p.put_url, file);
  const { data } = await rawApi.post("/v1/files/confirm-upload", { id: p.id });
  return withAliases(data);
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

/** Import path used the "ForImport" name; keep it pointing at the real upload. */
export const s3UploadForImport = (file: File, category: "patent" | "idea" = "patent") =>
  s3Upload(file, category);
