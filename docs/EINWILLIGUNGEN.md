# Einwilligungstexte in der App – Trainerbank

> **ENTWURF – vor Veröffentlichung anwaltlich prüfen lassen.**
> Die Texte sind Formulierungsvorschläge. Sie müssen zur endgültigen Datenschutzerklärung
> (`docs/DATENSCHUTZERKLAERUNG.md`), zum gewählten Rollenmodell (Herausgeber allein verantwortlich oder Verein
> verantwortlich) und zur tatsächlichen Umsetzung in der App passen.

Platzhalter: [Herausgeber], [E-Mail], [Datenschutz-URL], [Nutzungsbedingungen-URL], [Vorname des Kindes],
[Pfad zum Widerruf], [Tageslimit]. Wörter in eckigen Klammern, die mit „falls“ beginnen, nur übernehmen, wenn die
Funktion umgesetzt ist.

---

## 0. Überblick und Regeln für die Umsetzung

### 0.1 Welche Einwilligung wer sieht

| Kürzel | Inhalt | Wer sieht sie | Pflicht? | `consents.kind` | Version (Vorschlag) |
|---|---|---|---|---|---|
| (a) | Kenntnisnahme Datenschutzerklärung [und Annahme der Nutzungsbedingungen] | alle bei der Registrierung | ja | `privacy` | `privacy-1.0` |
| (b) | ausdrückliche Einwilligung Gesundheitsdaten (Art. 9 DSGVO) | Spieler ab 16 nach Teambeitritt | **empfohlen: freiwillig** (ohne Einwilligung sind Gesundheitsfunktionen gesperrt) | `health_data` | `health-1.0` |
| (c) | Einwilligung der Erziehungsberechtigten (Art. 8 DSGVO), umfasst (a) und (b) für das Kind, optional (d) | Spieler unter 16 nach Teambeitritt | ja für die Nutzung durch das Kind | `parental` (+ `parent_email`) | `parental-1.0` |
| (d) | Einwilligung KI-Coach | alle, beim ersten Öffnen des KI-Coachs | freiwillig | **neu: `ai_coach`** | `ai-1.0` |
| (e) | Vertraulichkeitszusage Trainerteam (empfohlen) | Staff bei Team-Anlage bzw. Beitritt mit Staff-Code | ja für Staff | **neu: `staff_confidentiality`** | `staff-1.0` |

### 0.2 Ablauf

```
Trainerteam:  Registrierung → (a) → Team anlegen / Staff-Code → (e) → App
                                                       KI-Coach öffnen → (d)

Spieler ≥ 16: Registrierung → (a) → Team-Code + Name + Geburtsdatum → Altersprüfung
              → (b) [freiwillig] → App;  KI-Coach öffnen → (d)

Spieler < 16: Registrierung → (a) → Team-Code + Name + Geburtsdatum → Altersprüfung
              → Hinweis an das Kind → (c) durch Erziehungsberechtigte (inkl. E-Mail, optional KI)
              → [falls umgesetzt: Bestätigungs-E-Mail; bis zur Bestätigung keine Gesundheitsdaten] → App
```

Das Alter wird erst beim Teambeitritt bekannt (Geburtsdatum in `join_team`). Deshalb müssen (b) und (c) **nach** dem
Beitritt und **vor** der ersten Speicherung von Gesundheitsdaten abgefragt werden.

### 0.3 Pflichtregeln für die Oberfläche

1. Keine vorausgewählten Kästchen. Jede Einwilligung hat ein eigenes Kästchen; nicht mit anderen Erklärungen bündeln.
2. Neben dem Kästchen steht die **Kurzfassung** (höchstens zwei Sätze), darunter der Link „Mehr lesen“ bzw.
   „Read more“, der die **Langfassung** öffnet. Die Links auf Datenschutzerklärung und Nutzungsbedingungen müssen
   funktionieren, auch ohne Anmeldung.
3. Der Bestätigungsknopf benennt die Handlung, z. B. „Einwilligen und weiter“ – nicht nur „OK“.
4. Bei freiwilligen Einwilligungen gibt es einen gleichwertig sichtbaren Weg ohne Einwilligung („Ohne Gesundheitsdaten
   fortfahren“, „Nicht jetzt“).
5. Gespeichert wird je Einwilligung: Konto, Art, Version, Zeitpunkt, bei (c) die E-Mail-Adresse der
   Erziehungsberechtigten (siehe Anhang A für empfohlene Zusatzfelder).
6. Der Widerruf muss so einfach sein wie die Erteilung (Art. 7 Abs. 3 DSGVO): ein Bildschirm in der App, auf dem alle
   Einwilligungen mit Datum stehen und einzeln widerrufen werden können.
7. Ändert sich ein Text inhaltlich, erhält er eine neue Version; Nutzer werden beim nächsten Öffnen erneut gefragt.
8. Alle veröffentlichten Textversionen werden archiviert (Nachweis, welcher Wortlaut wann gezeigt wurde).
9. Sprache: Es wird die Fassung in der App-Sprache angezeigt (DE oder EN).

---

## (a) Datenschutzerklärung und Nutzungsbedingungen

### Deutsch

**Kurzfassung (Kästchen):**
> Ich akzeptiere die [Nutzungsbedingungen] und habe die [Datenschutzerklärung] gelesen.

**Langfassung (Mehr lesen):**
> **So gehen wir mit deinen Daten um**
>
> Trainerbank ist eine App für Fußballteams. Wir – [Herausgeber] – verarbeiten deine Daten, damit du und dein Team
> die App nutzen könnt: dein Konto (E-Mail-Adresse, Anzeigename, Sprache), deine Teamzugehörigkeit und, wenn du
> Spieler bist, Name, Geburtsdatum, Position und Rückennummer.
>
> - Spieler sehen nur ihre eigenen Daten. Das Trainerteam deines Teams sieht die Daten aller Spieler im Team.
> - Die Daten liegen auf Servern in der EU (Frankfurt).
> - Keine Werbung, kein Tracking, kein Verkauf von Daten.
> - Für Gesundheitsdaten (z. B. Belastung, Wohlbefinden, Verletzungen) und den KI-Coach fragen wir dich gesondert.
> - Du kannst deine Daten in der App exportieren und dein Konto jederzeit löschen.
>
> Alle Einzelheiten – Zwecke, Rechtsgrundlagen, Dienstleister, Speicherdauer und deine Rechte – stehen in der
> [Datenschutzerklärung]. Die Regeln für die Nutzung der App stehen in den [Nutzungsbedingungen].

