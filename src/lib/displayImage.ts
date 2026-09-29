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

async function downscale(blob: Blob, maxSize: number, quality: number): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= maxSize) {
    bitmap.close();
    return blob;
  }

  const scale = maxSize / longest;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const converted = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  return converted ?? blob;
}

// 看图用：最长边压到 1600，兼顾清晰度和流畅度
export async function toDisplayBlob(blob: Blob): Promise<Blob> {
  const decodable = await normalizeToDecodable(blob);
  return downscale(decodable, 1600, 0.85);
}

// 地球卡片 / 相册缩略图：最长边 480，显著减少内存和卡顿
export async function toThumbBlob(blob: Blob): Promise<Blob> {
  const decodable = await normalizeToDecodable(blob);
  return downscale(decodable, 480, 0.8);
}