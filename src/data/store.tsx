// Zentraler Zustand der App: Konto, aktives Team, Daten (TeamData) und alle Änderungen.
// Änderungen werden sofort lokal übernommen (schnelle Oberfläche) und dann gespeichert.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addDays, iso, monday } from "../core/dates";
import { createEngine, type Engine } from "../core/engine";
import { translator, type Translator } from "../core/i18n";
import type {
  Absence, AttStatus, CalOverride, ClassKey, CoachMsg, CustomKind, Depth, Extra, Growth, Lang, Match, Player, PlanOverride,
  Potential, RpeEntry, Session, TeamData, TeamEvent, WeekMode, Wellness,
} from "../core/types";
import { ApiError, isStaffRole, type Api, type ConsentKind, type ConsentState, type CreateTeamInput, type JoinProfile, type Membership, type PublishedDay, type TeamPatch, type UserInfo } from "./api";
import { DemoApi } from "./demoApi";
import { hasSupabase } from "./supabase";
import { forgetPhoto } from "../ui/playerAvatar";

const K_TEAM = "tb.activeTeam", K_LANG = "tb.lang";
let tmp = 1;
export const tmpId = (): string => "tmp-" + Date.now().toString(36) + "-" + (tmp++);

export type Phase = "loading" | "signedOut" | "noTeam" | "pending" | "ready";

interface State {
  phase: Phase;
  api: Api;
  user: UserInfo | null;
  memberships: Membership[];
  active: Membership | null;
  D: TeamData | null;
  version: number;
  lang: Lang;
  consents: ConsentState | null;
  aiPlayers: string[];
  toastMsg: string | null;
  /** Nur im Demo-Modus: Trainer- oder Spieleransicht und gewählter Spieler. */
  demoView: "coach" | "player";
  demoPlayer: string | null;
}

function systemLang(): Lang {
  try { const l = Localization.getLocales()[0]?.languageCode; return l === "de" ? "de" : "en"; } catch { return "de"; }
}

function makeApi(): Api {
  if (hasSupabase) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SupabaseApi } = require("./supabaseApi") as typeof import("./supabaseApi");
    return new SupabaseApi();
  }
  return new DemoApi();
}

