// Demo: Matchplan für das nächste Spiel (freigegeben, mit Zugriffsprotokoll) und ein Plan vom letzten Spiel.
import { iso, rng } from "./dates";
import { groupOf, MATCHMIN } from "./classes";
import { isGoalkeeper } from "./units";
import {
  defaultUntil, emptyContent, fitToView, kickoff, lineupFor, mpId, newSlide, oppLineup, publishedOf, suggestLineup, DEFAULT_SECTIONS,
} from "./matchplan";
import type { Lang, Match, MatchPlan, MpContent, MpItem, MpLog, MpSlide, TeamData } from "./types";

const L = (en: boolean, de: string, e: string): string => en ? e : de;

/** Pfeile und Zonen für eine Folie aus Positionen der Marker (nur wenn es die Position gibt) */
function arrows(sl: MpSlide, add: (byLabel: (pos: string, i?: number) => MpItem | undefined) => MpItem[]): MpSlide {
  const by = (pos: string, i = 0): MpItem | undefined => sl.items.filter(x => x.t === "own" && x.label === pos)[i];
  return { ...sl, items: [...sl.items, ...add(by)] };
}
const line = (t: MpItem["t"], a: { x: number; y: number }, b: { x: number; y: number }, col?: MpItem["col"]): MpItem => ({ id: mpId("i"), t, x: a.x, y: a.y, x2: b.x, y2: b.y, ...(col ? { col } : {}) });
/** Marker auf eine Position setzen (Ecken, Freistöße) */
function place(sl: MpSlide, spots: [string, number, number][]): MpSlide {
  const used = new Set<string>(), items = sl.items.map(x => ({ ...x }));
  for (const [pos, x, y] of spots) {
    const it = items.find(z => z.t === "own" && z.label === pos && !used.has(z.id)) || items.find(z => z.t === "own" && !used.has(z.id) && z.label !== "TW");
    if (it) { used.add(it.id); it.x = x; it.y = y; }
  }
  return { ...sl, items };
}
/** Gegenspieler der Reihe nach auf Positionen setzen (Torwart zuerst) */
function placeOpp(sl: MpSlide, spots: [number, number][]): MpSlide {
  const opp = sl.items.filter(x => x.t === "opp"), at = new Map(opp.map((x, i) => [x.id, spots[i]] as const));
  return { ...sl, items: sl.items.map(x => at.get(x.id) ? { ...x, x: at.get(x.id)![0], y: at.get(x.id)![1] } : x) };
}

