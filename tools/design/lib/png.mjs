/** Decode a Playwright PNG (8-bit RGB or RGBA, non-interlaced) and report where two decodes differ. Dependency-free. */
import zlib from "node:zlib";

export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png");
  let pos = 8, width = 0, height = 0, channels = 4, bitDepth = 8; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos); const type = buf.toString("ascii", pos + 4, pos + 8); const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; const ct = data[9]; channels = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : 1; if (data[12] !== 0) throw new Error("interlaced png"); }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("unsupported bit depth");
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels, stride = width * bpp, out = Buffer.alloc(width * height * bpp);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)); const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1; else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    cur.copy(out, y * stride); prev = cur;
  }
  return { width, height, channels, data: out };
}

/** Bounding box and count of differing pixels between two same-size PNG buffers; null when identical. */
export function diffBox(a, b) {
  const A = decodePng(a), B = decodePng(b);
  if (A.width !== B.width || A.height !== B.height) return { count: -1, box: null, note: "size differs" };
  let count = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1; const c = A.channels;
  for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
    const i = (y * A.width + x) * c;
    let same = true; for (let k = 0; k < c; k++) if (A.data[i + k] !== B.data[i + k]) { same = false; break; }
    if (!same) { count++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  return count ? { count, box: [x0, y0, x1, y1] } : null;
}
