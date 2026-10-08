// Edge Function "delete-account" – Konto vollständig löschen (DSGVO Art. 17).
//
// Aufruf (App): supabase.functions.invoke('delete-account', { method: 'POST' })
// Antwort:      200 { ok: true } · 401 { error: 'unauthorized' } · 500 { error: 'internal' }
//
// Ablauf (mit service_role):
//   1. Fotos der eigenen Spielerzeilen aus dem Bucket "avatars" und Befund-Dateien
//      (Bucket "findings", Pfade aus der Tabelle findings) entfernen; eigene Trainerprofile
//      samt Foto löschen
//   2. Teams löschen, in denen das Konto das einzige (bestätigte) Staff-Mitglied ist
//      (inkl. aller Fotos und Befund-Dateien des Teams; offene Anfragen 'pending' zählen nicht und
//      verfallen mit dem Team). Bleiben andere Staff-Mitglieder übrig und war das
//      Konto der einzige Owner, wird ein verbleibendes Mitglied Owner.
//      Eigene offene Anfragen ('pending') lösen nichts aus.
//   3. auth.admin.deleteUser(uid) – die Datenbank löscht per Cascade Profil,
//      Spielerzeilen samt Gesundheitsdaten, Staff-Einträge, Tokens. Einwilligungen
//      bleiben als Nachweis erhalten (user_id → null, E-Mail-Hash bleibt).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/http.ts';
import { adminClient, authenticate } from '../_shared/supabase.ts';

const AVATARS = 'avatars';
const FINDINGS = 'findings';
const SKETCHES = 'sketches';

interface StaffRow {
  user_id: string;
  role: string;
}

/** Entfernt Objekte in Blöcken (Storage-API verarbeitet Listen). Fehlende Dateien sind kein Fehler. */
async function removeObjects(admin: SupabaseClient, bucket: string, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 500) {
    const chunk = paths.slice(i, i + 500);
    const { error } = await admin.storage.from(bucket).remove(chunk);
    if (error) throw error;
  }
}

/** Alle Objektpfade unterhalb eines Ordners; Unterordner (id === null) bis zur Tiefe `depth`. */
async function listObjects(admin: SupabaseClient, bucket: string, folder: string, depth = 1): Promise<string[]> {
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

Deno.serve(async (req: Request): Promise<Response> => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const auth = await authenticate(req);
  if (!auth) return json({ error: 'unauthorized' }, 401);
  const uid = auth.user.id;

  try {
    const admin = adminClient();

    // 1. Fotos der eigenen Spielerzeilen
    const { data: players, error: playersError } = await admin
      .from('players')
      .select('id, team_id, photo_path')
      .eq('user_id', uid);
    if (playersError) throw playersError;
    const photoPaths = new Set<string>();
    for (const p of (players ?? []) as { id: string; team_id: string; photo_path: string | null }[]) {
      photoPaths.add(`${p.team_id}/${p.id}.jpg`);
      if (p.photo_path) photoPaths.add(p.photo_path);
    }
    await removeObjects(admin, AVATARS, [...photoPaths]);

    // Befund-Dateien der eigenen Spielerzeilen (die Zeilen löscht der Cascade)
    const ownIds = ((players ?? []) as { id: string }[]).map((p) => p.id);
    if (ownIds.length) {
      const { data: files, error: filesError } = await admin.from('findings').select('path').in('player_id', ownIds);
      if (filesError) throw filesError;
      await removeObjects(admin, FINDINGS, ((files ?? []) as { path: string }[]).map((f) => f.path));
    }

    // 1b. Eigene Trainerprofile (Geburtsdatum, Telefon, Foto) – Foto entfernen, Profil löschen
    const { data: myProfiles, error: profError } = await admin.from('staff_profiles').select('id, photo_path').eq('user_id', uid);
    if (profError) throw profError;
    const profPhotos = ((myProfiles ?? []) as { id: string; photo_path: string | null }[]).map((x) => x.photo_path).filter((x): x is string => !!x);
    await removeObjects(admin, AVATARS, profPhotos);
    if ((myProfiles ?? []).length) {
      const { error } = await admin.from('staff_profiles').delete().eq('user_id', uid);
      if (error) throw error;
    }

    // 2. Teams, in denen das Konto Staff ist
    const { data: memberships, error: staffError } = await admin
      .from('team_staff')
      .select('team_id, role')
      .eq('user_id', uid);
    if (staffError) throw staffError;

    for (const m of (memberships ?? []) as { team_id: string; role: string }[]) {
      if (m.role === 'pending') continue; // nur eine Anfrage – das Team bleibt unberührt
      const teamId = m.team_id;
      const { data: otherRows, error: othersError } = await admin
        .from('team_staff')
        .select('user_id, role')
        .eq('team_id', teamId)
        .neq('user_id', uid)
        .neq('role', 'pending');
      if (othersError) throw othersError;
      const others = (otherRows ?? []) as StaffRow[];

      if (others.length === 0) {
        // Einziges Staff-Mitglied: Team mit allen Daten löschen (Cascade) – vorher die Fotos
        await removeObjects(admin, AVATARS, await listObjects(admin, AVATARS, teamId));
        await removeObjects(admin, FINDINGS, await listObjects(admin, FINDINGS, teamId, 2));
        await removeObjects(admin, SKETCHES, await listObjects(admin, SKETCHES, teamId));
        const { error } = await admin.from('teams').delete().eq('id', teamId);
        if (error) throw error;
        continue;
      }

      // Team bleibt bestehen: sicherstellen, dass es weiterhin einen Owner gibt
      if (m.role === 'owner' && !others.some((o) => o.role === 'owner')) {
        const successor = others.find((o) => o.role === 'coach') ?? others[0];
        const { error } = await admin
          .from('team_staff')
          .update({ role: 'owner' })
          .eq('team_id', teamId)
          .eq('user_id', successor.user_id);
        if (error) throw error;
      }
    }

    // 3. Konto löschen – alles Weitere erledigen die Fremdschlüssel (on delete cascade / set null)
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch (err) {
    console.error('delete-account failed', err);
    return json({ error: 'internal' }, 500);
  }
});
