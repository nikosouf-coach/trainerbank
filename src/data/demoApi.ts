// Demo-Modus: alles im Speicher, nichts verlässt das Gerät. Dient zum Ausprobieren, für Messen/Vereinsgespräche
// und als Fallback, solange kein Server eingerichtet ist.
import { buildDemo, demoChat, demoExtras, demoTeam } from "../core/demo";
import { chatSettings, pairKey, putMsg } from "../core/chat";
import { classDef } from "../core/classes";
import { CLUB_PERMS, cleanClubPerms, teamSummary, type ClubInfo, type ClubRole, type ClubStaffEntry, type ClubTeam, type TeamSummary } from "../core/club";
import { addDays, iso } from "../core/dates";
import { DEMO_CLUB, DEMO_CLUB_LINK, DEMO_CLUB_STAFF, demoClubClasses, demoClubStaff, demoClubTeam, demoClubTeamId, demoClubTeamName } from "../core/demoClub";
import type { MatchPlan, MpAvail, MpLog, MpOpened, MpPublished, MpShare, Assessment, Challenge, ChallengeEntry, Chat, ChatKind, ChatMsg, DevTalk, Goal, GoalEntry, IndivRequest, CashEntry, Contact, Phase, TeamGroup, DayBlock, DutyEntry, FineEntry, TeamTask, ClassKey, Modules, Principles, StaffRoleKey, TeamSettings, CoachMsg, CustomKind, Depth, Extra, Lang, Match, Player, Potential, Absence, Rating, RpeEntry, TeamData, TeamEvent, TestResult, Video, Finding, Exercise, SessionTemplate, StaffProfile } from "../core/types";
import { PERM_PRESETS, PERMS, accessRoleFor } from "../core/perms";
import { ApiError, type Api, type ChatListData, type ConsentState, type Membership, type StaffEntry, type UserInfo, type UserPrefs } from "./api";

let n = 1;
const newId = (id: string): string => (!id || id.startsWith("tmp-")) ? "demo-" + (n++) : id;

/** Angaben aus der Einrichtung, die die Demo übernimmt. */
export interface DemoSetup {
  modules?: Modules; settings?: TeamSettings; principles?: Principles;
  club?: string; team?: string; accent?: string; logo?: string | null;
  /** eigenes Trainerprofil */
  me?: Partial<StaffProfile>;
  /** weitere Trainer (ersetzen die Beispiel-Trainer der Reihe nach) */
  staff?: { name: string; role: StaffRoleKey }[];
  prefs?: UserPrefs;
}

