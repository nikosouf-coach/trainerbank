// Datenzugriff über Supabase. Die Zugriffsregeln (wer was sehen darf) setzt die Datenbank durch (RLS).
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classDef, defaultPrinciples, defaultSettings, groupOf, modsFor } from "../core/classes";
import { addDays, iso, monday } from "../core/dates";
import type {
  Absence, AttStatus, CalOverride, ClassKey, CoachMsg, Complaint, CustomKind, Depth, Extra, Growth, Kind, Lang, Match,
  MatchStat, Player, PlanOverride, Potential, Rating, RpeEntry, Session, Team, TeamData, TeamEvent, TestKey, TestResult, Video, WeekMode, Wellness,
} from "../core/types";
import { emptyTeamData } from "../core/types";
import {
  ApiError, CONSENT_VERSION, type AiRequest, type Api, type ConsentKind, type ConsentState, type CreateTeamInput,
  type JoinProfile, type Membership, type PublishedDay, type Role, type StaffEntry, type TeamPatch, type UserInfo,
} from "./api";
import { supabase } from "./supabase";

type Row = Record<string, any>;
const KNOWN_CODES = ["invalid_code", "not_authenticated", "forbidden", "invalid_name", "consent_required", "invalid_merge", "not_found", "different_teams", "already_linked", "not_linked", "invalid_role"];

function fail(error: { message?: string; details?: string; code?: string } | null | undefined): never {
  const msg = error?.message || "unknown";
  const code = KNOWN_CODES.find(c => msg.includes(c)) || (error?.code === "42501" ? "forbidden" : "server");
  throw new ApiError(code, msg, error?.details);
}
async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: any }>): Promise<T> {
  const { data, error } = await p; if (error) fail(error); return data as T;
}
/** Lädt alle Zeilen einer Abfrage seitenweise (Supabase liefert höchstens 1000 Zeilen pro Anfrage). */
async function all(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: any }>): Promise<Row[]> {
  const out: Row[] = []; const size = 1000;
  for (let from = 0; ; from += size) {
    const rows = await q<Row[]>(build(from, from + size - 1));
    out.push(...rows); if (rows.length < size) break;
  }
  return out;
}

const mdToNum = (md: string): number | null => md === "MD" ? 0 : md.startsWith("MD") ? Number(md.slice(2)) : null;
const numToMd = (n: number | null): string => n == null ? "" : n === 0 ? "MD" : n > 0 ? "MD+" + n : "MD" + n;
const isTmp = (id: string | undefined): boolean => !id || id.startsWith("tmp-");

function mapTeam(r: Row): Team {
  const cls = (r.age_class || "u19") as ClassKey, depth = (r.depth || "basis") as Depth;
  const base = defaultSettings();
  return {
    id: r.id, club: r.club, name: r.name, accent: r.accent || "#0b3d91", cls, depth,
    settings: { ...base, ...(r.settings || {}), days: (r.settings && r.settings.days) || base.days },
    principles: { ...defaultPrinciples(groupOf(cls)), ...(r.principles || {}) },
    modules: { ...modsFor(depth, cls), ...(r.modules || {}) },
    joinCode: r.join_code, staffCode: r.staff_code, timezone: r.timezone,
  };
}
const mapPlayer = (r: Row): Player => ({
  id: r.id, vn: r.first_name, nn: r.last_name || "", pos: r.position || "", nr: r.shirt_number ?? null, geb: r.birthdate || "",
  kg: r.weight_kg != null ? Number(r.weight_kg) : null, photo: r.photo_path || null, userId: r.user_id || null, neu: !!r.is_new, active: r.active !== false, groups: r.groups || [],
});
const mapMatch = (r: Row): Match => ({ id: r.id, date: r.date, zeit: r.time || "15:00", gegner: r.opponent || "", heim: !!r.home, comp: r.competition || "liga",
  result: r.goals_for != null && r.goals_against != null ? { own: r.goals_for, opp: r.goals_against } : null });
