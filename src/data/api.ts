// Schnittstelle zum Datenspeicher. Zwei Umsetzungen: Supabase (echt) und Demo (im Speicher).
import type {
  Absence, AttStatus, CalOverride, ClassKey, CoachMsg, CustomKind, Depth, Extra, Growth, Lang, Match, Phase, Contact, Modules,
  MatchStat, Player, PlanOverride, Potential, Principles, Rating, RpeEntry, Session, Team, TeamData, TeamEvent, TeamSettings, TestResult, Video, WeekMode, Wellness, Finding, Exercise, SessionTemplate, StaffProfile,
} from "../core/types";

export type Role = "owner" | "coach" | "physio" | "pending" | "player";
export const isStaffRole = (r: Role | undefined | null): boolean => r === "owner" || r === "coach" || r === "physio";

export interface Membership { teamId: string; club: string; name: string; role: Role; playerId?: string | null }
export interface UserInfo { id: string; email: string; displayName: string; lang: Lang }
export type ConsentKind = "privacy" | "health_data" | "parental" | "ai" | "staff_confidentiality" | "findings";
export type ConsentState = Record<ConsentKind, boolean>;
export interface CreateTeamInput {
  club: string; name: string; cls: ClassKey; depth: Depth; settings: TeamSettings; principles: Principles; modules: Modules; lang: Lang;
}
export interface JoinProfile { vn: string; nn: string; geb: string; pos: string; nr: number | null; kg: number | null }
export type AiMode = "coach" | "player" | "session" | "potentials" | "kind";
export interface AiRequest { mode: AiMode; prompt: string; context: string; lang: Lang; teamId: string }
export interface StaffEntry { userId: string; role: Role; displayName: string }
/** Vom Trainer veröffentlichter Wochenplan (für die Spieler-App). */
export interface PublishedDay { date: string; kind: string; rpe: number; dauer: number; inhalt: string }
export type TeamPatch = Partial<Pick<Team, "club" | "name" | "accent" | "cls" | "depth" | "settings" | "principles" | "modules">>;

/** Fehler mit maschinenlesbarem Code (z. B. invalid_code, consent_required, limit). */
export class ApiError extends Error {
  constructor(public code: string, message?: string, public details?: string) { super(message || code); }
}

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
  publishWeekPlan(teamId: string, ws: string, days: PublishedDay[]): Promise<void>;

  // Spieler & Daten
  savePlayer(teamId: string, p: Player): Promise<Player>;
  deletePlayer(teamId: string, p: Player): Promise<void>;
  mergePlayers(newId: string, existingId: string): Promise<void>;
  uploadPhoto(teamId: string, pid: string, uri: string): Promise<string>;
  photoUrl(path: string): Promise<string | null>;
  setAttendance(teamId: string, date: string, pid: string, st: AttStatus | null): Promise<void>;
  saveRpe(pid: string, date: string, e: RpeEntry | null): Promise<void>;
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
  deleteStaff(id: string): Promise<void>;

  // Vorbereitung & Pausen
  savePhase(teamId: string, x: Phase): Promise<Phase>;
  deletePhase(id: string): Promise<void>;
  // Kontaktliste
  saveContact(teamId: string, x: Contact): Promise<Contact>;
  deleteContact(id: string): Promise<void>;

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
}

export const CONSENT_VERSION = "2026-10";
