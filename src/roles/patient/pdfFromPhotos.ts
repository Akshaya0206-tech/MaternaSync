// Several photos of a report (a phone camera, one page each) combined into ONE PDF in the browser, so they reach her doctor as one document.
// Nothing here needs a library: each photo is shrunk on a canvas, saved as a JPEG, and written into a small PDF (one page per photo,
// with the JPEG stored as it is). The result is uploaded through the same endpoint as any other file.

const LONGEST_SIDE = 1600; // pixels; enough to read printed text, small enough to upload on a slow connection
const JPEG_QUALITY = 0.85;
const POINTS_PER_PIXEL = 0.5; // a PDF page is measured in points (1/72 inch)
export const MOST_PHOTOS = 20;

export interface PdfPage {
  /** Pixels. */
  width: number;
  height: number;
  /** A JPEG file's bytes. */
  jpeg: Uint8Array;
}

/** The bytes of a PDF with one page per picture, each page the size of its picture. */
export function buildPdf(pages: PdfPage[]): Uint8Array {
  const text = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? text.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, dictionary: string, stream?: Uint8Array) => {
    offsets[id] = length;
    write(`${id} 0 obj\n${dictionary}\n`);
    if (stream) {
      write('stream\n');
      write(stream);
      write('\nendstream\n');
    }
    write('endobj\n');
  };

  write('%PDF-1.4\n');
  write(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // a comment of high bytes tells programs this file is binary
  // 1 = catalog, 2 = page list; then three objects for each page: the page, what it draws, and its picture.
  const pageId = (index: number) => 3 + index * 3;
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageId(index)} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  pages.forEach((page, index) => {
    const width = +(page.width * POINTS_PER_PIXEL).toFixed(2);
    const height = +(page.height * POINTS_PER_PIXEL).toFixed(2);
    const draw = text.encode(`q ${width} 0 0 ${height} 0 0 cm /Photo Do Q`);
    object(pageId(index), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Photo ${pageId(index) + 2} 0 R >> >> /Contents ${pageId(index) + 1} 0 R >>`);
    object(pageId(index) + 1, `<< /Length ${draw.length} >>`, draw);
    object(pageId(index) + 2, `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>`, page.jpeg);
  });

  const count = 3 + pages.length * 3; // objects 0..count-1 (0 is the free entry)
  const tableAt = length;
  write(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) write(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  write(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${tableAt}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/** Reads a photo the way it looks (a phone often stores it sideways and marks it as turned). */
async function decode(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // An older browser: let an <img> do it (it turns the photo upright by itself).
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('unreadable photo');
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

async function toPage(file: File): Promise<PdfPage> {
  const picture = await decode(file);
  try {
    if (!picture.width || !picture.height) throw new Error('unreadable photo');
    const scale = Math.min(1, LONGEST_SIDE / Math.max(picture.width, picture.height));
    const width = Math.max(1, Math.round(picture.width * scale));
    const height = Math.max(1, Math.round(picture.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no canvas');
    context.fillStyle = '#ffffff'; // a PNG with see-through parts would otherwise turn black
    context.fillRect(0, 0, width, height);
    context.drawImage(picture.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error('could not save the photo');
    return { width, height, jpeg: new Uint8Array(await blob.arrayBuffer()) };
  } finally {
    picture.release();
  }
}

/** The photos, in this order, as one PDF file. Throws if a photo cannot be read. */
export async function photosToPdf(photos: File[], when = new Date()): Promise<File> {
  const pages: PdfPage[] = [];
  for (const photo of photos) pages.push(await toPage(photo)); // one at a time: a phone has little memory for big pictures
  const day = new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return new File([buildPdf(pages) as BlobPart], `photos-${day}.pdf`, { type: 'application/pdf' });
}