const mapRating = (r: Row): Rating => ({ id: r.id, pid: r.player_id, date: r.date, kind: r.kind, rating: r.rating != null ? Number(r.rating) : null, text: r.text || "", vis: !!r.visible });
const mapTest = (r: Row): TestResult => ({ id: r.id, pid: r.player_id, test: r.test as TestKey, date: r.date, value: Number(r.value), note: r.note || undefined });
const mapVideo = (r: Row): Video => ({ id: r.id, title: r.title, url: r.url, date: r.date || null, matchId: r.match_id || null, pids: r.player_ids || [], note: r.note || "", vis: !!r.visible });
const mapEvent = (r: Row): TeamEvent => ({ id: r.id, date: r.date, zeit: r.time || "", titel: r.title, typ: r.type || "sonst", ersetzt: !!r.replaces_training });
const mapAbs = (r: Row): Absence => ({ id: r.id, pid: r.player_id, typ: r.type, von: r.from_date, bis: r.to_date, stufe: r.stage, notiz: r.note || "", by: r.reported_by_player ? "player" : "coach" });
const mapExtra = (r: Row): Extra => ({ id: r.id, date: r.date, art: r.type, min: r.minutes, rpe: Number(r.rpe ?? 5), label: r.label || undefined });
const mapPot = (r: Row): Potential => ({ id: r.id, cat: r.category, text: r.text, vis: !!r.visible_to_player, src: r.source || "trainer" });
const mapMsg = (r: Row): CoachMsg => ({ id: r.id, date: (r.created_at || "").slice(0, 10), typ: r.type, text: r.text, bis: r.valid_until });
const mapKind = (r: Row): CustomKind => ({ id: r.id, name: r.name, rpe: Number(r.rpe ?? 5), inhalt: r.content || "" });

export class SupabaseApi implements Api {
  readonly kind = "supabase" as const;
  private sb: SupabaseClient;
  constructor() {
    if (!supabase) throw new ApiError("no_server", "Supabase ist nicht konfiguriert");
    this.sb = supabase;
  }

