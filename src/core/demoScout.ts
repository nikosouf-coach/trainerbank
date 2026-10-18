// Demo: Kaderplanung & Scouting – Kandidaten mit Berichten, Merklisten und eine Saisonplanung für die nächste Saison
// (Schattenkader je Position, Stand der eigenen Spieler). Deterministisch wie die übrige Demo.
import { classDef } from "./classes";
import { addDays, iso, rng } from "./dates";
import { fmtOf } from "./matchplan";
import { addRef, autoAssign, candidatesFor, defaultSeason, eligibleYears, emptyPlanContent, isClosed, isOut, playerState, posMatch, refOf, setPlayerStatus, setSlot, statsBy } from "./scout";
import { isGoalkeeper } from "./units";
import type { Lang, ScoutPlayer, ScoutReport, ScoutStatus, ScoutPrio, TeamData } from "./types";

type Row = [vn: string, nn: string, pos: string[], foot: "r" | "l" | "b", club: string, status: ScoutStatus, prio: ScoutPrio | null, level: number, pot: number, yi: number, lists: string[], tags: string[]];

export function demoScouting(D: TeamData, lang: Lang, now: Date): void {
  if (classDef(D.team.cls).grp === "u11") return;
  const en = lang === "en", TODAY = iso(now), r = rng(4711), season = defaultSeason(now);
  const e = eligibleYears(D.team.cls, season), years = e ? [e.min, e.max] : [season - 24, season - 21];
  D.scoutLists = [
    { id: "sl1", name: en ? "Top targets summer" : "Top-Ziele Sommer", color: "#c8402a", sort: 0 },
    { id: "sl2", name: en ? "Goalkeepers" : "Torhüter", color: "#3a6db5", sort: 1 },
    { id: "sl3", name: en ? "Left-footers" : "Linksfüße", color: "#22865a", sort: 2 },
  ];
  const T = (de: string, eng: string) => en ? eng : de;
  const rows: Row[] = [
    ["Lukas", "Brandner", ["TW"], "r", "SV Nordheim", "trial", "a", 4, 5, 1, ["sl1", "sl2"], [T("Strafraumbeherrschung", "Box control"), T("Spieleröffnung", "Distribution")]],
    ["Fynn", "Albrecht", ["TW"], "r", "TuS Rheinblick", "watch", "c", 3, 3, 0, ["sl2"], []],
    ["Jannis", "Okoye", ["IV", "DM"], "l", "FC Eintracht Waldau", "talks", "a", 4, 5, 0, ["sl1", "sl3"], [T("Linksfuß", "Left-footed"), T("kopfballstark", "Strong in the air"), T("Führungsspieler", "Leader")]],
    ["Moritz", "Feldhaus", ["IV"], "r", "SpVgg Ostfeld", "scout", "b", 3, 4, 1, [], [T("schnell", "Quick")]],
    ["Ben", "Kowalski", ["IV", "RV"], "r", "VfR Lindenhof", "watch", "b", 3, 3, 0, [], []],
    ["Elias", "Sommer", ["LV", "LM"], "l", "DJK Sonnenberg", "scout", "a", 4, 4, 1, ["sl1", "sl3"], [T("Flanken", "Crossing"), T("Tempo", "Pace")]],
    ["Noel", "Wagner", ["RV"], "r", "BV Hafenstadt", "watch", "b", 3, 4, 1, [], []],
    ["Leandro", "Costa", ["ZM", "OM"], "r", "SC Bergtal", "signed", "a", 4, 5, 0, ["sl1"], [T("Spielintelligenz", "Game intelligence")]],
    ["Hamza", "Yilmaz", ["DM"], "r", "Rot-Weiß Auenfeld", "trial", "b", 3, 4, 1, [], [T("Zweikampf", "Duels")]],
    ["Paul", "Reuter", ["ZM"], "b", "TSV Mühlbach", "watch", "c", 3, 3, 0, [], []],
    ["Matti", "Lehnert", ["OM", "ZM"], "l", "SG Kirchdorf", "scout", "b", 3, 5, 1, ["sl3"], [T("kreativ", "Creative")]],
    ["Joel", "Mensah", ["LA", "ST"], "r", "1. FC Talheim", "talks", "a", 4, 5, 1, ["sl1"], [T("Dribbling", "Dribbling"), T("Tiefe", "Runs in behind")]],
    ["Tim", "Hartwig", ["RM", "RA"], "r", "SV Grünwiese", "watch", "b", 3, 4, 0, [], []],
    ["Niklas", "Bauer", ["ST"], "r", "SV Nordheim", "scout", "a", 4, 4, 0, ["sl1"], [T("Abschluss", "Finishing"), T("Kopfball", "Heading")]],
    ["Can", "Özdemir", ["ST"], "l", "TuS Rheinblick", "declined", "b", 3, 4, 0, [], []],
    ["Lasse", "Petersen", ["ST", "LA"], "r", "FC Eintracht Waldau", "watch", "b", 3, 4, 1, [], []],
  ];
  const ago = (d: number) => new Date(now.getTime() - d * 864e5).toISOString();
  D.scouts = rows.map(([vn, nn, pos, foot, club, status, prio, level, potential, yi, lists, tags], i): ScoutPlayer => {
    const year = years[Math.min(yi, years.length - 1)], created = 10 + Math.floor(r() * 70);
    const contacted = status !== "watch";
    return {
      id: "sc" + (i + 1), vn, nn, year, geb: i % 3 === 0 ? iso(new Date(year, Math.floor(r() * 12), 1 + Math.floor(r() * 27))) : null, pos, foot,
      cm: pos[0] === "TW" || pos[0] === "IV" ? 182 + Math.floor(r() * 10) : 168 + Math.floor(r() * 14),
      club, clubTeam: e ? `${D.team.name} · ${T("Regionalliga", "Regional league")}` : T("Landesliga", "State league"), status, prio, level, potential, tags, lists,
      source: [T("Turnier", "Tournament"), T("Empfehlung Trainer", "Coach recommendation"), T("Video", "Video"), T("Ligaspiel", "League match")][i % 4],
      contact: contacted ? T("über die Eltern (Vater)", "via the parents (father)") : "", video: i % 4 === 1 ? "https://example.com/video/scout-" + (i + 1) : null,
      note: "", next: status === "trial" ? addDays(TODAY, 2 + (i % 3)) : status === "scout" && i % 2 ? addDays(TODAY, 5) : status === "talks" ? addDays(TODAY, -1) : null,
      nextNote: status === "trial" ? T("Probetraining 18:30", "Trial session 18:30") : status === "scout" ? T("Sichtung im Ligaspiel", "Watch league match") : status === "talks" ? T("Gespräch mit Eltern", "Meeting with parents") : "",
      // Informiert: wer schon Kontakt hatte; einer ist überfällig (zeigt den Hinweis)
      informed: contacted && i !== 3 ? addDays(TODAY, -Math.min(created - 2, 20)) : null,
      playerId: null, createdAt: ago(i === 3 ? 41 : created), updatedAt: ago(Math.floor(r() * 9)),
    };
  });
  const authors = [D.staff[0]?.name || "Demo", D.staff[1]?.name || "Co"];
  const events = [T("Ligaspiel", "League match"), T("Pokalspiel", "Cup match"), T("Hallenturnier", "Indoor tournament"), T("Video Rückrunde", "Video second half")];
  const reports: ScoutReport[] = [];
  let k = 1;
  D.scouts.forEach((s, i) => {
    const n = s.status === "watch" ? (i % 2) : isClosed(s.status) ? 1 : s.status === "scout" ? 1 + (i % 2) : 2 + (i % 2);
    for (let j = 0; j < n; j++) {
      const base = (s.level || 3) + (r() < 0.3 ? -1 : 0) + (j === n - 1 && n > 1 && r() < 0.6 ? 1 : 0), cl = (v: number) => Math.max(1, Math.min(5, Math.round(v)));
      const sc = { tech: cl(base + (r() - 0.5) * 2), takt: cl(base + (r() - 0.5) * 2), ath: cl(base + (r() - 0.5) * 2), ment: cl(base + (r() - 0.5) * 2) };
      const grade = cl(base), date = addDays(TODAY, -(4 + (n - j) * 12 + i % 5));
      reports.push({
        id: "sr" + (k++), sid: s.id, date, event: `${events[(i + j) % events.length]}${en ? " vs " : " gegen "}${["TSG Burgstadt", "VfB Ostend", "SC Rheinau", "FV Lindau-Süd"][(i + j) % 4]}`,
        kind: j === 0 && i % 4 === 1 ? "video" : s.status === "trial" && j === n - 1 ? "trial" : "match", min: 60 + (i % 4) * 10, pos: s.pos[0], scores: sc, grade,
        verdict: s.status === "declined" ? "watch" : grade >= 4 ? "sign" : grade <= 2 ? "no" : "watch",
        strengths: s.tags.join(", ") || T("Einsatz, Spielverständnis", "Work rate, game understanding"),
        weaknesses: [T("schwacher Fuß", "weaker foot"), T("Defensivverhalten", "defending"), T("Tempo über 30 m", "pace over 30 m"), T("Körpersprache nach Fehlern", "body language after mistakes")][(i + j) % 4],
        summary: (grade >= 4 ? [
          T("Klare Verstärkung für unser Niveau – weiter eng begleiten.", "Clear upgrade for our level – keep a close eye on him."),
          T("Hat das Spiel geprägt, auch unter Druck ruhig am Ball. Zum Probetraining einladen.", "Shaped the game, calm on the ball under pressure. Invite to a trial."),
          T("Bestätigt den ersten Eindruck – passt in unsere Spielidee.", "Confirms the first impression – fits our way of playing."),
        ] : grade <= 2 ? [
          T("Aktuell nicht über unserem Niveau, kein weiterer Bedarf.", "Not above our level right now, no further need."),
          T("Viele Ballverluste, wenig Einfluss aufs Spiel.", "Lost the ball a lot, little influence on the game."),
        ] : [
          T("Solide, aber aktuell kein Unterschiedsspieler.", "Solid, but not a difference-maker right now."),
          T("Gute Ansätze, schwankende Leistung – noch einmal im Ligaspiel ansehen.", "Promising moments, inconsistent – watch again in a league match."),
          T("Ordentliches Spiel, Entwicklung über die nächsten Monate abwarten.", "Decent game, wait and see how he develops over the next months."),
        ])[(i + j) % (grade >= 4 ? 3 : grade <= 2 ? 2 : 3)],
        author: null, authorName: authors[(i + j) % 2], createdAt: new Date(date + "T20:00:00").toISOString(),
      });
    }
  });
  D.scoutReports = reports;

  // Saisonplanung für die nächste Saison: eigene Spieler verteilen, Stand setzen, Schattenkandidaten je Position
  const fmt = fmtOf(D.team.cls);
  let c = emptyPlanContent(fmt, fmt === 11 ? "4-3-3" : "");
  const staying = D.players.filter(p => !p.neu && !isOut(playerState(p, c, D.team.cls, season)));
  const pick = (n: number) => staying[Math.min(staying.length - 1, n)]?.id;
  const notes: [string | undefined, "persp" | "unsure" | "leave" | "fix", string][] = [
    [pick(2), "unsure", T("Studium in einer anderen Stadt geplant", "Plans to study in another city")],
    [pick(5), "leave", T("Wechsel angekündigt", "Announced a move")],
    [pick(8), "persp", T("Braucht Spielzeit – Entwicklung beobachten", "Needs minutes – watch development")],
    [pick(1), "fix", ""], [pick(3), "fix", ""],
  ];
  for (const [pid, s, note] of notes) if (pid) c = setPlayerStatus(c, pid, s, note);
  c = autoAssign(c, fmt, staying.filter(p => c.status[p.id]?.s !== "leave").map(p => ({ ref: refOf("p", p.id), pos: p.pos, gk: isGoalkeeper(D, p) })));
  const stats = statsBy(reports), slots = Object.keys(c.slots);
  // je Position höchstens zwei passende Kandidaten, jeder nur einmal: zuerst Hauptposition, dann weitere/Ausweichposition
  const used = (id: string) => Object.values(c.slots).some(x => x.shadow.includes(refOf("s", id)) || x.own.includes(refOf("s", id)));
  for (const maxMatch of [0, 1, 2]) for (const key of slots) {
    const pos = key.split("-")[0], have = c.slots[key].shadow.length + c.slots[key].own.filter(r => r.startsWith("s:")).length;
    const cands = candidatesFor(pos, D.scouts, stats).filter(s => posMatch(s.pos, pos) <= maxMatch && !used(s.id));
    for (const s of cands.slice(0, Math.max(0, 2 - have))) c = addRef(c, key, s.status === "signed" ? "own" : "shadow", refOf("s", s.id));
  }
  if (c.slots["IV-l"]) c = setSlot(c, "IV-l", { need: T("Linksfuß, kopfballstark, Führung", "Left-footed, strong in the air, leader") });
  if (c.slots.ST) c = setSlot(c, "ST", { need: T("Tiefe Läufe und Abschluss – nach den Abgängen dringend", "Runs in behind and finishing – urgent after departures") });
  if (c.slots.TW) c = setSlot(c, "TW", { target: 2 });
  c = { ...c, notes: T(`Ziel ${season}/${String((season + 1) % 100).padStart(2, "0")}: Gerüst aus dem jüngeren Jahrgang halten, auf Außenverteidiger und Sturm gezielt nachlegen.`, `Goal for ${season}/${String((season + 1) % 100).padStart(2, "0")}: keep the core of the younger year group, add full-backs and strikers in a targeted way.`) };
  D.squadPlans = [{ id: "spl-" + season, season, content: c, updatedAt: new Date(now.getTime() - 3 * 3600e3).toISOString() }];
}
