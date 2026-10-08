// Zentraler Zustand der App: Konto, aktives Team, Daten (TeamData) und alle Änderungen.
// Änderungen werden sofort lokal übernommen (schnelle Oberfläche) und dann gespeichert.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { addDays, iso, monday } from "../core/dates";
import { fineViolations, lateFinesToWaive, nextDutyDate, planRotation } from "../core/duties";
import { applyOp, applyOutbox, enqueue, prune, withClientId, type OutboxItem, type OutboxOp } from "../core/outbox";
import { PERMS, effectivePerms, teamPatchPerms, viewFor, type Perm } from "../core/perms";
import { createEngine, type Engine } from "../core/engine";
import { translator, type Translator } from "../core/i18n";
import type { CashEntry, CashWaiver, KasseSettings, StaffRoleKey, TeamGroup, DayBlock, DutyDef, DutyEntry, FineEntry, FineRule, TeamTask,
  Absence, AttStatus, CalOverride, Contact, Phase as SeasonPhase, ClassKey, CoachMsg, CustomKind, Depth, Extra, Growth, Lang, Match, MatchStat, Player, PlanOverride,
  Potential, Rating, RpeEntry, Session, TeamData, TeamEvent, TestResult, Video, WeekMode, Wellness, Finding, Exercise, SessionTemplate, StaffProfile,
} from "../core/types";
import { ApiError, isOffline, isStaffRole, type Api, type ConsentKind, type ConsentState, type CreateTeamInput, type JoinProfile, type Membership, type PublishedDay, type TeamPatch, type UserInfo, type UserPrefs } from "./api";
import { DemoApi, type DemoSetup } from "./demoApi";
import { hasSupabase } from "./supabase";
import { forgetPhoto } from "../ui/playerAvatar";

