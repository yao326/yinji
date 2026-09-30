import { supabase } from "./supabase";
import type { PhotoLocation, StoredLocation } from "../data/types";

// ===== 认证 =====
export async function signUp(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signUp({ email, password });
  return error?.message ?? null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error?.message ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ===== 加载云端照片 =====
export async function loadCloudLocations(): Promise<PhotoLocation[]> {
  const { data: locs, error: locErr } = await supabase
    .from("locations")
    .select("*")
    .order("created_at", { ascending: true });

  if (locErr) throw locErr;
  if (!locs || locs.length === 0) return [];

  const locIds = locs.map((l) => l.id);
  const { data: photos, error: phErr } = await supabase
    .from("photos")
    .select("*")
    .in("location_id", locIds);

  if (phErr) throw phErr;

  // 批量生成签名 URL（24 小时有效）
  const paths: string[] = [];
  (photos || []).forEach((p: any) => {
    if (p.display_path) paths.push(p.display_path);
    if (p.thumb_path) paths.push(p.thumb_path);
  });

  const urlMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: signErr } = await supabase.storage
      .from("photos")
      .createSignedUrls(paths, 86400);
    if (!signErr && signed) {
      signed.forEach((s: any) => {
        if (s.path && s.signedUrl) urlMap.set(s.path, s.signedUrl);
      });
    }
  }

  return locs.map((loc: any) => {
    const locPhotos = (photos || [])
      .filter((p: any) => p.location_id === loc.id)
      .map((p: any) => ({
        id: p.id,
        title: p.title,
        image: p.display_path ? urlMap.get(p.display_path) ?? "" : "",
        thumb: p.thumb_path ? urlMap.get(p.thumb_path) ?? "" : "",
        date: p.date ?? ""
      }));

    return {
      id: loc.id,
      name: loc.name,
      country: loc.country ?? "",
      coordinates: [loc.lng, loc.lat] as [number, number],
      coverPhotoId: loc.cover_photo_id || locPhotos[0]?.id || "",
      photos: locPhotos
    };
  });
}

// ===== 导入照片（上传到云端） =====
export async function uploadLocations(storedLocations: StoredLocation[]): Promise<number> {
  const userId = await currentUserId();
  if (!userId) throw new Error("未登录");

  let count = 0;
  for (const loc of storedLocations) {
    const photoRows: any[] = [];
    for (const photo of loc.photos) {
      const displayPath = userId + "/" + photo.id + ".jpg";
      const thumbPath = userId + "/" + photo.id + "_thumb.jpg";
      const { error: dErr } = await supabase.storage
        .from("photos")
        .upload(displayPath, photo.blob, { upsert: true });
      if (dErr) throw dErr;
      const { error: tErr } = await supabase.storage
        .from("photos")
        .upload(thumbPath, photo.thumbBlob ?? photo.blob, { upsert: true });
      if (tErr) throw tErr;
      photoRows.push({
        id: photo.id,
        title: photo.title,
        date: photo.date,
        display_path: displayPath,
        thumb_path: thumbPath
      });
      count += 1;
    }

    const coverPhotoId =
      photoRows.find((p) => p.id === loc.coverPhotoId)?.id ?? photoRows[0]?.id ?? "";

    const { error: locErr } = await supabase.from("locations").insert({
      id: loc.id,
      user_id: userId,
      name: loc.name,
      country: loc.country,
      lat: loc.coordinates[1],
      lng: loc.coordinates[0],
      cover_photo_id: coverPhotoId
    });
    if (locErr) throw locErr;

    const rows = photoRows.map((p) => ({
      ...p,
      location_id: loc.id,
      user_id: userId
    }));
    const { error: phErr } = await supabase.from("photos").insert(rows);
    if (phErr) throw phErr;
  }

  return count;
}

// ===== 删除照片 =====

// ===== 云端改名 =====
export async function renameCloudLocation(locationId: string, name: string): Promise<void> {
  const { error } = await supabase.from("locations").update({ name }).eq("id", locationId);
  if (error) throw error;
}
export async function deleteCloudPhoto(photoId: string): Promise<void> {
  const { data: photo, error: phErr } = await supabase
    .from("photos")
    .select("*")
    .eq("id", photoId)
    .single();
  if (phErr || !photo) return;

  const p = photo as any;
  if (p.display_path) await supabase.storage.from("photos").remove([p.display_path]);
  if (p.thumb_path) await supabase.storage.from("photos").remove([p.thumb_path]);

  await supabase.from("photos").delete().eq("id", photoId);

  const { data: remaining } = await supabase
    .from("photos")
    .select("id")
    .eq("location_id", p.location_id);
  if (!remaining || remaining.length === 0) {
    await supabase.from("locations").delete().eq("id", p.location_id);
  }
}