export class DemoApi implements Api {
  readonly kind = "demo" as const;
  private user: UserInfo;
  private consent: ConsentState = { privacy: true, health_data: true, parental: true, ai: true, staff_confidentiality: true, findings: true };
  constructor(public cls: ClassKey = "u19", public depth: Depth = "basis", public lang: Lang = "de", public over: DemoSetup = {}) {
    const name = over.me?.name?.trim() || (lang === "en" ? "Demo coach" : "Demo-Trainer");
    this.user = { id: "demo-user", email: "demo@trainerbank.app", displayName: name, lang, prefs: { info: true, ...(over.prefs || {}) } };
  }
  /** Nur Demo: „kein Netz“ simulieren (Demo-Leiste), damit man die Offline-Warteschlange ausprobieren kann */
  offline = false;
  private net(): void { if (this.offline) throw new ApiError("offline", "Network request failed"); }
  async savePrefs(prefs: UserPrefs) { this.user = { ...this.user, prefs }; }
  async setDisplayName(name: string) { this.user = { ...this.user, displayName: name }; }
  async uploadTeamImage(_t: string, _n: string, uri: string) { return uri; }
  async currentUser() { return this.user; }
  onAuthChange() { return () => undefined; }
  async signIn() { throw new ApiError("demo"); }
  async signUp() { throw new ApiError("demo"); return { needsConfirmation: false }; }
  async resetPassword() { /* im Demo-Modus ohne Funktion */ }
  async signOut() { /* Demo verlassen übernimmt die Sitzung */ }
  async setLanguage(lang: Lang) { this.lang = lang; this.user = { ...this.user, lang }; }
  async memberships(): Promise<Membership[]> {
    this.net();
    const t = demoTeam(this.cls, this.depth, this.lang, this.over);
    const linked = this.clubTeamIds();
    const own = this.sets.demo?.team || t;
    const out: Membership[] = [{ teamId: "demo", club: own.club, name: own.name, role: "owner", clubId: linked.includes("demo") ? DEMO_CLUB : null }];
    // Weitere Teams des Demo-Vereins: Zugriff über den Verein (Rechte wie beim Funktionär eingestellt)
    const me = this.clubMe();
    if (me) for (const x of this.others()) if (linked.includes(x.id) && (me.teams == null || me.teams.includes(x.id)))
      out.push({ teamId: x.id, club: own.club, name: x.name, role: "coach", perms: [...me.perms], clubId: DEMO_CLUB, viaClub: true });
    return out;
  }
  async teamByCode(code: string) { return code.replace(/[^A-Z0-9]/gi, "").toUpperCase() === "DEMOU19K" ? { club: this.over.club || "", name: this.over.team || "U19" } : null; }
  async createTeam() { return "demo"; }
  async joinTeam() { return "p6"; }
  async joinStaff() { return "demo"; }
  /** Demo-Daten bleiben für die Sitzung im Speicher (Änderungen gehen beim Neuladen nicht verloren). */
  private data: TeamData | null = null;
  /** Alle bisher geladenen Teams (eigenes Team = „demo“, weitere Teams des Demo-Vereins) */
  private sets: Record<string, TeamData> = {};
  async loadTeam(m?: Membership): Promise<TeamData> {
    const id = m?.teamId || "demo";
    this.data = id === "demo" ? this.mainTeam() : this.clubSet(id);
    return this.data;
  }
  private mainTeam(): TeamData {
    if (this.sets.demo) return this.sets.demo;
    const D = buildDemo(demoTeam(this.cls, this.depth, this.lang, this.over), this.lang, new Date());
    demoExtras(D, this.lang, new Date());
    // Trainerprofil aus der Einrichtung = s1 (verknüpft mit dem Demo-Konto); weitere Trainer ersetzen die Beispiele
    const s1 = D.staff.find(x => x.id === "s1");
    if (s1) Object.assign(s1, { ...(this.over.me || {}), id: "s1", userId: this.user.id, name: this.over.me?.name?.trim() || s1.name });
    (this.over.staff || []).filter(x => x.name.trim()).forEach((x, i) => {
      const slot = D.staff[i + 1];
      if (slot) Object.assign(slot, { name: x.name.trim(), role: x.role });
      else D.staff.push({ id: "s" + (D.staff.length + 1), name: x.name.trim(), role: x.role, areas: [], phone: "", email: "", note: "" });
    });
    for (const c of D.contacts) if (c.role === "trainer") { const st = D.staff.find(x => x.role === "co"); if (st) c.name = st.name; }
    // Chat (nach den Trainerprofilen, damit Namen und Konten stimmen)
    if (D.team.modules.chat !== false) demoChat(D, this.lang, new Date(), this.user.id);
    // Ein Spieler hat sich zusätzlich selbst per App angemeldet (zeigt das Zusammenführen)
    const dup = D.players.find(p => p.vn === "Tim");
    if (dup) D.players.push({ ...dup, id: "p-app-1", nr: null, kg: null, photo: null, userId: "demo-user-tim", neu: true, groups: [] });
    // Ein ehemaliger Spieler (inaktiv) – zeigt das Reaktivieren im Kader
    D.inactive = [{ id: "p-old-1", vn: "Kai", nn: "Wendt", pos: "ST", nr: 23, geb: (D.players[5]?.geb || "2008-03-01"), active: false, groups: [] }];
    // Freigegebene Ziele für den ersten Spieler (zeigt die Ziele in der Spieler-App)
    const en = this.lang === "en";
    const goals: [Potential["cat"], string][] = en
      ? [["tech", "Weak foot: 2 extra passing sets per week"], ["ath", "Push-off power: clean single-leg jumps"], ["takt", "Organise the defensive line louder and earlier"], ["ment", "After mistakes: reset within the next action"], ["verf", "Morning check every day – keep your streak"]]
      : [["tech", "Schwacher Fuß: 2 zusätzliche Passserien pro Woche"], ["ath", "Absprungkraft: saubere einbeinige Sprünge"], ["takt", "Abwehrkette früher und lauter organisieren"], ["ment", "Nach Fehlern: in der nächsten Aktion abhaken"], ["verf", "Jeden Tag Morgen-Check – Serie halten"]];
    D.pot.p1 = [...(D.pot.p1 || []), ...goals.map(([cat, text], i) => ({ id: "demo-goal-" + i, cat, text, vis: true, src: "trainer" as const }))];
    D.team.clubId = this.clubTeamIds().includes("demo") ? DEMO_CLUB : null;
    this.sets.demo = D; return D;
  }