  // ---------- Konto ----------
  private async userInfo(u: { id: string; email?: string | null; user_metadata?: Row } | null): Promise<UserInfo | null> {
    if (!u) return null;
    const { data } = await this.sb.from("profiles").select("display_name, lang").eq("id", u.id).maybeSingle();
    return { id: u.id, email: u.email || "", displayName: data?.display_name || u.user_metadata?.display_name || "", lang: (data?.lang || u.user_metadata?.lang || "de") as Lang };
  }
  async currentUser() { const { data } = await this.sb.auth.getSession(); return this.userInfo(data.session?.user ?? null); }
  onAuthChange(cb: (u: UserInfo | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_e: string, session: { user: { id: string; email?: string | null; user_metadata?: Row } } | null) => { this.userInfo(session?.user ?? null).then(cb); });
    return () => data.subscription.unsubscribe();
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new ApiError(/confirm/i.test(error.message) ? "email_not_confirmed" : "invalid_login", error.message);
  }
  async signUp(email: string, password: string, displayName: string, lang: Lang) {
    const { data, error } = await this.sb.auth.signUp({ email: email.trim(), password, options: { data: { display_name: displayName, lang } } });
    if (error) throw new ApiError(/registered|exists/i.test(error.message) ? "email_taken" : /password/i.test(error.message) ? "weak_password" : "server", error.message);
    return { needsConfirmation: !data.session };
  }
  async resetPassword(email: string) { const { error } = await this.sb.auth.resetPasswordForEmail(email.trim()); if (error) fail(error); }
  async signOut() { await this.sb.auth.signOut(); }
  async setLanguage(lang: Lang) { const { data } = await this.sb.auth.getSession(); const id = data.session?.user.id; if (id) await q(this.sb.from("profiles").update({ lang }).eq("id", id)); }

  // ---------- Mitgliedschaften ----------
  async memberships(): Promise<Membership[]> {
    const { data } = await this.sb.auth.getSession(); const uid = data.session?.user.id; if (!uid) return [];
    const staff = await q(this.sb.from("team_staff").select("team_id, role, teams(club, name)").eq("user_id", uid));
    const players = await q(this.sb.from("players").select("id, team_id, teams(club, name)").eq("user_id", uid));
    const pending = await q(this.sb.rpc("my_pending_teams"));
    const out: Membership[] = [];
    for (const s of staff) if (s.role !== "pending" && s.teams) out.push({ teamId: s.team_id, club: s.teams.club, name: s.teams.name, role: s.role as Role });
    for (const p of players) if (p.teams) out.push({ teamId: p.team_id, club: p.teams.club, name: p.teams.name, role: "player", playerId: p.id });
    for (const r of pending as Row[]) out.push({ teamId: r.team_id, club: r.club, name: r.name, role: "pending" });
    return out;
  }
  async teamByCode(code: string) {
    const rows = await q<Row[]>(this.sb.rpc("team_by_join_code", { p_code: code }));
    return rows && rows[0] ? { club: rows[0].club, name: rows[0].name } : null;
  }
  async createTeam(i: CreateTeamInput) {
    return q<string>(this.sb.rpc("create_team", { p_club: i.club, p_name: i.name, p_age_class: i.cls, p_depth: i.depth, p_settings: i.settings, p_principles: i.principles, p_modules: i.modules, p_lang: i.lang }));
  }
  async joinTeam(code: string, p: JoinProfile) {
    return q<string>(this.sb.rpc("join_team", { p_code: code, p_first_name: p.vn, p_last_name: p.nn, p_birthdate: p.geb, p_position: p.pos, p_shirt_number: p.nr, p_weight_kg: p.kg }));
  }
  async joinStaff(code: string) { return q<string>(this.sb.rpc("join_staff", { p_code: code })); }

  // ---------- Laden ----------
  async loadTeam(m: Membership): Promise<TeamData> {
    const sb = this.sb, tid = m.teamId, today = iso(new Date());
    const team = mapTeam(await q<Row>(sb.from("teams").select("*").eq("id", tid).single()));
    const D = emptyTeamData(team);
    const staff = m.role !== "player";
    const [players, matches, events, cal, over, modes, kinds, sessions] = await Promise.all([
      q(sb.from("players").select("*").eq("team_id", tid).eq("active", true).order("shirt_number", { ascending: true, nullsFirst: false })),
      q(sb.from("matches").select("*").eq("team_id", tid).gte("date", addDays(today, -330)).order("date")),
      q(sb.from("team_events").select("*").eq("team_id", tid).gte("date", addDays(today, -60)).order("date")),
      q(sb.from("calendar_overrides").select("*").eq("team_id", tid).gte("date", addDays(today, -90))),
      q(sb.from("plan_overrides").select("*").eq("team_id", tid).gte("date", addDays(today, -90))),
      q(sb.from("week_modes").select("*").eq("team_id", tid).gte("week_start", addDays(today, -90))),
      q(sb.from("session_types").select("*").eq("team_id", tid)),
      q(sb.from("sessions").select("*").eq("team_id", tid).gte("date", addDays(today, -70)).order("date")),
    ]);
    D.players = players.map(mapPlayer);
    D.matches = matches.map(mapMatch);
    D.events = events.map(mapEvent);
    for (const r of cal) D.cal[r.date] = { cancel: r.cancel, extra: r.extra, zeit: r.time || undefined, dauer: r.duration || undefined };
    for (const r of over) D.over[r.date] = { kind: r.kind || undefined, rpe: r.rpe != null ? Number(r.rpe) : undefined, dauer: r.duration ?? undefined, inhalt: r.content ?? undefined, keepRest: !!r.keep_rest };
    for (const r of modes) D.wkMode[r.week_start] = r.mode as WeekMode;
    D.kinds = kinds.map(mapKind);
    D.sessions = sessions.map((r): Session => ({ date: r.date, typ: r.type, dauer: r.duration ?? 90, zeit: r.time || "19:30", md: numToMd(r.md), ziel: Number(r.target_rpe ?? 0), kind: (r.kind || undefined) as Kind | undefined }));
    const ids = D.players.map(p => p.id);
    if (ids.length) {
      const from = addDays(today, -63);
      const [rpe, well, extra, att, abs, growth, pots, msgs] = await Promise.all([
        all((a, b) => sb.from("rpe_entries").select("player_id, date, rpe, minutes").in("player_id", ids).gte("date", from).range(a, b)),
        all((a, b) => sb.from("wellness_entries").select("*").in("player_id", ids).gte("date", addDays(today, -35)).range(a, b)),
        q(sb.from("extra_activities").select("*").in("player_id", ids).gte("date", addDays(today, -35))),
        all((a, b) => sb.from("attendance").select("player_id, date, status").eq("team_id", tid).gte("date", addDays(today, -70)).range(a, b)),
        q(sb.from("absences").select("*").in("player_id", ids).or(`to_date.is.null,to_date.gte.${addDays(today, -365)}`)),
        q(sb.from("growth_measurements").select("*").in("player_id", ids).order("date")),
        q(sb.from("potentials").select("*").in("player_id", ids).order("created_at")),
        q(sb.from("coach_messages").select("*").in("player_id", ids).order("created_at")),
      ]);
      for (const r of rpe) (D.rpe[r.player_id] ||= {})[r.date] = { rpe: Number(r.rpe), min: r.minutes };
      for (const r of well) {
        const items = { sq: r.sleep_quality || 0, fat: r.fatigue || 0, doms: r.soreness || 0, stress: r.stress || 0 };
        (D.well[r.player_id] ||= {})[r.date] = { sum: items.sq + items.fat + items.doms + items.stress, schlaf: Number(r.sleep_hours ?? 0), beschw: (r.complaint || "none") as Complaint, ort: r.complaint_location || "", items };
      }
      for (const r of extra) (D.extra[r.player_id] ||= []).push(mapExtra(r));
      for (const r of att) (D.att[r.date] ||= {})[r.player_id] = r.status as AttStatus;
      D.absences = abs.map(mapAbs);
      for (const r of growth) (D.growth[r.player_id] ||= []).push({ date: r.date, cm: Number(r.height_cm) });
      for (const r of pots) (D.pot[r.player_id] ||= []).push(mapPot(r));
      for (const r of msgs) (D.msgs[r.player_id] ||= []).push(mapMsg(r));
      if (staff) {
        const notes = await q(sb.from("coach_notes").select("player_id, text").in("player_id", ids));
        for (const r of notes) D.notes[r.player_id] = r.text;
      }
      // Spieldaten, Noten, Videos (für Spieler filtern die Zugriffsregeln auf eigene, freigegebene Einträge)
      const [stats, ratings, videos, tests] = await Promise.all([
        all((a, b) => sb.from("match_stats").select("*").eq("team_id", tid).range(a, b)),
        all((a, b) => sb.from("player_ratings").select("*").eq("team_id", tid).gte("date", addDays(today, -330)).range(a, b)),
        q(sb.from("videos").select("*").eq("team_id", tid).order("created_at", { ascending: false }).limit(300)),
        all((a, b) => sb.from("performance_tests").select("*").eq("team_id", tid).gte("date", addDays(today, -730)).order("date").range(a, b)),
      ]);
      D.tests = tests.map(mapTest);
      for (const r of stats) (D.stats[r.match_id] ||= {})[r.player_id] = { min: r.minutes ?? 0, goals: r.goals ?? 0, assists: r.assists ?? 0, start: !!r.started };
      D.ratings = ratings.map(mapRating);
      D.videos = videos.map(mapVideo);
    }
    if (!staff) {
      // Spieler sehen den vom Trainer veröffentlichten Plan. Er wird als Vorgabe übernommen,
      // damit Intensitäten und Inhalte in der Spieler-App genau dem Plan des Trainers entsprechen.
      const plans = await q(sb.from("week_plans").select("week_start, items").eq("team_id", tid).gte("week_start", addDays(monday(today), -7)));
      for (const w of plans) for (const d of (w.items || []) as PublishedDay[]) {
        if (!D.over[d.date]?.kind) D.over[d.date] = { ...(D.over[d.date] || {}), kind: d.kind as Kind, rpe: d.rpe, dauer: d.dauer, inhalt: d.inhalt };
      }
    }
    return D;
  }

  // ---------- Team ----------
  async updateTeam(teamId: string, p: TeamPatch) {
    const row: Row = {};
    if (p.club != null) row.club = p.club; if (p.name != null) row.name = p.name; if (p.accent != null) row.accent = p.accent;
    if (p.cls != null) row.age_class = p.cls; if (p.depth != null) row.depth = p.depth;
    if (p.settings) row.settings = p.settings; if (p.principles) row.principles = p.principles; if (p.modules) row.modules = p.modules;
    await q(this.sb.from("teams").update(row).eq("id", teamId));
  }
  async regenerateCodes(teamId: string) {
    const rows = await q<Row[]>(this.sb.rpc("regenerate_codes", { p_team: teamId }));
    return { joinCode: rows[0].join_code, staffCode: rows[0].staff_code };
  }
  async staffList(teamId: string): Promise<StaffEntry[]> {
    const rows = await q<Row[]>(this.sb.rpc("team_staff_list", { p_team: teamId }));
    return rows.map(r => ({ userId: r.user_id, role: r.role, displayName: r.display_name || "" }));
  }
  async approveStaff(teamId: string, userId: string, role: "coach" | "physio") { await q(this.sb.rpc("approve_staff", { p_team: teamId, p_user: userId, p_role: role })); }
  async rejectStaff(teamId: string, userId: string) { await q(this.sb.rpc("reject_staff", { p_team: teamId, p_user: userId })); }

  // ---------- Kalender & Plan ----------
  async saveMatch(teamId: string, m: Match) {
    const row: Row = { team_id: teamId, date: m.date, time: m.zeit || null, opponent: m.gegner, home: m.heim, competition: m.comp, goals_for: m.result ? m.result.own : null, goals_against: m.result ? m.result.opp : null };
    const r = isTmp(m.id) ? await q<Row>(this.sb.from("matches").insert(row).select().single()) : await q<Row>(this.sb.from("matches").update(row).eq("id", m.id).select().single());
    return mapMatch(r);
  }
  async deleteMatch(_t: string, id: string) { await q(this.sb.from("matches").delete().eq("id", id)); }
  async saveEvent(teamId: string, e: TeamEvent) {
    const row: Row = { team_id: teamId, date: e.date, time: e.zeit || null, title: e.titel, type: e.typ, replaces_training: e.ersetzt };
    const r = isTmp(e.id) ? await q<Row>(this.sb.from("team_events").insert(row).select().single()) : await q<Row>(this.sb.from("team_events").update(row).eq("id", e.id).select().single());
    return mapEvent(r);
  }
  async deleteEvent(_t: string, id: string) { await q(this.sb.from("team_events").delete().eq("id", id)); }
  async setCal(teamId: string, date: string, ov: CalOverride | null) {
    if (!ov || (!ov.cancel && !ov.extra && !ov.zeit && !ov.dauer)) { await q(this.sb.from("calendar_overrides").delete().eq("team_id", teamId).eq("date", date)); return; }
    await q(this.sb.from("calendar_overrides").upsert({ team_id: teamId, date, cancel: !!ov.cancel, extra: !!ov.extra, time: ov.zeit || null, duration: ov.dauer || null }));
  }
  async setOver(teamId: string, date: string, ov: PlanOverride | null) {
    if (!ov) { await q(this.sb.from("plan_overrides").delete().eq("team_id", teamId).eq("date", date)); return; }
    await q(this.sb.from("plan_overrides").upsert({ team_id: teamId, date, kind: ov.kind ?? null, rpe: ov.rpe ?? null, duration: ov.dauer ?? null, content: ov.inhalt ?? null, keep_rest: !!ov.keepRest }));
  }
  async setWeekMode(teamId: string, ws: string, mode: WeekMode) {
    if (mode === "normal") await q(this.sb.from("week_modes").delete().eq("team_id", teamId).eq("week_start", ws));
    else await q(this.sb.from("week_modes").upsert({ team_id: teamId, week_start: ws, mode }));
  }
  async saveKind(teamId: string, k: CustomKind) {
    const row: Row = { team_id: teamId, name: k.name, rpe: k.rpe, content: k.inhalt };
    const r = isTmp(k.id) ? await q<Row>(this.sb.from("session_types").insert(row).select().single()) : await q<Row>(this.sb.from("session_types").update(row).eq("id", k.id).select().single());
    return mapKind(r);
  }
  async deleteKind(_t: string, id: string) { await q(this.sb.from("session_types").delete().eq("id", id)); }
  async saveSessions(teamId: string, s: Session[]) {
    if (!s.length) return;
    await q(this.sb.from("sessions").upsert(s.map(x => ({ team_id: teamId, date: x.date, type: x.typ, duration: x.dauer, time: x.zeit, md: mdToNum(x.md), target_rpe: x.ziel, kind: x.kind ?? null })), { onConflict: "team_id,date", ignoreDuplicates: true }));
  }
  async publishWeekPlan(teamId: string, ws: string, days: PublishedDay[]) {
    await q(this.sb.from("week_plans").upsert({ team_id: teamId, week_start: ws, items: days, computed_at: new Date().toISOString() }));
  }

  // ---------- Spieler & Daten ----------
  async savePlayer(teamId: string, p: Player) {
    const row: Row = { team_id: teamId, first_name: p.vn, last_name: p.nn || null, birthdate: p.geb || null, position: p.pos || null, shirt_number: p.nr ?? null, weight_kg: p.kg ?? null };
    if (!isTmp(p.id)) { row.is_new = !!p.neu; row.active = p.active !== false; }
    if (p.groups) row.groups = p.groups;
    const r = isTmp(p.id) ? await q<Row>(this.sb.from("players").insert(row).select().single()) : await q<Row>(this.sb.from("players").update(row).eq("id", p.id).select().single());
    return mapPlayer(r);
  }
  async deletePlayer(teamId: string, p: Player) {
    if (p.photo) await this.sb.storage.from("avatars").remove([p.photo]);
    await q(this.sb.from("players").delete().eq("id", p.id));
  }
  async mergePlayers(newId: string, existingId: string) { await q(this.sb.rpc("merge_players", { p_new: newId, p_existing: existingId })); }
  async uploadPhoto(teamId: string, pid: string, uri: string) {
    // Auf 512 px verkleinern und als JPEG speichern (Speicher erlaubt nur JPEG bis 2 MB)
    const img = await manipulateAsync(uri, [{ resize: { width: 512 } }], { compress: 0.7, format: SaveFormat.JPEG });
    const buf = await (await fetch(img.uri)).arrayBuffer();
    const path = `${teamId}/${pid}.jpg`;
    const { error } = await this.sb.storage.from("avatars").upload(path, buf, { contentType: "image/jpeg", upsert: true });
    if (error) fail(error);
    await q(this.sb.from("players").update({ photo_path: path }).eq("id", pid));
    return path;
  }
  async photoUrl(path: string) {
    const { data } = await this.sb.storage.from("avatars").createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  }
  async setAttendance(teamId: string, date: string, pid: string, st: AttStatus | null) {
    if (!st) await q(this.sb.from("attendance").delete().eq("player_id", pid).eq("date", date));
    else await q(this.sb.from("attendance").upsert({ player_id: pid, date, team_id: teamId, status: st }));
  }
  async saveRpe(pid: string, date: string, e: RpeEntry | null) {
    if (!e) await q(this.sb.from("rpe_entries").delete().eq("player_id", pid).eq("date", date));
    else await q(this.sb.from("rpe_entries").upsert({ player_id: pid, date, rpe: e.rpe, minutes: e.min }));
  }
  async saveWellness(pid: string, date: string, w: Wellness) {
    await q(this.sb.from("wellness_entries").upsert({
      player_id: pid, date, sleep_hours: w.schlaf, sleep_quality: w.items?.sq ?? null, fatigue: w.items?.fat ?? null,
      soreness: w.items?.doms ?? null, stress: w.items?.stress ?? null, complaint: w.beschw, complaint_location: w.beschw !== "none" ? (w.ort || null) : null,
    }));
  }
  async saveExtra(pid: string, x: Extra) {
    const row: Row = { player_id: pid, date: x.date, type: x.art, minutes: x.min, rpe: x.rpe, label: x.label?.trim() || null };
    const r = isTmp(x.id) ? await q<Row>(this.sb.from("extra_activities").insert(row).select().single()) : await q<Row>(this.sb.from("extra_activities").update(row).eq("id", x.id).select().single());
    return mapExtra(r);
  }
  async deleteExtra(id: string) { await q(this.sb.from("extra_activities").delete().eq("id", id)); }
  async saveAbsence(teamId: string, a: Absence) {
    const row: Row = { team_id: teamId, player_id: a.pid, type: a.typ, from_date: a.von, to_date: a.bis || null, stage: a.typ === "verletzung" ? (a.stufe || 1) : null, note: a.notiz || null };
    const r = isTmp(a.id) ? await q<Row>(this.sb.from("absences").insert(row).select().single()) : await q<Row>(this.sb.from("absences").update(row).eq("id", a.id).select().single());
    return mapAbs(r);
  }
  async deleteAbsence(id: string) { await q(this.sb.from("absences").delete().eq("id", id)); }
  async saveGrowth(pid: string, g: Growth) { await q(this.sb.from("growth_measurements").insert({ player_id: pid, date: g.date, height_cm: g.cm })); }
  async savePotential(pid: string, x: Potential) {
    const row: Row = { player_id: pid, category: x.cat, text: x.text, visible_to_player: x.vis, source: x.src };
    const r = isTmp(x.id) ? await q<Row>(this.sb.from("potentials").insert(row).select().single()) : await q<Row>(this.sb.from("potentials").update(row).eq("id", x.id).select().single());
    return mapPot(r);
  }
  async deletePotential(id: string) { await q(this.sb.from("potentials").delete().eq("id", id)); }
  async saveMessage(pid: string, m: CoachMsg) {
    return mapMsg(await q<Row>(this.sb.from("coach_messages").insert({ player_id: pid, type: m.typ, text: m.text, valid_until: m.bis || null }).select().single()));
  }
  async deleteMessage(id: string) { await q(this.sb.from("coach_messages").delete().eq("id", id)); }
  async saveNote(pid: string, text: string) { await q(this.sb.from("coach_notes").upsert({ player_id: pid, text })); }

  // ---------- Spiele, Bewertungen, Videos ----------
  async saveStat(teamId: string, matchId: string, pid: string, st: MatchStat | null) {
    if (!st) { await q(this.sb.from("match_stats").delete().eq("match_id", matchId).eq("player_id", pid)); return; }
    await q(this.sb.from("match_stats").upsert({ team_id: teamId, match_id: matchId, player_id: pid, minutes: st.min, goals: st.goals, assists: st.assists, started: st.start }));
  }
  async saveRating(teamId: string, x: Rating) {
    const row: Row = { team_id: teamId, player_id: x.pid, date: x.date, kind: x.kind, rating: x.rating, text: x.text || null, visible: x.vis };
    const r = isTmp(x.id) ? await q<Row>(this.sb.from("player_ratings").insert(row).select().single()) : await q<Row>(this.sb.from("player_ratings").update(row).eq("id", x.id).select().single());
    return mapRating(r);
  }
  async deleteRating(id: string) { await q(this.sb.from("player_ratings").delete().eq("id", id)); }
  async saveVideo(teamId: string, v: Video) {
    const row: Row = { team_id: teamId, title: v.title, url: v.url, date: v.date, match_id: v.matchId, player_ids: v.pids, note: v.note || null, visible: v.vis };
    const r = isTmp(v.id) ? await q<Row>(this.sb.from("videos").insert(row).select().single()) : await q<Row>(this.sb.from("videos").update(row).eq("id", v.id).select().single());
    return mapVideo(r);
  }
  async deleteVideo(id: string) { await q(this.sb.from("videos").delete().eq("id", id)); }
  async saveTest(teamId: string, x: TestResult) {
    const row: Row = { team_id: teamId, player_id: x.pid, test: x.test, date: x.date, value: x.value, note: x.note || null };
    const r = isTmp(x.id) ? await q<Row>(this.sb.from("performance_tests").insert(row).select().single()) : await q<Row>(this.sb.from("performance_tests").update(row).eq("id", x.id).select().single());
    return mapTest(r);
  }
  async deleteTest(id: string) { await q(this.sb.from("performance_tests").delete().eq("id", id)); }

  // ---------- Einwilligungen, Push, Datenschutz ----------
  async consents(): Promise<ConsentState> {
    const st: ConsentState = { privacy: false, health_data: false, parental: false, ai: false, staff_confidentiality: false };
    const { data } = await this.sb.auth.getSession(); const uid = data.session?.user.id; if (!uid) return st;
    const rows = await q(this.sb.from("consents").select("kind").eq("user_id", uid).is("withdrawn_at", null));
    for (const r of rows) (st as Record<string, boolean>)[r.kind] = true;
    return st;
  }
  async giveConsent(kind: ConsentKind, o?: { parentEmail?: string; playerId?: string }) {
    await q(this.sb.from("consents").insert({ kind, version: CONSENT_VERSION, parent_email: o?.parentEmail || null, player_id: o?.playerId || null }));
  }
  async withdrawConsent(kind: ConsentKind) {
    const { data } = await this.sb.auth.getSession(); const uid = data.session?.user.id; if (!uid) return;
    await q(this.sb.from("consents").update({ withdrawn_at: new Date().toISOString() }).eq("user_id", uid).eq("kind", kind).is("withdrawn_at", null));
  }
  async aiConsentPlayers(teamId: string) {
    const rows = await q(this.sb.from("consents").select("user_id, player_id").eq("kind", "ai").is("withdrawn_at", null));
    const players = await q(this.sb.from("players").select("id, user_id").eq("team_id", teamId).not("user_id", "is", null));
    const users = new Set(rows.map(r => r.user_id));
    return players.filter(p => users.has(p.user_id)).map(p => p.id as string);
  }
  async registerPushToken(token: string, platform: "ios" | "android" | "web") { await q(this.sb.rpc("register_push_token", { p_token: token, p_platform: platform })); }
  async exportMyData() { return q<unknown>(this.sb.rpc("my_data_export")); }
  async deleteAccount() {
    const { error } = await this.sb.functions.invoke("delete-account", { method: "POST" });
    if (error) throw new ApiError("server", error.message);
    await this.sb.auth.signOut();
  }

  // ---------- KI ----------
  async ai(req: AiRequest) {
    const { data, error } = await this.sb.functions.invoke("ai", { body: { mode: req.mode, prompt: req.prompt, context: req.context, lang: req.lang, team_id: req.teamId } });
    if (error) {
      let code = "upstream";
      try { const body = await (error as { context?: Response }).context?.json(); code = body?.error || code; } catch { /* Antwort ohne JSON */ }
      throw new ApiError(code, error.message);
    }
    return String((data as { text?: string })?.text || "");
  }
}

/** Hilfsfunktion für die Teamerstellung (Einstellungen der gewählten Altersklasse). */
export function teamDefaults(cls: ClassKey, depth: Depth) {
  return { settings: defaultSettings(), principles: defaultPrinciples(groupOf(cls)), modules: modsFor(depth, cls), name: classDef(cls).team?.de || cls.toUpperCase() };
}
