// Demo-Mannschaft: für den Demo-Modus, für Tests und für „Beispieldaten laden“ (App-Review).
import { classDef, defaultPrinciples, defaultSettings, groupOf, isGrowthAge, modsFor, sleepTarget } from "./classes";
import { addDays, ageOn, diff, iso, parse, rng } from "./dates";
import { createEngine } from "./engine";
import { translator } from "./i18n";
import type { AttStatus, ClassKey, Depth, Lang, Team, TeamData } from "./types";
import { emptyTeamData } from "./types";

export const DEMO_NAMES: [string, string, string][] = [["Luca", "Brenner", "TW"], ["Jonas", "Albers", "IV"], ["Elias", "Kraft", "IV"], ["Mats", "Ehlert", "IV"], ["Noah", "Petersen", "RV"], ["Leon", "Yildiz", "LV"], ["Finn", "Hartmann", "RV"], ["Ben", "Okafor", "DM"], ["Paul", "Wiese", "ZM"], ["Tim", "Sander", "ZM"], ["Emil", "Rasch", "DM"], ["Milan", "Kovač", "OM"], ["Arda", "Demir", "OM"], ["Nico", "Lindner", "LM"], ["Samuel", "Asante", "RM"], ["Jan", "Vogt", "LM"], ["Henry", "Böhm", "ST"], ["Malik", "Haddad", "ST"], ["Ole", "Brandt", "ST"], ["Kian", "Weber", "TW"], ["Lennard", "Fuchs", "IV"], ["David", "Neumann", "ZM"]];
const OPP = ["SV Nordheim", "TuS Rheinblick", "FC Eintracht Waldau", "SpVgg Ostfeld", "VfR Lindenhof", "DJK Sonnenberg", "BV Hafenstadt", "SC Bergtal", "Rot-Weiß Auenfeld", "TSV Mühlbach", "SG Kirchdorf", "1. FC Talheim", "SV Grünwiese"];

export function demoTeam(cls: ClassKey = "u19", depth: Depth = "basis", lang: Lang = "de"): Team {
  const c = classDef(cls);
  return {
    id: "demo", club: lang === "en" ? "My Club" : "Mein Verein", name: c.team ? c.team[lang] : cls.toUpperCase(), accent: "#0b3d91",
    cls, depth, settings: defaultSettings(), principles: defaultPrinciples(groupOf(cls)), modules: modsFor(depth, cls), joinCode: "DEMO-U19K", staffCode: "DEMO-STAF",
  };
}

