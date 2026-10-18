// Demo-Verein: weitere Teams des Vereins (andere Altersklassen, eigene Namen und Spielpläne) für die Vereinsübersicht,
// Hochziehen/Wechsel und Ankündigungen im Demo-Modus. Deterministisch wie die übrige Demo.
import { classDef, defaultSettings } from "./classes";
import type { ClubStaffEntry } from "./club";
import { CLUB_PERMS } from "./club";
import { rng } from "./dates";
import { buildDemo, demoChat, demoExtras, demoTeam } from "./demo";
import type { ClassKey, Lang, Team, TeamData } from "./types";

export const DEMO_CLUB = "demo-club";
export const DEMO_CLUB_LINK = "DEMO-CLUB", DEMO_CLUB_STAFF = "DEMO-FUNK";

const FIRST = ["Lukas", "Felix", "Moritz", "Julian", "Niklas", "Tom", "Anton", "Jakob", "Leo", "Erik", "Lasse", "Theo", "Matteo", "Vincent", "Mika", "Hannes", "Fabian", "Simon", "Robin", "Yusuf", "Can", "Luis", "Marlon", "Jannik", "Bastian", "Oskar"];
const LAST = ["Becker", "Schulz", "Krüger", "Lange", "Wolf", "Zimmermann", "Braun", "Hofmann", "Schröder", "Koch", "Richter", "Klein", "Schmitt", "Lorenz", "Kaya", "Novak", "Jansen", "Berg", "Frank", "Seidel", "Arslan", "Peters", "Busch", "Engel", "Roth", "Pohl"];
const OPP = ["FC Wiesental", "SV Blau-Gelb Ahrfeld", "TSG Burgstadt", "VfB Ostend", "SC Rheinau", "Sportfreunde Hügelheim", "FV Lindau-Süd", "TuRa Brückhausen", "SpVg Eichwald", "DJK Westfeld", "SC Kirchberg", "Union Talstadt", "FC Mühlenweg"];
const COACHES: [string, string, string, string][] = [["Markus Engel", "Jens Pohl", "Kevin Roth", "Lena Busch"], ["Stefan Brück", "Ali Kaya", "Nils Busch", "Mara Jansen"], ["Andrea Lorenz", "Timo Frank", "Sven Seidel", "Eva Koch"]];

/** Weitere Teams des Demo-Vereins: drei andere Altersklassen (Senioren, A-, B- oder C-Jugend) */
export function demoClubClasses(own: ClassKey): ClassKey[] {
  return (["sen", "u19", "u17", "u15", "u13"] as ClassKey[]).filter(k => k !== own).slice(0, 3);
}
export const demoClubTeamId = (k: number): string => "demo-t" + (k + 2);
export function demoClubTeamName(cls: ClassKey, lang: Lang): string {
  const c = classDef(cls); return c.team ? c.team[lang] : cls.toUpperCase();
}

/** Daten eines weiteren Teams (k = 0, 1, 2): eigene Spielernamen, Gegner, Trainer und Spieltag */
export function demoClubTeam(base: Pick<Team, "club" | "accent" | "logo" | "depth">, cls: ClassKey, k: number, lang: Lang, now: Date, me: { id: string; name: string }): TeamData {
  const youth = classDef(cls).grp !== "akt";
  const settings = { ...defaultSettings(), spieltag: youth ? 6 : 0, anstoss: youth ? ["11:00", "13:00", "12:30"][k % 3] : "15:00" };
  const team: Team = { ...demoTeam(cls, base.depth, lang, { club: base.club, team: demoClubTeamName(cls, lang), accent: base.accent, logo: base.logo || null, settings }),
    id: demoClubTeamId(k), clubId: DEMO_CLUB, joinCode: "DEMO-T" + (k + 2) + "SP", staffCode: "DEMO-T" + (k + 2) + "TR" };
  const D = buildDemo(team, lang, now);
  // eigene Namen (keine Doppelungen mit dem eigenen Team), eigene Gegner
  const r = rng(101 + k * 17), f = [...FIRST], l = [...LAST];
  for (let i = f.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [f[i], f[j]] = [f[j], f[i]]; }
  for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  D.players.forEach((p, i) => { p.vn = f[i % f.length]; p.nn = l[(i + k) % l.length]; });
  D.matches.forEach((m, i) => { if (m.comp === "liga") m.gegner = OPP[(i + k * 4) % OPP.length]; });
  demoExtras(D, lang, now);
  // eigene Ergebnisse: Gegentore je Team neu würfeln (eigene Tore passen weiter zu den Torschützen), Gegentore der Torhüter angleichen
  const rr = rng(55 + k * 13);
  for (const m of D.matches) if (m.result) {
    m.result = { own: m.result.own, opp: Math.floor(rr() * 4) };
    for (const [pid, x] of Object.entries(D.stats[m.id] || {})) if (D.players.find(p => p.id === pid)?.pos === "TW") x.conceded = x.min >= 85 ? m.result.opp : Math.round(m.result.opp * x.min / 90);
  }
  // Trainerteam: eigene Namen; das Demo-Konto ist hier Funktionär (Zugriff über den Verein)
  const names = COACHES[k % COACHES.length];
  D.staff = D.staff.map((x, i) => ({ ...x, name: names[i] || x.name, userId: null }));
  for (const c of D.contacts) {
    if (c.role === "trainer") { c.name = names[1]; c.org = (lang === "en" ? "Assistant coach " : "Co-Trainer ") + team.name; }
    if (c.role === "physio") c.name = names[3];
  }
  D.notes = {};
  if (D.team.modules.chat !== false) {
    demoChat(D, lang, now, "demo-" + D.staff[0].id);
    D.chatPeople.push({ uid: me.id, name: me.name, kind: "staff", pid: null, role: null });
  }
  return D;
}

/** Funktionäre des Demo-Vereins (das Demo-Konto ist Vereinsadmin) */
export function demoClubStaff(me: { id: string; name: string }, lang: Lang, youthTeams: string[]): ClubStaffEntry[] {
  const en = lang === "en";
  return [
    { userId: me.id, role: "admin", title: "", perms: [...CLUB_PERMS.admin], teams: null, displayName: me.name },
    { userId: "demo-off-1", role: "leiter", title: en ? "Head of football" : "Sportlicher Leiter", perms: [...CLUB_PERMS.leiter], teams: null, displayName: "Sabine Krause" },
    { userId: "demo-off-2", role: "nlz", title: en ? "Youth director" : "Jugendleitung", perms: [...CLUB_PERMS.nlz], teams: youthTeams, displayName: "Dirk Hoffmann" },
    { userId: "demo-off-3", role: "pending", title: "", perms: [], teams: null, displayName: "Marco Lehmann" },
  ];
}
