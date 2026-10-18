// Demo-Modus: alles im Speicher, nichts verlässt das Gerät. Dient zum Ausprobieren, für Messen/Vereinsgespräche
// und als Fallback, solange kein Server eingerichtet ist.
import { buildDemo, demoChat, demoExtras, demoTeam } from "../core/demo";
import { chatSettings, pairKey } from "../core/chat";
import type { MatchPlan, MpAvail, MpLog, MpOpened, MpPublished, MpShare, Assessment, Challenge, ChallengeEntry, Chat, ChatKind, ChatMsg, DevTalk, Goal, GoalEntry, IndivRequest, CashEntry, Contact, Phase, TeamGroup, DayBlock, DutyEntry, FineEntry, TeamTask, ClassKey, Modules, Principles, StaffRoleKey, TeamSettings, CoachMsg, CustomKind, Depth, Extra, Lang, Match, Player, Potential, Absence, Rating, TeamData, TeamEvent, TestResult, Video, Finding, Exercise, SessionTemplate, StaffProfile } from "../core/types";
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
    this.data = D; return D;
  }
  async updateTeam() { /* lokal */ }
  async regenerateCodes() { return { joinCode: "DEMO-U19K", staffCode: "DEMO-STAF" }; }
  /** Demo: Trainerteam = Trainerprofile (außer dem eigenen); Rechte je Profil (Vorlage der Funktion, änderbar) */
  private perms: Record<string, string[] | null> = {};
  async staffList(): Promise<StaffEntry[]> {
    const others = (this.data?.staff || []).filter(x => x.id !== "s1");
    return [{ userId: this.user.id, role: "owner" as const, displayName: this.user.displayName, perms: [...PERMS] },
      ...others.map(x => ({ userId: "demo-" + x.id, role: accessRoleFor(x.role), displayName: x.name, perms: this.demoPerms(x.id) }))];
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