function useStoreValue() {
  const [s, setS] = useState<State>(() => ({
    phase: "loading", api: makeApi(), user: null, memberships: [], active: null, D: null, version: 0, lang: systemLang(),
    consents: null, aiPlayers: [], toastMsg: null, demoView: "coach", demoPlayer: null,
  }));
  const ref = useRef(s); ref.current = s;
  const set = useCallback((p: Partial<State>) => setS(prev => ({ ...prev, ...p })), []);
  const tr = useMemo(() => translator(s.lang), [s.lang]);

  // ---------- Meldungen ----------
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string) => {
    set({ toastMsg: msg }); if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => set({ toastMsg: null }), 2600);
  }, [set]);
  const errText = useCallback((e: unknown): string => {
    const code = e instanceof ApiError ? e.code : "server";
    const k = "err_" + code; const txt = translator(ref.current.lang).t(k);
    return txt === k ? translator(ref.current.lang).t("err_server") : txt;
  }, []);

  // ---------- Laden ----------
  const loadActive = useCallback(async (api: Api, m: Membership | null, extra: Partial<State> = {}) => {
    if (!m) { set({ phase: "noTeam", active: null, D: null, ...extra }); return; }
    if (m.role === "pending") { set({ phase: "pending", active: m, D: null, ...extra }); return; }
    const D = await api.loadTeam(m);
    const [consents, aiPlayers] = await Promise.all([api.consents(), isStaffRole(m.role) ? api.aiConsentPlayers(m.teamId).catch(() => []) : Promise.resolve([])]);
    set({ phase: "ready", active: m, D, version: ref.current.version + 1, consents, aiPlayers, ...extra });
    try { await AsyncStorage.setItem(K_TEAM, m.teamId); } catch { /* optional */ }
    if (isStaffRole(m.role) && api.kind === "supabase") afterCoachLoad(api, m, D);
  }, [set]);

  const boot = useCallback(async () => {
    const api = ref.current.api;
    let lang = ref.current.lang;
    try { const l = await AsyncStorage.getItem(K_LANG); if (l === "de" || l === "en") lang = l; } catch { /* optional */ }
    try {
      const user = await api.currentUser();
      if (!user || api.kind === "demo") { set({ phase: "signedOut", user: null, lang }); return; }
      const ms = await api.memberships();
      let pick: Membership | null = null;
      try { const last = await AsyncStorage.getItem(K_TEAM); pick = ms.find(m => m.teamId === last && m.role !== "pending") || null; } catch { /* optional */ }
      pick = pick || ms.find(m => m.role !== "pending") || ms[0] || null;
      await loadActive(api, pick, { user, memberships: ms, lang: user.lang || lang });
    } catch (e) { set({ phase: "signedOut", lang }); toast(errText(e)); }
  }, [loadActive, set, toast, errText]);

  useEffect(() => {
    boot();
    const off = ref.current.api.onAuthChange(u => { if (!u && ref.current.api.kind === "supabase") set({ phase: "signedOut", user: null, D: null, active: null, memberships: [] }); });
    return off;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    const { api, active } = ref.current;
    try { const ms = await api.memberships(); const m = ms.find(x => x.teamId === active?.teamId) || ms[0] || null; await loadActive(api, m, { memberships: ms }); }
    catch (e) { toast(errText(e)); }
  }, [loadActive, toast, errText]);

  // ---------- Trainer: vergangene Einheiten festhalten und Plan für Spieler veröffentlichen ----------
  const published = useRef<Record<string, string>>({});
  function afterCoachLoad(api: Api, m: Membership, D: TeamData) {
    const E = createEngine(D, { lang: ref.current.lang });
    const have = new Set(D.sessions.map(x => x.date)), add: Session[] = [];
    for (let k = 42; k >= 0; k--) {
      const d = addDays(E.TODAY, -k); if (have.has(d)) continue;
      const it = E.weekPlan(monday(d)).items.find(x => x.date === d)!;
      if (it.match) add.push({ date: d, typ: "Spiel", dauer: E.matchMin(), zeit: it.match.zeit, md: "MD", ziel: E.matchRpe() });
      else if (it.train && it.train.kind !== "frei") add.push({ date: d, typ: "Training", dauer: it.train.dauer, zeit: E.zeitOf(d), md: it.md, ziel: it.train.rpe, kind: it.train.kind });
    }
    if (add.length) { D.sessions.push(...add); D.sessions.sort((a, b) => a.date < b.date ? -1 : 1); api.saveSessions(m.teamId, add).catch(() => undefined); }
    publishPlans();
  }
  const pubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishPlans = useCallback(() => {
    if (pubTimer.current) clearTimeout(pubTimer.current);
    pubTimer.current = setTimeout(async () => {
      const { api, active, D, lang } = ref.current;
      if (!D || !active || !isStaffRole(active.role) || api.kind !== "supabase") return;
      const E = createEngine(D, { lang });
      for (let w = 0; w <= 2; w++) {
        const ws = addDays(monday(E.TODAY), 7 * w), wp = E.weekPlan(ws);
        const days: PublishedDay[] = wp.tr.map(p => ({ date: p.date, kind: p.kind, rpe: p.rpe, dauer: p.dauer, inhalt: p.inhalt }));
        const key = JSON.stringify(days);
        if (published.current[ws] === key) continue;
        try { await api.publishWeekPlan(active.teamId, ws, days); published.current[ws] = key; } catch { /* nächster Versuch bei der nächsten Änderung */ }
      }
    }, 1500);
  }, []);

  // ---------- Änderungen ----------
  /** Lokal ändern, neu rechnen, speichern; bei Fehler Meldung und neu laden. */
  const change = useCallback(async (local: (D: TeamData) => void, remote: (api: Api, teamId: string) => Promise<unknown>, opts: { plan?: boolean; ok?: string } = {}) => {
    const { D, active, api } = ref.current; if (!D || !active) return;
    local(D); setS(prev => ({ ...prev, version: prev.version + 1 }));
    try { await remote(api, active.teamId); setS(prev => ({ ...prev, version: prev.version + 1 })); if (opts.ok) toast(opts.ok); if (opts.plan) publishPlans(); }
    catch (e) { toast(errText(e)); reload(); }
  }, [toast, errText, reload, publishPlans]);

  const replaceIn = <T extends { id: string }>(arr: T[], tmpObj: T, saved: T): void => { const i = arr.findIndex(x => x.id === tmpObj.id); if (i >= 0) arr[i] = saved; };

  const actions = {
    toast, errText, reload, boot,
    // Konto & Sitzung
    setLang: async (lang: Lang) => { set({ lang }); try { await AsyncStorage.setItem(K_LANG, lang); } catch { /* optional */ } ref.current.api.setLanguage(lang).catch(() => undefined); },
    signIn: async (email: string, pw: string) => { const api = ref.current.api; await api.signIn(email, pw); await boot(); },
    signUp: (email: string, pw: string, name: string) => ref.current.api.signUp(email, pw, name, ref.current.lang),
    resetPassword: (email: string) => ref.current.api.resetPassword(email),
    signOut: async () => { await ref.current.api.signOut(); try { await AsyncStorage.removeItem(K_TEAM); } catch { /* optional */ } set({ phase: "signedOut", user: null, D: null, active: null, memberships: [] }); },
    startDemo: async (cls: ClassKey = "u19", depth: Depth = "basis") => {
      const api = new DemoApi(cls, depth, ref.current.lang);
      const user = await api.currentUser(); const ms = await api.memberships();
      set({ api, user, memberships: ms }); await loadActive(api, ms[0], { api, user, memberships: ms, demoView: "coach", demoPlayer: null });
    },
    leaveDemo: () => { set({ api: makeApi(), phase: "loading", D: null, active: null, user: null }); setTimeout(() => boot(), 0); },
    setDemoView: (v: "coach" | "player", pid?: string | null) => set({ demoView: v, demoPlayer: pid ?? ref.current.demoPlayer }),
    selectTeam: async (m: Membership) => { set({ phase: "loading" }); try { await loadActive(ref.current.api, m); } catch (e) { toast(errText(e)); } },
    createTeam: async (input: CreateTeamInput) => { const id = await ref.current.api.createTeam(input); const ms = await ref.current.api.memberships(); await loadActive(ref.current.api, ms.find(m => m.teamId === id) || null, { memberships: ms }); return id; },
    joinTeam: async (code: string, p: JoinProfile) => { const pid = await ref.current.api.joinTeam(code, p); const ms = await ref.current.api.memberships(); await loadActive(ref.current.api, ms.find(m => m.playerId === pid) || ms[0] || null, { memberships: ms }); return pid; },
    joinStaff: async (code: string) => { await ref.current.api.joinStaff(code); const ms = await ref.current.api.memberships(); await loadActive(ref.current.api, ms.find(m => m.role === "pending") || ms[0] || null, { memberships: ms }); },
    giveConsent: async (kind: ConsentKind, o?: { parentEmail?: string; playerId?: string }) => { await ref.current.api.giveConsent(kind, o); set({ consents: await ref.current.api.consents() }); },
    withdrawConsent: async (kind: ConsentKind) => { await ref.current.api.withdrawConsent(kind); set({ consents: await ref.current.api.consents() }); },
    deleteAccount: async () => { await ref.current.api.deleteAccount(); set({ phase: "signedOut", user: null, D: null, active: null, memberships: [] }); },
    exportMyData: () => ref.current.api.exportMyData(),

    // Team
    updateTeam: (patch: TeamPatch) => change(D => { Object.assign(D.team, patch); }, (api, id) => api.updateTeam(id, patch), { plan: true }),

    // Kalender & Plan
    saveMatch: (m: Match) => { const isNew = m.id.startsWith("tmp-"); return change(D => { if (isNew) D.matches.push(m); else Object.assign(D.matches.find(x => x.id === m.id)!, m); D.matches.sort((a, b) => a.date < b.date ? -1 : 1); },
      async (api, id) => { const saved = await api.saveMatch(id, m); replaceIn(ref.current.D!.matches, m, saved); }, { plan: true }); },
    deleteMatch: (id: string) => change(D => { D.matches = D.matches.filter(x => x.id !== id); }, (api, t) => api.deleteMatch(t, id), { plan: true }),
    saveEvent: (e: TeamEvent) => { const isNew = e.id.startsWith("tmp-"); return change(D => { if (isNew) D.events.push(e); else Object.assign(D.events.find(x => x.id === e.id)!, e); },
      async (api, id) => { const saved = await api.saveEvent(id, e); replaceIn(ref.current.D!.events, e, saved); }, { plan: true }); },
    deleteEvent: (id: string) => change(D => { D.events = D.events.filter(x => x.id !== id); }, (api, t) => api.deleteEvent(t, id), { plan: true }),
    setCal: (date: string, ov: CalOverride | null) => change(D => { if (ov) D.cal[date] = ov; else delete D.cal[date]; }, (api, t) => api.setCal(t, date, ov), { plan: true }),
    setOver: (date: string, ov: PlanOverride | null) => change(D => { if (ov) D.over[date] = ov; else delete D.over[date]; }, (api, t) => api.setOver(t, date, ov), { plan: true }),
    setWeekMode: (ws: string, mode: WeekMode) => change(D => { if (mode === "normal") delete D.wkMode[ws]; else D.wkMode[ws] = mode; }, (api, t) => api.setWeekMode(t, ws, mode), { plan: true }),
    saveKind: async (k: CustomKind): Promise<CustomKind> => {
      const { api, active, D } = ref.current; if (!D || !active) return k;
      const saved = await api.saveKind(active.teamId, k);
      const i = D.kinds.findIndex(x => x.id === k.id); if (i >= 0) D.kinds[i] = saved; else D.kinds.push(saved);
      set({ version: ref.current.version + 1 }); publishPlans(); return saved;
    },
    deleteKind: (id: string) => change(D => { D.kinds = D.kinds.filter(x => x.id !== id); }, (api, t) => api.deleteKind(t, id), { plan: true }),

    // Spieler
    savePlayer: async (p: Player): Promise<Player> => {
      const { api, active, D } = ref.current; if (!D || !active) return p;
      const saved = await api.savePlayer(active.teamId, p);
      const i = D.players.findIndex(x => x.id === p.id); if (i >= 0) D.players[i] = { ...saved, photo: saved.photo ?? p.photo }; else D.players.push(saved);
      set({ version: ref.current.version + 1 }); return saved;
    },
    deletePlayer: (p: Player) => change(D => { D.players = D.players.filter(x => x.id !== p.id); }, (api, t) => api.deletePlayer(t, p)),
    mergePlayers: async (newId: string, existingId: string) => { await ref.current.api.mergePlayers(newId, existingId); await reload(); },
    uploadPhoto: async (pid: string, uri: string) => {
      const { api, active, D } = ref.current; if (!D || !active) return;
      const path = await api.uploadPhoto(active.teamId, pid, uri); forgetPhoto(path); const p = D.players.find(x => x.id === pid); if (p) p.photo = path;
      set({ version: ref.current.version + 1 });
    },
    setAttendance: (date: string, pid: string, st: AttStatus | null) => change(D => { if (st) (D.att[date] ||= {})[pid] = st; else if (D.att[date]) delete D.att[date][pid]; }, (api, t) => api.setAttendance(t, date, pid, st)),
    saveRpe: (pid: string, date: string, e: RpeEntry | null) => change(D => { if (e) (D.rpe[pid] ||= {})[date] = e; else if (D.rpe[pid]) delete D.rpe[pid][date]; if (e && D.sessions.some(s => s.date === date) && !D.att[date]?.[pid]) (D.att[date] ||= {})[pid] = "da"; }, api => api.saveRpe(pid, date, e)),
    saveWellness: (pid: string, date: string, w: Wellness) => change(D => { (D.well[pid] ||= {})[date] = w; }, api => api.saveWellness(pid, date, w)),
    saveExtra: (pid: string, x: Extra) => change(D => { (D.extra[pid] ||= []).push(x); }, async api => { const saved = await api.saveExtra(pid, x); replaceIn(ref.current.D!.extra[pid] || [], x, saved); }),
    deleteExtra: (pid: string, id: string) => change(D => { D.extra[pid] = (D.extra[pid] || []).filter(x => x.id !== id); }, api => api.deleteExtra(id)),
    saveAbsence: (a: Absence) => { const isNew = a.id.startsWith("tmp-"); return change(D => { if (isNew) D.absences.push(a); else Object.assign(D.absences.find(x => x.id === a.id)!, a); },
      async (api, t) => { const saved = await api.saveAbsence(t, a); replaceIn(ref.current.D!.absences, a, saved); }, { plan: true }); },
    deleteAbsence: (id: string) => change(D => { D.absences = D.absences.filter(x => x.id !== id); }, api => api.deleteAbsence(id), { plan: true }),
    saveGrowth: (pid: string, g: Growth) => change(D => { (D.growth[pid] ||= []).push(g); }, api => api.saveGrowth(pid, g)),
    savePotential: (pid: string, x: Potential) => { const isNew = x.id.startsWith("tmp-"); return change(D => { const L = (D.pot[pid] ||= []); if (isNew) L.push(x); else Object.assign(L.find(y => y.id === x.id)!, x); },
      async api => { const saved = await api.savePotential(pid, x); replaceIn(ref.current.D!.pot[pid] || [], x, saved); }); },
    deletePotential: (pid: string, id: string) => change(D => { D.pot[pid] = (D.pot[pid] || []).filter(x => x.id !== id); }, api => api.deletePotential(id)),
    saveMessage: (pid: string, m: CoachMsg) => change(D => { (D.msgs[pid] ||= []).push(m); }, async api => { const saved = await api.saveMessage(pid, m); replaceIn(ref.current.D!.msgs[pid] || [], m, saved); }),
    deleteMessage: (pid: string, id: string) => change(D => { D.msgs[pid] = (D.msgs[pid] || []).filter(x => x.id !== id); }, api => api.deleteMessage(id)),
    saveNote: (pid: string, text: string) => change(D => { D.notes[pid] = text; }, api => api.saveNote(pid, text)),

    // KI
    ai: (mode: "coach" | "player" | "session" | "potentials" | "kind", prompt: string, context: string) => {
      const { api, active, lang } = ref.current; if (!active) return Promise.reject(new ApiError("server"));
      return api.ai({ mode, prompt, context, lang, teamId: active.teamId });
    },
  };

  const engine: Engine | null = useMemo(() => s.D ? createEngine(s.D, { lang: s.lang }) : null, [s.D, s.version, s.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rolle für die Oberfläche (im Demo-Modus umschaltbar)
  const isDemo = s.api.kind === "demo";
  const role = s.active?.role;
  const viewAs: "coach" | "player" | null = !s.active ? null : isDemo ? s.demoView : role === "player" ? "player" : isStaffRole(role) ? "coach" : null;
  const mePid = isDemo ? s.demoPlayer : s.active?.playerId || null;

  return { ...s, ...actions, tr, engine, isDemo, viewAs, mePid };
}

export type Store = ReturnType<typeof useStoreValue>;
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreValue();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}
export function useStore(): Store {
  const v = useContext(Ctx); if (!v) throw new Error("StoreProvider fehlt"); return v;
}
/** Übersetzer der aktuellen Sprache. */
export function useT(): Translator { return useStore().tr; }
/** Fachlogik für das aktive Team (null, solange nichts geladen ist). */
export function useEngine(): Engine { const e = useStore().engine; if (!e) throw new Error("Kein Team geladen"); return e; }

export { iso };