### English

**Short version (checkbox):**
> I accept the [Terms of Use] and have read the [Privacy Policy].

**Long version (Read more):**
> **How we handle your data**
>
> Trainerbank is an app for football teams. We – [Herausgeber] – process your data so that you and your team can use
> the app: your account (e-mail address, display name, language), your team membership and, if you are a player, your
> name, date of birth, position and shirt number.
>
> - Players only see their own data. Your team's coaching staff see the data of all players in the team.
> - Data is stored on servers in the EU (Frankfurt, Germany).
> - No advertising, no tracking, no sale of data.
> - We ask you separately before processing health data (e.g. training load, wellness, injuries) and before you use
>   the AI coach.
> - You can export your data in the app and delete your account at any time.
>
> All details – purposes, legal bases, service providers, retention and your rights – are in the [Privacy Policy].
> The rules for using the app are in the [Terms of Use].

> **Prüfhinweis:** Die Kenntnisnahme der Datenschutzerklärung ist keine Einwilligung und sollte auch nicht so
> formuliert werden. Alternative ohne Kästchen: „Mit der Registrierung akzeptierst du die Nutzungsbedingungen. Wie wir
> deine Daten verarbeiten, erklärt unsere Datenschutzerklärung.“ Die Nutzungsbedingungen existieren noch nicht und
> müssen erstellt werden (inkl. Hinweis „kein Medizinprodukt“). Wirksamkeit der Annahme durch Minderjährige prüfen
> (§§ 106 ff. BGB); für unter 16-Jährige umfasst (c) die Zustimmung der Eltern.

---

## (b) Ausdrückliche Einwilligung in die Verarbeitung von Gesundheitsdaten (Art. 9 DSGVO)

### Deutsch

**Kurzfassung (Kästchen):**
> Ich willige ausdrücklich ein, dass meine Gesundheitsdaten (Belastung, Wohlbefinden, Beschwerden, Krankheit,
> Verletzungen, Größe, Gewicht) zur Trainings- und Belastungssteuerung verarbeitet und dem Trainerteam meines Teams
> angezeigt werden. Die Einwilligung ist freiwillig und jederzeit in der App widerrufbar.

Knöpfe: **„Einwilligen und weiter“** · **„Ohne Gesundheitsdaten fortfahren“**

**Langfassung (Mehr lesen):**
> **Einwilligung in die Verarbeitung deiner Gesundheitsdaten**
>
> **Welche Daten?** Dein Belastungsempfinden nach Training und Spiel (RPE) und die Dauer; dein morgendliches
> Wohlbefinden (Schlafdauer, Schlafqualität, Müdigkeit, Muskelkater, Stress, Beschwerden und betroffene
> Körperregionen mit Angaben zum Schmerz wie Stärke, Art und Beginn); Zusatzsport; Körpergröße und Gewicht; Abwesenheiten wegen Krankheit oder Verletzung mit
> Rückkehrstufe, verletzter Körperregion und Notiz; deine Zugehörigkeit zu Gruppen wie „Reha“, „Belastungsaufbau“ oder
> „Wachstumsschub“; sowie die daraus berechneten Werte (z. B. Belastungsverlauf, Ampel, Erholungsstatus, dein
> persönliches Belastungsziel, Reha-Plan und Tipps). Die Einwilligung gilt auch für solche Angaben, die das Trainerteam
> für dich einträgt.
>
> **Wozu?** Damit dein Trainerteam Training, Belastung und Erholung an dich anpassen kann – zum Beispiel nach einem
> intensiven Spiel, bei einer stufenweisen Rückkehr nach einer Verletzung oder in Wachstumsphasen.
>
> **Wer sieht die Daten?** Du selbst und die Mitglieder des Trainerteams deines Teams, denen der Cheftrainer das Recht
> „Gesundheitsdaten“ gegeben hat (z. B. Co-Trainer, Physio – Befunde nur mit eigenem Recht). Mitspieler, ein Kassenwart
> und andere Nutzer sehen sie nicht.
>
> **Wo?** Auf Servern unseres Dienstleisters Supabase in Frankfurt (EU). An den KI-Coach werden Gesundheitsdaten nur
> übermittelt, wenn du dafür gesondert einwilligst.
>
> **Wie lange?** Bis du die Einwilligung widerrufst oder dein Konto löschst, spätestens 24 Monate nach deiner letzten
> Aktivität in der App.
>
> **Freiwillig.** Ohne Einwilligung kannst du die App weiter nutzen (Kalender, Wochenplan, Nachrichten, Abwesenheiten
> ohne Gesundheitsangaben). Die Eingabe von Belastung, Wohlbefinden, Zusatzsport und Körperdaten ist dann gesperrt.
> Deine Teilnahme an Training und Spielen darf nicht von der Einwilligung abhängen. Ohne Einwilligung gibt es auch
> keine Strafen oder Dienste wegen fehlender Einträge.
>
> **Kein Medizinprodukt.** Trainerbank stellt keine Diagnosen und gibt keine Therapieempfehlungen. Bei Schmerzen,
> Krankheit oder Verletzung wende dich an eine Ärztin oder einen Arzt.
>
> **Widerruf.** Du kannst die Einwilligung jederzeit unter [Pfad zum Widerruf] widerrufen. Danach werden keine neuen
> Gesundheitsdaten erfasst und deine gespeicherten Gesundheitsdaten gelöscht. Was bis zum Widerruf verarbeitet wurde,
> bleibt rechtmäßig.
>
> Verantwortlich: [Herausgeber], [E-Mail]. Mehr in der [Datenschutzerklärung].

### English

**Short version (checkbox):**
> I explicitly consent to my health data (training load, wellness, complaints, illness, injuries, height, weight)
> being processed for training and load management and shown to my team's coaching staff. This consent is voluntary
> and can be withdrawn in the app at any time.

