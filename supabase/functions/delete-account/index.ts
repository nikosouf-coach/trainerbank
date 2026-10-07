// Edge Function "delete-account" – Konto vollständig löschen (DSGVO Art. 17).
//
// Aufruf (App): supabase.functions.invoke('delete-account', { method: 'POST' })
// Antwort:      200 { ok: true } · 401 { error: 'unauthorized' } · 500 { error: 'internal' }
//
// Ablauf (mit service_role):
//   1. Fotos der eigenen Spielerzeilen aus dem Bucket "avatars" entfernen
//   2. Teams löschen, in denen das Konto das einzige (bestätigte) Staff-Mitglied ist
//      (inkl. aller Fotos des Teams; offene Anfragen 'pending' zählen nicht und
//      verfallen mit dem Team). Bleiben andere Staff-Mitglieder übrig und war das
//      Konto der einzige Owner, wird ein verbleibendes Mitglied Owner.
//      Eigene offene Anfragen ('pending') lösen nichts aus.
//   3. auth.admin.deleteUser(uid) – die Datenbank löscht per Cascade Profil,
//      Spielerzeilen samt Gesundheitsdaten, Staff-Einträge, Tokens. Einwilligungen
//      bleiben als Nachweis erhalten (user_id → null, E-Mail-Hash bleibt).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { json, preflight } from '../_shared/http.ts';
import { adminClient, authenticate } from '../_shared/supabase.ts';

const BUCKET = 'avatars';

interface StaffRow {
  user_id: string;
  role: string;
}

/** Entfernt Objekte in Blöcken (Storage-API verarbeitet Listen). Fehlende Dateien sind kein Fehler. */
async function removeObjects(admin: SupabaseClient, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 500) {
    const chunk = paths.slice(i, i + 500);
    const { error } = await admin.storage.from(BUCKET).remove(chunk);
    if (error) throw error;
  }
}

/** Alle Objektpfade unterhalb von "{teamId}/". */
async function listTeamObjects(admin: SupabaseClient, teamId: string): Promise<string[]> {
  const paths: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage.from(BUCKET).list(teamId, { limit: pageSize, offset });
    if (error) throw error;
    for (const obj of (data ?? []) as { name: string }[]) paths.push(`${teamId}/${obj.name}`);
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
    await removeObjects(admin, [...photoPaths]);

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
        await removeObjects(admin, await listTeamObjects(admin, teamId));
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
