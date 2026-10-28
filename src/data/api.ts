// Schnittstelle zum Datenspeicher. Zwei Umsetzungen: Supabase (echt) und Demo (im Speicher).
import type { ClubInfo, ClubRole, ClubStaffEntry, ClubTeam, TeamSummary } from "../core/club";
import type { ChatFolderPrefs } from "../core/chat";
import type { StatPeriod } from "../core/stats";
import type { Riser, ScoutList, ScoutPlayer, ScoutReport, SquadPlan, MatchPlan, MpAvail, MpLog, MpOpened, MpPublished, MpShare, CashEntry, CashWaiver, Assessment, Challenge, ChallengeEntry, ChallengeTotals, Chat, ChatKind, ChatMsg, ChatPerson, ChatReport, ChatReportReason, DevTalk, Goal, GoalEntry, IndivRequest,
  Absence, AttStatus, CalOverride, ClassKey, CoachMsg, CustomKind, DayUnit, Depth, Extra, Growth, Lang, Match, Phase, Contact, Modules, TeamGroup, DayBlock, DutyEntry, FineEntry, TeamTask,
  MatchStat, Player, PlanOverride, Potential, Principles, Rating, RpeEntry, Session, Team, TeamData, TeamEvent, TeamSettings, TestResult, Video, WeekMode, Wellness, Finding, Exercise, SessionTemplate, StaffProfile,
} from "../core/types";

export type Role = "owner" | "coach" | "physio" | "pending" | "player";
export const isStaffRole = (r: Role | undefined | null): boolean => r === "owner" || r === "coach" || r === "physio";

export interface Membership { teamId: string; club: string; name: string; role: Role; playerId?: string | null;
  /** Trainerteam: einzelne Rechte (null/fehlend = Standard der Rolle, core/perms) */
  perms?: string[] | null;
  /** Verein des Teams (core/club) */
  clubId?: string | null;
  /** Zugriff über den Verein (Funktionär) – Rechte vergibt der Verein */
  viaClub?: boolean }
/** Persönliche Einstellungen eines Kontos (gelten auf allen Geräten). */
export interface UserPrefs {
  /** Info-Buttons (i) anzeigen – Standard: an */
  info?: boolean;
  /** Startseite: Reihenfolge und Sichtbarkeit der Karten */
  dash?: { k: string; on: boolean }[];
  /** Navigation (Trainer): Bereiche in der unteren Leiste (Reihenfolge) und im Menü ausgeblendete Bereiche */
  nav?: { bar?: string[]; hide?: string[] };
  /** Spieler-Startseite: Reihenfolge und Sichtbarkeit der Karten */
  dashPlayer?: { k: string; on: boolean }[];
  /** Spieler-Leiste: ausgeblendete Bereiche (kalender, chat, daten, tipps; Standard: tipps) */
  navPlayer?: { hide?: string[] };
  /** schon gesehene Tipps (z. B. „Leiste anpassen“) */
  seen?: string[];
  /** Darstellung: wie das System, hell oder dunkel */
  theme?: ThemeMode;
  /** Chat-Ordner: vorgegebene umbenannt/ausgeblendet, eigene Ordner mit Chats */
  chatFolders?: ChatFolderPrefs;
  /** Statistik: Ansicht (bzw. eigene Kennzahlen) und Zeitraum */
  stats?: { view?: string; cols?: string[]; period?: StatPeriod };
  /** Kader: Wert neben dem Namen (Kennzahl, „none“ = keiner) und Zeitraum */
  squadValue?: { k: string; period?: StatPeriod };
}
/** Darstellung: wie das System, immer hell oder immer dunkel */
export type ThemeMode = "system" | "light" | "dark";
export interface UserInfo { id: string; email: string; displayName: string; lang: Lang; prefs?: UserPrefs }
export type ConsentKind = "privacy" | "health_data" | "parental" | "ai" | "staff_confidentiality" | "findings";
export type ConsentState = Record<ConsentKind, boolean>;
export interface CreateTeamInput {
  club: string; name: string; cls: ClassKey; depth: Depth; settings: TeamSettings; principles: Principles; modules: Modules; lang: Lang;
}
export interface JoinProfile { vn: string; nn: string; geb: string; pos: string; nr: number | null; kg: number | null }
export type AiMode = "coach" | "player" | "session" | "potentials" | "kind";
export interface AiRequest { mode: AiMode; prompt: string; context: string; lang: Lang; teamId: string }
export interface StaffEntry { userId: string; role: Role; displayName: string; /** wirksame Rechte (core/perms) */ perms?: string[];
  /** Zugriff über den Verein (nicht im Team änderbar) */ viaClub?: boolean }
