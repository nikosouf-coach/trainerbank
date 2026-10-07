// Spielplan-Import: Kalenderdatei (.ics) oder kopierter Text (z. B. von fussball.de).
import { pad } from "./dates";

export interface ParsedFixture { date: string; zeit: string; gegner: string; heim: boolean; comp: "liga" | "pokal" }

/**
 * @param text   Inhalt der .ics-Datei oder kopierter Spielplan (eine Zeile pro Spiel: Datum, Uhrzeit, "Heim - Gast")
 * @param club   eigener Vereinsname (zur Erkennung Heim/Auswärts)
 * @param team   eigene Mannschaftsbezeichnung (z. B. "U19")
 * @param defaultTime Anstoßzeit, wenn keine Uhrzeit erkannt wird
 */
export function parseFixtures(text: string, club: string, team: string, defaultTime: string): ParsedFixture[] {
  const out: ParsedFixture[] = [];
  const own = (club + " " + team).toLowerCase(), ownV = club.toLowerCase();
  const side = (a: string, b: string): { gegner: string; heim: boolean } => {
    const A = a.toLowerCase(), B = b.toLowerCase();
    if ((ownV && A.includes(ownV)) || own.includes(A)) return { gegner: b.trim(), heim: true };
    if ((ownV && B.includes(ownV)) || own.includes(B)) return { gegner: a.trim(), heim: false };
    return { gegner: a.trim() + " – " + b.trim(), heim: true };
  };
  if (/BEGIN:VEVENT/.test(text)) {
    text.split("BEGIN:VEVENT").slice(1).forEach(ev => {
      const dt = ev.match(/DTSTART[^:]*:(\d{8})(T(\d{2})(\d{2}))?/) || [], su = (ev.match(/SUMMARY[^:]*:(.*)/) || [])[1];
      if (!dt[1] || !su) return;
      const d = dt[1].slice(0, 4) + "-" + dt[1].slice(4, 6) + "-" + dt[1].slice(6, 8);
      const parts = su.replace(/\\,/g, ",").trim().split(/\s+[-–]\s+|\s+vs\.?\s+/i); if (parts.length < 2) return;
      out.push({ date: d, zeit: dt[3] ? dt[3] + ":" + dt[4] : defaultTime, comp: /pokal/i.test(su) ? "pokal" : "liga", ...side(parts[0], parts[1]) });
    });
  } else {
    text.split(/\n+/).forEach(line => {
      const dm = line.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/); if (!dm) return;
      const y = dm[3].length === 2 ? "20" + dm[3] : dm[3], d = y + "-" + pad(+dm[2]) + "-" + pad(+dm[1]), tm = line.match(/(\d{1,2}):(\d{2})/);
      const rest = line.replace(dm[0], "").replace(tm ? tm[0] : "", "").replace(/^[^A-Za-zÄÖÜäöü0-9]*(Mo|Di|Mi|Do|Fr|Sa|So)\b,?/, "").replace(/\|/g, " ").trim();
      const parts = rest.split(/\s+[-–:]\s+|\s+vs\.?\s+/i).map(x => x.trim()).filter(Boolean); if (parts.length < 2) return;
      out.push({ date: d, zeit: tm ? pad(+tm[1]) + ":" + tm[2] : defaultTime, comp: /pokal/i.test(line) ? "pokal" : "liga", ...side(parts[0], parts[parts.length - 1]) });
    });
  }
  return out;
}
