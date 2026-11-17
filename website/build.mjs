// Baut die Website trainerstab.app nach website/dist (Aufruf: node website/build.mjs).
// - Datenschutzerklärung aus docs/DATENSCHUTZERKLAERUNG.md, ohne interne Hinweise und Prüfhinweise; der Build bricht ab,
//   wenn noch Platzhalter in eckigen Klammern stehen oder Anbieter und Kontakt nicht zu src/data/site.json passen.
// - Alle übrigen Seiten aus website/pages.mjs. Keine externen Schriften, Skripte oder Bilder; jede Seite trägt eine
//   Content-Security-Policy mit den Prüfsummen ihrer eigenen Skripte.
// Optional (für die Seiten „E-Mail bestätigt“ und „Neues Passwort“): EXPO_PUBLIC_SUPABASE_URL und
// EXPO_PUBLIC_SUPABASE_ANON_KEY – dieselben öffentlichen Werte wie in der App (GitHub-Variablen, nicht geheim).
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "./vendor/marked.esm.js";
import { esc, pages } from "./pages.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = path.join(here, "dist");
const site = JSON.parse(fs.readFileSync(path.join(root, "src/data/site.json"), "utf8"));
const SITE = site.url.replace(/\/+$/, "");
const fail = msg => { console.error("FEHLER: " + msg); process.exit(1); };

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const supabaseKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();
if (supabaseUrl && !/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(supabaseUrl)) fail("EXPO_PUBLIC_SUPABASE_URL ist keine gültige https-Adresse");
if (supabaseUrl && !supabaseKey) fail("EXPO_PUBLIC_SUPABASE_ANON_KEY fehlt");
if (supabaseKey && /^sb_secret_|service_role/i.test(supabaseKey)) fail("Das ist ein geheimer Schlüssel – nur den Publishable key (sb_publishable_…) verwenden");
const cfg = { supabaseUrl, supabaseKey };

