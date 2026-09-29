const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

async function looksLikeHeic(blob: Blob): Promise<boolean> {
  if (/heic|heif/i.test(blob.type)) return true;
  if (blob.size < 12) return false;

  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  return ascii(head, 4, 4) === "ftyp" && HEIC_BRANDS.has(ascii(head, 8, 4));
}

async function normalizeToDecodable(blob: Blob): Promise<Blob> {
  if (blob.type === "image/jpeg" || blob.type === "image/png" || blob.type === "image/webp") {
    return blob;
  }

  if (!(await looksLikeHeic(blob))) return blob;

  try {
    const { heicTo, isHeic } = await import("heic-to");
    const file = blob instanceof File ? blob : new File([blob], "photo.heic", { type: "image/heic" });
    if (!(await isHeic(file))) return blob;
    return await heicTo({ blob, type: "image/jpeg", quality: 0.92 });
  } catch {
    return blob;
  }
}

async function renderScaled(
  bitmap: ImageBitmap,
  original: Blob,
  maxSize: number,
  quality: number
): Promise<Blob> {
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= maxSize) return original;

  const scale = maxSize / longest;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;

  ctx.drawImage(bitmap, 0, 0, width, height);
  const converted = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  return converted ?? original;
}

// 一次解码，同时生成「看图用」和「缩略图」两个尺寸，迁移更快
export async function toDisplayAndThumb(blob: Blob): Promise<{ display: Blob; thumb: Blob }> {
  const decodable = await normalizeToDecodable(blob);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(decodable);
  } catch {
    return { display: decodable, thumb: decodable };
  }

  const display = await renderScaled(bitmap, decodable, 1600, 0.85);
  const thumb = await renderScaled(bitmap, decodable, 480, 0.8);
  bitmap.close();
  return { display, thumb };
}

export async function toDisplayBlob(blob: Blob): Promise<Blob> {
  const { display } = await toDisplayAndThumb(blob);
  return display;
}

export async function toThumbBlob(blob: Blob): Promise<Blob> {
  const { thumb } = await toDisplayAndThumb(blob);
  return thumb;
}