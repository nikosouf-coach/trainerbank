// Seiten der Website trainerstab.app. Inhalte in einfachem HTML; Rahmen, Kopf und Sicherheitsangaben setzt build.mjs.
// Anbieter und Kontakt kommen aus src/data/site.json (dieselbe Quelle wie die App).

/** HTML-Sonderzeichen maskieren */
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const PATH_P = "„Ich → Konto, Einwilligungen &amp; Datenschutz“";
const PATH_S = "„Mehr → Konto &amp; Datenschutz“";

/** Installationslinks (Testversion bzw. Stores) aus site.json – oder der Hinweis, dass das Trainerteam sie schickt */
function installBlock(site, du = true) {
  const { ios, android } = site.install || {};
  const ask = du ? "Den Link bekommst du von deinem Trainerteam." : "Den Link bekommen Sie vom Trainerteam.";
  const tile = (name, url, sub) => url
    ? `<a href="${esc(url)}" rel="noopener"><strong>${name}</strong><span>${sub}</span></a>`
    : `<div><strong>${name}</strong><span>${ask}</span></div>`;
  return `<div class="install" id="installieren">${tile("iPhone", ios, "Testversion über TestFlight")}${tile("Android", android, "Test bei Google Play")}</div>`;
}

const week = `
<figure class="week" aria-label="Beispielwoche: Belastung je Tag in einer Woche mit Spiel am Samstag">
  <div class="head"><strong>Woche mit Spiel am Samstag</strong><span>Belastung je Tag (AU)</span></div>
  <div class="bars" aria-hidden="true">
    <div class="bar rest"></div>
    <div class="bar"><span class="au">420</span></div>
    <div class="bar"><span class="au">520</span></div>
    <div class="bar"><span class="au">360</span></div>
    <div class="bar light"><span class="au">150</span></div>
    <div class="bar match"><span class="au">750</span></div>
    <div class="bar light"><span class="au">90</span></div>
  </div>
  <div class="days" aria-hidden="true">
    <div><b>Mo</b><span>frei</span></div><div><b>Di</b><span>MD−4</span></div><div><b>Mi</b><span>MD−3</span></div>
    <div><b>Do</b><span>MD−2</span></div><div><b>Fr</b><span>MD−1</span></div><div><b>Sa</b><span>MD</span></div><div><b>So</b><span>MD+1</span></div>
  </div>
  <figcaption class="foot">
    <span class="key"><i></i>Training</span><span class="key"><i class="light"></i>locker</span><span class="key"><i class="match"></i>Spiel</span>
    <span>AU = Anstrengung (RPE 0–10) × Minuten</span>
  </figcaption>
</figure>`;

