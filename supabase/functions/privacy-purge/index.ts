// Edge Function „privacy-purge“: Löschfristen, die Dateien im Speicher betreffen (Aufruf täglich per pg_cron/pg_net,
// Migration 20261105000010_loeschung.sql; POST mit Header x-cron-secret = CRON_SECRET; verify_jwt ist in config.toml aus).
//   1. Befunde, deren App-Einwilligung seit 30 Tagen widerrufen ist, und Befunde von Spielern, die seit 6 Monaten nicht
//      mehr aktiv sind (public.privacy_findings_due) – Datei und Eintrag
//   2. Spielerprofile, die seit 24 Monaten nicht mehr aktiv sind (public.privacy_players_due) – Foto, Befund-Dateien, Profil
//   3. Teams, in denen seit 24 Monaten niemand die App genutzt hat (public.privacy_teams_due) – Fotos, Logos, Befunde,
//      Skizzen und das Team mit allen Daten
//   4. Konten ohne Rolle, seit 24 Monaten nicht genutzt (public.privacy_accounts_due) – Trainerprofile mit Foto,
//      Bildschirmfotos eigener Rückmeldungen, das Konto (Einwilligungen bleiben als Nachweis, wie bei delete-account)
// Die übrigen Fristen (Gesundheitsdaten nach Widerruf, inaktive Spieler, Push-Token, Nachrichten) erledigt
// public.purge_privacy() direkt in der Datenbank. Ein Fehler bei einem Eintrag hält die übrigen nicht auf.
import { json, safeEqual } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import { listObjects, removeObjects } from '../_shared/storage.ts';
import { chunks, cleanDue, cleanIds, cleanPlayers, playerPhotoPaths, removableIds } from '../_shared/privacy.ts';

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  const given = req.headers.get('x-cron-secret') ?? '';
  if (!secret || !safeEqual(given, secret)) return json({ error: 'unauthorized' }, 401);

  try {
    const admin = adminClient();
    const result = { findings: 0, files: 0, players: 0, teams: 0, accounts: 0, errors: 0 };

    // 1. Befunde
    const { data, error } = await admin.rpc('privacy_findings_due');
    if (error) throw error;
    const due = cleanDue(data);
    const removed: string[] = [];
    for (const part of chunks(due.map(d => d.path))) {
      const { error: rmErr } = await admin.storage.from('findings').remove(part);
      if (rmErr) { console.error('privacy-purge: remove failed', rmErr.message); result.errors++; continue; }
      removed.push(...part); // fehlende Dateien gelten als schon gelöscht
    }
    result.files = removed.length;
    for (const part of chunks(removableIds(due, removed))) {
      const { error: delErr, count } = await admin.from('findings').delete({ count: 'exact' }).in('id', part);
      if (delErr) { console.error('privacy-purge: delete findings failed', delErr.message); result.errors++; continue; }
      result.findings += count ?? 0;
    }

    // 2. Spielerprofile
    const { data: pl, error: plErr } = await admin.rpc('privacy_players_due');
    if (plErr) throw plErr;
    for (const p of cleanPlayers(pl)) {
      try {
        await removeObjects(admin, 'avatars', playerPhotoPaths(p));
        const { data: files, error: fErr } = await admin.from('findings').select('path').eq('player_id', p.id);
        if (fErr) throw fErr;
        await removeObjects(admin, 'findings', ((files ?? []) as { path: string }[]).map(f => f.path));
        const { error: dErr } = await admin.from('players').delete().eq('id', p.id);
        if (dErr) throw dErr;
        result.players++;
      } catch (e) { console.error('privacy-purge: player', p.id, msg(e)); result.errors++; }
    }

    // 3. Teams
    const { data: tm, error: tmErr } = await admin.rpc('privacy_teams_due');
    if (tmErr) throw tmErr;
    for (const teamId of cleanIds(tm)) {
      try {
        await removeObjects(admin, 'avatars', await listObjects(admin, 'avatars', teamId));
        await removeObjects(admin, 'findings', await listObjects(admin, 'findings', teamId, 2));
        await removeObjects(admin, 'sketches', await listObjects(admin, 'sketches', teamId));
        const { error: dErr } = await admin.from('teams').delete().eq('id', teamId);
        if (dErr) throw dErr;
        result.teams++;
      } catch (e) { console.error('privacy-purge: team', teamId, msg(e)); result.errors++; }
    }

    // 4. Konten ohne Rolle
    const { data: ac, error: acErr } = await admin.rpc('privacy_accounts_due');
    if (acErr) throw acErr;
    for (const uid of cleanIds(ac)) {
      try {
        const { data: prof, error: pErr } = await admin.from('staff_profiles').select('photo_path').eq('user_id', uid);
        if (pErr) throw pErr;
        await removeObjects(admin, 'avatars', ((prof ?? []) as { photo_path: string | null }[]).map(x => x.photo_path ?? '').filter(Boolean));
        const { error: spErr } = await admin.from('staff_profiles').delete().eq('user_id', uid);
        if (spErr) throw spErr;
        await removeObjects(admin, 'feedback', await listObjects(admin, 'feedback', uid));
        const { error: uErr } = await admin.auth.admin.deleteUser(uid);
        if (uErr) throw uErr;
        result.accounts++;
      } catch (e) { console.error('privacy-purge: account', uid, msg(e)); result.errors++; }
    }

    return json({ ok: true, ...result });
  } catch (err) {
    console.error('privacy-purge failed', msg(err));
    return json({ error: 'internal' }, 500);
  }
});
