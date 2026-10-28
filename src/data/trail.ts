// Zuletzt geöffnete Seiten (nur im Speicher, nie gespeichert): Rückmeldungen und Absturzberichte nennen damit die Seite,
// auf der etwas passiert ist. IDs (Spieler, Spiele, Pläne …) werden durch „:id“ ersetzt.
const MAX = 5;
let trail: string[] = [];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
/** Pfad ohne IDs (UUIDs, Demo-, Offline- und vorläufige IDs) und höchstens 200 Zeichen lang */
export const cleanPath = (p: string): string =>
  (p || "").split("?")[0].replace(UUID, ":id").replace(/(^|\/)(?:demo|tmp|c)-[\w-]+/g, "$1:id").slice(0, 200);

/** Seite merken (die Rückmeldung selbst zählt nicht) */
export function notePath(p: string): string | null {
  const c = cleanPath(p);
  if (!c || c === "/" || c === "/feedback") return null; // „/“ leitet nur weiter
  if (trail[trail.length - 1] !== c) trail = [...trail, c].slice(-MAX);
  return c;
}
/** Menüs, über die man nur zur Rückmeldung kommt – sagen nichts über die Stelle, an der etwas passiert ist */
const MENUS = new Set(["/coach/mehr", "/player/ich", "/konto"]);
/** Weg zur Rückmeldung: die letzten Seiten (höchstens drei, ohne Menüs am Ende), z. B. „/coach/plan › /coach/tag/:id“ */
export function lastPage(): string | null {
  const L = [...trail];
  while (L.length > 1 && MENUS.has(L[L.length - 1])) L.pop();
  return L.length ? L.slice(-3).join(" › ").slice(0, 200) : null;
}