export function pages(site, cfg) {
  const P = site.publisher, M = esc(site.email);
  const mail = `<a href="mailto:${M}">${M}</a>`;
  const supa = cfg.supabaseUrl ? { url: cfg.supabaseUrl, key: cfg.supabaseKey } : null;

  // Weiterleitung der Links aus Bestätigungs- und Passwort-E-Mails, falls Supabase sie auf die Startseite schickt
  const forward = `(function(){var h=location.hash,q=location.search;var p=new URLSearchParams((h||"").slice(1));var s=new URLSearchParams(q||"");
if(p.get("type")==="recovery"){location.replace("/passwort"+h);return;}
if(p.get("access_token")||p.get("error")||p.get("error_description")||s.get("error_description")){location.replace("/bestaetigt"+q+h);}})();`;

  const index = {
    file: "index.html", path: "/", title: "Trainerstab – Training planen, Belastung steuern",
    description: "Die App für Trainerteams im Fußball: Training planen, Belastung mit Session-RPE steuern und das Team organisieren. Server in der EU, keine Werbung, kein Tracking.",
    scripts: [forward],
    body: `
<section class="hero">
  <div>
    <h1>Training planen. Belastung steuern. Team organisieren.</h1>
    <p class="lead">Trainerstab ist die App für Trainerteams im Fußball – von der U7 bis zu den Senioren. Deine Spieler tragen nach dem Training ein, wie anstrengend es war, und du siehst sofort, wer mehr Erholung braucht und wer mehr kann.</p>
    <div class="status"><span class="pill">Pilotphase</span><span>Wir testen die App gerade mit ersten Teams. Interesse? ${mail}</span></div>
  </div>
  ${week}
</section>
<section class="section">
  <h2>Was die App kann</h2>
  <div class="cols">
    <div><h3>Für das Trainerteam</h3><ul class="plain">
      <li>Wochenplan vom nächsten Spiel aus gedacht – mit Aufbau- und Entlastungswochen</li>
      <li>Belastung je Einheit mit Session-RPE, im Wochenverlauf und akut im Vergleich zu chronisch</li>
      <li>Hinweise, wer Erholung braucht – mit Erholungszeiten für neun Altersstufen</li>
      <li>Kader fürs Spiel mit Zu- und Absagen, Fahrgemeinschaften und Anwesenheit</li>
      <li>Team-Chat statt WhatsApp-Gruppe, mit Kinderschutz für Jugendteams</li>
    </ul></div>
    <div><h3>Für Spielerinnen und Spieler</h3><ul class="plain">
      <li>Mit dem Team-Code beitreten</li>
      <li>Teamkalender und Wochenplan immer dabei</li>
      <li>Nach dem Training in Sekunden eintragen, wie anstrengend es war</li>
      <li>Morgens kurz: Schlaf, Müdigkeit, Muskelkater, Stress</li>
      <li>Persönliche Tipps zu Erholung und Belastung</li>
    </ul></div>
    <div><h3>Für Eltern</h3><ul class="plain">
      <li>Eltern-Zugang mit einem Code vom Trainerteam</li>
      <li>Termine, Abmeldungen und Nominierung des eigenen Kindes</li>
      <li>Keine Gesundheitsdetails, keine Chats, keine Daten anderer Kinder</li>
    </ul></div>
  </div>
</section>
<section class="section">
  <h2>Datenschutz von Anfang an</h2>
  <div class="facts">
    <div><strong>Server in Frankfurt</strong><p>Die Daten liegen in der EU.</p></div>
    <div><strong>Nur die eigenen Daten</strong><p>Spieler sehen nie die Werte ihrer Mitspieler.</p></div>
    <div><strong>Gesundheitsdaten nur mit Einwilligung</strong><p>Unter 16 Jahren willigen die Eltern ein.</p></div>
    <div><strong>Keine Werbung, kein Tracking</strong><p>Und kein Verkauf von Daten.</p></div>
  </div>
  <p class="more"><a href="/datenschutz">Datenschutzerklärung lesen</a></p>
</section>
<section class="section">
  <h2>Fachlich fundiert</h2>
  <p class="note">Die Methoden beruhen auf etablierten sportwissenschaftlichen Ansätzen, etwa Session-RPE nach Foster et al. (2001) und dem Wellness-Fragebogen nach Hooper und Mackinnon (1995). Trainerstab ist ein Werkzeug zur Trainingsorganisation und kein Medizinprodukt: Die App stellt keine Diagnosen und ersetzt keine ärztliche oder physiotherapeutische Beurteilung.</p>
</section>`,
  };

  const impressum = {
    file: "impressum.html", path: "/impressum", title: "Impressum – Trainerstab",
    description: "Anbieterkennzeichnung für die App Trainerstab und die Website trainerstab.app.",
    body: `
<div class="page-head"><h1>Impressum</h1></div>
<div class="doc">
  <h2>Angaben gemäß § 5 DDG</h2>
  <address class="address">${esc(P.name)}<br>${esc(P.business)}<br>${esc(P.street)}<br>${esc(P.postcode)} ${esc(P.city)}<br>${esc(P.country)}</address>
  <h2>Kontakt</h2>
  <dl class="facts-list"><dt>E-Mail</dt><dd>${mail}</dd>${P.phone ? `<dt>Telefon</dt><dd>${esc(P.phone)}</dd>` : ""}</dl>
  ${P.vatId ? `<h2>Umsatzsteuer-ID</h2><p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: ${esc(P.vatId)}</p>` : ""}
  <h2>Verbraucherstreitbeilegung</h2>
  <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
  <h2>Datenschutz</h2>
  <p>Wie wir mit Daten umgehen, steht in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
</div>`,
  };

  const loeschen = {
    file: "konto-loeschen.html", path: "/konto-loeschen", title: "Konto löschen – Trainerstab",
    description: "So löschst du dein Konto in der App Trainerstab – in der App oder per E-Mail, auch ohne App.",
    body: `
<div class="page-head"><h1>Konto löschen</h1><p>So löschst du dein Konto in der App Trainerstab von ${esc(P.name)} – mit allen Daten, die zu dir gehören.</p></div>
<div class="doc">
  <h2>In der App</h2>
  <p>Am schnellsten geht es direkt in der App; das Konto ist danach sofort gelöscht.</p>
  <ul>
    <li>Spielerinnen und Spieler: ${PATH_P} → „Konto löschen“</li>
    <li>Eltern im Eltern-Zugang: „Konto, Einwilligungen &amp; Datenschutz“ → „Konto löschen“</li>
    <li>Trainerteam: ${PATH_S} → „Konto löschen“</li>
  </ul>
  <h2>Ohne App</h2>
  <p>Schreib eine E-Mail an ${mail} mit dem Betreff „Konto löschen“ – bitte von der E-Mail-Adresse, mit der du registriert bist. So stellen wir sicher, dass niemand fremde Konten löschen lässt; falls nötig, fragen wir nach. Wir löschen das Konto unverzüglich, spätestens innerhalb eines Monats, und bestätigen dir die Löschung.</p>
  <h2>Was gelöscht wird</h2>
  <ul>
    <li>dein Konto mit E-Mail-Adresse und Passwort</li>
    <li>dein Spielerprofil mit allen Gesundheitsdaten (Belastung, Morgen-Check, Beschwerden, Verletzungen, Hinweise für den Notfall)</li>
    <li>deine Einträge, Einwilligungen in der App, Push-Token und Rückmeldungen</li>
  </ul>
  <p>Teamdaten, die nicht dir zugeordnet sind (z. B. der Kalender), bleiben für dein Team erhalten. Löscht ein Trainer sein Konto, bleibt das Team für das übrige Trainerteam bestehen; war er das letzte Mitglied, wird das Team mit allen Daten gelöscht – gehört es zu einem Verein, übernimmt stattdessen ein Vereinsadmin.</p>
  <h2>Was bleibt</h2>
  <ul>
    <li>Nachweise über erteilte Einwilligungen ohne Bezug zum Konto (die E-Mail-Adresse nur verschlüsselt als Hash): 3 Jahre, weil wir Einwilligungen nachweisen müssen</li>
    <li>Datensicherungen: gelöschte Daten können bis zu 7 Tage darin verbleiben und werden dann überschrieben</li>
    <li>Server-Protokolle: bis zu 7 Tage</li>
  </ul>
  <h2>Nur einzelne Daten löschen</h2>
  <p>Du musst nicht gleich das ganze Konto löschen: Widerrufst du unter ${PATH_P} die Einwilligung in Gesundheitsdaten, werden diese innerhalb von 30 Tagen gelöscht. Einzelne Angaben kann auch dein Trainerteam löschen. Alles Weitere steht in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
</div>`,
  };

  const hilfe = {
    file: "hilfe.html", path: "/hilfe", title: "Hilfe – Trainerstab",
    description: "Antworten auf häufige Fragen zur App Trainerstab: Installation, Team beitreten, Passwort, Eltern-Zugang, Datenschutz und Kontakt.",
    body: `
<div class="page-head"><h1>Hilfe</h1><p>Antworten auf häufige Fragen. Nicht dabei? Schreib uns an ${mail}.</p></div>
<div class="doc faq">
  <details><summary>Wie bekomme ich die App?</summary><div>
    <p>Während der Testphase gibt es Trainerstab über TestFlight (iPhone) und einen Test bei Google Play (Android).</p>
    ${installBlock(site)}
  </div></details>
  <details><summary>Wie trete ich meinem Team bei?</summary><div>
    <p>Registriere dich in der App und bestätige deine E-Mail-Adresse. Danach gibst du den Team-Code ein, den dir dein Trainerteam gibt – oder du öffnest den Einladungslink bzw. scannst den QR-Code. Ein eigenes Konto gibt es ab 13 Jahren; jüngere Spieler trägt das Trainerteam selbst ein.</p>
  </div></details>
  <details><summary>Ich habe keine Bestätigungs-E-Mail bekommen.</summary><div>
    <p>Schau im Spam- bzw. Werbung-Ordner nach und prüfe, ob die E-Mail-Adresse richtig geschrieben ist. Kommt nach zehn Minuten nichts, schreib uns an ${mail}.</p>
  </div></details>
  <details><summary>Ich habe mein Passwort vergessen.</summary><div>
    <p>Tippe in der App bei der Anmeldung auf „Passwort vergessen?“. Du bekommst eine E-Mail mit einem Link; darüber setzt du auf dieser Website ein neues Passwort und meldest dich danach in der App wieder an.</p>
  </div></details>
  <details><summary>Ich bin jünger als 16.</summary><div>
    <p>Dann muss ein Elternteil zustimmen, dass du die App nutzt und deine Angaben zu Belastung und Gesundheit gespeichert werden. Beim Beitreten gibst du dafür die E-Mail-Adresse deiner Eltern an. Mit dem Eltern-Zugang können deine Eltern die Einwilligung auch selbst in der App geben.</p>
  </div></details>
  <details><summary>Wer sieht meine Daten?</summary><div>
    <p>Du siehst nur deine eigenen Daten, deine Mitspieler sehen sie nicht. Dein Trainerteam sieht die Daten aller Spieler im Team. Gesundheitsdaten speichert die App nur mit deiner Einwilligung. Alles Weitere steht in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
  </div></details>
  <details><summary>Wie lösche ich mein Konto?</summary><div>
    <p>In der App unter ${PATH_P} (Trainerteam: ${PATH_S}) → „Konto löschen“ – oder ohne App wie unter <a href="/konto-loeschen">Konto löschen</a> beschrieben.</p>
  </div></details>
  <details><summary>Ich bin Elternteil. Wie funktioniert der Eltern-Zugang?</summary><div>
    <p>Sie bekommen vom Trainerteam einen Code für Ihr Kind. Installieren Sie die App, registrieren Sie sich, wählen Sie „Ich bin Elternteil“ und geben Sie den Code ein. Sobald das Trainerteam die Verknüpfung bestätigt hat, sehen Sie Termine, Abmeldungen und Nominierungen Ihres Kindes – keine Gesundheitsdetails und keine Chats.</p>
  </div></details>
  <details><summary>Wie erreiche ich euch?</summary><div>
    <p>Per E-Mail an ${mail}. Bitte schick uns keine Gesundheitsdaten per E-Mail. Fehler und Wünsche kannst du auch direkt in der App unter „Feedback / Fehler melden“ schicken.</p>
  </div></details>
</div>`,
  };

  // ---------- Einladungen ----------
  const invite = (kind) => {
    const K = {
      join: {
        title: "Einladung in dein Team", lead: "Mit diesem Code trittst du deinem Team in der App Trainerstab bei.",
        steps: ["App installieren (siehe unten).", "In der App registrieren und die E-Mail-Adresse bestätigen.", "Hier auf „In der App öffnen“ tippen – oder in der App den Code eingeben."],
        re: "^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$", len: 8, du: true,
        bad: "Dieser Link enthält keinen gültigen Team-Code. Bitte frag dein Trainerteam nach einem neuen Link.",
      },
      "staff-join": {
        title: "Einladung ins Trainerteam", lead: "Mit diesem Code trittst du dem Trainerteam bzw. deinem Verein in der App Trainerstab bei.",
        steps: ["App installieren (siehe unten).", "In der App registrieren und die E-Mail-Adresse bestätigen.", "Hier auf „In der App öffnen“ tippen – oder in der App unter „Als Trainer oder Funktionär beitreten“ den Code eingeben."],
        re: "^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$", len: 8, du: true,
        bad: "Dieser Link enthält keinen gültigen Code. Bitte frag nach einem neuen Link.",
      },
      "parent-link": {
        title: "Eltern-Zugang für Ihr Kind", lead: "Mit diesem Code verknüpfen Sie Ihr Konto in der App Trainerstab mit Ihrem Kind. Sobald das Trainerteam die Verknüpfung bestätigt hat, sehen Sie Termine, Abmeldungen und Nominierungen Ihres Kindes.",
        steps: ["App installieren (siehe unten).", "In der App registrieren und die E-Mail-Adresse bestätigen.", "„Ich bin Elternteil“ wählen und den Code eingeben – oder hier auf „In der App öffnen“ tippen."],
        re: "^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$", len: 10, du: false,
        bad: "Dieser Link enthält keinen gültigen Eltern-Code. Bitte fragen Sie das Trainerteam nach einem neuen Code. Ein Code gilt 14 Tage.",
      },
    }[kind];
    const half = K.len / 2;
    const js = `(function(){var KIND=${JSON.stringify(kind)},RE=new RegExp(${JSON.stringify(K.re)}),LEN=${K.len},HALF=${half};
function clean(r){if(!r)return null;var c=String(r).toUpperCase().replace(/[^A-Z0-9]/g,"");var s=c.length===LEN?c.slice(0,HALF)+"-"+c.slice(HALF):"";return RE.test(s)?s:null;}
var code=clean(new URLSearchParams(location.search).get("code"));
var ok=document.getElementById("ok"),bad=document.getElementById("bad");
if(!code){bad.hidden=false;return;}
ok.hidden=false;document.getElementById("code").textContent=code;
var q="?code="+encodeURIComponent(code),deep="trainerstab://"+KIND+q;
var a=document.getElementById("open");
if(/Android/i.test(navigator.userAgent)){var fb=location.origin+location.pathname+q+"#installieren";a.href="intent://"+KIND+q+"#Intent;scheme=trainerstab;package=app.trainerstab;S.browser_fallback_url="+encodeURIComponent(fb)+";end";}else{a.href=deep;}
var b=document.getElementById("copy"),done=function(){b.textContent=${JSON.stringify(K.du ? "Code kopiert" : "Code kopiert")};setTimeout(function(){b.textContent="Code kopieren";},2500);};
b.hidden=false;b.addEventListener("click",function(){var c=document.getElementById("code");
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(code).then(done,function(){sel(c);});}else{sel(c);}});
function sel(el){var r=document.createRange();r.selectNodeContents(el);var s=window.getSelection();s.removeAllRanges();s.addRange(r);}})();`;
    return {
      file: kind + ".html", path: "/" + kind, title: K.title + " – Trainerstab", noindex: true,
      description: K.lead, scripts: [js],
      body: `
<div class="page-head"><h1>${esc(K.title)}</h1><p>${esc(K.lead)}</p></div>
<div class="panel" id="ok" hidden>
  <p class="label">${K.du ? "Dein Code" : "Ihr Code"}</p>
  <p class="code" id="code"></p>
  <div class="actions"><a class="btn primary" id="open" href="#">In der App öffnen</a><button class="btn ghost" id="copy" type="button" hidden>Code kopieren</button></div>
  <p class="hint">${K.du ? "Passiert nichts? Dann ist die App noch nicht installiert – oder du gibst den Code in der App von Hand ein." : "Passiert nichts? Dann ist die App noch nicht installiert – oder Sie geben den Code in der App von Hand ein."}</p>
</div>
<div class="panel" id="bad" hidden><p>${esc(K.bad)}</p></div>
<noscript><div class="panel"><p>${K.du ? "Gib den Code aus deinem Einladungslink in der App ein." : "Geben Sie den Code aus dem Einladungslink in der App ein."}</p></div></noscript>
<div class="doc">
  <h2>So geht es</h2>
  <ol class="steps">${K.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
  <h2>App installieren</h2>
  ${installBlock(site, K.du)}
  <p class="hint">${K.du ? "Fragen? Schreib uns an" : "Fragen? Schreiben Sie uns an"} ${mail}.</p>
</div>`,
    };
  };

  // ---------- E-Mail bestätigt ----------
  const confirmJs = `(function(){var CFG=${JSON.stringify(supa)};var h=location.hash,q=location.search;
var p=new URLSearchParams((h||"").slice(1)),s=new URLSearchParams(q||"");
if(h||q){try{history.replaceState(null,"",location.pathname);}catch(e){}}
if(p.get("type")==="recovery"){location.replace("/passwort"+h);return;}
var code=p.get("error_code")||s.get("error_code"),err=p.get("error")||s.get("error")||p.get("error_description")||s.get("error_description");
var show=function(id){document.getElementById(id).hidden=false;};
if(err){show(code==="otp_expired"?"expired":"failed");return;}
var at=p.get("access_token");
if(at||p.get("type")){show("done");
if(at&&CFG){fetch(CFG.url+"/auth/v1/logout?scope=local",{method:"POST",headers:{apikey:CFG.key,Authorization:"Bearer "+at}}).catch(function(){});}
return;}
show("plain");})();`;
  const bestaetigt = {
    file: "bestaetigt.html", path: "/bestaetigt", title: "E-Mail bestätigt – Trainerstab", noindex: true,
    description: "Bestätigung der E-Mail-Adresse für die App Trainerstab.", scripts: [confirmJs], connect: true,
    body: `
<div class="page-head"><h1>E-Mail-Adresse bestätigen</h1></div>
<div class="panel" id="done" hidden>
  <p class="msg ok">Deine E-Mail-Adresse ist bestätigt.</p>
  <p class="hint">Öffne jetzt die App Trainerstab und melde dich mit deiner E-Mail-Adresse und deinem Passwort an.</p>
  <div class="actions"><a class="btn primary" href="trainerstab://">App öffnen</a></div>
</div>
<div class="panel" id="expired" hidden>
  <p class="msg err">Der Link ist abgelaufen oder wurde schon benutzt.</p>
  <p class="hint">Melde dich in der App an. Ist die Adresse schon bestätigt, klappt die Anmeldung; sonst registriere dich erneut oder schreib uns an ${mail}.</p>
</div>
<div class="panel" id="failed" hidden>
  <p class="msg err">Die Bestätigung hat nicht geklappt.</p>
  <p class="hint">Öffne den Link aus der E-Mail noch einmal. Klappt es weiter nicht, schreib uns an ${mail}.</p>
</div>
<div class="panel" id="plain" hidden>
  <p>Hier landest du, wenn du den Link aus der Bestätigungs-E-Mail öffnest. Danach meldest du dich in der App an.</p>
</div>
<noscript><div class="panel"><p>Öffne die App Trainerstab und melde dich an.</p></div></noscript>`,
  };

  // ---------- Neues Passwort ----------
  const pwJs = `(function(){var CFG=${JSON.stringify(supa)};var h=location.hash;var p=new URLSearchParams((h||"").slice(1));
if(h){try{history.replaceState(null,"",location.pathname);}catch(e){}}
var show=function(id){document.getElementById(id).hidden=false;},hide=function(id){document.getElementById(id).hidden=true;};
if(!CFG){show("off");return;}
if(p.get("error")||p.get("error_code")){show(p.get("error_code")==="otp_expired"?"expired":"failed");return;}
var at=p.get("access_token");
if(!at||p.get("type")!=="recovery"){show("plain");return;}
show("set");var f=document.getElementById("pwform"),m=document.getElementById("pwmsg"),btn=document.getElementById("pwbtn");
var say=function(t,ok){m.textContent=t;m.className="msg "+(ok?"ok":"err");m.hidden=false;};
f.addEventListener("submit",function(ev){ev.preventDefault();var a=f.elements.pw1.value,b=f.elements.pw2.value;
if(a.length<8){say("Das Passwort muss mindestens 8 Zeichen haben.");return;}
if(a!==b){say("Die beiden Passwörter stimmen nicht überein.");return;}
btn.disabled=true;m.hidden=true;
fetch(CFG.url+"/auth/v1/user",{method:"PUT",headers:{apikey:CFG.key,Authorization:"Bearer "+at,"Content-Type":"application/json"},body:JSON.stringify({password:a})})
.then(function(r){return r.json().catch(function(){return {};}).then(function(j){return {r:r,j:j};});})
.then(function(x){if(x.r.ok){hide("set");show("saved");
fetch(CFG.url+"/auth/v1/logout?scope=local",{method:"POST",headers:{apikey:CFG.key,Authorization:"Bearer "+at}}).catch(function(){});return;}
var c=String(x.j.error_code||x.j.code||"");btn.disabled=false;
if(c==="same_password"){say("Das neue Passwort muss sich vom bisherigen unterscheiden.");}
else if(c==="weak_password"||x.r.status===422){say("Das Passwort ist zu schwach. Nimm ein längeres oder weniger gebräuchliches.");}
else if(x.r.status===401||x.r.status===403){hide("set");show("expired");}
else{say("Das hat nicht geklappt. Bitte versuch es noch einmal.");}})
.catch(function(){btn.disabled=false;say("Keine Verbindung. Bitte prüf dein Internet und versuch es noch einmal.");});});})();`;
  const passwort = {
    file: "passwort.html", path: "/passwort", title: "Neues Passwort – Trainerstab", noindex: true,
    description: "Neues Passwort für die App Trainerstab festlegen.", scripts: [pwJs], connect: true,
    body: `
<div class="page-head"><h1>Neues Passwort</h1></div>
<div class="panel" id="set" hidden>
  <p>Leg ein neues Passwort für dein Konto fest – mindestens 8 Zeichen.</p>
  <form class="pw" id="pwform" novalidate>
    <label>Neues Passwort<input name="pw1" type="password" autocomplete="new-password" minlength="8" required></label>
    <label>Passwort wiederholen<input name="pw2" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="actions"><button class="btn primary" id="pwbtn" type="submit">Passwort speichern</button></div>
  </form>
  <p class="msg" id="pwmsg" hidden role="status"></p>
</div>
<div class="panel" id="saved" hidden>
  <p class="msg ok">Dein neues Passwort ist gespeichert.</p>
  <p class="hint">Öffne die App Trainerstab und melde dich mit dem neuen Passwort an.</p>
  <div class="actions"><a class="btn primary" href="trainerstab://">App öffnen</a></div>
</div>
<div class="panel" id="expired" hidden>
  <p class="msg err">Der Link ist abgelaufen oder wurde schon benutzt.</p>
  <p class="hint">Fordere in der App bei der Anmeldung über „Passwort vergessen?“ einen neuen Link an. Er gilt eine Stunde.</p>
</div>
<div class="panel" id="failed" hidden>
  <p class="msg err">Der Link funktioniert nicht.</p>
  <p class="hint">Fordere in der App über „Passwort vergessen?“ einen neuen Link an. Klappt es weiter nicht, schreib uns an ${mail}.</p>
</div>
<div class="panel" id="plain" hidden>
  <p>Hier setzt du ein neues Passwort, nachdem du in der App auf „Passwort vergessen?“ getippt und den Link aus der E-Mail geöffnet hast.</p>
</div>
<div class="panel" id="off" hidden>
  <p>Das Zurücksetzen über die Website ist noch nicht eingerichtet. Schreib uns an ${mail} – wir helfen dir weiter.</p>
</div>
<noscript><div class="panel"><p>Für diese Seite muss JavaScript eingeschaltet sein. Alternativ schreib uns an ${mail}.</p></div></noscript>`,
  };

  const notFound = {
    file: "404.html", path: "/404", title: "Seite nicht gefunden – Trainerstab", noindex: true,
    description: "Diese Seite gibt es nicht.",
    body: `
<div class="page-head"><h1>Seite nicht gefunden</h1><p>Diese Adresse gibt es auf trainerstab.app nicht. Zur <a href="/">Startseite</a>, zur <a href="/hilfe">Hilfe</a> oder schreib uns an ${mail}.</p></div>`,
  };

  return [index, impressum, loeschen, hilfe, invite("join"), invite("staff-join"), invite("parent-link"), bestaetigt, passwort, notFound];
}
