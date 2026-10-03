import type { PhotoLocation, StoredLocation } from "../data/types";
import { toDisplayAndThumb } from "./displayImage";
import { matchCity } from "./cities";

const DB_NAME = "yinji";
const STORE = "locations";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readStoredLocations(db: IDBDatabase): Promise<StoredLocation[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).openCursor();
    const locations: StoredLocation[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      locations.push(cursor.value as StoredLocation);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve(locations);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("读取本地照片库失败"));
  });
}

async function toPhotoLocation(location: StoredLocation): Promise<{
  location: PhotoLocation;
  changed: boolean;
}> {
  let changed = false;

  // 用内置城市库自动校准地名（用户手动改过的除外），修正旧数据里匹配错的城市
  if (!location.renamed) {
    const city = matchCity(location.coordinates[0], location.coordinates[1]);
    if (city && city !== location.name) {
      location.name = city;
      changed = true;
    }
  }

  const photos: PhotoLocation["photos"] = [];

  for (const photo of location.photos) {
    const jpegLike =
      photo.blob.type === "image/jpeg" ||
      photo.blob.type === "image/png" ||
      photo.blob.type === "image/webp";

    // 缩略图缺失、或过大（说明没真正压小）都要重新生成
    const thumbTooBig = !!photo.thumbBlob && photo.thumbBlob.size > 200 * 1024;

    // 已处理过（有缩略图且主图已压缩）就直接用，避免每次打开都重新解码
    if (photo.thumbBlob && jpegLike && !thumbTooBig) {
      photos.push({
        id: photo.id,
        title: photo.title,
        image: URL.createObjectURL(photo.blob),
        thumb: URL.createObjectURL(photo.thumbBlob),
        date: photo.date
      });
      continue;
    }

    const { display, thumb } = await toDisplayAndThumb(photo.blob);
    if (display !== photo.blob) {
      photo.blob = display;
      changed = true;
    }
    if (!photo.thumbBlob || thumbTooBig) {
      photo.thumbBlob = thumb;
      changed = true;
    }

    photos.push({
      id: photo.id,
      title: photo.title,
      image: URL.createObjectURL(photo.blob),
      thumb: URL.createObjectURL(photo.thumbBlob as Blob),
      date: photo.date
    });
  }

  return {
    changed,
    location: {
      id: location.id,
      name: location.name,
      country: location.country,
      coordinates: location.coordinates,
      coverPhotoId: location.coverPhotoId,
      photos
    }
  };
}

export async function saveImported(locations: StoredLocation[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const location of locations) store.put(location);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadImported(
  onBatch?: (locations: PhotoLocation[]) => void
): Promise<PhotoLocation[]> {
  const db = await openDb();
  let stored: StoredLocation[] = [];

  try {
    stored = await readStoredLocations(db);
  } finally {
    db.close();
  }

  const locations: PhotoLocation[] = [];
  let batch: PhotoLocation[] = [];

  const flush = () => {
    if (!batch.length) return;
    const ready = batch;
    batch = [];
    try {
      onBatch?.(ready);
    } catch {
      // Loading should continue even if the UI callback fails.
    }
  };

  for (const storedLocation of stored) {
    const result = await toPhotoLocation(storedLocation);
    locations.push(result.location);
    batch.push(result.location);

    if (result.changed) {
      await saveImported([storedLocation]);
    }
    if (batch.length >= 2) flush();
  }

  flush();
  return locations;
}

export async function renameLocation(id: string, name: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const loc = getReq.result as StoredLocation | undefined;
      if (loc) {
        loc.name = name;
        loc.renamed = true;
        store.put(loc);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function removePhoto(photoId: string): Promise<void> {
  const db = await openDb();
  let stored: StoredLocation[] = [];
  try {
    stored = await readStoredLocations(db);
  } catch {
    db.close();
    return;
  }

  for (const loc of stored) {
    const idx = loc.photos.findIndex((p) => p.id === photoId);
    if (idx >= 0) {
      loc.photos.splice(idx, 1);
      if (loc.coverPhotoId === photoId) {
        loc.coverPhotoId = loc.photos[0]?.id ?? "";
      }
      break;
    }
  }

  const remaining = stored.filter((loc) => loc.photos.length > 0);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.clear();
    for (const loc of remaining) store.put(loc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearImported(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}