Buttons: **"Consent and continue"** · **"Continue without health data"**

**Long version (Read more):**
> **Consent to the processing of your health data**
>
> **What data?** Your perceived exertion after training and matches (RPE) and the duration; your morning wellness
> (sleep hours, sleep quality, fatigue, muscle soreness, stress, complaints and affected body regions with pain details
> such as intensity, character and onset); extra sport;
> height and weight; absences due to illness or injury with return-to-play stage, injured body region and note; your
> membership in groups such as "rehab", "load build-up" or "growth spurt"; and the values calculated from them (e.g.
> load trend, traffic light, recovery status, your personal load target, rehab plan and tips). This consent also
> covers such data entered for you by the coaching staff.
>
> **Why?** So that your coaching staff can adapt training, load and recovery to you – for example after an intense
> match, during a gradual return after an injury, or during growth phases.
>
> **Who sees it?** You and those members of your team's coaching staff whom the head coach has given the "health data"
> permission (e.g. assistant coach, physio – findings only with their own permission). Team-mates, a treasurer and other
> users do not.
>
> **Where?** On servers of our service provider Supabase in Frankfurt (EU). Health data is only sent to the AI coach
> if you give separate consent.
>
> **How long?** Until you withdraw consent or delete your account, at the latest 24 months after your last activity in
> the app.
>
> **Voluntary.** Without consent you can still use the app (calendar, weekly plan, messages, absences without health
> details). Entering load, wellness, extra sport and body data is then disabled. Your participation in training and
> matches must not depend on this consent. Without consent there are no fines or duties for missing entries either.
>
> **Not a medical device.** Trainerbank does not diagnose or recommend treatment. If you have pain, illness or an
> injury, please see a doctor.
>
> **Withdrawal.** You can withdraw consent at any time under [path]. No new health data will be recorded and your
> stored health data will be deleted. Processing before withdrawal remains lawful.
>
> Controller: [Herausgeber], [E-Mail]. More in the [Privacy Policy].

---

## (c) Einwilligung der Erziehungsberechtigten (Spieler unter 16)

### Deutsch

**Hinweis an das Kind (vor dem Eltern-Bildschirm):**
> **Fast geschafft!** Du bist jünger als 16. Damit du Trainerbank nutzen kannst, muss ein Elternteil zustimmen. Gib
> dein Gerät bitte kurz deiner Mutter, deinem Vater oder einer anderen sorgeberechtigten Person.

Knopf: **„Meine Eltern sind da“**

**Eltern-Bildschirm** (Anrede „Sie“):

Überschrift: **Einwilligung für [Vorname des Kindes]**

Eingabefeld (Pflicht): **E-Mail-Adresse eines Erziehungsberechtigten**
Hinweistext unter dem Feld: *An diese Adresse senden wir [falls umgesetzt: einen Bestätigungslink und] Informationen
zum Widerruf. Sie wird nur für diese Einwilligung verwendet.*

**Kästchen 1 – Pflicht, Kurzfassung:**
> Ich bin erziehungsberechtigt für [Vorname des Kindes] und willige ein, dass mein Kind Trainerbank nutzt und seine
> Gesundheitsdaten (Belastung, Wohlbefinden, Beschwerden, Krankheit, Verletzungen, Größe, Gewicht) zur
> Trainingssteuerung verarbeitet und dem Trainerteam angezeigt werden. Ich kann die Einwilligung jederzeit
> widerrufen; [falls umgesetzt: eine Bestätigung geht an die angegebene E-Mail-Adresse].

**Kästchen 2 – freiwillig, Kurzfassung:**
> Optional: Ich willige außerdem ein, dass mein Kind den KI-Coach nutzt und dabei seine Fragen mit Vorname, Alter und
> Trainingsdaten an den KI-Anbieter Anthropic in den USA übermittelt werden.

Knöpfe: **„Einwilligen“** · **„Abbrechen“**

**Langfassung (Mehr lesen):**
> **Information und Einwilligung für Erziehungsberechtigte**
>
> Ihr Kind möchte Trainerbank nutzen, eine App, mit der das Trainerteam seiner Mannschaft Training, Spiele und
> Belastung plant. Weil Ihr Kind jünger als 16 Jahre ist, benötigen wir Ihre Einwilligung (Art. 8 DSGVO).
>
> **Was Ihr Kind in der App tut:** Es sieht den Teamkalender und den Wochenplan, meldet Abwesenheiten, liest
> Nachrichten des Trainerteams und kann eintragen, wie anstrengend ein Training war und wie es sich morgens fühlt.
>
> **Welche Daten:** Konto (E-Mail-Adresse, Anzeigename), Vor- und Nachname, Geburtsdatum, Position, Rückennummer,
> optional Foto und Gewicht. Außerdem **Gesundheitsdaten**: Belastungsempfinden und Trainingsminuten, Schlaf,
> Müdigkeit, Muskelkater, Stress, Beschwerden und betroffene Körperregionen, Zusatzsport, Körpergröße und Gewicht,
> Abwesenheiten wegen Krankheit oder Verletzung mit Rückkehrstufe und verletzter Körperregion, Zugehörigkeit zu
> Gruppen wie „Reha“ oder „Wachstumsschub“ sowie daraus berechnete Werte. Die Einwilligung gilt
> auch für solche Angaben, die das Trainerteam für Ihr Kind einträgt.
>
> **Wer sieht die Daten:** Ihr Kind und das Trainerteam seiner Mannschaft (Trainer, Co-Trainer, Physio). Mitspieler
> sehen keine Daten Ihres Kindes. Nachrichten in der App kommen nur vom Trainerteam der eigenen Mannschaft.
>
> **Wo und wie lange:** Auf Servern in Frankfurt (EU), bis zum Widerruf oder zur Löschung des Kontos, Gesundheitsdaten
> spätestens 24 Monate nach der letzten Aktivität. Keine Werbung, kein Tracking, kein Verkauf von Daten.
>
> **Kein Medizinprodukt:** Die App stellt keine Diagnosen und gibt keine Therapieempfehlungen.
>
> **KI-Coach (optional, Kästchen 2):** Wenn Sie zustimmen, kann Ihr Kind Fragen an einen KI-Coach stellen. Die Frage
> wird mit Vorname, Alter und Trainingsdaten über unseren Server an Anthropic (USA) übermittelt; Nachname,
> Geburtsdatum, E-Mail-Adresse und Foto werden nicht übermittelt. KI-Antworten können fehlerhaft sein. Ohne Ihre
> Zustimmung bleibt der KI-Coach für Ihr Kind gesperrt; alle anderen Funktionen sind davon nicht betroffen.
>
> **Ihre E-Mail-Adresse** speichern wir als Nachweis der Einwilligung und um Sie bei Bedarf zu kontaktieren.
> [Falls umgesetzt: Sie erhalten eine E-Mail mit einem Bestätigungslink. Bis Sie bestätigen, werden keine
> Gesundheitsdaten Ihres Kindes gespeichert.]
>
> **Freiwilligkeit und Widerruf:** Die Einwilligung ist freiwillig. Sie können sie jederzeit mit Wirkung für die
> Zukunft widerrufen – per E-Mail an [E-Mail] [oder über den Link in der Bestätigungs-E-Mail]. Ihr Kind kann den
> Widerruf auch in der App unter [Pfad zum Widerruf] erklären. Gespeicherte Gesundheitsdaten werden dann gelöscht.
> Sie können für Ihr Kind Auskunft, Berichtigung, Löschung und eine Kopie der Daten verlangen.
>
> **Mit 16 Jahren** [falls umgesetzt: bitten wir Ihr Kind, die Einwilligungen selbst zu bestätigen].
>
> Bitte erteilen Sie diese Einwilligung nur, wenn Sie für das Kind sorgeberechtigt sind.
>
> Verantwortlich: [Herausgeber], [Anschrift], [E-Mail]. Mehr in der [Datenschutzerklärung].

