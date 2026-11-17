// Reine Hilfen für die Edge Function privacy-purge (ohne Deno/Supabase – Unit-Tests in supabase/tests/functions.test.ts).

export interface DueFinding { id: string; path: string }

/** Pfade in Pakete teilen (Storage-API: höchstens 100 Dateien je Aufruf) */
export function chunks<T>(list: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += Math.max(1, size)) out.push(list.slice(i, i + Math.max(1, size)));
  return out;
}

/** Nur gültige, eindeutige Einträge (Pfad im Bucket „findings“: {team}/{player}/{datei}, ohne „..“) */
export function cleanDue(rows: unknown): DueFinding[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>(), out: DueFinding[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const id = typeof r?.id === 'string' ? r.id : '', path = typeof r?.path === 'string' ? r.path : '';
    if (!id || !path || path.includes('..') || path.startsWith('/') || seen.has(id)) continue;
    seen.add(id); out.push({ id, path });
  }
  return out;
}

/** Welche Einträge dürfen gelöscht werden? Nur die, deren Datei entfernt wurde oder schon fehlte */
export function removableIds(due: DueFinding[], removedPaths: string[], missingPaths: string[] = []): string[] {
  const ok = new Set([...removedPaths, ...missingPaths]);
  return due.filter(d => ok.has(d.path)).map(d => d.id);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gültige, eindeutige IDs aus einer RPC-Antwort (Zeilen mit Feld `id` oder reine Strings) */
export function cleanIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const out = new Set<string>();
  for (const r of rows as unknown[]) {
    const id = typeof r === 'string' ? r : typeof (r as Record<string, unknown>)?.id === 'string' ? (r as Record<string, string>).id : '';
    if (UUID.test(id)) out.add(id.toLowerCase());
  }
  return [...out];
}

export interface DuePlayer { id: string; teamId: string; photoPath: string | null }

/** Spielerprofile aus privacy_players_due(): nur mit gültigen IDs; fremde Fotopfade (anderes Team, „..“) fallen weg */
export function cleanPlayers(rows: unknown): DuePlayer[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>(), out: DuePlayer[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    const id = typeof r?.id === 'string' ? r.id.toLowerCase() : '', teamId = typeof r?.team_id === 'string' ? r.team_id.toLowerCase() : '';
    if (!UUID.test(id) || !UUID.test(teamId) || seen.has(id)) continue;
    const raw = typeof r?.photo_path === 'string' ? r.photo_path : '';
    const photoPath = raw && !raw.includes('..') && raw.startsWith(teamId + '/') ? raw : null;
    seen.add(id); out.push({ id, teamId, photoPath });
  }
  return out;
}

/** Fotos eines Spielerprofils im Bucket „avatars“: Standardpfad {team}/{spieler}.jpg und ggf. der gespeicherte Pfad */
export function playerPhotoPaths(p: DuePlayer): string[] {
  return [...new Set([`${p.teamId}/${p.id}.jpg`, ...(p.photoPath ? [p.photoPath] : [])])];
}