/** Erzeugt eine vollständige Demo-Mannschaft relativ zu `now` (deterministisch). */
export function buildDemo(team: Team, lang: Lang, now: Date = new Date()): TeamData {
  const D = emptyTeamData(team);
  const r = rng(19), c = classDef(team.cls), grp = c.grp, TODAY = iso(now), en = lang === "en";
  const { tf } = translator(lang);
  let uid = 1; const nid = (): string => "d" + (uid++);
  D.players = DEMO_NAMES.map((n, i) => {
    const a = c.ages[0] + Math.floor(r() * (c.ages[1] - c.ages[0] + 1));
    const bd = new Date(now.getFullYear() - a, Math.floor(r() * 12), 1 + Math.floor(r() * 27));
    if (bd > new Date(now.getFullYear() - a, now.getMonth(), now.getDate())) bd.setFullYear(bd.getFullYear() - 1);
    return { id: "p" + (i + 1), vn: n[0], nn: n[1], pos: n[2], nr: i + 1, geb: iso(bd) };
  });
  if (grp === "akt") {
    const o = c.k === "ue32" ? 6 : 0;
    D.players[2].geb = iso(new Date(now.getFullYear() - 36 - o, 2, 4)); D.players[7].geb = iso(new Date(now.getFullYear() - 33 - o, 5, 12)); D.players[16].geb = iso(new Date(now.getFullYear() - 38 - o, 8, 20));
  }
  const sd = team.settings.spieltag, nextMD = addDays(TODAY, ((sd - parse(TODAY).getDay()) + 7) % 7 || 7);
  let oi = 0;
  for (let k = -7; k <= 6; k++) { const d = addDays(nextMD, 7 * k); if (k === 3) continue; D.matches.push({ id: nid(), date: d, zeit: team.settings.anstoss, gegner: OPP[oi++ % OPP.length], heim: k % 2 === 0, comp: "liga" }); }
  D.matches.push({ id: nid(), date: addDays(nextMD, 10), zeit: "19:30", gegner: "SC Bergtal", heim: true, comp: "pokal" });
  D.events.push({ id: nid(), date: addDays(nextMD, 5), zeit: "21:00", titel: en ? "Team night" : "Mannschaftsabend", typ: "abend", ersetzt: false });
  D.events.push({ id: nid(), date: addDays(nextMD, 1), zeit: "19:00", titel: en ? "Team photo" : "Teamfoto", typ: "foto", ersetzt: false });
  D.events.push({ id: nid(), date: addDays(nextMD, 15), zeit: "", titel: en ? "Autumn break – no training" : "Herbstferien – trainingsfrei", typ: "frei", ersetzt: true });
  D.absences.push({ id: nid(), pid: "p15", typ: "verletzung", von: addDays(TODAY, -9), bis: null, stufe: 2, notiz: en ? "Hamstring" : "Oberschenkel hinten" });
  D.absences.push({ id: nid(), pid: "p3", typ: "verletzung", von: addDays(TODAY, -30), bis: addDays(TODAY, -10), stufe: 4, notiz: en ? "Ankle" : "Sprunggelenk" });
  D.absences.push({ id: nid(), pid: "p11", typ: "urlaub", von: addDays(TODAY, 2), bis: addDays(TODAY, 10), stufe: null, notiz: "" });
  D.absences.push({ id: nid(), pid: "p19", typ: grp === "akt" ? "arbeit" : "schule", von: addDays(TODAY, -1), bis: addDays(TODAY, 3), stufe: null, notiz: "" });
  D.absences.push({ id: nid(), pid: "p8", typ: "krank", von: addDays(TODAY, -1), bis: addDays(TODAY, 1), stufe: null, notiz: "" });
  const E = createEngine(D, { lang, now });
  for (let k = 42; k >= 1; k--) {
    const d = addDays(TODAY, -k), m = E.matchOn(d);
    if (m) D.sessions.push({ date: d, typ: "Spiel", dauer: E.matchMin(), zeit: m.zeit, md: "MD", ziel: E.matchRpe() });
    else if (E.isTraining(d)) {
      const md = E.mdOf(d).md, pr = team.principles[md] || { kind: "aufbau", rpe: 6 }; if (pr.kind === "frei") continue;
      D.sessions.push({ date: d, typ: "Training", dauer: E.durOf(d), zeit: E.zeitOf(d), md, ziel: Math.min(E.CAP, pr.rpe), kind: pr.kind });
    }
  }
  const spike = "p6", low = "p20", sleepy = "p10", sore = "p17";
  for (const s of D.sessions) {
    D.att[s.date] = {};
    for (const p of D.players) {
      const ab = E.absenceOn(p.id, s.date); const st: AttStatus | null = ab ? null : (r() < 0.9 ? "da" : (r() < 0.6 ? "ent" : "unent"));
      if (st) D.att[s.date][p.id] = st;
      if (st !== "da" || grp === "u11") continue;
      let rpe = s.ziel + Math.round((r() - 0.5) * 2.4); if (p.id === spike && diff(s.date, TODAY) <= 7) rpe += 2; if (p.id === low) rpe -= 3; rpe = Math.max(1, Math.min(10, rpe));
      let min = s.dauer;
      if (s.typ === "Spiel") {
        const MM = E.matchMin(); min = p.pos === "TW" && p.id !== "p1" ? 0 : (r() < 0.7 ? MM : Math.round(15 + r() * 40));
        if (p.id === low) min = 10; if (p.id === spike && diff(s.date, TODAY) <= 7) min = MM; if (grp === "akt" && ["p3", "p8", "p17", "p12"].includes(p.id)) min = MM;
      }
      if (p.id === spike && diff(s.date, TODAY) > 7 && diff(s.date, TODAY) <= 28 && r() < 0.5) continue;
      if (min === 0) continue;
      (D.rpe[p.id] ||= {})[s.date] = { rpe, min };
    }
  }
  if (grp !== "u11") for (const p of D.players) {
    for (let k = 27; k >= 0; k--) {
      const d = addDays(TODAY, -k);
      if (r() < 0.75) {
        const tg = sleepTarget(ageOn(p.geb, now)); let s4 = 8 + Math.round(r() * 4), h = tg[0] + Math.round(r() * 3) * 0.5;
        if (p.id === sleepy && k <= 6) { h = tg[0] - 1.5 + Math.round(r()) * 0.5; s4 += 4; }
        if (p.id === sore && k === 0) s4 += 7;
        (D.well[p.id] ||= {})[d] = { sum: s4, schlaf: h, beschw: p.id === sore && k === 0 ? "clear" : "none" };
      }
    }
  }
  if (isGrowthAge(team.cls)) for (const p of D.players) {
    const spurt = ["p4", "p9", "p13", "p18"].includes(p.id); let h = 145 + Math.round(r() * 25);
    D.growth[p.id] = [-12, -9, -6, -3, 0].map(m => { const d = new Date(now); d.setMonth(d.getMonth() + m); const v = { date: iso(d), cm: Math.round(h * 10) / 10 }; h += spurt ? 2.2 + r() * 0.8 : 0.9 + r() * 0.8; return v; });
  }
  D.notes.p6 = en ? "Has done extra private gym sessions in recent days." : "Hat in den letzten Tagen privat zusätzlich im Gym trainiert.";
  const lastS = D.sessions[D.sessions.length - 1];
  if (lastS) ["p10", "p14", "p21"].forEach(id => { if (D.rpe[id]) delete D.rpe[id][lastS.date]; });
  if (grp !== "u11") {
    D.extra.p6 = [{ id: nid(), date: addDays(TODAY, -2), art: "gym", min: 60, rpe: 7 }, { id: nid(), date: addDays(TODAY, -4), art: "gym", min: 45, rpe: 6 }];
    D.extra.p13 = [{ id: nid(), date: addDays(TODAY, -1), art: "schule", min: 90, rpe: 5 }];
    D.pot.p6 = [{ id: nid(), cat: "ath", text: en ? "Acceleration and top speed are among the best in the team: use them deliberately in transitions." : "Antritt und Endgeschwindigkeit gehören zu den besten im Team: im Umschaltspiel gezielt einsetzen.", vis: true, src: "trainer" }];
    D.pot.p12 = [{ id: nid(), cat: "takt", text: en ? "Turn between the lines instead of laying the ball off." : "Zwischen den Linien aufdrehen statt abprallen lassen.", vis: true, src: "trainer" }];
    D.pot.p2 = [{ id: nid(), cat: "ment", text: en ? "Take on leadership in the back line (communication)." : "Führungsrolle in der Abwehrkette übernehmen (Kommandos).", vis: false, src: "trainer" }];
    const tg = sleepTarget(ageOn(D.players[9].geb, now));
    D.msgs.p10 = [{ id: nid(), date: addDays(TODAY, -1), typ: "info", text: tf("rs_sleep", { a: tg[0], b: tg[1] }), bis: addDays(TODAY, 5) }];
  }
  return D;
}

/** Beispielzeilen für den Spielplan-Import. */
export function sampleFixtures(team: Team, now: Date = new Date()): string {
  const TODAY = iso(now), WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const s = addDays(TODAY, ((team.settings.spieltag - parse(TODAY).getDay()) + 7) % 7 || 7);
  return [6, 7, 8].map((k, i) => {
    const d = parse(addDays(s, 7 * k)), home = i % 2 === 0, opp = ["VfL Weidenau", "FC Blau-Weiß Ostend", "SV Am Hang"][i];
    const own = team.club + " " + team.name;
    return `${WT[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} | ${team.settings.anstoss} | ${home ? own + " - " + opp : opp + " - " + own}`;
  }).join("\n");
}