export function demoMatchPlans(D: TeamData, lang: Lang, now: Date): void {
  if (D.team.modules.matchplan === false || !D.players.length) return;
  const en = lang === "en", TODAY = iso(now), r = rng(77), kids = groupOf(D.team.cls) === "u11";
  const mm = MATCHMIN[D.team.cls] || 90;
  const up = D.matches.filter(m => m.date >= TODAY).sort((a, b) => a.date < b.date ? -1 : 1)[0];
  const past = D.matches.filter(m => m.date < TODAY).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  const absent = (pid: string, d: string) => D.absences.some(a => a.pid === pid && a.von <= d && (!a.bis || a.bis >= d));
  // Startelf: wer zuletzt viel gespielt hat, zuerst
  const minutes = (pid: string) => Object.values(D.stats).reduce((s, st) => s + (st[pid]?.min || 0), 0);
  const build = (m: Match): MpContent => {
    let c = emptyContent(D.team.cls);
    c = suggestLineup(c, D.players, pid => !absent(pid, m.date), pid => -minutes(pid), p => isGoalkeeper(D, p));
    const zm = c.lineup.find(x => (x.label === "ZM" || x.label === "DM" || x.label === "IV") && x.pid);
    c.captain = zm?.pid || null;
    c.mode = "name"; c.size = 1;
    // Gegner
    const oppF = c.fmt === 11 ? "4-4-2" : c.formation;
    c.opp = {
      formation: oppF, items: oppLineup(c.fmt, oppF),
      style: L(en, "Tiefes 4-4-2, lange Bälle auf die Spitzen, viel über zweite Bälle. Sehr gut bei Standards.", "Deep 4-4-2, long balls to the strikers, a lot via second balls. Very good at set pieces."),
      strong: L(en, "Kopfballstark (Nr. 9 und 5), schnelles Umschalten über links, Einwürfe weit in den Strafraum.", "Strong in the air (no. 9 and 5), quick transitions down the left, long throw-ins into the box."),
      weak: L(en, "Viel Raum zwischen den Ketten, wenn die Sechser rausrücken. Rechtsverteidiger ist langsam im Rückwärtslaufen.", "A lot of space between the lines when the midfielders step out. Right back is slow when running back."),
      keys: [
        { n: 9, name: L(en, "Mittelstürmer", "Centre forward"), note: L(en, "Groß, sucht Kopfballduelle – immer Körperkontakt, zweiten Ball sichern.", "Tall, looks for headers – always body contact, win the second ball.") },
        { n: 11, name: L(en, "Linksaußen", "Left winger"), note: L(en, "Schnell, zieht nach innen auf den rechten Fuß – nach außen lenken.", "Fast, cuts inside onto his right foot – show him outside.") },
      ],
      plan: L(en, "Hoch anlaufen, wenn ihr Innenverteidiger den Ball hat; Bälle zwischen die Ketten auf unseren Zehner; Flanken früh in den Rücken der Abwehr.", "Press high when their centre-back has the ball; play into the space between the lines to our no. 10; early crosses behind the back line."),
    };
    c.idea = {
      motto: L(en, "Mutig. Kompakt. Schnell nach vorne.", "Brave. Compact. Fast forward."),
      keys: kids ? (en ? ["Be brave in 1 v 1", "Defend together"] : ["Mutig ins Dribbling", "Gemeinsam verteidigen"])
        : en ? ["Win it back within 5 seconds after losing the ball", "Stay compact: max. 10 m between the lines", "Every second ball is ours"]
          : ["Gegenpressing 5 Sekunden nach Ballverlust", "Abstände eng: max. 10 m zwischen den Ketten", "Jeder zweite Ball gehört uns"],
      ball: L(en, "Flacher Aufbau über die Innenverteidiger und den Sechser. Außenverteidiger hoch und breit, Zehner zwischen den Linien anspielen.", "Build up on the ground via the centre-backs and the holding midfielder. Full-backs high and wide, find the no. 10 between the lines."),
      gegen: L(en, "Mittelfeldpressing ab der Mittellinie, Auslöser: Pass auf den Außenverteidiger oder Rückpass. Ball auf die Seite lenken.", "Mid-block from the halfway line; trigger: pass to the full-back or back-pass. Show the ball to the side."),
      umschalt: L(en, "Nach Ballgewinn sofort in die Tiefe – maximal drei Kontakte bis zum Abschluss.", "After winning the ball go forward immediately – at most three touches until the shot."),
    };
    // Aufgaben
    const tasks: [string, string, string][] = [
      ["TW", "Kommandos laut und früh – Abwehr bei Flanken führen.", "Loud and early commands – organise the defence on crosses."],
      ["IV", "Duelle mit der Nr. 9: immer Körperkontakt, zweiter Ball sichern.", "Duels with no. 9: always body contact, win the second ball."],
      ["DM", "Abstand zur Abwehr max. 10 m, nach Ballgewinn sofort steil.", "Max. 10 m to the back line, play forward after winning the ball."],
      ["OM", "Zwischen den Linien anbieten, aufdrehen und Tiefe suchen.", "Show between the lines, turn and look for depth."],
      ["ST", "Anlaufen auf den linken IV, Rückpass zum Torwart provozieren.", "Press the left centre-back, force the back-pass to the goalkeeper."],
      ["RV", "Linksaußen nach außen lenken, nicht ins Dribbling gehen lassen.", "Show the left winger outside, don't let him dribble inside."],
    ];
    for (const [pos, de, e] of tasks) { const it = c.lineup.find(x => x.label === pos && x.pid); if (it?.pid) c.tasks[it.pid] = en ? e : de; }
    // Wechselplan (Senioren: drei Wechsel; Jugend: mehr Rotation)
    const bench = c.bench.filter(pid => !D.players.find(p => p.id === pid && isGoalkeeper(D, p)));
    const outs = c.lineup.filter(x => x.pid && ["ST", "LA", "RA", "LM", "RM", "ZM", "OM"].includes(x.label || "")).map(x => x.pid!);
    const mins = kids ? [Math.round(mm / 4), Math.round(mm / 2), Math.round(mm * 3 / 4)] : [60, 70, 78];
    c.subs = mins.map((min, i) => ({ id: mpId("w"), min, out: outs[i] || null, in: bench[i] || null, note: i === 2 ? L(en, "nur bei Führung", "only when leading") : "" })).filter(x => x.out && x.in);
    c.subsNote = L(en, "Bei Rückstand ab 60. Minute mit zwei Spitzen (4-4-2).", "If behind from minute 60: two strikers (4-4-2).");
    // Folien
    const t = (de: string, e: string) => en ? e : de;
    let s1 = newSlide(c, "gegen", t("Gegen den Ball: Mittelfeldpressing", "Out of possession: mid-block"), true);
    s1 = arrows(s1, by => [
      ...(by("ST") ? [line("run", by("ST")!, { x: by("ST")!.x - 6, y: by("ST")!.y - 12 })] : []),
      ...(by("LA") ? [line("run", by("LA")!, { x: by("LA")!.x + 2, y: by("LA")!.y - 14 })] : []),
      ...(by("RA") ? [line("run", by("RA")!, { x: by("RA")!.x - 2, y: by("RA")!.y - 14 })] : []),
      { id: mpId("i"), t: "zone", x: 6, y: 40, x2: 62, y2: 72, col: "y" },
    ]);
    s1.note = t("Auslöser: Pass auf den Außenverteidiger. Ball auf die Seite lenken, dann zu dritt zustellen.", "Trigger: pass to their full-back. Show the ball wide, then close it down with three players.");
    let s2 = newSlide(c, "ball", t("Mit Ball: Spielaufbau", "In possession: build-up"), false);
    s2 = arrows(s2, by => {
      const out: MpItem[] = [];
      const iv = by("IV"), dm = by("DM"), om = by("OM"), lv = by("LV"), rv = by("RV");
      if (iv && dm) out.push(line("pass", iv, dm));
      if (dm && om) out.push(line("pass", dm, om));
      if (lv) out.push(line("run", lv, { x: lv.x, y: lv.y - 26 }));
      if (rv) out.push(line("run", rv, { x: rv.x, y: rv.y - 26 }));
      return out;
    });
    s2.note = t("Außenverteidiger hoch und breit, der Zehner bietet sich zwischen den Linien an.", "Full-backs high and wide, the no. 10 shows between the lines.");
    let s3 = newSlide(c, "ecke_off", t("Ecke offensiv: kurzer Pfosten", "Attacking corner: near post"), false);
    s3 = place(s3, [["RA", 67, 1], ["IV", 30, 9], ["IV", 40, 13], ["ST", 25, 7], ["OM", 36, 21], ["DM", 46, 6], ["ZM", 44, 18], ["LA", 20, 16], ["LV", 34, 27.5], ["RV", 56, 26]]);
    s3 = arrows(s3, by => [{ ...line("pass", { x: 66, y: 1 }, { x: 27, y: 6 }, "y"), bend: -1 }, ...(by("IV") ? [line("run", by("IV")!, { x: 28, y: 5 })] : [])]);
    s3.note = t("Ball scharf auf den kurzen Pfosten, der erste IV verlängert, zweiter IV und ST gehen auf den langen Pfosten.", "Driven ball to the near post, first centre-back flicks it on, second centre-back and striker attack the far post.");
    let s4 = newSlide(c, "ecke_def", t("Ecke defensiv: Raumdeckung", "Defending corners: zonal"), true);
    s4 = place(s4, [["TW", 34, 103.3], ["LV", 28.8, 103.6], ["IV", 27, 99.6], ["IV", 31.6, 99.6], ["DM", 36.2, 99.6], ["DM", 40.8, 99.6], ["RV", 39.8, 103.8], ["OM", 30.5, 94.2], ["ST", 37.6, 93.4], ["LA", 16, 84], ["RA", 52, 84]]);
    s4 = placeOpp(s4, [[34, 7], [0.6, 104.4], [25.5, 96.4], [31.8, 95.8], [38.6, 96.2], [44.5, 98.5], [36.6, 91.6], [23.5, 88], [46.5, 89], [24, 77.5], [44, 77.5]]);
    s4 = { ...s4, size: 0.8, mode: "num" };
    s4.note = t("Sechs Spieler im Raum (Fünfmeterlinie und Pfosten), ein Manndecker für ihre Nr. 9. LA und RA bleiben für den Konter vorne.", "Six players zonal (six-yard line and posts), one man-marker on their no. 9. Left and right winger stay up for the counter.");
    // Freistoß zentral im gezoomten 16er: Mauer, Schuss mit Bogen, Nachsetzen, Absicherung
    let s5 = newSlide(c, "frei_off", t("Freistoß zentral: über die Mauer", "Central free kick: over the wall"), true);
    s5 = { ...s5, view: "pen_att", items: fitToView(s5.items.filter(x => x.t !== "ball"), "pen_att") };
    s5 = place(s5, [["OM", 33, 25.3], ["DM", 36.6, 25.6], ["ST", 27.5, 16.4], ["LA", 21, 18], ["RA", 46.5, 17.2], ["IV", 41.5, 16.2], ["IV", 20.5, 26], ["DM", 47.5, 26], ["LV", 14.5, 27], ["RV", 53.5, 27]]);
    s5 = placeOpp(s5, [[34, 1], [30.4, 14.4], [32.8, 14.4], [35.2, 14.4], [37.6, 14.4], [24.5, 10.5], [30, 7], [39, 7.5], [44.5, 10.5], [49.5, 14.5], [19, 15]]);
    s5.size = 0.8;
    s5 = { ...s5, items: [...s5.items, { id: mpId("i"), t: "ball", x: 34, y: 23.5 }, { ...line("pass", { x: 34, y: 23 }, { x: 30.6, y: -0.2 }, "y"), bend: 1 }] };
    s5 = arrows(s5, by => [
      ...(by("ST") ? [line("run", by("ST")!, { x: 31, y: 6.5 })] : []),
      ...(by("RA") ? [line("run", by("RA")!, { x: 38.5, y: 5.5 })] : []),
    ]);
    s5.note = t("Schütze Nr. 10 mit rechts über die Mauer ins linke Eck, der Sechser täuscht an. Bei Abpraller gehen ST und RA nach; IV, DM und Außenverteidiger sichern ab.",
      "No. 10 shoots right-footed over the wall into the left corner, the holding midfielder fakes. On a rebound the striker and right winger follow up; centre-back, holding midfielder and full-backs secure.");
    c.slides = kids ? [s2, s1] : [s1, s2, s3, s4, s5];
    return c;
  };
  const mk = (m: Match, id: string): MatchPlan => ({ id, matchId: m.id, title: (en ? "vs " : "gegen ") + m.gegner, c: build(m), share: null, published: null, publishedAt: null, updatedAt: now.toISOString() });

  if (up) {
    const p = mk(up, "mp-demo-next");
    const sections = DEFAULT_SECTIONS;
    p.share = { sections, from: null, until: defaultUntil(up, mm, now), squadOnly: false, ownTasks: true };
    p.published = publishedOf(p.c, sections);
    p.publishedAt = new Date(now.getTime() - 5 * 3600e3).toISOString();
    D.plans.push(p);
    // Zugriffsprotokoll: gut die Hälfte hat schon reingeschaut, einer hat einen Screenshot gemacht
    const logs: MpLog[] = [];
    D.players.forEach((pl, i) => {
      if (r() < 0.62 && i !== 0) logs.push({ pid: pl.id, at: new Date(now.getTime() - (4.5 - r() * 4) * 3600e3).toISOString(), kind: "open", platform: r() < 0.55 ? "ios" : "android" });
    });
    const shot = logs.find(l => l.platform === "android");
    if (shot) logs.push({ pid: shot.pid, at: new Date(new Date(shot.at).getTime() + 90e3).toISOString(), kind: "shot", platform: "android" });
    D.planLogs[p.id] = logs.sort((a, b) => a.at < b.at ? -1 : 1);
  }
  if (past) {
    const p = mk(past, "mp-demo-last");
    p.c.formation = p.c.fmt === 11 ? "4-4-2" : p.c.formation;
    p.c.lineup = lineupFor(p.c.fmt, p.c.formation, p.c.lineup).lineup;
    p.share = { sections: DEFAULT_SECTIONS, from: null, until: defaultUntil(past, mm, now), squadOnly: true, ownTasks: true };
    p.published = publishedOf(p.c, p.share.sections);
    p.publishedAt = new Date(kickoff(past).getTime() - 26 * 3600e3).toISOString();
    p.updatedAt = p.publishedAt;
    D.plans.push(p);
  }
}
