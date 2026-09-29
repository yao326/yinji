import exifr from "exifr";
import type { Photo, PhotoLocation } from "../data/demoPhotos";
import type { StoredLocation } from "./store";

export type ImportResult = {
  locations: PhotoLocation[];
  stored: StoredLocation[];
  totalPhotos: number;
  skipped: string[];
  failed: string[];
};

function toIsoDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const d = new Date(value.replace(" ", "T"));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return undefined;
}

function shortCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lng).toFixed(2)}°${ew}`;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=zh`;
    const res = await fetch(url, { headers: { "User-Agent": "yinji-local-app" } });
    if (!res.ok) return shortCoord(lat, lng);
    const data = await res.json();
    const a = data?.address;
    const city = a?.city || a?.town || a?.village || a?.county || a?.state || a?.country;
    return city ? `${city}` : shortCoord(lat, lng);
  } catch {
    return shortCoord(lat, lng);
  }
}

function runId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function importPhotosFromFiles(files: File[]): Promise<ImportResult> {
  type Parsed = { id: string; title: string; date: string; file: File; coordinates: [number, number] };
  const parsed: Parsed[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  const run = runId();

  for (const file of files) {
    try {
      const gps = await exifr.gps(file);
      const meta = await exifr.parse(file, ["DateTimeOriginal", "CreateDate", "ModifyDate"]);
      if (!gps || typeof gps.latitude !== "number" || typeof gps.longitude !== "number") {
        skipped.push(file.name);
        continue;
      }
      const date =
        toIsoDate(meta?.DateTimeOriginal) ||
        toIsoDate(meta?.CreateDate) ||
        toIsoDate(meta?.ModifyDate) ||
        new Date(file.lastModified).toISOString().slice(0, 10);

      parsed.push({
        id: `${run}-${parsed.length + 1}`,
        title: file.name.replace(/\.[^.]+$/, ""),
        date,
        file,
        coordinates: [gps.longitude, gps.latitude],
      });
    } catch {
      failed.push(file.name);
    }
  }

  // 按约 1 公里内聚类，同一处照片堆叠成一组
  const groups = new Map<string, { coordinates: [number, number]; photos: Parsed[] }>();
  for (const item of parsed) {
    const key = `${item.coordinates[1].toFixed(2)},${item.coordinates[0].toFixed(2)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.photos.push(item);
    } else {
      groups.set(key, { coordinates: item.coordinates, photos: [item] });
    }
  }

  const locations: PhotoLocation[] = [];
  const stored: StoredLocation[] = [];
  let n = 0;
  for (const group of groups.values()) {
    n += 1;
    const [lng, lat] = group.coordinates;
    const name = await reverseGeocode(lat, lng);
    const cover = group.photos[0];
    const locId = `${run}-loc-${n}`;

    locations.push({
      id: locId,
      name,
      country: shortCoord(lat, lng),
      coordinates: group.coordinates,
      coverPhotoId: cover.id,
      photos: group.photos.map((p) => ({
        id: p.id,
        title: p.title,
        image: URL.createObjectURL(p.file),
        date: p.date,
      })),
    });

    stored.push({
      id: locId,
      name,
      country: shortCoord(lat, lng),
      coordinates: group.coordinates,
      coverPhotoId: cover.id,
      photos: group.photos.map((p) => ({
        id: p.id,
        title: p.title,
        date: p.date,
        blob: p.file,
      })),
    });
  }

  return { locations, stored, totalPhotos: parsed.length, skipped, failed };
}