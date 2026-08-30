/**
 * Getting readable text out of the file an inventor drops on the draft page.
 *
 * This runs in the BROWSER, on purpose. The alternative — upload the file,
 * extract server-side — would put the whole disclosure document in object
 * storage to answer a question about its text, and the answer is needed for
 * about four seconds. Extracting here means the file never leaves the machine;
 * only the text the inventor is about to put in the form does, and that is the
 * same text the form was always going to send.
 *
 * Both heavy parsers are dynamically imported, so a draft page that nobody
 * uploads a file to never downloads them.
 */

export type ExtractedDocument = { text: string; pages?: number };

export class UnsupportedDocument extends Error {}

const readAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("could not read the file"));
    r.onload = () => resolve(String(r.result ?? ""));
    r.readAsText(file);
  });

async function fromPdf(file: File): Promise<ExtractedDocument> {
  const pdfjs: any = await import("pdfjs-dist");
  // The worker ships with the library; Vite resolves this to a real URL at
  // build time. Without it pdf.js falls back to the main thread and warns.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const parts: string[] = [];
  // 40 pages is far more than any disclosure needs and keeps a mis-dropped
  // 500-page standard from locking the tab.
  const pages = Math.min(doc.numPages, 40);
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it: any) => it.str ?? "").join(" "));
  }
  return { text: parts.join("\n\n").replace(/[ \t]+/g, " ").trim(), pages: doc.numPages };
}

async function fromDocx(file: File): Promise<ExtractedDocument> {
  const mammoth: any = await import("mammoth/mammoth.browser");
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return { text: String(value ?? "").trim() };
}

/**
 * Text from a dropped file, or an UnsupportedDocument naming what to do
 * instead. Never returns an empty success: a file we cannot read is a message,
 * not a silent no-op.
 */
export async function extractDocumentText(file: File): Promise<ExtractedDocument> {
  const name = file.name.toLowerCase();
  const out =
    name.endsWith(".pdf") ? await fromPdf(file)
    : name.endsWith(".docx") ? await fromDocx(file)
    : /\.(txt|md|markdown|rtf)$/.test(name) ? { text: (await readAsText(file)).trim() }
    : null;

  if (!out) {
    throw new UnsupportedDocument(
      name.endsWith(".doc")
        ? "The old .doc format cannot be read in the browser — save it as .docx or paste the text."
        : name.endsWith(".pptx")
          ? "Slides cannot be read directly — paste the text from the slides instead."
          : "That file type cannot be read. Use a PDF, a .docx, or paste the text.",
    );
  }
  if (out.text.length < 40) {
    throw new UnsupportedDocument(
      "There was almost no text in that file — a scanned PDF is a picture of words, not words. Paste the text instead.",
    );
  }
  return out;
}