### English

**Notice to the child:**
> **Almost done!** You are younger than 16. A parent needs to agree before you can use Trainerbank. Please hand your
> device to your mum, dad or another person with parental responsibility for a moment.

Button: **"My parent is here"**

**Parent screen:** Heading **Consent for [child's first name]**

Input (required): **E-mail address of a parent or guardian**
Helper text: *We will send [if implemented: a confirmation link and] information on withdrawal to this address. It is
used only for this consent.*

**Checkbox 1 – required, short version:**
> I have parental responsibility for [child's first name] and consent to my child using Trainerbank and to their
> health data (training load, wellness, complaints, illness, injuries, height, weight) being processed for training
> management and shown to the coaching staff. I can withdraw this consent at any time; [if implemented: a confirmation
> will be sent to the e-mail address provided].

**Checkbox 2 – optional, short version:**
> Optional: I also consent to my child using the AI coach, whereby their questions are sent together with first name,
> age and training data to the AI provider Anthropic in the USA.

Buttons: **"Consent"** · **"Cancel"**

**Long version (Read more):**
> **Information and consent for parents and guardians**
>
> Your child would like to use Trainerbank, an app the coaching staff of their team use to plan training, matches and
> training load. Because your child is under 16, we need your consent (Art. 8 GDPR).
>
> **What your child does in the app:** views the team calendar and weekly plan, reports absences, reads messages from
> the coaching staff, and can record how hard a session was and how they feel in the morning.
>
> **Which data:** account (e-mail address, display name), first and last name, date of birth, position, shirt number,
> optional photo and weight. Also **health data**: perceived exertion and training minutes, sleep, fatigue, muscle
> soreness, stress, complaints and affected body regions, extra sport, height and weight, absences due to illness or
> injury with return-to-play stage and injured body region, membership in groups such as "rehab" or "growth spurt",
> and values calculated from these. The consent also covers such data entered for
> your child by the coaching staff.
>
> **Who sees it:** your child and their team's coaching staff (coach, assistant coach, physio). Team-mates never see
> your child's data. In-app messages only come from the coaching staff of the child's own team.
>
> **Where and how long:** on servers in Frankfurt (EU), until consent is withdrawn or the account is deleted; health
> data at the latest 24 months after the last activity. No advertising, no tracking, no sale of data.
>
> **Not a medical device:** the app does not diagnose or recommend treatment.
>
> **AI coach (optional, checkbox 2):** if you agree, your child can ask an AI coach questions. The question is sent
> via our server together with first name, age and training data to Anthropic (USA); surname, date of birth, e-mail
> address and photo are not sent. AI answers can be wrong. Without your consent the AI coach stays disabled for your
> child; all other features are unaffected.
>
> **Your e-mail address** is stored as proof of consent and to contact you if needed. [If implemented: you will
> receive an e-mail with a confirmation link. No health data of your child is stored until you confirm.]
>
> **Voluntary, withdrawal:** consent is voluntary. You can withdraw it at any time with effect for the future – by
> e-mail to [E-Mail] [or via the link in the confirmation e-mail]. Your child can also withdraw in the app under
> [path]. Stored health data will then be deleted. You can request access, rectification, erasure and a copy of the
> data on behalf of your child.
>
> **At 16** [if implemented: we will ask your child to confirm the consents themselves].
>
> Please only give this consent if you have parental responsibility for the child.
>
> Controller: [Herausgeber], [Anschrift], [E-Mail]. More in the [Privacy Policy].

### Vorlage: Bestätigungs-E-Mail an Erziehungsberechtigte (empfohlen, noch nicht umgesetzt)

**Deutsch**

```
Betreff: Bitte bestätigen: Einwilligung für [Vorname des Kindes] in Trainerbank

Guten Tag,

über die App Trainerbank wurde soeben eine Einwilligung für [Vorname des Kindes] erteilt, damit
[er/sie] die App des Teams [Teamname] nutzen kann. Dabei wurde diese E-Mail-Adresse als Adresse
eines Erziehungsberechtigten angegeben.

Erteilt wurde:
- Nutzung der App und Verarbeitung von Gesundheitsdaten zur Trainingssteuerung: ja
- Nutzung des KI-Coachs: [ja/nein]

Bitte bestätigen Sie die Einwilligung:  [Bestätigungslink]
Falls Sie diese Einwilligung nicht erteilt haben oder sie widerrufen möchten:  [Ablehnen/Widerrufen-Link]

Ohne Bestätigung innerhalb von [7] Tagen werden keine Gesundheitsdaten von [Vorname des Kindes]
gespeichert [und die Einwilligung verfällt].

Was wir verarbeiten und welche Rechte Sie haben: [Datenschutz-URL]
Fragen: [E-Mail]

[Herausgeber], [Anschrift]
```

**English**

```
Subject: Please confirm: consent for [child's first name] in Trainerbank

Hello,

A consent was just given in the Trainerbank app so that [child's first name] can use the app of the
team [team name]. This e-mail address was entered as the address of a parent or guardian.

Consent given for:
- using the app and processing health data for training management: yes
- using the AI coach: [yes/no]

Please confirm the consent:  [confirmation link]
If you did not give this consent or want to withdraw it:  [decline/withdraw link]

If not confirmed within [7] days, no health data of [child's first name] will be stored
[and the consent will lapse].

What we process and your rights: [Datenschutz-URL]
Questions: [E-Mail]

[Herausgeber], [Anschrift]
```

> **Prüfhinweis:**
> 1. Ohne Bestätigungs-E-Mail kann ein Kind eine beliebige Adresse eintragen. Art. 8 Abs. 2 DSGVO verlangt
>    „angemessene Anstrengungen“ zur Überprüfung – ein Bestätigungslink (Double-Opt-in) wird dringend empfohlen.
>    Zusätzlich prüfen: Adresse darf nicht der Konto-Adresse des Kindes entsprechen.
> 2. Gemeinsames Sorgerecht: Ob die Zustimmung eines Elternteils genügt (z. B. als Angelegenheit des täglichen
>    Lebens, § 1687 BGB), ist zu prüfen.
> 3. Klären, ob für Kinder unter dem Mindestalter für eigene Konten überhaupt eine Registrierung möglich sein soll.

---

## (d) Einwilligung KI-Coach

Wird beim ersten Öffnen des KI-Coachs gezeigt, getrennt von (b). Für Spieler unter 16 gilt stattdessen Kästchen 2 in
(c); fehlt es, bleibt der KI-Coach gesperrt.

### Deutsch

**Kurzfassung für Spieler (Kästchen):**
> Ich willige ausdrücklich ein, dass meine Fragen an den KI-Coach mit Vorname, Alter und Trainingsdaten (auch
> Gesundheitsdaten wie Belastung und Wohlbefinden) an Anthropic in den USA übermittelt und dort zur Erstellung der
> Antwort verarbeitet werden – auch wenn mein Trainerteam den KI-Coach zu mir befragt. Die Einwilligung ist freiwillig
> und jederzeit widerrufbar.

**Kurzfassung für das Trainerteam (Kästchen):**
> Ich willige ein, dass meine Fragen an den KI-Coach an Anthropic in den USA übermittelt und dort zur Erstellung der
> Antwort verarbeitet werden. Daten meiner Spieler werden nur einbezogen, wenn diese bzw. ihre Eltern selbst
> eingewilligt haben.

Knöpfe: **„Einwilligen und KI-Coach öffnen“** · **„Nicht jetzt“**

**Langfassung (Mehr lesen):**
> **Einwilligung zur Nutzung des KI-Coachs**
>
> Der KI-Coach beantwortet Fragen zu Training, Belastung und Erholung. Er nutzt ein KI-Modell (Claude) des Anbieters
> Anthropic. Die Antworten werden von einer KI erzeugt und in der App entsprechend gekennzeichnet.
>
> **Was übermittelt wird:** der Text deiner Frage und ein reduzierter Kontext: Vorname, Alter in Jahren und
> passende Trainingsdaten (z. B. Belastung, Trainingsminuten, [Wohlbefindenswerte], Spieltagsbezug). Diese
> Trainingsdaten können Gesundheitsdaten sein. **Nicht** übermittelt werden Nachname, Geburtsdatum, E-Mail-Adresse,
> Foto, [Vereins- und Teamname] und Trainernotizen. Schreib bitte keine weiteren persönlichen Angaben in deine
> Frage.
>
> **Wohin:** Die Anfrage läuft über unseren Server in Frankfurt zu Anthropic in die USA. Anthropic verarbeitet die
> Daten in unserem Auftrag, um die Antwort zu erzeugen. [Rechtsgrundlage der Übermittlung laut Prüfung eintragen,
> z. B. EU-US Data Privacy Framework oder Standardvertragsklauseln.] [Variante, falls für die Übermittlung keine
> Angemessenheitsentscheidung greift: In den USA besteht möglicherweise kein dem EU-Recht gleichwertiges
> Datenschutzniveau; insbesondere können US-Behörden unter Umständen auf Daten zugreifen, ohne dass dir wirksame
> Rechtsbehelfe zur Verfügung stehen.]
>
> **Speicherung:** Wir speichern deine Fragen und die Antworten [nicht dauerhaft], nur die Anzahl deiner Anfragen pro
> Tag (Tageslimit: [Tageslimit]). Beim Anbieter: [Aufbewahrungsdauer laut Vertrag]; die Daten werden [laut Vertrag
> nicht zum Training von KI-Modellen verwendet].
>
> **Trainerteam:** Wenn dein Trainerteam den KI-Coach zu dir oder zum Team befragt, werden deine Daten nur einbezogen,
> wenn du hier eingewilligt hast.
>
> **Grenzen:** KI-Antworten können unvollständig oder falsch sein und sind keine medizinische Beratung. Besprich
> Änderungen am Training mit deinem Trainerteam und bei Beschwerden mit einer Ärztin oder einem Arzt.
>
> **Freiwillig und widerrufbar:** Ohne Einwilligung kannst du alle anderen Funktionen nutzen. Du kannst die
> Einwilligung jederzeit unter [Pfad zum Widerruf] widerrufen; danach ist der KI-Coach für dich gesperrt und es
> werden keine Daten mehr an Anthropic übermittelt.
>
> Verantwortlich: [Herausgeber], [E-Mail]. Mehr in der [Datenschutzerklärung], Abschnitt „KI-Coach“.

### English

**Short version for players (checkbox):**
> I explicitly consent to my questions to the AI coach being sent with my first name, age and training data
> (including health data such as load and wellness) to Anthropic in the USA and processed there to generate the
> answer – including when my coaching staff ask the AI coach about me. This consent is voluntary and can be withdrawn
> at any time.

**Short version for coaching staff (checkbox):**
> I consent to my questions to the AI coach being sent to Anthropic in the USA and processed there to generate the
> answer. My players' data is only included if they or their parents have consented themselves.

Buttons: **"Consent and open AI coach"** · **"Not now"**

**Long version (Read more):**
> **Consent to using the AI coach**
>
> The AI coach answers questions about training, load and recovery. It uses an AI model (Claude) from the provider
> Anthropic. Answers are generated by AI and labelled as such in the app.
>
> **What is sent:** the text of your question and a reduced context: first name, age in years and relevant training
> data (e.g. load, training minutes, [wellness values], match-day reference). This training data may be health data.
> **Not** sent: surname, date of birth, e-mail address, photo, [club and team name] and coach notes. Please do not
> add other personal details to your question.
>
> **Where to:** the request goes via our server in Frankfurt to Anthropic in the USA. Anthropic processes the data on
> our behalf to generate the answer. [Insert transfer mechanism after verification, e.g. EU-US Data Privacy Framework
> or Standard Contractual Clauses.] [Variant if no adequacy decision applies: the USA may not offer a level of data
> protection equivalent to EU law; in particular, US authorities may be able to access data without effective legal
> remedies being available to you.]
>
> **Storage:** we do not [permanently] store your questions or the answers, only the number of requests per day
> (daily limit: [Tageslimit]). At the provider: [retention per contract]; data is [per contract not used to train AI
> models].
>
> **Coaching staff:** if your coaching staff ask the AI coach about you or the team, your data is only included if you
> have consented here.
>
> **Limits:** AI answers can be incomplete or wrong and are not medical advice. Discuss training changes with your
> coaching staff and see a doctor if you have complaints.
>
> **Voluntary and revocable:** without consent you can use all other features. You can withdraw at any time under
> [path]; the AI coach is then disabled for you and no further data is sent to Anthropic.
>
> Controller: [Herausgeber], [E-Mail]. More in the [Privacy Policy], section "AI coach".

> **Prüfhinweis:** Apple verlangt in Richtlinie 5.1.2(i) eine ausdrückliche Erlaubnis, bevor personenbezogene Daten
> an Dritte – nach aktueller Fassung ausdrücklich auch an Dritt-KI – weitergegeben werden; Wortlaut der aktuellen
> Richtlinie prüfen. Die Einwilligung (d) deckt das ab, wenn sie vor der ersten Anfrage eingeholt wird. Für (d) ist
> eine Schema-Erweiterung nötig (`consents.kind = 'ai_coach'`), ebenso die serverseitige Prüfung in der Funktion
> `ai`, dass nur Daten von Spielern mit KI-Einwilligung in den Kontext gelangen.

---

## (e) Vertraulichkeitszusage für das Trainerteam (empfohlen)

### Deutsch

**Kurzfassung (Kästchen):**
> Ich behandle die Personen- und Gesundheitsdaten der Spieler vertraulich und nutze sie nur zur Trainings- und
> Mannschaftsorganisation. Ich gebe Zugangsdaten und den Staff-Code nicht an Unbefugte weiter und erfasse
> Gesundheitsdaten von Spielern ohne Konto nur, wenn deren Einwilligung (bei Kindern die der Eltern) vorliegt.

**Langfassung (Mehr lesen):**
> **Deine Verantwortung als Teil des Trainerteams**
>
> Du siehst in Trainerbank Daten aller Spieler deines Teams, darunter Gesundheitsdaten – oft von Kindern und
> Jugendlichen. Bitte beachte:
>
> - Nutze die Daten nur, um Training, Belastung und Spielbetrieb zu organisieren – nicht für andere Zwecke und nicht
>   außerhalb des Trainerteams.
> - Gib keine Daten an Mitspieler, Eltern anderer Kinder, Presse oder in sozialen Medien weiter. Zeige keine
>   Bildschirmfotos mit Spielerdaten.
> - Gib den Staff-Code nur an Personen weiter, die tatsächlich zum Trainerteam gehören. Wer den Staff-Code nutzt,
>   sieht alle Gesundheitsdaten des Teams. Erzeuge die Codes neu, wenn jemand das Trainerteam verlässt.
> - Erfasse Gesundheitsdaten (z. B. Belastung, Verletzungen, Größe) von Spielern ohne eigenes Konto nur, wenn der
>   Verein eine schriftliche Einwilligung hat (bei Kindern unter 16 die der Eltern).
> - Setze niemanden unter Druck, Gesundheitsdaten anzugeben. Spieler dürfen ohne Einwilligung ganz normal am Training
>   teilnehmen.
> - Schreibe in Notizen und Nachrichten nur, was für das Training nötig ist.
> - Trainerbank ersetzt keine ärztliche Beurteilung. Bei Verletzungen und Beschwerden zählt die Freigabe durch Arzt
>   oder Physiotherapeut.
> - Melde Verdachtsfälle (z. B. verlorenes Gerät, fremder Zugriff) sofort an [E-Mail].

### English

**Short version (checkbox):**
> I will treat players' personal and health data confidentially and use it only to organise training and the team.
> I will not share login details or the staff code with unauthorised persons, and I will only record health data of
> players without an account if their consent (for children, their parents' consent) has been obtained.

**Long version (Read more):**
> **Your responsibility as a member of the coaching staff**
>
> In Trainerbank you see the data of all players in your team, including health data – often of children and
> adolescents. Please note:
>
> - Use the data only to organise training, load and matches – not for other purposes and not outside the coaching
>   staff.
> - Do not pass data on to team-mates, other children's parents, the press or social media. Do not share screenshots
>   showing player data.
> - Only give the staff code to people who are actually part of the coaching staff. Anyone using it sees all health
>   data of the team. Regenerate the codes when someone leaves the coaching staff.
> - Only record health data (e.g. load, injuries, height) of players without their own account if the club holds
>   written consent (for children under 16, from their parents).
> - Never pressure anyone to provide health data. Players may take part in training normally without consent.
> - Only write in notes and messages what is necessary for training.
> - Trainerbank does not replace a medical assessment. For injuries and complaints, clearance by a doctor or
>   physiotherapist is what counts.
> - Report suspected incidents (e.g. lost device, unauthorised access) immediately to [E-Mail].

---

## (f) Einwilligung Befund-Auswertung (freiwillig)

Wird nur angezeigt, wenn das Paket „Leistung“ mit Befunden aktiv ist. Technischer Schlüssel: `findings`.
Ohne diese Einwilligung kann das Trainerteam Befunde speichern, wenn der Spieler schriftlich zugestimmt hat, aber
**keine** KI-Auswertung starten (geprüft serverseitig in der Function `finding`).

### Deutsch

**Befund-Auswertung (freiwillig)**

Mein Trainerteam darf Befunde zu meinen Verletzungen (z. B. Arztbriefe) speichern und mit KI auswerten lassen.

Wenn du verletzt bist, kann dein Trainerteam Befunde (Fotos oder PDFs von Arztbriefen) in der App speichern. Mit
deiner Einwilligung darf es sie von einem KI-Dienst zusammenfassen lassen, um deinen Wiedereinstieg zu planen. Die
Datei wird dafür an den KI-Anbieter übermittelt, möglicherweise außerhalb der EU, und dort nicht gespeichert oder zum
Training verwendet. Du siehst alle Befunde selbst und kannst die Einwilligung jederzeit widerrufen.

### English

**Medical report analysis (optional)**

My coaching staff may store medical reports about my injuries (e.g. doctor's letters) and have them summarised by AI.

If you are injured, your coaching staff can store medical reports (photos or PDFs of doctor's letters) in the app.
With your consent they may have an AI service summarise them to plan your return to training. The file is sent to the
AI provider for this, possibly outside the EU, and is not stored there or used for training. You can see all reports
yourself and withdraw your consent at any time.

> **Prüfhinweis:** Bei Spielern unter 16 Jahren zusätzlich die Einwilligung der Erziehungsberechtigten einholen
> (Vorlage (c) um diesen Punkt ergänzen).

## Widerruf von Einwilligungen

### Ort in der App

- Spieler: [Pfad, z. B. „Ich → Datenschutz → Einwilligungen“]
- Trainerteam: [Pfad, z. B. „Mehr → Datenschutz → Einwilligungen“]

Der Bildschirm listet jede Einwilligung mit Status, Datum und Version, z. B. *„Gesundheitsdaten – erteilt am
12.10.2026 (health-1.0)“*, und bietet je Einwilligung den Knopf **„Widerrufen“**. Die Kenntnisnahme (a) ist nicht
widerrufbar; dort steht stattdessen der Hinweis auf „Konto löschen“.

### Deutsch

**Bildschirmtext (oben):**
> Hier siehst du, wozu du eingewilligt hast. Du kannst jede Einwilligung jederzeit widerrufen. Was bis zum Widerruf
> verarbeitet wurde, bleibt rechtmäßig.

**Dialog – Gesundheitsdaten:**
> **Einwilligung für Gesundheitsdaten widerrufen?**
> Du kannst dann keine Belastung, kein Wohlbefinden, keinen Zusatzsport und keine Körperdaten mehr eintragen, und dein
> Trainerteam erhält keine neuen Gesundheitsdaten von dir. Deine gespeicherten Gesundheitsdaten werden [sofort]
> gelöscht – das lässt sich nicht rückgängig machen. Tipp: Exportiere deine Daten vorher, wenn du sie behalten
> möchtest.
>
> Knöpfe: **„Abbrechen“** · **„Widerrufen und löschen“**
> Bestätigung: *Einwilligung widerrufen. Deine Gesundheitsdaten wurden gelöscht.*

**Dialog – KI-Coach:**
> **Einwilligung für den KI-Coach widerrufen?**
> Der KI-Coach wird für dich gesperrt und es werden keine Daten mehr an den KI-Anbieter übermittelt. Bereits
> übermittelte Anfragen kann der Anbieter [laut Vertrag bis zu … Tage] speichern.
>
> Knöpfe: **„Abbrechen“** · **„Widerrufen“**
> Bestätigung: *Einwilligung widerrufen. Der KI-Coach ist jetzt gesperrt.*

**Dialog – Einwilligung der Eltern (vom Kind ausgelöst):**
> **Einwilligung deiner Eltern widerrufen?**
> Dann sind die Gesundheitsfunktionen und der KI-Coach gesperrt und deine gespeicherten Gesundheitsdaten werden
> gelöscht. Kalender, Wochenplan und Nachrichten kannst du [weiter nutzen / nicht mehr nutzen – je nach Umsetzung].
> [Falls umgesetzt: Deine Eltern erhalten eine Info-E-Mail.]
>
> Knöpfe: **„Abbrechen“** · **„Widerrufen“**

**Hinweis an das Kind nach Widerruf durch die Eltern:**
> Deine Eltern haben ihre Einwilligung zurückgezogen. Gesundheitsfunktionen und KI-Coach sind deshalb gesperrt. Bei
> Fragen sprich mit deinen Eltern oder deinem Trainerteam.

**Widerruf durch Eltern per E-Mail – Antwortvorlage:**
> Guten Tag, wir haben Ihren Widerruf der Einwilligung für [Vorname des Kindes] am [Datum] umgesetzt. Die
> Gesundheitsdaten Ihres Kindes wurden gelöscht; Gesundheitsfunktionen und KI-Coach sind gesperrt. [Konto und
> Teamzugehörigkeit bleiben bestehen / wurden ebenfalls gelöscht.] Mit freundlichen Grüßen, [Herausgeber]

**Erneute Abfrage bei neuer Textversion:**
> **Wir haben unsere Einwilligungstexte aktualisiert.** Bitte lies die neue Fassung und entscheide, ob du weiterhin
> einwilligst. Was sich geändert hat: [kurze Zusammenfassung].
> Knöpfe: **„Einwilligen“** · **„Nicht einwilligen“**

### English

**Screen text (top):**
> Here you can see what you have consented to. You can withdraw any consent at any time. Processing before
> withdrawal remains lawful.

**Dialog – health data:**
> **Withdraw consent for health data?**
> You will no longer be able to record load, wellness, extra sport or body data, and your coaching staff will receive
> no new health data from you. Your stored health data will be deleted [immediately] – this cannot be undone. Tip:
> export your data first if you want to keep it.
>
> Buttons: **"Cancel"** · **"Withdraw and delete"**
> Confirmation: *Consent withdrawn. Your health data has been deleted.*

**Dialog – AI coach:**
> **Withdraw consent for the AI coach?**
> The AI coach will be disabled for you and no more data will be sent to the AI provider. Requests already sent may be
> retained by the provider [per contract for up to … days].
>
> Buttons: **"Cancel"** · **"Withdraw"**
> Confirmation: *Consent withdrawn. The AI coach is now disabled.*

**Dialog – parental consent (triggered by the child):**
> **Withdraw your parents' consent?**
> Health features and the AI coach will be disabled and your stored health data will be deleted. You can [still use /
> no longer use – depending on implementation] the calendar, weekly plan and messages. [If implemented: your parents
> will receive an information e-mail.]
>
> Buttons: **"Cancel"** · **"Withdraw"**

**Notice to the child after withdrawal by parents:**
> Your parents have withdrawn their consent. Health features and the AI coach are therefore disabled. If you have
> questions, talk to your parents or your coaching staff.

**Withdrawal by parents via e-mail – reply template:**
> Hello, we have processed your withdrawal of consent for [child's first name] on [date]. Your child's health data
> has been deleted; health features and the AI coach are disabled. [The account and team membership remain / have
> also been deleted.] Kind regards, [Herausgeber]

**Re-consent after a new text version:**
> **We have updated our consent texts.** Please read the new version and decide whether you continue to consent.
> What has changed: [short summary].
> Buttons: **"Consent"** · **"Do not consent"**

---

## Anhang A – Technische Speicherung der Einwilligungen

Heutige Tabelle `consents`: `id`, `user_id`, `kind` ('privacy' / 'health_data' / 'parental'), `version`,
`parent_email`, `given_at`.

| Empfehlung | Grund |
|---|---|
| `kind` um `ai_coach` und `staff_confidentiality` erweitern | (d) und (e) nachweisen |
| Spalte `withdrawn_at` (oder eigene Zeile `kind`+`withdrawn`) | Widerruf nachweisen; aktive Einwilligung = letzte Zeile ohne Widerruf |
| Spalte `lang` ('de'/'en') und `text_hash` (SHA-256 des angezeigten Textes) | nachweisen, welcher Wortlaut gezeigt wurde |
| Spalte `player_id` | bei mehreren Teams bzw. Spielerprofilen eindeutige Zuordnung |
| Spalten `confirmed_at`, `confirmation_method` ('in_app' / 'email_link') | Double-Opt-in der Eltern |
| `app_version`, `platform` | Nachvollziehbarkeit bei Fehlern in einer App-Version |
| serverseitige Prüfung vor jedem Schreiben in `rpe_entries`, `wellness_entries`, `extra_activities`, `growth_measurements` und vor jedem KI-Aufruf | Einwilligung technisch erzwingen, nicht nur in der Oberfläche |
| Aufbewahrung nach Kontolöschung klären (heute voraussichtlich Löschung per Cascade) | Nachweispflicht vs. Datenminimierung |

Versionsschema: `<art>-<major>.<minor>`; Minor bei redaktionellen Änderungen ohne erneute Abfrage, Major bei
inhaltlichen Änderungen mit erneuter Abfrage.

---

## Anhang B – Einwilligung außerhalb der App (Spieler ohne Konto) – Vorlage für Vereine

> **ENTWURF – vor Verwendung anwaltlich prüfen lassen.** Für Spieler, die das Trainerteam ohne eigenes Konto anlegt.
> Der Verein bewahrt das unterschriebene Formular auf.

```
Einwilligung in die Verarbeitung von Gesundheitsdaten in der App „Trainerbank“

Spielerin/Spieler: ____________________________  Geburtsdatum: ___________
Mannschaft: __________________________________  Verein: ___________________

Das Trainerteam unserer Mannschaft nutzt die App Trainerbank, um Training, Spiele und Belastung zu
planen. Dafür möchte es folgende Gesundheitsdaten erfassen: Belastungsempfinden und Trainingsminuten,
Abwesenheiten wegen Krankheit oder Verletzung mit Rückkehrstufe, Körpergröße und ggf. Gewicht.
Die Daten sieht nur das Trainerteam der Mannschaft; Mitspieler sehen sie nicht. Gespeichert wird
in der EU (Frankfurt) bei [Herausgeber] bzw. dessen Dienstleister. Die App stellt keine Diagnosen.

[ ] Ich willige / wir willigen ausdrücklich ein, dass diese Gesundheitsdaten zu den genannten
    Zwecken in Trainerbank verarbeitet werden.

Die Einwilligung ist freiwillig. Die Teilnahme am Training hängt nicht davon ab. Sie kann jederzeit
gegenüber dem Trainerteam oder [E-Mail des Vereins] widerrufen werden; die Daten werden dann gelöscht.
Weitere Informationen: [Datenschutz-URL] [und Datenschutzhinweise des Vereins].

Ort, Datum: __________________

Unterschrift Spielerin/Spieler (ab 16): __________________

Unterschrift Erziehungsberechtigte (bei unter 18 bzw. unter 16 – zu prüfen): __________________
```

> **Prüfhinweis:** Wer Verantwortlicher ist (Verein oder Herausgeber, siehe Datenschutzerklärung Abschnitt 1),
> bestimmt, in wessen Namen diese Einwilligung eingeholt wird. Empfehlung für die App: Vor der ersten Eingabe von
> Gesundheitsdaten für einen Spieler ohne Konto muss der Trainer bestätigen, dass eine solche Einwilligung vorliegt;
> die Bestätigung wird gespeichert.