// ---------- Datenschutzerklärung ----------
function privacyMarkdown() {
  const src = fs.readFileSync(path.join(root, "docs/DATENSCHUTZERKLAERUNG.md"), "utf8").replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  const keep = [];
  let skipSection = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // „Hinweise zur Bearbeitung“ bis zur nächsten Trennlinie bzw. Überschrift
    if (/^#{2,3} Hinweise zur Bearbeitung/.test(l)) { skipSection = true; continue; }
    if (skipSection) { if (/^---\s*$/.test(l) || /^#{1,3} /.test(l)) skipSection = false; else continue; }
    // interne Zitatblöcke (Prüfhinweise, Hinweis zur internen Fassung) samt folgender Leerzeile
    if (/^> \*\*(Prüfhinweis|Interne Fassung|ENTWURF|DRAFT)/.test(l)) {
      while (i < lines.length && lines[i].startsWith(">")) i++;
      if (i < lines.length && lines[i].trim() === "") continue;
      i--; continue;
    }
    keep.push(l);
  }
  let md = keep.join("\n").replace(/\n{3,}/g, "\n\n");
  // Titel kommt aus dem Seitenkopf
  md = md.replace(/^# .*\n+/, "");
  // Prüfungen: keine Platzhalter, keine internen Hinweise, Anbieter wie in site.json
  const outside = md.replace(/`[^`]*`/g, "");
  const ph = outside.match(/\[[^\]\n]+\](?!\()/g);
  if (ph) fail("Platzhalter in der Datenschutzerklärung: " + [...new Set(ph)].join(", "));
  if (/Prüfhinweis|ENTWURF|zu prüfen/i.test(md)) fail("Interner Hinweis in der Datenschutzerklärung: " + (md.match(/.{0,40}(Prüfhinweis|ENTWURF|zu prüfen).{0,40}/i) || [""])[0]);
  for (const v of [site.publisher.name, site.publisher.street, `${site.publisher.postcode} ${site.publisher.city}`, site.email])
    if (!md.includes(v)) fail(`Datenschutzerklärung nennt „${v}“ nicht (src/data/site.json)`);
  return md;
}

function slug(text) {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss")
    .replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "abschnitt";
}

function privacyPage() {
  const md = privacyMarkdown();
  const toc = [], used = new Set();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        let id = slug(html); while (used.has(id)) id += "-2"; used.add(id);
        if (depth === 2) toc.push({ id, html });
        return `<h${depth} id="${id}">${html}</h${depth}>\n`;
      },
    },
  });
  let html = marked.parse(md);
  html = html.replace(/<table>/g, '<div class="table"><table>').replace(/<\/table>/g, "</table></div>");
  html = html.replace(/<thead>\s*<tr>\s*(<th>\s*<\/th>\s*)+<\/tr>\s*<\/thead>/g, "");   // leere Kopfzeile (Stand/Version)
  const en = toc.find(t => /^english/i.test(slug(t.html)));
  if (en) {
    const at = html.indexOf(`<h2 id="${en.id}">`);
    html = html.slice(0, at) + '<section lang="en">' + html.slice(at) + "</section>";
  }
  const nav = `<details class="toc"><summary>Inhalt</summary><ul>${toc.map(t => `<li><a href="#${t.id}">${t.html}</a></li>`).join("")}</ul></details>`;
  return {
    file: "datenschutz.html", path: "/datenschutz", title: "Datenschutzerklärung – Trainerstab",
    description: "Wie die App Trainerstab und die Website trainerstab.app mit personenbezogenen Daten umgehen.",
    body: `<div class="page-head"><h1>Datenschutzerklärung</h1></div>${nav}<div class="doc">${html}</div>`,
  };
}

// ---------- Rahmen ----------
const markSvg = `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="8.5" fill="#0d6b4b"/><path d="M6.425 8.25H19.125V9.75A6.25 6.25 0 0 0 14.205 12.15H6.425A1.3 1.3 0 0 1 5.125 10.85V9.55A1.3 1.3 0 0 1 6.425 8.25Z" fill="#fff"/><circle cx="19.125" cy="16" r="6.25" fill="none" stroke="#fff" stroke-width="3"/><circle cx="19.125" cy="16" r="1.6" fill="#fff"/></svg>`;
const sha = s => "'sha256-" + createHash("sha256").update(s, "utf8").digest("base64") + "'";

function layout(p) {
  const scripts = p.scripts || [];
  const csp = [
    "default-src 'none'", "style-src 'self'", "img-src 'self' data:",
    scripts.length ? "script-src " + scripts.map(sha).join(" ") : "script-src 'none'",
    p.connect && supabaseUrl ? `connect-src ${supabaseUrl}` : "connect-src 'none'",
    "base-uri 'none'", "form-action 'none'",
  ].join("; ");
  const url = SITE + (p.path === "/" ? "/" : p.path);
  const cur = h => (p.path === h ? ' aria-current="page"' : "");
  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
${p.noindex ? '<meta name="robots" content="noindex">\n' : `<link rel="canonical" href="${url}">\n`}<meta name="theme-color" content="#f2f4f3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d1110" media="(prefers-color-scheme: dark)">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="de_DE">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<a class="skip" href="#inhalt">Zum Inhalt</a>
<header class="top"><div class="wrap">
  <a class="brand" href="/" aria-label="Trainerstab – Startseite">${markSvg}<span>trainer<b>stab</b></span></a>
  <nav class="top" aria-label="Hauptnavigation"><a href="/hilfe"${cur("/hilfe")}>Hilfe</a><a href="/datenschutz"${cur("/datenschutz")}>Datenschutz</a></nav>
</div></header>
<main id="inhalt"><div class="wrap${p.path === "/" ? "" : " narrow"}">
${p.body.trim()}
</div></main>
<footer class="bottom"><div class="wrap">
  <span>© ${year} ${esc(site.publisher.name)}</span>
  <nav aria-label="Rechtliches und Hilfe"><a href="/hilfe">Hilfe</a><a href="/datenschutz">Datenschutz</a><a href="/impressum">Impressum</a><a href="/konto-loeschen">Konto löschen</a></nav>
</div></footer>
${scripts.map(s => `<script>${s}</script>`).join("\n")}
</body>
</html>
`;
}

// ---------- Ausgabe ----------
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const all = [...pages(site, cfg), privacyPage()];
const seen = new Set();
for (const p of all) {
  if (seen.has(p.file)) fail("doppelte Seite " + p.file);
  seen.add(p.file);
  const html = layout(p);
  if (/\[(?:E-Mail|Herausgeber|Anschrift|Telefon|Pfad|TT\.MM)/.test(html)) fail("Platzhalter in " + p.file);
  fs.writeFileSync(path.join(out, p.file), html);
}
for (const f of fs.readdirSync(path.join(here, "static"))) fs.copyFileSync(path.join(here, "static", f), path.join(out, f));
fs.writeFileSync(path.join(out, "robots.txt"), `User-agent: *\nAllow: /\n`);
// GitHub Pages (Branch gh-pages): eigene Domain aus site.json, Dateien ohne Jekyll ausliefern
fs.writeFileSync(path.join(out, "CNAME"), new URL(SITE).host + "\n");
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log(`Website gebaut: ${all.length} Seiten in ${path.relative(root, out)}` + (supabaseUrl ? " (mit Supabase für Bestätigung und Passwort)" : " (ohne Supabase: Passwort-Seite zeigt Kontakt)"));