/** Vom Trainer veröffentlichter Wochenplan (für die Spieler-App). */
export interface PublishedDay { date: string; kind: string; rpe: number; dauer: number; inhalt: string }
export type TeamPatch = Partial<Pick<Team, "club" | "name" | "accent" | "cls" | "depth" | "settings" | "principles" | "modules" | "logo">>;

/** Rückmeldung aus der App: Fehler, Unklares, Wunsch oder Lob */
export type FeedbackKind = "bug" | "unclear" | "wish" | "praise";
export const FEEDBACK_KINDS: FeedbackKind[] = ["bug", "unclear", "wish", "praise"];
export interface FeedbackInput {
  kind: FeedbackKind; text: string;
  /** aktives Team (die Datenbank prüft die Mitgliedschaft und setzt die Rolle) */
  teamId: string | null;
  /** zuletzt geöffnete Seite (IDs durch :id ersetzt) */
  page: string | null;
  appVersion: string | null; updateId: string | null; platform: "ios" | "android" | "web"; osVersion: string | null; device: string | null;
}
/** Rückmeldung in der Liste der Betreiber */
export interface FeedbackItem extends Omit<FeedbackInput, "teamId"> {
  id: string; status: "open" | "done"; createdAt: string; doneAt: string | null;
  role: Role | null; team: string | null; reporter: string | null; shotPath: string | null;
}

/** Fehler mit maschinenlesbarem Code (z. B. invalid_code, consent_required, limit). */
export class ApiError extends Error {
  constructor(public code: string, message?: string, public details?: string) { super(message || code); }
}
/** Kein Netz (oder Server nicht erreichbar): Einträge kommen in die Offline-Warteschlange. */
export const isOffline = (e: unknown): boolean => e instanceof ApiError ? e.code === "offline"
  : e instanceof Error && /failed to fetch|network request failed|networkerror|fetch failed|load failed/i.test(e.message);

export interface Api {
  readonly kind: "demo" | "supabase";

