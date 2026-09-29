import type { PhotoLocation } from "../data/demoPhotos";

export type StoredPhoto = {
  id: string;
  title: string;
  date: string;
  blob: Blob;
};

export type StoredLocation = {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number];
  coverPhotoId: string;
  photos: StoredPhoto[];
};

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

export async function saveImported(locations: StoredLocation[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const loc of locations) store.put(loc);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadImported(): Promise<PhotoLocation[]> {
  const db = await openDb();
  const stored: StoredLocation[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as StoredLocation[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return stored.map((loc) => ({
    id: loc.id,
    name: loc.name,
    country: loc.country,
    coordinates: loc.coordinates,
    coverPhotoId: loc.coverPhotoId,
    photos: loc.photos.map((p) => ({
      id: p.id,
      title: p.title,
      image: URL.createObjectURL(p.blob),
      date: p.date,
    })),
  }));
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