const K_TEAM = "tb.activeTeam", K_LANG = "tb.lang";
/** Offline: wartende Einträge je Konto und letzter geladener Stand (für den Start ohne Netz) */
const K_OUTBOX = (uid: string): string => "tb.outbox.v1." + uid, K_CACHE = "tb.cache.v1";
/** Gerätespeicher: höchstens so groß (Zeichen) und so alt (Tage) */
const CACHE_MAX = 2_500_000, CACHE_DAYS = 14;
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
  /** Spieler mit Einwilligung in Gesundheitsdaten (Automatik „RPE zu spät“ gilt nur für sie) */
  healthPlayers: string[];
  toastMsg: string | null;
  /** Nur im Demo-Modus: Trainer- oder Spieleransicht und gewählter Spieler. */
  demoView: "coach" | "player";
  demoPlayer: string | null;
  /** Nur im Demo-Modus: als Co-Trainer ansehen (StaffProfile.id), sonst null = Cheftrainer */
  demoStaff: string | null;
  /** Ohne Netz gemachte Einträge, die noch gesendet werden */
  outbox: OutboxItem[];
  /** Letzter Kontakt zum Server ist fehlgeschlagen (kein Netz) */
  offline: boolean;
  /** Warteschlange wird gerade gesendet */
  syncing: boolean;
  /** Daten stammen aus dem Gerätespeicher (Stand von …), weil beim Start kein Netz da war */
  cachedAt: string | null;
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
    consents: null, aiPlayers: [], healthPlayers: [], toastMsg: null, demoView: "coach", demoPlayer: null, demoStaff: null,
    outbox: [], offline: false, syncing: false, cachedAt: null,
  }));
  const ref = useRef(s); ref.current = s;
  /** Rechte im aktiven Team (Trainerteam). Demo: Cheftrainer alle, Co-Trainer-Ansicht die Rechte des Profils. */
  const permsNow = (st: State = ref.current): Set<Perm> => {
    if (!st.active) return new Set();
    if (st.api instanceof DemoApi) return st.demoStaff ? new Set(st.api.demoPerms(st.demoStaff) as Perm[]) : new Set(PERMS);
    return effectivePerms(st.active.role, st.active.perms);
  };
  /** Wird gerade als Trainerteam gearbeitet (nicht Spieleransicht)? */
  const asStaff = (st: State = ref.current): boolean => !!st.active && (st.api instanceof DemoApi ? st.demoView === "coach" : isStaffRole(st.active.role));
  /** Warteschlange als sofort aktuelle Quelle (State nur für die Anzeige – wird erst beim nächsten Rendern aktuell) */
  const obRef = useRef<OutboxItem[]>([]);
  const set = useCallback((p: Partial<State>) => setS(prev => ({ ...prev, ...p })), []);
  const tr = useMemo(() => translator(s.lang), [s.lang]);

  // ---------- Meldungen ----------
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Zeitpunkt, zu dem zuletzt ein Eintrag in die Offline-Warteschlange kam (Meldungen direkt danach bekommen einen Hinweis) */
  const queuedAt = useRef(0);
  const toast = useCallback((msg: string) => {
    const tr0 = translator(ref.current.lang);
    if (Date.now() - queuedAt.current < 1500 && msg !== tr0.t("off_saved")) msg = msg + " · " + tr0.t("off_later");
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
    const staff = isStaffRole(m.role);
    const [consents, aiPlayers, healthPlayers] = await Promise.all([api.consents(), staff ? api.aiConsentPlayers(m.teamId).catch(() => []) : Promise.resolve([]),
      staff ? api.healthConsentPlayers(m.teamId).catch(() => [] as string[]) : Promise.resolve([] as string[])]);
    // Stand für den Start ohne Netz merken (vor dem Anwenden wartender Einträge), dann Wartendes wieder anwenden
    const me = extra.user ?? ref.current.user;
    if (api.kind === "supabase" && me) writeCache(me, m, D, consents);
    const pending = applyOutbox(D, obRef.current, m.teamId);
    set({ phase: "ready", active: m, D, version: ref.current.version + 1, consents, aiPlayers, healthPlayers, offline: false, cachedAt: null, ...extra });
    if (pending) scheduleFlush(400);
    if (staff) scheduleAutomation(300);
    try { await AsyncStorage.setItem(K_TEAM, m.teamId); } catch { /* optional */ }
    if (isStaffRole(m.role) && api.kind === "supabase" && effectivePerms(m.role, m.perms).has("plan")) afterCoachLoad(api, m, D);
  }, [set]);

  const boot = useCallback(async () => {
    const api = ref.current.api;
    let lang = ref.current.lang;
    try { const l = await AsyncStorage.getItem(K_LANG); if (l === "de" || l === "en") lang = l; } catch { /* optional */ }
    let user: UserInfo | null = null;
    try {
      user = await api.currentUser();
      if (!user || api.kind === "demo") { set({ phase: "signedOut", user: null, lang }); return; }
      await loadOutbox(user.id);
      const ms = await api.memberships();
      let pick: Membership | null = null;
      try { const last = await AsyncStorage.getItem(K_TEAM); pick = ms.find(m => m.teamId === last && m.role !== "pending") || null; } catch { /* optional */ }
      pick = pick || ms.find(m => m.role !== "pending") || ms[0] || null;
      await loadActive(api, pick, { user, memberships: ms, lang: user.lang || lang });
    } catch (e) {
      // Ohne Netz: letzten Stand vom Gerät zeigen, Einträge sammeln und später senden
      if (isOffline(e) && await openFromCache(user, lang)) return;
      set({ phase: "signedOut", lang }); toast(errText(e));
    }
  }, [loadActive, set, toast, errText]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    boot();
    const off = ref.current.api.onAuthChange(u => { if (!u && ref.current.api.kind === "supabase") set({ phase: "signedOut", user: null, D: null, active: null, memberships: [] }); });
    return off;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    const { api, active } = ref.current;
    try { const ms = await api.memberships(); const m = ms.find(x => x.teamId === active?.teamId) || ms[0] || null; await loadActive(api, m, { memberships: ms }); }
    catch (e) { if (isOffline(e)) set({ offline: true }); else toast(errText(e)); }
  }, [loadActive, toast, errText, set]);

  // ---------- Offline: Warteschlange und Gerätespeicher ----------
  async function loadOutbox(uid: string) {
    try {
      const raw = await AsyncStorage.getItem(K_OUTBOX(uid));
      const list = raw ? prune(JSON.parse(raw) as OutboxItem[], new Date()) : [];
      obRef.current = Array.isArray(list) ? list : []; set({ outbox: obRef.current });
    } catch { obRef.current = []; set({ outbox: [] }); }
  }
  function saveOutbox(list: OutboxItem[]) {
    obRef.current = list; set({ outbox: list });
    const uid = ref.current.user?.id; if (!uid || ref.current.api.kind !== "supabase") return;
    (list.length ? AsyncStorage.setItem(K_OUTBOX(uid), JSON.stringify(list)) : AsyncStorage.removeItem(K_OUTBOX(uid))).catch(() => undefined);
  }
  function writeCache(user: UserInfo, m: Membership, D: TeamData, consents: ConsentState | null) {
    try {
      const raw = JSON.stringify({ v: 1, uid: user.id, user, m, D, consents, at: new Date().toISOString() });
      if (raw.length > CACHE_MAX) { AsyncStorage.removeItem(K_CACHE).catch(() => undefined); return; }
      AsyncStorage.setItem(K_CACHE, raw).catch(() => undefined);
    } catch { /* optional */ }
  }
  async function openFromCache(user: UserInfo | null, lang: Lang): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(K_CACHE); if (!raw) return false;
      const c = JSON.parse(raw) as { v: number; uid: string; user?: UserInfo; m: Membership; D: TeamData; consents: ConsentState | null; at: string };
      if (c.v !== 1 || (user && c.uid !== user.id) || Date.now() - Date.parse(c.at) > CACHE_DAYS * 86400e3) return false;
      if (!user) await loadOutbox(c.uid);
      applyOutbox(c.D, obRef.current, c.m.teamId);
      set({ phase: "ready", active: c.m, D: c.D, memberships: [c.m], consents: c.consents, user: user || c.user || { id: c.uid, email: "", displayName: "", lang },
        lang: user?.lang || lang, offline: true, cachedAt: c.at, version: ref.current.version + 1 });
      return true;
    } catch { return false; }
  }
  function clearDevice(uid?: string) {
    AsyncStorage.removeItem(K_CACHE).catch(() => undefined);
    if (uid) AsyncStorage.removeItem(K_OUTBOX(uid)).catch(() => undefined);
  }

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
      if (!D || !active || !isStaffRole(active.role) || api.kind !== "supabase" || !permsNow().has("plan")) return;
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

  // ---------- Trainer: Automatik für Strafen und Dienste (reihum) ----------
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoBusy = useRef(false);
  const runAutomation = useCallback(async () => {
    const { api, active, D, lang } = ref.current;
    if (!D || !active || !isStaffRole(active.role) || autoBusy.current) return;
    // Automatik braucht das Recht „Aufgaben“; Regeln zur Belastung zusätzlich „Gesundheit“ (sonst fehlen die RPE-Daten)
    const pm = permsNow(); if (!pm.has("tasks")) return;
    const healthOk = pm.has("health");
    const defs = D.team.settings.duties || [], rules = D.team.settings.fines || [];
    if (ref.current.offline || ref.current.cachedAt) return; // Automatik nur mit aktuellem Stand vom Server
    if (!defs.some(d => d.on) && !rules.some(r => r.on && r.trigger !== "manual") && !D.fines.some(f => f.auto && f.status === "open")) return;
    autoBusy.current = true;
    try {
      const E = createEngine(D, { lang }), hp = new Set(ref.current.healthPlayers);
      // 0. Offline rechtzeitig eingetragen, aber erst später gesendet: Strafe erlassen, offenen Strafdienst streichen
      for (const f of healthOk ? lateFinesToWaive(E, rules, D.fines) : []) {
        const upd: FineEntry = { ...f, status: "waived", note: translator(lang).t("off_waived") };
        try { await api.saveFine(active.teamId, upd); } catch { continue; }
        Object.assign(f, upd);
        const dIds = D.duties.filter(d => d.fineId === f.id && d.status === "open").map(d => d.id);
        if (dIds.length) { await api.deleteDuties(dIds); D.duties = D.duties.filter(d => !dIds.includes(d.id)); }
      }
      // 1. Strafen aus Regeln (einmal je Spieler und Einheit), Dienst am nächsten passenden Termin
      for (const v of fineViolations(E, healthOk ? rules : rules.filter(r => r.trigger !== "late_rpe"), D.fines, pid => hp.has(pid))) {
        const def = v.rule.duty ? defs.find(d => d.id === v.rule.duty && d.on) : undefined;
        const dutyDate = def ? nextDutyDate(E, def) : null;
        let fine: FineEntry;
        try { fine = await api.saveFine(active.teamId, { id: tmpId(), pid: v.pid, rule: v.rule.id, date: E.TODAY, ref: v.ref, amount: v.rule.amount, note: "", status: "open", auto: true, dutyDate }); }
        catch { continue; } // schon vorhanden (anderes Gerät)
        D.fines.push(fine);
        if (def && dutyDate) D.duties.push(...await api.addDuties(active.teamId, [{ id: tmpId(), date: dutyDate, duty: def.id, pid: v.pid, source: "fine", fineId: fine.id, status: "open" }]));
      }
      // 2. Dienste reihum für die nächsten 14 Tage
      const plan = planRotation(E, defs, D.duties);
      if (plan.remove.length) { await api.deleteDuties(plan.remove); D.duties = D.duties.filter(x => !plan.remove.includes(x.id)); }
      if (plan.add.length) D.duties.push(...await api.addDuties(active.teamId, plan.add.map(x => ({ ...x, id: tmpId() }))));
      setS(prev => ({ ...prev, version: prev.version + 1 }));
    } catch { /* nächster Versuch bei der nächsten Änderung */ } finally { autoBusy.current = false; }
  }, []);
  const scheduleAutomation = useCallback((ms = 1200) => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => { runAutomation(); }, ms);
  }, [runAutomation]);

  // ---------- Änderungen ----------
  /** Lokal ändern, neu rechnen, speichern; bei Fehler Meldung und neu laden. */
  const change = useCallback(async (local: (D: TeamData) => void, remote: (api: Api, teamId: string) => Promise<unknown>, opts: { plan?: boolean; ok?: string } = {}) => {
    const { D, active, api } = ref.current; if (!D || !active) return;
    local(D); setS(prev => ({ ...prev, version: prev.version + 1 }));
    try {
      await remote(api, active.teamId); setS(prev => ({ ...prev, version: prev.version + 1, offline: false }));
      if (opts.ok) toast(opts.ok); if (opts.plan) { publishPlans(); scheduleAutomation(); }
      if (obRef.current.length) scheduleFlush(300);
    }
    catch (e) {
      // Ohne Netz bleibt diese Änderung nicht erhalten (nur Einträge kommen in die Warteschlange) – klar sagen
      if (isOffline(e)) { set({ offline: true }); toast(translator(ref.current.lang).t("off_notSaved")); return; }
      toast(errText(e)); reload();
    }
  }, [toast, errText, reload, publishPlans, scheduleAutomation]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Eintrag senden (an das jeweilige Api) – gibt bei neuen Datensätzen den gespeicherten Stand zurück */
  async function exec(api: Api, teamId: string, o: OutboxOp): Promise<Extra | Absence | void> {
    const sid = (id: string): string => id.startsWith("c-") ? id.slice(2) : id;
    switch (o.op) {
      case "rpe": return api.saveRpe(o.pid, o.date, o.e);
      case "well": return api.saveWellness(o.pid, o.date, o.w);
      case "extra": return api.saveExtra(o.pid, o.x);
      case "extraDel": return api.deleteExtra(sid(o.id));
      case "abs": return api.saveAbsence(teamId, o.a);
      case "absDel": return api.deleteAbsence(sid(o.id));
      case "att": return api.setAttendance(teamId, o.date, o.pid, o.st);
      case "task": return api.setTaskDone(o.id, o.done, o.at);
    }
  }
  /** Gespeicherten Datensatz (Server-ID) statt des lokalen übernehmen */
  function afterSave(o: OutboxOp, saved: Extra | Absence | void) {
    const D = ref.current.D; if (!D || !saved) return;
    if (o.op === "extra") { const L = D.extra[o.pid] || []; const i = L.findIndex(x => x.id === o.x.id); if (i >= 0) L[i] = saved as Extra; }
    if (o.op === "abs") { const i = D.absences.findIndex(x => x.id === o.a.id); if (i >= 0) D.absences[i] = saved as Absence; }
  }
  /**
   * Eintrag (RPE, Morgen-Check, Zusatzsport, Abwesenheit, Anwesenheit, Aufgabe erledigt): sofort lokal übernehmen,
   * senden – ohne Netz in die Warteschlange (wird automatisch nachgereicht, Reihenfolge bleibt erhalten).
   */
  const entry = useCallback(async (o0: OutboxOp, opts: { plan?: boolean; ok?: string } = {}) => {
    const { D, active, api } = ref.current; if (!D || !active) return;
    const now = new Date().toISOString();
    let o = withClientId(o0);
    if (o.op === "rpe" && o.e && !o.e.at) o = { ...o, e: { ...o.e, at: now } };
    if (o.op === "task" && o.done && !o.at) o = { ...o, at: now };
    applyOp(D, o); setS(prev => ({ ...prev, version: prev.version + 1 }));
    const tr0 = translator(ref.current.lang);
    const queue = () => { saveOutbox(enqueue(obRef.current, { team: active.teamId, at: now, tries: 0, o })); toast(tr0.t("off_saved")); queuedAt.current = Date.now(); scheduleFlush(15000); };
    // Wartet schon etwas (oder kein Netz): hinten anstellen, damit die Reihenfolge stimmt
    if (ref.current.offline || obRef.current.some(x => x.team === active.teamId)) { queue(); if (!ref.current.offline) scheduleFlush(300); return; }
    try {
      afterSave(o, await exec(api, active.teamId, o));
      setS(prev => ({ ...prev, version: prev.version + 1, offline: false }));
      if (opts.ok) toast(opts.ok); if (opts.plan) { publishPlans(); scheduleAutomation(); }
    } catch (e) {
      if (isOffline(e)) { set({ offline: true }); queue(); return; }
      toast(errText(e)); reload();
    }
  }, [toast, errText, reload, publishPlans, scheduleAutomation, set]); // eslint-disable-line react-hooks/exhaustive-deps

  const flushing = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Warteschlange senden (in Reihenfolge); bei Netzfehler stoppen und später erneut versuchen */
  const flush = useCallback(async () => {
    const { api, active } = ref.current;
    if (flushing.current || !active) return;
    const mine = obRef.current.filter(x => x.team === active.teamId);
    if (!mine.length) { if (ref.current.cachedAt || ref.current.offline) reload(); return; }
    flushing.current = true; set({ syncing: true });
    let sent = 0, failed = 0, off = false;
    const tr0 = translator(ref.current.lang);
    for (const it of mine) {
      try { afterSave(it.o, await exec(api, active.teamId, it.o)); sent++; saveOutbox(obRef.current.filter(x => x !== it)); }
      catch (e) {
        if (isOffline(e)) { off = true; saveOutbox(obRef.current.map(x => x === it ? { ...x, tries: x.tries + 1 } : x)); break; }
        failed++; saveOutbox(obRef.current.filter(x => x !== it)); // vom Server abgelehnt: nicht endlos wiederholen
      }
    }
    flushing.current = false;
    setS(prev => ({ ...prev, syncing: false, offline: off, version: prev.version + 1 }));
    if (sent) { toast(tr0.tf(sent === 1 ? "off_sent1" : "off_sentN", { n: sent })); publishPlans(); scheduleAutomation(); }
    if (failed) toast(tr0.t("off_failed"));
    if (off) scheduleFlush(20000);
    else if (ref.current.cachedAt || failed) reload(); // Stand vom Gerät bzw. abgelehnte Einträge: frisch laden
  }, [set, toast, reload, publishPlans, scheduleAutomation]); // eslint-disable-line react-hooks/exhaustive-deps
  function scheduleFlush(ms = 20000) {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => { flushTimer.current = null; flushRef.current(); }, ms);
  }
  const flushRef = useRef(flush); flushRef.current = flush;
  // Zurück in der App oder regelmäßig, solange etwas wartet bzw. kein Netz war: erneut versuchen
  useEffect(() => {
    const sub = AppState.addEventListener("change", st => { if (st === "active" && (obRef.current.length || ref.current.offline)) flushRef.current(); });
    const iv = setInterval(() => { if (ref.current.phase === "ready" && (ref.current.offline || obRef.current.some(x => x.team === ref.current.active?.teamId)) && !flushTimer.current) flushRef.current(); }, 30000);
    return () => { sub.remove(); clearInterval(iv); };
  }, []);

  const replaceIn = <T extends { id: string }>(arr: T[], tmpObj: T, saved: T): void => { const i = arr.findIndex(x => x.id === tmpObj.id); if (i >= 0) arr[i] = saved; };
  /** Eintrag in einer Liste von TeamData anlegen oder ersetzen und speichern. */
  function upsert<K extends "exercises" | "templates" | "staff" | "phases" | "contacts">(key: K, x: TeamData[K][number], save: (api: Api, teamId: string) => Promise<TeamData[K][number]>, opts: { plan?: boolean } = {}) {
    const isNew = x.id.startsWith("tmp-");
    return change(D => { const L = D[key] as { id: string }[]; const i = L.findIndex(y => y.id === x.id); if (isNew || i < 0) L.push(x); else L[i] = x; },
      async (api, t) => { const saved = await save(api, t); replaceIn(ref.current.D![key] as { id: string }[], x, saved); }, opts);
  }

  const actions = {
    toast, errText, reload, boot,
    // Konto & Sitzung
    setLang: async (lang: Lang) => { set({ lang }); try { await AsyncStorage.setItem(K_LANG, lang); } catch { /* optional */ } ref.current.api.setLanguage(lang).catch(() => undefined); },
    signIn: async (email: string, pw: string) => { const api = ref.current.api; await api.signIn(email, pw); await boot(); },
    signUp: (email: string, pw: string, name: string) => ref.current.api.signUp(email, pw, name, ref.current.lang),
    resetPassword: (email: string) => ref.current.api.resetPassword(email),
    signOut: async () => {
      // Wartende Einträge bleiben für dieses Konto gespeichert (werden nach der nächsten Anmeldung gesendet); der Datenstand wird gelöscht
      clearDevice(); await ref.current.api.signOut().catch(() => undefined);
      try { await AsyncStorage.removeItem(K_TEAM); } catch { /* optional */ }
      obRef.current = []; set({ phase: "signedOut", user: null, D: null, active: null, memberships: [], outbox: [], offline: false, cachedAt: null });
    },
    startDemo: async (cls: ClassKey = "u19", depth: Depth = "basis", over: DemoSetup = {}) => {
      const api = new DemoApi(cls, depth, ref.current.lang, over);
      const user = await api.currentUser(); const ms = await api.memberships();
      obRef.current = []; set({ api, user, memberships: ms, outbox: [], offline: false, cachedAt: null });
      await loadActive(api, ms[0], { api, user, memberships: ms, demoView: "coach", demoPlayer: null, demoStaff: null });
    },
    leaveDemo: () => { obRef.current = []; set({ api: makeApi(), phase: "loading", D: null, active: null, user: null, outbox: [], offline: false, cachedAt: null }); setTimeout(() => boot(), 0); },
    setDemoView: (v: "coach" | "player", pid?: string | null, staffId?: string | null) => set({ demoView: v, demoPlayer: pid ?? ref.current.demoPlayer, demoStaff: v === "coach" ? (staffId ?? null) : ref.current.demoStaff }),
    selectTeam: async (m: Membership) => { set({ phase: "loading" }); try { await loadActive(ref.current.api, m); } catch (e) { toast(errText(e)); } },
    createTeam: async (input: CreateTeamInput & { me?: Partial<StaffProfile>; staff?: { name: string; role: StaffRoleKey }[]; logoUri?: string | null; prefs?: UserPrefs }) => {
      const api = ref.current.api;
      const id = await api.createTeam(input); const ms = await api.memberships();
      await loadActive(api, ms.find(m => m.teamId === id) || null, { memberships: ms });
      // Danach: eigenes Trainerprofil (mit Konto verknüpft), Anzeigename, Logo, weitere Trainer, Einstellungen
      const uid = ref.current.user?.id || null;
      if (input.me?.name?.trim()) {
        const me: StaffProfile = { id: tmpId(), name: input.me.name.trim(), role: input.me.role || "chef", areas: input.me.areas || [], phone: input.me.phone || "", email: input.me.email || ref.current.user?.email || "", note: "",
          userId: uid, birth: input.me.birth || null, license: input.me.license || "", photo: null };
        const saved = await api.saveStaff(id, me);
        if (input.me.photo) { const path = await api.uploadTeamImage(id, `staff-${saved.id}`, input.me.photo); await api.saveStaff(id, { ...saved, photo: path }); }
        await api.setDisplayName(me.name).catch(() => undefined);
      }
      for (const x of (input.staff || []).filter(y => y.name.trim())) await api.saveStaff(id, { id: tmpId(), name: x.name.trim(), role: x.role, areas: [], phone: "", email: "", note: "" });
      if (input.logoUri) { const path = await api.uploadTeamImage(id, "logo", input.logoUri); await api.updateTeam(id, { logo: path }); }
      if (input.prefs) { const u = ref.current.user; if (u) { const prefs = { ...(u.prefs || {}), ...input.prefs }; await api.savePrefs(prefs).catch(() => undefined); set({ user: { ...u, prefs } }); } }
      await reload();
      return id;
    },
    /** Persönliche Einstellungen (Info-Buttons, Startseite) */
    setPrefs: async (p: Partial<UserPrefs>) => {
      const u = ref.current.user; if (!u) return;
      const prefs = { ...(u.prefs || {}), ...p }; set({ user: { ...u, prefs } });
      try { await ref.current.api.savePrefs(prefs); } catch (e) { toast(errText(e)); }
    },
    /** Vereinslogo setzen (null = entfernen) */
    setLogo: async (uri: string | null) => {
      const { api, active, D } = ref.current; if (!D || !active) return;
      const path = uri ? await api.uploadTeamImage(active.teamId, "logo", uri) : null;
      if (path) forgetPhoto(path);
      D.team.logo = path; set({ version: ref.current.version + 1 });
      await api.updateTeam(active.teamId, { logo: path });
    },
    /** Eigenes bzw. fremdes Trainerprofil inkl. Foto speichern */
    saveStaffWithPhoto: async (x: StaffProfile, photoUri?: string | null) => {
      const { api, active, D } = ref.current; if (!D || !active) return x;
      let saved = await api.saveStaff(active.teamId, x);
      if (photoUri) { const path = await api.uploadTeamImage(active.teamId, `staff-${saved.id}`, photoUri); forgetPhoto(path); saved = await api.saveStaff(active.teamId, { ...saved, photo: path }); }
      const i = D.staff.findIndex(y => y.id === x.id || y.id === saved.id); if (i >= 0) D.staff[i] = saved; else D.staff.push(saved);
      if (saved.userId && saved.userId === ref.current.user?.id) { await api.setDisplayName(saved.name).catch(() => undefined); const u = ref.current.user; if (u) set({ user: { ...u, displayName: saved.name } }); }
      set({ version: ref.current.version + 1 }); return saved;
    },
    joinTeam: async (code: string, p: JoinProfile) => { const pid = await ref.current.api.joinTeam(code, p); const ms = await ref.current.api.memberships(); await loadActive(ref.current.api, ms.find(m => m.playerId === pid) || ms[0] || null, { memberships: ms }); return pid; },
    joinStaff: async (code: string) => { await ref.current.api.joinStaff(code); const ms = await ref.current.api.memberships(); await loadActive(ref.current.api, ms.find(m => m.role === "pending") || ms[0] || null, { memberships: ms }); },
    giveConsent: async (kind: ConsentKind, o?: { parentEmail?: string; playerId?: string }) => { await ref.current.api.giveConsent(kind, o); set({ consents: await ref.current.api.consents() }); },
    withdrawConsent: async (kind: ConsentKind) => { await ref.current.api.withdrawConsent(kind); set({ consents: await ref.current.api.consents() }); },
    deleteAccount: async () => { const uid = ref.current.user?.id; await ref.current.api.deleteAccount(); clearDevice(uid); obRef.current = []; set({ phase: "signedOut", user: null, D: null, active: null, memberships: [], outbox: [], cachedAt: null }); },
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
      // Gruppen liegen in einer eigenen Tabelle (setGroupMember) und bleiben hier unverändert
      const prev = [...D.players, ...D.inactive].find(y => y.id === p.id);
      const x = { ...saved, photo: saved.photo ?? p.photo, groups: prev?.groups || [] };
      // Aktive und inaktive Spieler getrennt halten (inaktive zählen in keiner Berechnung)
      D.players = D.players.filter(y => y.id !== p.id); D.inactive = D.inactive.filter(y => y.id !== p.id);
      if (x.active === false) D.inactive.push(x);
      else { const at = D.players.findIndex(y => (y.nr ?? 99) > (x.nr ?? 99)); if (at < 0) D.players.push(x); else D.players.splice(at, 0, x); }
      set({ version: ref.current.version + 1 }); return saved;
    },
    deletePlayer: (p: Player) => change(D => { D.players = D.players.filter(x => x.id !== p.id); D.inactive = D.inactive.filter(x => x.id !== p.id); }, (api, t) => api.deletePlayer(t, p)),
    mergePlayers: async (newId: string, existingId: string) => { await ref.current.api.mergePlayers(newId, existingId); await reload(); },
    uploadPhoto: async (pid: string, uri: string) => {
      const { api, active, D } = ref.current; if (!D || !active) return;
      const path = await api.uploadPhoto(active.teamId, pid, uri); forgetPhoto(path); const p = D.players.find(x => x.id === pid); if (p) p.photo = path;
      set({ version: ref.current.version + 1 });
    },
    // Einträge: funktionieren auch ohne Netz (Warteschlange, siehe entry)
    setAttendance: (date: string, pid: string, st: AttStatus | null) => entry({ op: "att", date, pid, st }),
    saveRpe: (pid: string, date: string, e: RpeEntry | null) => entry({ op: "rpe", pid, date, e: e ? { ...e, at: e.at ?? ref.current.D?.rpe[pid]?.[date]?.at ?? null } : null }),
    saveWellness: (pid: string, date: string, w: Wellness) => entry({ op: "well", pid, date, w }),
    saveExtra: (pid: string, x: Extra) => entry({ op: "extra", pid, x }),
    deleteExtra: (pid: string, id: string) => entry({ op: "extraDel", pid, id }),
    saveAbsence: (a: Absence) => entry({ op: "abs", a }, { plan: true }),
    deleteAbsence: (id: string) => entry({ op: "absDel", id }, { plan: true }),
    /** Erneut senden (Knopf in der Offline-Leiste) */
    syncNow: () => { if (obRef.current.length) flushRef.current(); else reload(); },
    /** Nur Demo: Netz an/aus simulieren */
    setDemoOffline: (off: boolean) => {
      const api = ref.current.api; if (!(api instanceof DemoApi)) return;
      api.offline = off; set({ offline: off });
      if (!off) setTimeout(() => flushRef.current(), 200);
    },
    saveGrowth: (pid: string, g: Growth) => change(D => { (D.growth[pid] ||= []).push(g); }, api => api.saveGrowth(pid, g)),
    savePotential: (pid: string, x: Potential) => { const isNew = x.id.startsWith("tmp-"); return change(D => { const L = (D.pot[pid] ||= []); if (isNew) L.push(x); else Object.assign(L.find(y => y.id === x.id)!, x); },
      async api => { const saved = await api.savePotential(pid, x); replaceIn(ref.current.D!.pot[pid] || [], x, saved); }); },
    deletePotential: (pid: string, id: string) => change(D => { D.pot[pid] = (D.pot[pid] || []).filter(x => x.id !== id); }, api => api.deletePotential(id)),
    saveMessage: (pid: string, m: CoachMsg) => change(D => { (D.msgs[pid] ||= []).push(m); }, async api => { const saved = await api.saveMessage(pid, m); replaceIn(ref.current.D!.msgs[pid] || [], m, saved); }),
    deleteMessage: (pid: string, id: string) => change(D => { D.msgs[pid] = (D.msgs[pid] || []).filter(x => x.id !== id); }, api => api.deleteMessage(id)),
    saveNote: (pid: string, text: string) => change(D => { D.notes[pid] = text; }, api => api.saveNote(pid, text)),

    // Spiele, Bewertungen, Videos
    saveStat: (matchId: string, pid: string, st: MatchStat | null) => change(D => { const m = (D.stats[matchId] ||= {}); if (st) m[pid] = st; else delete m[pid]; }, (api, t) => api.saveStat(t, matchId, pid, st)),
    saveRating: (r: Rating) => { const isNew = r.id.startsWith("tmp-"); return change(D => { if (isNew) D.ratings.push(r); else Object.assign(D.ratings.find(x => x.id === r.id)!, r); },
      async (api, t) => { const saved = await api.saveRating(t, r); replaceIn(ref.current.D!.ratings, r, saved); }); },
    deleteRating: (id: string) => change(D => { D.ratings = D.ratings.filter(x => x.id !== id); }, api => api.deleteRating(id)),
    saveVideo: (v: Video) => { const isNew = v.id.startsWith("tmp-"); return change(D => { if (isNew) D.videos.push(v); else Object.assign(D.videos.find(x => x.id === v.id)!, v); },
      async (api, t) => { const saved = await api.saveVideo(t, v); replaceIn(ref.current.D!.videos, v, saved); }); },
    deleteVideo: (id: string) => change(D => { D.videos = D.videos.filter(x => x.id !== id); }, api => api.deleteVideo(id)),

    // Leistungstests
    saveTest: (r: TestResult) => { const isNew = r.id.startsWith("tmp-"); return change(D => { if (isNew) D.tests.push(r); else Object.assign(D.tests.find(x => x.id === r.id)!, r); },
      async (api, t) => { const saved = await api.saveTest(t, r); replaceIn(ref.current.D!.tests, r, saved); }, { plan: true }); },
    deleteTest: (id: string) => change(D => { D.tests = D.tests.filter(x => x.id !== id); }, api => api.deleteTest(id)),

    // Befunde
    uploadFinding: async (f: Omit<Finding, "id" | "path" | "ai" | "aiAt">, uri: string): Promise<Finding | null> => {
      const { api, active, D } = ref.current; if (!D || !active) return null;
      const saved = await api.uploadFinding(active.teamId, f, uri); D.findings.push(saved); set({ version: ref.current.version + 1 }); return saved;
    },
    updateFinding: (f: Finding) => change(D => { Object.assign(D.findings.find(x => x.id === f.id)!, f); }, api => api.updateFinding(f)),
    deleteFinding: (f: Finding) => change(D => { D.findings = D.findings.filter(x => x.id !== f.id); }, api => api.deleteFinding(f)),
    saveExercise: (x: Exercise) => upsert("exercises", x, (api, t) => api.saveExercise(t, x)),
    deleteExercise: (id: string) => change(D => { D.exercises = D.exercises.filter(x => x.id !== id); }, api => api.deleteExercise(id)),
    saveTemplate: (x: SessionTemplate) => upsert("templates", x, (api, t) => api.saveTemplate(t, x)),
    deleteTemplate: (id: string) => change(D => { D.templates = D.templates.filter(x => x.id !== id); }, api => api.deleteTemplate(id)),
    saveStaff: (x: StaffProfile) => upsert("staff", x, (api, t) => api.saveStaff(t, x)),
    deleteStaff: (id: string) => change(D => { D.staff = D.staff.filter(x => x.id !== id); }, api => api.deleteStaff(id)),
    savePhase: (x: SeasonPhase) => upsert("phases", x, (api, t) => api.savePhase(t, x), { plan: true }),
    saveContact: (x: Contact) => upsert("contacts", x, (api, t) => api.saveContact(t, x)),
    deleteContact: (id: string) => change(D => { D.contacts = D.contacts.filter(x => x.id !== id); }, api => api.deleteContact(id)),
    // Aufgaben, Dienste, Strafen
    saveDutyDefs: (defs: DutyDef[]) => actions.updateTeam({ settings: { ...ref.current.D!.team.settings, duties: defs } }),
    saveFineRules: (rules: FineRule[]) => actions.updateTeam({ settings: { ...ref.current.D!.team.settings, fines: rules } }),
    runAutomation,
    saveDuty: async (d: DutyEntry): Promise<DutyEntry> => {
      const { api, active, D } = ref.current; if (!D || !active) return d;
      const saved = await api.saveDuty(active.teamId, d);
      const i = D.duties.findIndex(x => x.id === d.id); if (i >= 0) D.duties[i] = saved; else D.duties.push(saved);
      set({ version: ref.current.version + 1 }); return saved;
    },
    saveFine: async (f: FineEntry, withDuty = true): Promise<FineEntry> => {
      const { api, active, D, lang } = ref.current; if (!D || !active) return f;
      const saved = await api.saveFine(active.teamId, f);
      const i = D.fines.findIndex(x => x.id === f.id); if (i >= 0) D.fines[i] = saved; else D.fines.push(saved);
      // neue Strafe mit Dienst: am nächsten passenden Termin einteilen
      const def = withDuty && f.id.startsWith("tmp-") ? (D.team.settings.duties || []).find(d => d.id === (D.team.settings.fines || []).find(r => r.id === f.rule)?.duty && d.on) : undefined;
      if (def) {
        const E = createEngine(D, { lang }), dd = nextDutyDate(E, def);
        if (dd) { D.duties.push(...await api.addDuties(active.teamId, [{ id: tmpId(), date: dd, duty: def.id, pid: f.pid, source: "fine", fineId: saved.id, status: "open" }])); saved.dutyDate = dd; await api.saveFine(active.teamId, saved); }
      }
      // erlassen: zugehörigen Dienst streichen
      if (saved.status === "waived") { const ids = D.duties.filter(x => x.fineId === saved.id && x.status === "open").map(x => x.id); if (ids.length) { await api.deleteDuties(ids); D.duties = D.duties.filter(x => !ids.includes(x.id)); } }
      set({ version: ref.current.version + 1 }); scheduleAutomation(); return saved;
    },
    deleteFine: (id: string) => change(D => { D.fines = D.fines.filter(x => x.id !== id); D.duties = D.duties.filter(x => x.fineId !== id); D.cash.forEach(e => { if (e.fineId === id) e.fineId = null; }); }, api => api.deleteFine(id)),

    // Mannschaftskasse (Trainerteam mit Recht „Kasse“ oder Kassenwart)
    saveKasse: (k: KasseSettings) => { const D = ref.current.D; if (!D) return Promise.resolve(); return actions.updateTeam({ settings: { ...D.team.settings, kasse: k } }); },
    saveCash: (e: CashEntry) => change(D => {
      const i = D.cash.findIndex(x => x.id === e.id); if (i >= 0) D.cash[i] = e; else D.cash.push(e);
      // wie in der Datenbank: Zahlung einer Strafe ⇒ bezahlt
      if (e.fineId) { const f = D.fines.find(x => x.id === e.fineId); if (f && f.status === "open") f.status = "done"; }
    }, async (api, t) => { const saved = await api.saveCash(t, e); replaceIn(ref.current.D!.cash, e, saved); }),
    deleteCash: (id: string) => change(D => {
      const e = D.cash.find(x => x.id === id); D.cash = D.cash.filter(x => x.id !== id);
      if (e?.fineId) { const f = D.fines.find(x => x.id === e.fineId); if (f && f.status === "done") f.status = "open"; }
    }, api => api.deleteCash(id)),
    /** Mehrere Posten auf einmal als bezahlt buchen (je Posten ein Kassenbuch-Eintrag) */
    payItems: async (entries: CashEntry[]) => { for (const e of entries) await actions.saveCash(e); },
    setWaiver: (w: CashWaiver, on: boolean) => change(D => {
      D.waivers = D.waivers.filter(x => !(x.pid === w.pid && x.feeId === w.feeId && x.period === w.period)); if (on) D.waivers.push(w);
    }, (api, t) => api.setWaiver(t, w, on)),
    saveTask: async (x: TeamTask): Promise<TeamTask> => {
      const { api, active, D } = ref.current; if (!D || !active) return x;
      const saved = await api.saveTask(active.teamId, x);
      const i = D.tasks.findIndex(y => y.id === x.id); if (i >= 0) D.tasks[i] = saved; else D.tasks.push(saved);
      set({ version: ref.current.version + 1 }); return saved;
    },
    deleteTask: (id: string) => change(D => { D.tasks = D.tasks.filter(x => x.id !== id); }, api => api.deleteTask(id)),
    setTaskDone: (id: string, done: boolean) => entry({ op: "task", id, done, at: null }),

    // Trainingstag (Ablauf)
    saveBlock: async (b: DayBlock): Promise<DayBlock> => {
      const { api, active, D } = ref.current; if (!D || !active) return b;
      const i0 = D.blocks.findIndex(x => x.id === b.id), prevPhoto = i0 >= 0 ? D.blocks[i0].photo : null;
      if (i0 >= 0) D.blocks[i0] = b; else D.blocks.push(b);
      // entferntes Skizzen-Foto auch aus dem Speicher löschen
      if (prevPhoto && prevPhoto !== b.photo) api.removeSketch(prevPhoto).catch(() => undefined);
      set({ version: ref.current.version + 1 });
      try {
        const saved = await api.saveBlock(active.teamId, b);
        const i = D.blocks.findIndex(x => x.id === b.id || x.id === saved.id); if (i >= 0) D.blocks[i] = saved; else D.blocks.push(saved);
        set({ version: ref.current.version + 1 }); return saved;
      } catch (e) { toast(errText(e)); reload(); throw e; }
    },
    deleteBlock: (b: DayBlock) => change(D => { D.blocks = D.blocks.filter(x => x.id !== b.id); }, api => api.deleteBlock(b)),
    /** Foto einer Skizze für einen (ggf. neuen) Block hochladen */
    uploadSketch: async (b: DayBlock, uri: string): Promise<DayBlock> => {
      const { api, active } = ref.current; if (!active) return b;
      const saved = b.id.startsWith("tmp-") ? await actions.saveBlock(b) : b;
      const path = await api.uploadSketch(active.teamId, saved.id, uri); forgetPhoto(path);
      return actions.saveBlock({ ...saved, photo: path });
    },

    // Gruppen
    saveGroup: async (g: TeamGroup): Promise<TeamGroup> => {
      const { api, active, D } = ref.current; if (!D || !active) return g;
      const i0 = D.groups.findIndex(x => x.id === g.id);
      if (i0 >= 0) { D.groups[i0] = g; set({ version: ref.current.version + 1 }); }
      try {
        const saved = await api.saveGroup(active.teamId, g);
        const i = D.groups.findIndex(x => x.id === g.id || x.id === saved.id); if (i >= 0) D.groups[i] = saved; else D.groups.push(saved);
        set({ version: ref.current.version + 1 }); return saved;
      } catch (e) { toast(errText(e)); reload(); return g; }
    },
    deleteGroup: (id: string) => change(D => { D.groups = D.groups.filter(x => x.id !== id); for (const p of [...D.players, ...D.inactive]) if (p.groups?.includes(id)) p.groups = p.groups.filter(x => x !== id); },
      api => api.deleteGroup(id)),
    setGroupMember: (gid: string, pid: string, on: boolean) => change(D => {
      const p = [...D.players, ...D.inactive].find(x => x.id === pid); if (!p) return;
      const cur = p.groups || []; p.groups = on ? (cur.includes(gid) ? cur : [...cur, gid]) : cur.filter(x => x !== gid);
    }, (api, t) => api.setGroupMember(t, gid, pid, on)),
    deletePhase: (id: string) => change(D => { D.phases = D.phases.filter(x => x.id !== id); }, api => api.deletePhase(id), { plan: true }),
    analyzeFinding: async (id: string, context: string): Promise<string> => {
      const { api, active, D, lang } = ref.current; if (!D || !active) throw new ApiError("server");
      const text = await api.analyzeFinding(active.teamId, id, context, lang);
      const f = D.findings.find(x => x.id === id); if (f) { f.ai = text; f.aiAt = new Date().toISOString(); }
      set({ version: ref.current.version + 1 }); return text;
    },

    // KI
    ai: (mode: "coach" | "player" | "session" | "potentials" | "kind", prompt: string, context: string) => {
      const { api, active, lang } = ref.current; if (!active) return Promise.reject(new ApiError("server"));
      return api.ai({ mode, prompt, context, lang, teamId: active.teamId });
    },
  };

  // ---------- Rechte: Aktionen des Trainerteams nur mit passendem Recht (Server prüft zusätzlich) ----------
  const NEED: Partial<Record<keyof typeof actions, Perm | Perm[]>> = {
    saveMatch: "plan", deleteMatch: "plan", saveEvent: "plan", deleteEvent: "plan", setCal: "plan", setOver: "plan", setWeekMode: "plan",
    saveKind: "plan", deleteKind: "plan", savePhase: "plan", deletePhase: "plan", saveVideo: "plan", deleteVideo: "plan",
    savePlayer: "squad", deletePlayer: "squad", mergePlayers: "squad", uploadPhoto: "squad", setAttendance: "squad",
    saveGroup: "squad", deleteGroup: "squad", setGroupMember: "squad", saveContact: "squad", deleteContact: "squad",
    saveAbsence: ["squad", "health"], deleteAbsence: ["squad", "health"],
    saveRpe: "health", saveWellness: "health", saveExtra: "health", deleteExtra: "health", saveGrowth: "health",
    uploadFinding: "medical", updateFinding: "medical", deleteFinding: "medical", analyzeFinding: "medical",
    saveNote: "notes", savePotential: "notes", deletePotential: "notes", saveRating: "notes", deleteRating: "notes",
    saveMessage: "messages", deleteMessage: "messages",
    saveStat: "perf", saveTest: "perf", deleteTest: "perf",
    saveDutyDefs: "tasks", saveFineRules: "tasks", saveDuty: "tasks", saveFine: "tasks", deleteFine: "tasks", saveTask: "tasks", deleteTask: "tasks",
    saveCash: "cash", deleteCash: "cash", payItems: "cash", setWaiver: "cash",
  };
  const denied = (need: Perm[]): boolean => {
    if (!asStaff() || !need.length) return false;
    const pm = permsNow(); if (need.some(p => pm.has(p))) return false;
    const tr0 = translator(ref.current.lang);
    toast(tr0.tf("pm_denied", { p: need.map(p => tr0.t("pm_" + p)).join(" / ") }));
    return true;
  };
  for (const k of Object.keys(NEED) as (keyof typeof actions)[]) {
    const fn = actions[k] as unknown as (...a: unknown[]) => unknown, need = NEED[k]!;
    // ohne Recht: nichts tun (Rückgabe wie „unverändert“ – das übergebene Objekt)
    (actions as Record<string, unknown>)[k] = (...a: unknown[]) => denied(Array.isArray(need) ? need : [need]) ? Promise.resolve(a[a.length > 1 ? 1 : 0]) : fn(...a);
  }
  {
    const upd = actions.updateTeam;
    actions.updateTeam = (patch: TeamPatch) => {
      const D = ref.current.D;
      const need = D ? teamPatchPerms(patch as Record<string, unknown>, D.team as unknown as Record<string, unknown> & { settings: object }) : [];
      for (const p of need) if (denied([p])) return Promise.resolve();
      return upd(patch);
    };
  }

  // Rechte und Sicht: ohne Recht wirken Module wie ausgeschaltet (Demo: Daten werden zusätzlich ausgeblendet wie vom Server)
  const permKey = [...permsNow(s)].sort().join(",");
  const perms = useMemo(() => new Set(permKey ? permKey.split(",") as Perm[] : []), [permKey]);
  const staffView = asStaff(s);
  const viewD: TeamData | null = useMemo(() => !s.D ? null : staffView ? viewFor(s.D, perms, s.api.kind === "demo") : s.D, [s.D, s.version, perms, staffView]); // eslint-disable-line react-hooks/exhaustive-deps
  const engine: Engine | null = useMemo(() => viewD ? createEngine(viewD, { lang: s.lang }) : null, [viewD, s.version, s.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Hat die Person (Trainerteam) dieses Recht? Spieleransicht: immer false */
  const can = (p: Perm): boolean => staffView && perms.has(p);

  // Rolle für die Oberfläche (im Demo-Modus umschaltbar)
  const isDemo = s.api.kind === "demo";
  const role = s.active?.role;
  const viewAs: "coach" | "player" | null = !s.active ? null : isDemo ? s.demoView : role === "player" ? "player" : isStaffRole(role) ? "coach" : null;
  const mePid = isDemo ? s.demoPlayer : s.active?.playerId || null;

  // Eigenes Trainerprofil (Staff mit verknüpftem Konto)
  const myStaff = !s.D ? null : isDemo && s.demoStaff ? s.D.staff.find(x => x.id === s.demoStaff) || null : s.user ? s.D.staff.find(x => x.userId === s.user!.id) || null : null;
  const prefs: UserPrefs = { info: true, ...(s.user?.prefs || {}) };

  return { ...s, D: viewD, ...actions, tr, engine, isDemo, viewAs, mePid, myStaff, prefs, perms, can };
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
