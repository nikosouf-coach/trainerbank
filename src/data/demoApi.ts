// Demo-Modus: alles im Speicher, nichts verlässt das Gerät. Dient zum Ausprobieren, für Messen/Vereinsgespräche
// und als Fallback, solange kein Server eingerichtet ist.
import { buildDemo, demoExtras, demoTeam } from "../core/demo";
import type { Contact, Phase, TeamGroup, DayBlock, ClassKey, Modules, Principles, StaffRoleKey, TeamSettings, CoachMsg, CustomKind, Depth, Extra, Lang, Match, Player, Potential, Absence, Rating, TeamData, TeamEvent, TestResult, Video, Finding, Exercise, SessionTemplate, StaffProfile } from "../core/types";
import { ApiError, type Api, type ConsentState, type Membership, type UserInfo, type UserPrefs } from "./api";

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
    const t = demoTeam(this.cls, this.depth, this.lang, this.over);
    return [{ teamId: "demo", club: t.club, name: t.name, role: "owner" }];
  }
  async teamByCode(code: string) { return code.replace(/[^A-Z0-9]/gi, "").toUpperCase() === "DEMOU19K" ? { club: this.over.club || "", name: this.over.team || "U19" } : null; }
  async createTeam() { return "demo"; }
  async joinTeam() { return "p6"; }
  async joinStaff() { return "demo"; }
  /** Demo-Daten bleiben für die Sitzung im Speicher (Änderungen gehen beim Neuladen nicht verloren). */
  private data: TeamData | null = null;
  async loadTeam(): Promise<TeamData> {
    if (this.data) return this.data;
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
    this.data = D; return D;
  }
  async updateTeam() { /* lokal */ }
  async regenerateCodes() { return { joinCode: "DEMO-U19K", staffCode: "DEMO-STAF" }; }
  async staffList() { return [{ userId: this.user.id, role: "owner" as const, displayName: this.user.displayName }]; }
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
  async setAttendance() { /* lokal */ }
  async saveRpe() { /* lokal */ }
  async saveWellness() { /* lokal */ }
  async saveExtra(_p: string, x: Extra) { return { ...x, id: newId(x.id) }; }
  async deleteExtra() { /* lokal */ }
  async saveAbsence(_t: string, a: Absence) { return { ...a, id: newId(a.id) }; }
  async deleteAbsence() { /* lokal */ }
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
  async consents() { return { ...this.consent }; }
  async giveConsent(kind: keyof ConsentState) { this.consent[kind] = true; }
  async withdrawConsent(kind: keyof ConsentState) { this.consent[kind] = false; }
  async aiConsentPlayers() { return [] as string[]; }
  async registerPushToken() { /* im Demo-Modus keine Push-Nachrichten */ }
  async exportMyData() { return { hinweis: "Demo-Modus: Es sind keine persönlichen Daten gespeichert." }; }
  async deleteAccount() { /* nichts gespeichert */ }
  async ai(): Promise<string> { throw new ApiError("demo_ai"); }
}