  // Konto
  currentUser(): Promise<UserInfo | null>;
  onAuthChange(cb: (u: UserInfo | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string, lang: Lang): Promise<{ needsConfirmation: boolean }>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  setLanguage(lang: Lang): Promise<void>;

  // Mitgliedschaften
  memberships(): Promise<Membership[]>;
  teamByCode(code: string): Promise<{ club: string; name: string } | null>;
  createTeam(input: CreateTeamInput): Promise<string>;
  joinTeam(code: string, profile: JoinProfile): Promise<string>;
  joinStaff(code: string): Promise<string>;

  // Laden
  loadTeam(m: Membership): Promise<TeamData>;

  // Team
  updateTeam(teamId: string, patch: TeamPatch): Promise<void>;
  regenerateCodes(teamId: string): Promise<{ joinCode: string; staffCode: string }>;
  staffList(teamId: string): Promise<StaffEntry[]>;
  approveStaff(teamId: string, userId: string, role: "coach" | "physio"): Promise<void>;
  rejectStaff(teamId: string, userId: string): Promise<void>;
  /** Nur Owner: Rechte eines Mitglieds setzen (null = Standard der Rolle) */
  setStaffPerms(teamId: string, userId: string, perms: string[] | null): Promise<void>;

  // Verein (Vereinsabo): Funktionäre, Teams, Übersicht, Hochziehen/Wechsel, Ankündigungen
  myClubs(): Promise<ClubInfo[]>;
  /** Verein anlegen (optional gleich mit dem eigenen Team) – liefert die ID */
  clubCreate(name: string, teamId: string | null): Promise<string>;
  /** Team-Owner: Team per Vereinscode verbinden */
  clubLinkTeam(code: string, teamId: string): Promise<string>;
  /** Team-Owner oder Vereinsadmin: Team aus dem Verein lösen */
  clubUnlinkTeam(teamId: string): Promise<void>;
  /** Als Funktionär beitreten (Anfrage) */
  clubJoin(code: string): Promise<string>;
  clubUpdate(clubId: string, patch: { name?: string; accent?: string }): Promise<void>;
  clubStaffList(clubId: string): Promise<ClubStaffEntry[]>;
  /** Vereinsadmin: Funktion, Titel, Rechte und Teams (null = alle) setzen – bestätigt auch Anfragen */
  clubSetStaff(clubId: string, userId: string, role: ClubRole, title: string, perms: string[], teams: string[] | null): Promise<void>;
  /** Vereinsadmin entfernt bzw. Funktionär tritt selbst aus */
  clubRemoveStaff(clubId: string, userId: string): Promise<void>;
  clubRegenerateCodes(clubId: string): Promise<{ linkCode: string; staffCode: string }>;
  clubDelete(clubId: string): Promise<void>;
  clubTeams(clubId: string): Promise<ClubTeam[]>;
  clubOverview(clubId: string): Promise<TeamSummary[]>;
  /** Spieler zusätzlich ins Zielteam (add, z. B. Hochziehen) oder dauerhaft wechseln (move); copy = Belastung, Morgen-Checks, Ausfälle mitnehmen */
  clubMovePlayer(playerId: string, targetTeamId: string, mode: "add" | "move", copy: boolean): Promise<string>;
  /** Ankündigung in die Teamchats (null = alle Teams mit Zugriff); liefert die Anzahl der Teams */
  clubAnnounce(clubId: string, body: string, teams: string[] | null): Promise<number>;

  // Kalender & Plan
  saveMatch(teamId: string, m: Match): Promise<Match>;
  deleteMatch(teamId: string, id: string): Promise<void>;
  saveEvent(teamId: string, e: TeamEvent): Promise<TeamEvent>;
  deleteEvent(teamId: string, id: string): Promise<void>;
  setCal(teamId: string, date: string, ov: CalOverride | null): Promise<void>;
  setOver(teamId: string, date: string, ov: PlanOverride | null): Promise<void>;
  setWeekMode(teamId: string, ws: string, mode: WeekMode): Promise<void>;
  saveKind(teamId: string, k: CustomKind): Promise<CustomKind>;
  deleteKind(teamId: string, id: string): Promise<void>;
  saveSessions(teamId: string, s: Session[]): Promise<void>;
  /** Weitere Einheit für einen Tag speichern (ändern, absagen oder zusätzlich) */
  saveUnit(teamId: string, date: string, u: DayUnit): Promise<void>;
  deleteUnit(teamId: string, date: string, slot: number): Promise<void>;
  /** Vergangene wiederkehrende Einheiten festhalten (vorhandene Tageseinträge bleiben unverändert) */
  saveUnits(teamId: string, rows: { date: string; u: DayUnit }[]): Promise<void>;
  publishWeekPlan(teamId: string, ws: string, days: PublishedDay[]): Promise<void>;

  // Spieler & Daten
  savePlayer(teamId: string, p: Player): Promise<Player>;
  deletePlayer(teamId: string, p: Player): Promise<void>;
  mergePlayers(newId: string, existingId: string): Promise<void>;
  uploadPhoto(teamId: string, pid: string, uri: string): Promise<string>;
  photoUrl(path: string): Promise<string | null>;
  setAttendance(teamId: string, date: string, pid: string, st: AttStatus | null): Promise<void>;
  /** slot: 0 = Mannschaftstraining/Spiel, 1–9 = weitere Einheit des Tages */
  saveRpe(pid: string, date: string, e: RpeEntry | null, slot?: number): Promise<void>;
  saveWellness(pid: string, date: string, w: Wellness): Promise<void>;
  saveExtra(pid: string, x: Extra): Promise<Extra>;
  deleteExtra(id: string): Promise<void>;
  saveAbsence(teamId: string, a: Absence): Promise<Absence>;
  deleteAbsence(id: string): Promise<void>;
  saveGrowth(pid: string, g: Growth): Promise<void>;
  savePotential(pid: string, x: Potential): Promise<Potential>;
  deletePotential(id: string): Promise<void>;
  saveMessage(pid: string, m: CoachMsg): Promise<CoachMsg>;
  deleteMessage(id: string): Promise<void>;
  saveNote(pid: string, text: string): Promise<void>;

  // Spiele, Bewertungen, Videos
  saveStat(teamId: string, matchId: string, pid: string, st: MatchStat | null): Promise<void>;
  saveRating(teamId: string, r: Rating): Promise<Rating>;
  deleteRating(id: string): Promise<void>;
  saveVideo(teamId: string, v: Video): Promise<Video>;
  deleteVideo(id: string): Promise<void>;

  // Leistungstests
  saveTest(teamId: string, r: TestResult): Promise<TestResult>;
  deleteTest(id: string): Promise<void>;

  // Befunde (Verletzungen)
  uploadFinding(teamId: string, f: Omit<Finding, "id" | "path" | "ai" | "aiAt">, uri: string): Promise<Finding>;
  updateFinding(f: Finding): Promise<void>;
  deleteFinding(f: Finding): Promise<void>;
  findingUrl(path: string): Promise<string | null>;
  analyzeFinding(teamId: string, id: string, context: string, lang: Lang): Promise<string>;

  // Übungsarchiv, Einheiten-Vorlagen, Trainerprofile
  saveExercise(teamId: string, x: Exercise): Promise<Exercise>;
  deleteExercise(id: string): Promise<void>;
  saveTemplate(teamId: string, x: SessionTemplate): Promise<SessionTemplate>;
  deleteTemplate(id: string): Promise<void>;
  saveStaff(teamId: string, x: StaffProfile): Promise<StaffProfile>;
  /** Vereinslogo bzw. Trainerfoto hochladen; liefert den Speicherpfad */
  uploadTeamImage(teamId: string, name: "logo" | `staff-${string}`, uri: string): Promise<string>;
  /** Persönliche Einstellungen speichern */
  savePrefs(prefs: UserPrefs): Promise<void>;
  /** Anzeigename des Kontos setzen */
  setDisplayName(name: string): Promise<void>;
  deleteStaff(id: string): Promise<void>;

  // Vorbereitung & Pausen
  savePhase(teamId: string, x: Phase): Promise<Phase>;
  deletePhase(id: string): Promise<void>;
  // Kontaktliste
  saveContact(teamId: string, x: Contact): Promise<Contact>;
  deleteContact(id: string): Promise<void>;
  // Gruppen (Mitglieder: Player.groups)
  saveGroup(teamId: string, g: TeamGroup): Promise<TeamGroup>;
  deleteGroup(id: string): Promise<void>;
  setGroupMember(teamId: string, groupId: string, playerId: string, on: boolean): Promise<void>;
  // Trainingstag: Ablauf-Blöcke und Skizzen-Fotos (nur Trainerteam)
  saveBlock(teamId: string, b: DayBlock): Promise<DayBlock>;
  deleteBlock(b: DayBlock): Promise<void>;
  /** Foto einer Skizze hochladen; liefert den Speicherpfad */
  uploadSketch(teamId: string, blockId: string, uri: string): Promise<string>;
  sketchUrl(path: string): Promise<string | null>;
  removeSketch(path: string): Promise<void>;
  // Aufgaben, Dienste, Strafen
  saveFine(teamId: string, f: FineEntry): Promise<FineEntry>;
  deleteFine(id: string): Promise<void>;
  /** Dienste anlegen (vorhandene gleiche Einteilungen werden übersprungen); liefert die neuen Zeilen */
  addDuties(teamId: string, ds: DutyEntry[]): Promise<DutyEntry[]>;
  saveDuty(teamId: string, d: DutyEntry): Promise<DutyEntry>;
  deleteDuties(ids: string[]): Promise<void>;
  saveTask(teamId: string, t: TeamTask): Promise<TeamTask>;
  deleteTask(id: string): Promise<void>;
  /** Aufgabe erledigt/offen (Spieler: nur eigene) */
  setTaskDone(id: string, done: boolean, at?: string | null): Promise<void>;

  // Mannschaftskasse (Trainerteam mit Recht „cash“ und Kassenwart)
  saveCash(teamId: string, e: CashEntry): Promise<CashEntry>;
  deleteCash(id: string): Promise<void>;
  setWaiver(teamId: string, w: CashWaiver, on: boolean): Promise<void>;
  /** Spieler mit App-Konto und Einwilligung in Gesundheitsdaten (dürfen RPE eintragen) */
  healthConsentPlayers(teamId: string): Promise<string[]>;

  // Spielerentwicklung (Trainerteam mit Recht „Notizen“; Spieler: Selbsteinschätzung, eigene Ziele, Fortschritt)
  saveAssessment(teamId: string, a: Assessment): Promise<Assessment>;
  deleteAssessment(id: string): Promise<void>;
  saveGoal(teamId: string, g: Goal): Promise<Goal>;
  /** Spieler: nur Schritte eines Ziels des Trainerteams abhaken */
  saveGoalSteps(id: string, steps: Goal["steps"]): Promise<void>;
  deleteGoal(id: string): Promise<void>;
  saveGoalEntry(e: GoalEntry): Promise<GoalEntry>;
  deleteGoalEntry(id: string): Promise<void>;
  /** Gespräch mit interner Notiz (eigene Tabelle, nie für Spieler) */
  saveTalk(teamId: string, t: DevTalk): Promise<DevTalk>;
  deleteTalk(id: string): Promise<void>;
  // Wochenchallenge
  saveChallenge(teamId: string, c: Challenge): Promise<Challenge>;
  deleteChallenge(id: string): Promise<void>;
  saveChallengeEntry(e: ChallengeEntry): Promise<void>;
  /** Teamsummen einer Woche (Spieler: ohne Werte anderer; Bestenliste nur, wenn eingeschaltet) */
  challengeTotals(teamId: string, ws: string): Promise<ChallengeTotals[]>;
  // Individualtraining
  saveIndiv(teamId: string, r: IndivRequest): Promise<IndivRequest>;

  // Matchplan (Trainerteam: Recht „plan“; Spieler lesen nur freigegebene Pläne über planOpen – mit Zugriffsprotokoll)
  savePlan(teamId: string, p: MatchPlan): Promise<MatchPlan>;
  deletePlan(id: string): Promise<void>;
  /** Freigeben bzw. aktualisieren (veröffentlichter Stand, Zeitraum, Kader) oder beenden (share = null) */
  sharePlan(id: string, share: MpShare | null, published: MpPublished | null, squad: string[]): Promise<MatchPlan>;
  /** Zugriffsprotokoll eines Plans (Trainerteam) */
  planLogs(planId: string): Promise<MpLog[]>;
  /** Spieler: jetzt freigegebene Pläne */
  myPlans(teamId: string): Promise<MpAvail[]>;
  /** Spieler: Plan öffnen (wird protokolliert) */
  planOpen(id: string, platform: "ios" | "android" | "web"): Promise<MpOpened>;
  /** Spieler: erkannter Screenshot */
  planShot(id: string, platform: "ios" | "android" | "web"): Promise<void>;

  // Kaderplanung & Scouting (Recht „scout“; Spieler nie)
  saveScout(teamId: string, x: ScoutPlayer): Promise<ScoutPlayer>;
  deleteScout(id: string): Promise<void>;
  saveScoutReport(teamId: string, r: ScoutReport): Promise<ScoutReport>;
  deleteScoutReport(id: string): Promise<void>;
  saveScoutList(teamId: string, l: ScoutList): Promise<ScoutList>;
  deleteScoutList(id: string): Promise<void>;
  /** Saisonplanung speichern (eine je Saison) */
  saveSquadPlan(teamId: string, p: SquadPlan): Promise<SquadPlan>;
  deleteSquadPlan(id: string): Promise<void>;
  /** Aufrücker aus jüngeren Teams des Vereins mit passendem Jahrgang */
  clubRisers(teamId: string, years: number[]): Promise<Riser[]>;

  // Chat
  /** Team-, Trainerteam-, Gruppen- oder Einzelchat öffnen (wird bei Bedarf angelegt) */
  chatOpen(teamId: string, kind: ChatKind, groupId?: string | null, other?: string | null): Promise<Chat>;
  /** Eigene Gruppe anlegen oder ändern */
  chatSaveCustom(teamId: string, chatId: string | null, title: string, members: string[], readOnly: boolean): Promise<Chat>;
  chatLeave(chatId: string): Promise<void>;
  /** Gruppen-/Trainerteam-Chat: nur Trainerteam schreibt (Recht „messages“) */
  chatSetReadOnly(chatId: string, readOnly: boolean): Promise<void>;
  chatSend(teamId: string, chatId: string, body: string, replyTo: string | null, clientId: string): Promise<ChatMsg>;
  chatDelete(id: string): Promise<void>;
  chatReact(msgId: string, emoji: string, on: boolean): Promise<void>;
  chatRead(chatId: string, at: string): Promise<void>;
  chatMute(chatId: string, muted: boolean): Promise<void>;
  chatReport(msgId: string, reason: ChatReportReason, note: string): Promise<void>;
  chatSetReport(id: string, done: boolean): Promise<void>;
  /** Ältere Nachrichten eines Chats (vor dem Zeitpunkt) */
  chatOlder(chatId: string, before: string): Promise<{ msgs: ChatMsg[]; more: boolean }>;
  /** Neue und gelöschte Nachrichten seit dem Zeitpunkt (mit Reaktionen) – falls Echtzeit nicht ankommt */
  chatSince(teamId: string, since: string): Promise<ChatMsg[]>;
  /** Chats, Personen, Meldungen und eigener Lesestand neu laden */
  chatList(teamId: string): Promise<ChatListData>;
  /** Echtzeit: neue und gelöschte Nachrichten, Reaktionen; liefert die Abmeldung */
  chatSubscribe(teamId: string, on: (ev: ChatEvent) => void): () => void;

  // Einwilligungen, Push, Datenschutz
  consents(): Promise<ConsentState>;
  giveConsent(kind: ConsentKind, opts?: { parentEmail?: string; playerId?: string }): Promise<void>;
  withdrawConsent(kind: ConsentKind): Promise<void>;
  aiConsentPlayers(teamId: string): Promise<string[]>;
  registerPushToken(token: string, platform: "ios" | "android" | "web"): Promise<void>;
  exportMyData(): Promise<unknown>;
  deleteAccount(): Promise<void>;

  // KI
  ai(req: AiRequest): Promise<string>;

  // Rückmeldungen (Feedback-Knopf für alle; Liste, erledigen und löschen nur für Betreiber der App)
  /** Rückmeldung senden, optional mit Bildschirmfoto (Bild-URI vom Gerät) */
  sendFeedback(f: FeedbackInput, shotUri: string | null): Promise<void>;
  isAppAdmin(): Promise<boolean>;
  /** Offene Rückmeldungen (0, wenn kein Betreiber) */
  feedbackOpenCount(): Promise<number>;
  feedbackList(status: "open" | "done" | "all"): Promise<FeedbackItem[]>;
  feedbackSetDone(id: string, done: boolean): Promise<void>;
  /** Rückmeldung samt Bildschirmfoto löschen */
  feedbackDelete(id: string): Promise<void>;
  feedbackShotUrl(path: string): Promise<string | null>;
}

export const CONSENT_VERSION = "2026-10";

export interface ChatListData { chats: Chat[]; people: ChatPerson[]; reports: ChatReport[]; read: Record<string, string>; old: Record<string, string> }
/** Ereignis aus der Echtzeit-Verbindung des Chats */
export type ChatEvent =
  | { type: "msg"; msg: Omit<ChatMsg, "reactions"> }
  | { type: "react"; msgId: string; chatId: string; uid: string; emoji: string; on: boolean };
