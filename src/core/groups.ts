// Gruppen: Arten mit Wirkung auf die Steuerung, Vorschläge und automatische Mitglieder-Vorschläge.
import type { Engine } from "./engine";
import type { GroupKind, Player, TeamGroup } from "./types";

export interface GroupKindDef { kind: GroupKind; vis: boolean; steer: boolean }
/** Reihenfolge = Reihenfolge der Vorschläge */
export const GROUP_KINDS: GroupKindDef[] = [
  { kind: "reha", vis: true, steer: true },
  { kind: "tw", vis: true, steer: true },
  { kind: "build", vis: true, steer: true },
  { kind: "growth", vis: false, steer: true },
  { kind: "lead", vis: true, steer: false },
  { kind: "talent", vis: false, steer: false },
  { kind: "custom", vis: false, steer: false },
];
export const kindDef = (k: GroupKind | undefined): GroupKindDef => GROUP_KINDS.find(x => x.kind === (k || "custom")) || GROUP_KINDS[GROUP_KINDS.length - 1];

/** Gruppen eines Spielers */
export const groupsOf = (groups: TeamGroup[] | undefined, p: Player): TeamGroup[] => (groups || []).filter(g => (p.groups || []).includes(g.id));
/** Hat der Spieler eine Gruppe dieser Art? */
export const inKind = (groups: TeamGroup[] | undefined, p: Player, k: GroupKind): boolean => groupsOf(groups, p).some(g => (g.kind || "custom") === k);
/** Mitglieder einer Gruppe */
export const membersOf = (players: Player[], gid: string): Player[] => players.filter(p => (p.groups || []).includes(gid));

/** Vorschlag, wer in eine Gruppe dieser Art gehört (aus vorhandenen Daten). */
export function suggestMembers(E: Engine, kind: GroupKind): string[] {
  const P = E.D.players;
  switch (kind) {
    case "tw": return P.filter(p => p.pos === "TW").map(p => p.id);
    case "reha": return P.filter(p => { const a = E.injuryOf(p.id); return (a && a.typ === "verletzung") || !!E.returning(p.id); }).map(p => p.id);
    case "build": return P.filter(p => { const m = E.metrics(p.id); return !!E.returning(p.id) || p.neu || (m != null && m.days < 21); }).map(p => p.id);
    case "growth": return P.filter(p => E.growthInfo(p.id)?.spurt).map(p => p.id);
    default: return [];
  }
}
