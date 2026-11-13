// Gemeinsame Speicher-Hilfen für delete-account und privacy-purge (Supabase Storage mit service_role).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Entfernt Objekte in Blöcken (Storage-API verarbeitet Listen). Fehlende Dateien sind kein Fehler. */
export async function removeObjects(admin: SupabaseClient, bucket: string, paths: string[]): Promise<void> {
  const list = paths.filter(Boolean);
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500);
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) throw error;
  }
}

/** Alle Objektpfade unterhalb eines Ordners; Unterordner (id === null) bis zur Tiefe `depth`. */
export async function listObjects(admin: SupabaseClient, bucket: string, folder: string, depth = 1): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: pageSize, offset });
    if (error) throw error;
    for (const obj of (data ?? []) as { name: string; id: string | null }[]) {
      const path = `${folder}/${obj.name}`;
      if (obj.id === null) { if (depth > 1) paths.push(...(await listObjects(admin, bucket, path, depth - 1))); }
      else paths.push(path);
    }
    if (!data || data.length < pageSize) break;
  }
  return paths;
}