  // ---------- Demo-Verein: eigenes Team + drei weitere Teams, das Demo-Konto ist Vereinsadmin ----------
  private club: { name: string; accent: string; linkCode: string; staffCode: string } | null = null;
  private clubLinked: string[] = [];
  private officials: ClubStaffEntry[] = [];
  private clubInit = false;
  private ensureClub(): void {
    if (this.clubInit) return; this.clubInit = true;
    const en = this.lang === "en", base = demoTeam(this.cls, this.depth, this.lang, this.over);
    this.club = { name: base.club || (en ? "Demo club" : "Demo-Verein"), accent: base.accent, linkCode: DEMO_CLUB_LINK, staffCode: DEMO_CLUB_STAFF };
    this.clubLinked = ["demo", ...this.others().map(x => x.id)];
    const youth = [...(classDef(this.cls).grp !== "akt" ? ["demo"] : []), ...this.others().filter(x => classDef(x.cls).grp !== "akt").map(x => x.id)];
    this.officials = demoClubStaff({ id: this.user.id, name: this.user.displayName }, this.lang, youth);
  }
  private others(): { id: string; cls: ClassKey; name: string }[] {
    return demoClubClasses(this.cls).map((cls, k) => ({ id: demoClubTeamId(k), cls, name: demoClubTeamName(cls, this.lang) }));
  }
  private clubTeamIds(): string[] { this.ensureClub(); return this.club ? this.clubLinked : []; }
  private clubMe(): ClubStaffEntry | null { this.ensureClub(); const me = this.club ? this.officials.find(x => x.userId === this.user.id) : null; return me && me.role !== "pending" ? me : null; }
  private clubSet(id: string): TeamData {
    if (this.sets[id]) return this.sets[id];
    const k = this.others().findIndex(x => x.id === id); if (k < 0) throw new ApiError("not_found");
    const main = this.mainTeam();
    const D = demoClubTeam(main.team, this.others()[k].cls, k, this.lang, new Date(), { id: this.user.id, name: this.user.displayName });
    D.team.clubId = this.clubTeamIds().includes(id) ? DEMO_CLUB : null;
    this.sets[id] = D; return D;
  }
  /** Eigene Rechte in einem Team des Demo-Vereins (eigenes Team: Owner = alle) */
  private clubPermsIn(id: string): Set<string> {
    if (id === "demo") return new Set(PERMS);
    const me = this.clubMe(); return me && (me.teams == null || me.teams.includes(id)) && this.clubTeamIds().includes(id) ? new Set(me.perms) : new Set();
  }
  private teamName(id: string): string { return id === "demo" ? this.mainTeam().team.name : this.others().find(x => x.id === id)?.name || "–"; }
  private needAdmin(): void { if (this.clubMe()?.role !== "admin") throw new ApiError("forbidden"); }
  async myClubs(): Promise<ClubInfo[]> {
    this.net(); this.ensureClub(); if (!this.club) return [];
    const me = this.officials.find(x => x.userId === this.user.id), role = me ? me.role : "team", admin = role === "admin";
    return [{ id: DEMO_CLUB, name: this.club.name, accent: this.club.accent, role, title: me?.title || "", linkCode: admin ? this.club.linkCode : null, staffCode: admin ? this.club.staffCode : null, teams: this.clubLinked.length }];
  }
  async clubCreate(name: string, teamId: string | null): Promise<string> {
    this.net(); this.ensureClub();
    if (this.club) throw new ApiError("already_in_club");
    this.club = { name: name.trim().slice(0, 100) || "–", accent: this.mainTeam().team.accent, linkCode: DEMO_CLUB_LINK, staffCode: DEMO_CLUB_STAFF };
    this.clubLinked = teamId ? [teamId] : [];
    this.officials = [{ userId: this.user.id, role: "admin", title: "", perms: [...CLUB_PERMS.admin], teams: null, displayName: this.user.displayName }];
    if (teamId === "demo") this.mainTeam().team.clubId = DEMO_CLUB;
    return DEMO_CLUB;
  }
  async clubLinkTeam(code: string, teamId: string): Promise<string> {
    this.net(); this.ensureClub();
    if (!this.club || code.replace(/[^A-Z0-9]/gi, "").toUpperCase() !== this.club.linkCode.replace("-", "")) throw new ApiError("invalid_code");
    if (this.clubLinked.includes(teamId)) throw new ApiError("already_in_club");
    this.clubLinked.push(teamId); if (this.sets[teamId]) this.sets[teamId].team.clubId = DEMO_CLUB;
    return DEMO_CLUB;
  }
  async clubUnlinkTeam(teamId: string) {
    this.net(); this.ensureClub();
    if (!this.clubLinked.includes(teamId)) throw new ApiError("not_found");
    if (teamId !== "demo") this.needAdmin();
    this.clubLinked = this.clubLinked.filter(x => x !== teamId);
    for (const o of this.officials) if (o.teams) o.teams = o.teams.filter(x => x !== teamId);
    if (this.sets[teamId]) this.sets[teamId].team.clubId = null;
  }
  async clubJoin(code: string): Promise<string> {
    this.ensureClub();
    if (!this.club || code.replace(/[^A-Z0-9]/gi, "").toUpperCase() !== this.club.staffCode.replace("-", "")) throw new ApiError("invalid_code");
    return DEMO_CLUB;
  }
  async clubUpdate(_c: string, patch: { name?: string; accent?: string }) {
    this.net(); this.needAdmin(); if (!this.club) return;
    if (patch.name != null && patch.name.trim()) this.club.name = patch.name.trim().slice(0, 100);
    if (patch.accent) this.club.accent = patch.accent;
  }
  async clubStaffList(): Promise<ClubStaffEntry[]> {
    this.net(); if (!this.clubMe()) throw new ApiError("forbidden");
    const order = ["admin", "leiter", "nlz", "koord", "pending"];
    return [...this.officials].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role)).map(x => ({ ...x, perms: [...x.perms], teams: x.teams ? [...x.teams] : null }));
  }
  async clubSetStaff(_c: string, userId: string, role: ClubRole, title: string, perms: string[], teams: string[] | null) {
    this.net(); this.needAdmin();
    const x = this.officials.find(o => o.userId === userId); if (!x) throw new ApiError("not_found");
    if (x.role === "admin" && role !== "admin" && this.officials.filter(o => o.role === "admin").length <= 1) throw new ApiError("last_admin");
    if (teams && teams.some(t => !this.clubLinked.includes(t))) throw new ApiError("different_teams");
    Object.assign(x, { role, title: title.trim().slice(0, 60), perms: cleanClubPerms(perms), teams: teams ? [...new Set(teams)] : null });
  }
  async clubRemoveStaff(_c: string, userId: string) {
    this.net(); const x = this.officials.find(o => o.userId === userId); if (!x) throw new ApiError("not_found");
    if (userId !== this.user.id) this.needAdmin();
    if (x.role === "admin" && this.officials.filter(o => o.role === "admin").length <= 1) throw new ApiError("last_admin");
    this.officials = this.officials.filter(o => o.userId !== userId);
  }
  async clubRegenerateCodes() {
    this.net(); this.needAdmin(); if (!this.club) throw new ApiError("not_found");
    const n = () => Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
    this.club.linkCode = n() + "-" + n(); this.club.staffCode = n() + "-" + n();
    return { linkCode: this.club.linkCode, staffCode: this.club.staffCode };
  }
  async clubDelete() {
    this.net(); this.needAdmin();
    this.club = null; this.clubLinked = []; this.officials = [];
    for (const D of Object.values(this.sets)) D.team.clubId = null;
  }
  async clubTeams(): Promise<ClubTeam[]> {
    this.net(); this.ensureClub(); if (!this.club) throw new ApiError("forbidden");
    const all = [{ id: "demo", cls: this.cls, name: this.teamName("demo") }, ...this.others()];
    return all.filter(x => this.clubLinked.includes(x.id)).map(x => ({ teamId: x.id, club: this.mainTeam().team.club, name: x.name, cls: x.cls, access: this.clubPermsIn(x.id).size > 0 || x.id === "demo" }));
  }
  async clubOverview(): Promise<TeamSummary[]> {
    this.net(); if (!this.clubMe()) throw new ApiError("forbidden");
    const now = new Date(), out: TeamSummary[] = [];
    const ids = ["demo", ...this.others().map(x => x.id)].filter(id => this.clubLinked.includes(id));
    for (const id of ids) {
      const pm = this.clubPermsIn(id); if (!pm.size) continue;
      out.push(teamSummary(id === "demo" ? this.mainTeam() : this.clubSet(id), now, { squad: pm.has("squad"), plan: pm.has("plan") }));
    }
    return out;
  }
  async clubMovePlayer(playerId: string, target: string, mode: "add" | "move", copy: boolean): Promise<string> {
    this.net();
    // Spieler aus dem gerade geöffneten Team
    const src = this.data, p = src?.players.find(x => x.id === playerId); if (!src || !p) throw new ApiError("not_found");
    if (mode !== "add" && mode !== "move") throw new ApiError("invalid_mode");
    if (target === src.team.id) throw new ApiError("invalid_target");
    const linked = this.clubTeamIds();
    if (!(linked.includes(src.team.id) && linked.includes(target))) throw new ApiError("different_clubs");
    const ps = this.clubPermsIn(src.team.id), pt = this.clubPermsIn(target);
    if (!ps.has("squad") || !pt.has("squad")) throw new ApiError("forbidden");
    if (copy && !(ps.has("health") && pt.has("health"))) throw new ApiError("forbidden");
    const T = target === "demo" ? this.mainTeam() : this.clubSet(target);
    const norm = (x: string | null | undefined) => (x || "").trim().toLowerCase();
    if (T.players.some(x => (p.userId && x.userId === p.userId) || (norm(x.vn) === norm(p.vn) && norm(x.nn) === norm(p.nn) && x.geb === p.geb))) throw new ApiError("already_in_team");
    const nr = p.nr != null && !T.players.some(x => x.nr === p.nr) ? p.nr : null;
    const np: Player = { id: newId(""), vn: p.vn, nn: p.nn, pos: p.pos, nr, geb: p.geb, kg: p.kg ?? null, photo: null, userId: p.userId || null, active: true, groups: [],
      origin: src.team.name.slice(0, 80), linkedFrom: p.id };
    const at = T.players.findIndex(y => (y.nr ?? 99) > (np.nr ?? 99)); if (at < 0) T.players.push(np); else T.players.splice(at, 0, np);
    if (copy) {
      const today = iso(new Date()), from = addDays(today, -42), label = ("Training " + src.team.name).slice(0, 60);
      const days = new Set([...Object.keys(src.rpe[p.id] || {}), ...Object.keys(src.rpeU[p.id] || {})]);
      const ex = (T.extra[np.id] ||= []);
      for (const d of [...days].sort()) {
        if (d <= from || d > today) continue;
        const L = [src.rpe[p.id]?.[d], ...Object.values(src.rpeU[p.id]?.[d] || {})].filter((e): e is RpeEntry => !!e && e.min > 0);
        const min = L.reduce((a, e) => a + e.min, 0); if (!min) continue;
        ex.push({ id: newId(""), date: d, art: "verein", min: Math.min(600, min), rpe: Math.round(L.reduce((a, e) => a + e.rpe * e.min, 0) / min * 10) / 10, label });
      }
      for (const e of src.extra[p.id] || []) if (e.date > from && e.date <= today) ex.push({ ...e, id: newId("") });
      const w = src.well[p.id] || {};
      for (const [d, v] of Object.entries(w)) if (d > addDays(today, -28)) (T.well[np.id] ||= {})[d] = JSON.parse(JSON.stringify(v));
      for (const a of src.absences) if (a.pid === p.id && a.von <= addDays(today, 60) && (!a.bis || a.bis >= today)) T.absences.push({ ...a, id: newId(""), pid: np.id });
    }
    if (mode === "move") {
      src.players = src.players.filter(x => x.id !== p.id);
      src.inactive = [...src.inactive, { ...p, active: false, userId: null }];
    }
    return np.id;
  }
  async clubAnnounce(_c: string, body: string, teams: string[] | null): Promise<number> {
    this.net(); if (!this.clubMe()) throw new ApiError("forbidden");
    const text = body.trim(); if (!text || text.length > 4000) throw new ApiError("invalid_body");
    let n = 0; const at = new Date().toISOString();
    for (const id of ["demo", ...this.others().map(x => x.id)]) {
      if (!this.clubLinked.includes(id) || (teams && !teams.includes(id)) || !this.clubPermsIn(id).size) continue;
      const D = id === "demo" ? this.mainTeam() : this.clubSet(id);
      if (D.team.modules.chat === false || !chatSettings(D.team).on) continue;
      let c = D.chats.find(x => x.kind === "team");
      if (!c) { c = { id: newId(""), kind: "team", title: "", groupId: null, members: [], readOnly: false, transparent: false, createdBy: null, lastAt: null, muted: false }; D.chats.push(c); }
      putMsg(D, { id: newId(""), chatId: c.id, uid: this.user.id, name: this.user.displayName, body: text, at, replyTo: null, deleted: false, reactions: {} });
      c.lastAt = at; if (D.chatRead) D.chatRead[c.id] = at;
      n++;
    }
    return n;
  }
  async updateTeam() { /* lokal */ }
  async regenerateCodes() { return { joinCode: "DEMO-U19K", staffCode: "DEMO-STAF" }; }
  /** Demo: Trainerteam = Trainerprofile (außer dem eigenen); Rechte je Profil (Vorlage der Funktion, änderbar) */
  private perms: Record<string, string[] | null> = {};
  async staffList(teamId?: string): Promise<StaffEntry[]> {
    const id = teamId || "demo";
    // Funktionäre des Vereins mit Zugriff auf dieses Team (Rechte vergibt der Verein)
    const club = this.clubTeamIds().includes(id) ? this.officials.filter(o => o.role !== "pending" && (o.teams == null || o.teams.includes(id)))
      .map(o => ({ userId: o.userId, role: "coach" as const, displayName: o.displayName, perms: [...o.perms], viaClub: true })) : [];
    if (id !== "demo") {
      const D = this.clubSet(id), [chef, ...rest] = D.staff;
      return [...(chef ? [{ userId: "demo-" + chef.id, role: "owner" as const, displayName: chef.name, perms: [...PERMS] }] : []),
        ...rest.map(x => ({ userId: "demo-" + x.id, role: accessRoleFor(x.role), displayName: x.name, perms: PERM_PRESETS[x.role] ?? [] })), ...club];
    }
    const others = (this.data?.staff || []).filter(x => x.id !== "s1");
    return [{ userId: this.user.id, role: "owner" as const, displayName: this.user.displayName, perms: [...PERMS] },
      ...others.map(x => ({ userId: "demo-" + x.id, role: accessRoleFor(x.role), displayName: x.name, perms: this.demoPerms(x.id) })),
      ...club.filter(x => x.userId !== this.user.id)];
  }
  /** Wirksame Rechte eines Demo-Trainerprofils */
  demoPerms(staffId: string): string[] {
    const x = this.data?.staff.find(y => y.id === staffId); if (!x) return [];
    return this.perms["demo-" + staffId] ?? PERM_PRESETS[x.role] ?? [];
  }
  async setStaffPerms(_t: string, userId: string, perms: string[] | null) { this.perms[userId] = perms; }
  async approveStaff() { /* lokal */ }
  async rejectStaff() { /* lokal */ }
  async saveMatch(_t: string, m: Match) { return { ...m, id: newId(m.id) }; }
  async deleteMatch() { /* lokal */ }
  async saveEvent(_t: string, e: TeamEvent) { return { ...e, id: newId(e.id) }; }
  async deleteEvent() { /* lokal */ }
  async setCal() { /* lokal */ }
  async setOver() { /* lokal */ }
  async setWeekMode() { /* lokal */ }
  async saveKind(_t: string, k: CustomKind) { return { ...k, id: newId(k.id) }; }
  async deleteKind() { /* lokal */ }
  async saveSessions() { /* lokal */ }
  async saveUnit() { /* lokal (Store ändert die Demo-Daten direkt) */ }
  async deleteUnit() { /* lokal */ }
  async saveUnits() { /* lokal */ }
  async publishWeekPlan() { /* lokal */ }
  async savePlayer(_t: string, p: Player) { return { ...p, id: newId(p.id) }; }
  async deletePlayer() { /* lokal */ }
  async mergePlayers(newId: string, existingId: string) {
    const D = this.data; if (!D) return;
    const nw = D.players.find(p => p.id === newId), ex = D.players.find(p => p.id === existingId); if (!nw || !ex) throw new ApiError("invalid_merge");
    ex.userId = nw.userId; ex.neu = false;
    for (const map of [D.rpe, D.well] as Record<string, Record<string, unknown>>[]) { if (map[newId]) { map[existingId] = { ...(map[existingId] || {}), ...map[newId] }; delete map[newId]; } }
    for (const map of [D.extra, D.pot, D.msgs, D.growth] as Record<string, unknown[]>[]) { if (map[newId]) { map[existingId] = [...(map[existingId] || []), ...map[newId]]; delete map[newId]; } }
    D.absences.forEach(a => { if (a.pid === newId) a.pid = existingId; });
    for (const d of Object.keys(D.att)) { const r = D.att[d]; if (r[newId]) { r[existingId] = r[existingId] || r[newId]; delete r[newId]; } }
    D.players = D.players.filter(p => p.id !== newId);
  }
  async uploadPhoto(_t: string, _pid: string, uri: string) { return uri; }
  async photoUrl(path: string) { return path; }
  async setAttendance() { this.net(); }
  async saveRpe() { this.net(); }
  async saveWellness() { this.net(); }
  async saveExtra(_p: string, x: Extra) { this.net(); return { ...x, id: newId(x.id) }; }
  async deleteExtra() { this.net(); }
  async saveAbsence(_t: string, a: Absence) { this.net(); return { ...a, id: newId(a.id) }; }
  async deleteAbsence() { this.net(); }
  async saveGrowth() { /* lokal */ }
  async savePotential(_p: string, x: Potential) { return { ...x, id: newId(x.id) }; }
  async deletePotential() { /* lokal */ }
  async saveMessage(_p: string, m: CoachMsg) { return { ...m, id: newId(m.id) }; }
  async deleteMessage() { /* lokal */ }
  async saveNote() { /* lokal */ }
  async saveStat() { /* lokal */ }
  async saveRating(_t: string, r: Rating) { return { ...r, id: newId(r.id) }; }
  async deleteRating() { /* lokal */ }
  async saveVideo(_t: string, v: Video) { return { ...v, id: newId(v.id) }; }
  async deleteVideo() { /* lokal */ }
  async saveTest(_t: string, r: TestResult) { return { ...r, id: newId(r.id) }; }
  async deleteTest() { /* lokal */ }
  async uploadFinding(_t: string, f: Omit<Finding, "id" | "path" | "ai" | "aiAt">, uri: string): Promise<Finding> { return { ...f, id: newId(""), path: uri, ai: null, aiAt: null }; }
  async updateFinding() { /* lokal */ }
  async deleteFinding() { /* lokal */ }
  async findingUrl(path: string) { return path.startsWith("demo:") ? null : path; }
  async analyzeFinding(): Promise<string> { throw new ApiError("demo_ai"); }
  async saveExercise(_t: string, x: Exercise) { return { ...x, id: newId(x.id) }; }
  async deleteExercise() { /* lokal */ }
  async saveTemplate(_t: string, x: SessionTemplate) { return { ...x, id: newId(x.id) }; }
  async deleteTemplate() { /* lokal */ }
  async saveStaff(_t: string, x: StaffProfile) { return { ...x, id: newId(x.id) }; }
  async deleteStaff() { /* lokal */ }
  async savePhase(_t: string, x: Phase) { return { ...x, id: newId(x.id) }; }
  async deletePhase() { /* lokal */ }
  async saveContact(_t: string, x: Contact) { return { ...x, id: newId(x.id) }; }
  async deleteContact() { /* lokal */ }
  async saveGroup(_t: string, g: TeamGroup) { return { ...g, id: newId(g.id) }; }
  async deleteGroup() { /* lokal */ }
  async setGroupMember() { /* lokal */ }
  async saveBlock(_t: string, b: DayBlock) { return { ...b, id: newId(b.id) }; }
  async deleteBlock() { /* lokal */ }
  async uploadSketch(_t: string, _b: string, uri: string) { return uri; }
  async sketchUrl(path: string) { return path; }
  async removeSketch() { /* lokal */ }
  async saveFine(_t: string, f: FineEntry) { return { ...f, id: newId(f.id) }; }
  async deleteFine() { /* lokal */ }
  async addDuties(_t: string, ds: DutyEntry[]) { return ds.map(d => ({ ...d, id: newId(d.id) })); }
  async saveDuty(_t: string, d: DutyEntry) { return { ...d, id: newId(d.id) }; }
  async deleteDuties() { /* lokal */ }
  async saveTask(_t: string, x: TeamTask) { return { ...x, id: newId(x.id) }; }
  async deleteTask() { /* lokal */ }
  async setTaskDone() { this.net(); }
  async saveCash(_t: string, e: CashEntry) { this.net(); return { ...e, id: newId(e.id) }; }
  async deleteCash() { this.net(); }
  async setWaiver() { this.net(); }
  /** Demo: alle Spieler gelten als eingewilligt */
  async healthConsentPlayers() { return (this.data?.players || []).map(p => p.id); }
  async consents() { return { ...this.consent }; }
  async giveConsent(kind: keyof ConsentState) { this.consent[kind] = true; }
  async withdrawConsent(kind: keyof ConsentState) { this.consent[kind] = false; }
  async aiConsentPlayers() { return [] as string[]; }
  async registerPushToken() { /* im Demo-Modus keine Push-Nachrichten */ }
  async exportMyData() { return { hinweis: "Demo-Modus: Es sind keine persönlichen Daten gespeichert." }; }
  async deleteAccount() { /* nichts gespeichert */ }
  async ai(): Promise<string> { throw new ApiError("demo_ai"); }

  // Spielerentwicklung, Challenges, Individualtraining (lokal – der Store ändert die Demo-Daten direkt)
  async saveAssessment(_t: string, a: Assessment) { this.net(); return { ...a, id: newId(a.id) }; }
  async deleteAssessment() { this.net(); }
  async saveGoal(_t: string, g: Goal) { this.net(); return { ...g, id: newId(g.id) }; }
  async saveGoalSteps() { this.net(); }
  async deleteGoal() { this.net(); }
  async saveGoalEntry(e: GoalEntry) { this.net(); return { ...e, id: newId(e.id) }; }
  async deleteGoalEntry() { this.net(); }
  async saveTalk(_t: string, x: DevTalk) { this.net(); return { ...x, id: newId(x.id) }; }
  async deleteTalk() { this.net(); }
  async saveChallenge(_t: string, c: Challenge) { this.net(); return { ...c, id: newId(c.id) }; }
  async deleteChallenge() { this.net(); }
  async saveChallengeEntry(_e: ChallengeEntry) { this.net(); }
  async challengeTotals() { return []; }
  async saveIndiv(_t: string, r: IndivRequest) { this.net(); return { ...r, id: newId(r.id) }; }

  // Matchplan (lokal – der Store ändert die Demo-Daten direkt; Spieleransicht rechnet der Store aus den Plänen)
  async savePlan(_t: string, p: MatchPlan) { this.net(); return { ...p, id: newId(p.id), updatedAt: new Date().toISOString() }; }
  async deletePlan() { this.net(); }
  async sharePlan(id: string, share: MpShare | null, published: MpPublished | null): Promise<MatchPlan> {
    this.net(); const p = this.data?.plans.find(x => x.id === id); if (!p) throw new ApiError("not_found");
    const same = !!p.published && JSON.stringify(p.published) === JSON.stringify(published);
    return { ...p, share: share && published ? share : null, published: share ? published : null, publishedAt: share && published ? (same && p.publishedAt ? p.publishedAt : new Date().toISOString()) : null };
  }
  async planLogs(planId: string): Promise<MpLog[]> { return this.data?.planLogs[planId] || []; }
  async myPlans(): Promise<MpAvail[]> { return []; }
  async planOpen(): Promise<MpOpened> { throw new ApiError("not_found"); }
  async planShot() { /* lokal */ }

  // Chat (Demo: im Speicher). „Ich“ setzt der Store je nach Ansicht (Trainer, Co-Trainer, Spieler).
  chatMe = "demo-user";
  private chatOf(id: string): Chat { const c = this.data?.chats.find(x => x.id === id); if (!c) throw new ApiError("not_found"); return c; }
  async chatOpen(_t: string, kind: ChatKind, groupId?: string | null, other?: string | null): Promise<Chat> {
    this.net(); const D = this.data; if (!D) throw new ApiError("not_found");
    const st = chatSettings(D.team); if (!st.on) throw new ApiError("chat_off");
    const me = this.chatMe, find = (f: (c: Chat) => boolean) => D.chats.find(f);
    const mk = (x: Partial<Chat>): Chat => { const c: Chat = { id: newId(""), kind, title: "", groupId: null, members: [], readOnly: false, transparent: false, createdBy: me, lastAt: null, muted: false, ...x }; D.chats.push(c); return c; };
    if (kind === "team" || kind === "staff") return find(c => c.kind === kind) || mk({ createdBy: null });
    if (kind === "group") return find(c => c.kind === "group" && c.groupId === groupId) || mk({ groupId: groupId || null });
    if (kind === "direct" && other) {
      const k = pairKey(me, other), ex = find(c => c.kind === "direct" && pairKey(c.members[0] || "", c.members[1] || "") === k); if (ex) return ex;
      const a = D.chatPeople.find(p => p.uid === me)?.kind, b = D.chatPeople.find(p => p.uid === other)?.kind;
      if (st.dm === "off" || (st.dm === "staff" && a !== "staff" && b !== "staff")) throw new ApiError("dm_off");
      return mk({ members: [me, other], transparent: st.transparent && a !== b });
    }
    throw new ApiError("invalid_kind");
  }
  async chatSaveCustom(_t: string, chatId: string | null, title: string, members: string[], readOnly: boolean): Promise<Chat> {
    this.net(); const D = this.data; if (!D) throw new ApiError("not_found");
    const me = this.chatMe, all = [...new Set([me, ...members])], st = chatSettings(D.team), kinds = all.map(u => D.chatPeople.find(p => p.uid === u)?.kind);
    if (all.length < 2) throw new ApiError("invalid_members");
    const mixed = kinds.includes("staff") && kinds.includes("player"), staff = D.chatPeople.find(p => p.uid === me)?.kind === "staff";
    if (chatId) { const c = this.chatOf(chatId); Object.assign(c, { title: title.trim().slice(0, 60), members: all, readOnly: readOnly && staff, transparent: c.transparent || (st.transparent && mixed) }); return c; }
    const c: Chat = { id: newId(""), kind: "custom", title: title.trim().slice(0, 60), groupId: null, members: all, readOnly: readOnly && staff, transparent: st.transparent && mixed, createdBy: me, lastAt: null, muted: false };
    D.chats.push(c); return c;
  }
  async chatLeave(chatId: string) { this.net(); const c = this.chatOf(chatId); c.members = c.members.filter(u => u !== this.chatMe); if (!c.members.length && this.data) this.data.chats = this.data.chats.filter(x => x.id !== chatId); }
  async chatSetReadOnly(chatId: string, readOnly: boolean) { this.net(); this.chatOf(chatId).readOnly = readOnly; }
  async chatSend(_t: string, chatId: string, body: string, replyTo: string | null): Promise<ChatMsg> {
    this.net(); const name = this.data?.chatPeople.find(p => p.uid === this.chatMe)?.name || "–";
    return { id: newId(""), chatId, uid: this.chatMe, name, body, at: new Date().toISOString(), replyTo, deleted: false, reactions: {} };
  }
  async chatDelete() { this.net(); }
  async chatReact() { this.net(); }
  async chatRead() { /* lokal */ }
  async chatMute() { this.net(); }
  async chatReport() { this.net(); }
  async chatSetReport() { this.net(); }
  async chatOlder() { return { msgs: [] as ChatMsg[], more: false }; }
  async chatSince() { return [] as ChatMsg[]; }
  async chatList(): Promise<ChatListData> { const D = this.data; return { chats: D?.chats || [], people: D?.chatPeople || [], reports: D?.chatReports || [], read: D?.chatRead || {}, old: {} }; }
  chatSubscribe() { return () => undefined; }
}
