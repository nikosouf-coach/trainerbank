// Trainer – Kalender: Woche oder Monat mit Training, Spielen, Events; Tagesansicht, Termine, Spielplan-Import.
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { addDays, iso, kwOf, monday, monthStart, parse } from "../../../src/core/dates";
import type { PlanItem } from "../../../src/core/engine";
import { phaseOn } from "../../../src/core/prep";
import { useEngine, useStore } from "../../../src/data/store";
import { Icon } from "../../../src/ui/icons";
import { Btn, Card, CardTitle, Header, Info, ListItem, Muted, Row, Screen, Seg, Tag } from "../../../src/ui/kit";
import { CalNav } from "../../../src/ui/plan/CalNav";
import { setCal, useCal } from "../../../src/ui/plan/calState";
import { usePlanSheets } from "../../../src/ui/plan/sheets";
import { rpeColor, useTheme, withAlpha } from "../../../src/ui/theme";

/** Ein Eintrag in der Wochenansicht. */
function Item({ kind, text, color, onPress, testID, off }: { kind: string; text: string; color: string; onPress?: () => void; testID?: string; off?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress}
      style={{ borderLeftWidth: 3, borderLeftColor: color, backgroundColor: withAlpha(color.startsWith("#") ? color : "#888888", 0.08), borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, gap: 1, opacity: off ? 0.6 : 1 }}>
      <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color }}>{kind}</Text>
      <Text style={{ fontSize: 14, color: c.ink, textDecorationLine: off ? "line-through" : "none" }}>{text}</Text>
    </Pressable>
  );
}

export default function Kalender() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const cal = useCal(); const sheets = usePlanSheets();
  const { width } = useWindowDimensions();
  const showI = E.lvl(1) && E.grp !== "u11", mods = E.mods;

  const wp = useMemo(() => E.weekPlan(cal.week), [s.version, cal.week, E]); // eslint-disable-line react-hooks/exhaustive-deps
  const up = E.D.matches.filter(m => m.date >= E.TODAY).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 5);
  // Tag antippen → Trainingstag (Einheit, Ablauf, Kader, Aufgaben); bearbeiten über „Tag bearbeiten“ oder „+“
  const openDay = (d: string) => router.push("/coach/tag/" + d);

  const dayRow = (x: PlanItem) => {
    const its: React.ReactNode[] = [];
    if (x.match) its.push(<Item key="m" testID={"cal-match-" + x.date} kind={t("it_match")} color={c.accentTx} text={`${x.match.zeit} · ${t("vs")} ${x.match.gegner} (${x.match.heim ? t("home") : t("away")}${x.match.comp !== "liga" ? ", " + t("comp_" + x.match.comp) : ""})`} onPress={() => x.date <= E.TODAY && mods.spielanalyse ? router.push("/coach/spiel/" + x.match!.id) : sheets.open({ k: "add", date: x.date, type: "match", obj: x.match! })} />);
    if (x.train && x.train.kind === "frei") its.push(<Item key="r" kind={t("k_frei")} color={c.ok} text={tf("restDay", { md: x.md })} onPress={() => sheets.open({ k: "day", date: x.date })} />);
    else if (x.train) its.push(<Item key="t" testID={"cal-train-" + x.date} kind={t("it_training")} color={rpeColor(c, showI ? x.train.rpe : 5)} text={`${E.zeitOf(x.date)} · ${E.kn(x.train.kind)}${showI ? " · " + E.intWord(x.train.rpe) : ""}`} onPress={() => openDay(x.date)} />);
    if (x.cancelled) its.push(<Item key="c" off kind={t("it_training")} color={c.muted} text={t("cancelled")} onPress={() => sheets.open({ k: "day", date: x.date })} />);
    if (x.brk && E.regularDay(x.date)) { const ph = phaseOn(E.D, x.date); its.push(<Item key="b" kind={t("vb_breakDay")} color="#16a3a3" text={ph?.title || ""} onPress={() => ph ? router.push("/coach/phase/" + ph.id) : sheets.open({ k: "day", date: x.date })} />); }
    x.events.forEach(e => its.push(<Item key={e.id} kind={t("it_event")} color={c.event} text={(e.zeit ? e.zeit + " · " : "") + e.titel} onPress={() => sheets.open({ k: "add", date: x.date, type: "event", obj: e })} />));
    const ab = E.absentOn(x.date);
    if ((x.train || x.match) && ab.length) its.push(<Muted key="a" small>{ab.length} {t("absent")}: {ab.slice(0, 4).map(p => p.vn).join(", ")}{ab.length > 4 ? " …" : ""}</Muted>);
    const today = x.date === E.TODAY, flash = cal.flash === x.date;
    return (
      <View key={x.date} testID={"cal-day-" + x.date} style={{ flexDirection: "row", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: flash ? withAlpha(c.warn, 0.15) : today ? withAlpha(c.accent, 0.05) : "transparent", borderRadius: flash || today ? 8 : 0, paddingHorizontal: flash || today ? 6 : 0 }}>
        <Pressable testID={"cal-dl-" + x.date} accessibilityRole="button" accessibilityLabel={`${E.wt(x.date)} ${E.de(x.date)}`} onPress={() => openDay(x.date)} style={{ width: 54, gap: 2 }}>
          <Text style={{ fontWeight: "800", fontSize: 15, color: today ? c.accentTx : c.ink }}>{E.wt(x.date)}</Text>
          <Text style={{ fontSize: 12, color: c.muted }}>{E.de(x.date)}</Text>
          {x.md ? <Text style={{ fontSize: 10.5, fontWeight: "700", color: c.muted }}>{x.md}</Text> : null}
        </Pressable>
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>{its.length ? its : <Muted small>{t("noTraining")}</Muted>}</View>
        <Pressable testID={"cal-plus-" + x.date} accessibilityRole="button" accessibilityLabel={t("addE")} onPress={() => sheets.open({ k: "add", date: x.date, type: "training" })}
          style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: c.line, alignItems: "center", justifyContent: "center" }}>
          <Icon name="plus" size={18} color={c.muted} />
        </Pressable>
      </View>
    );
  };

  const month = () => {
    const first = parse(cal.month), mo = first.getMonth(), y = first.getFullYear();
    const start = monday(cal.month), last = iso(new Date(y, mo + 1, 0)), end = addDays(monday(last), 6), n = E.D.players.length;
    const narrow = width < 560;
    const cells: React.ReactNode[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const x = E.weekPlan(monday(d)).items.find(i => i.date === d)!, inM = parse(d).getMonth() === mo, past = d < E.TODAY, sess = E.D.sessions.find(z => z.date === d);
      const L: React.ReactNode[] = []; const tx = (k: string, s2: string, col?: string, bold?: boolean) => <Text key={k} numberOfLines={1} style={{ fontSize: narrow ? 9.5 : 11, color: col || c.muted, fontWeight: bold ? "800" : "500" }}>{s2}</Text>;
      const chip = (k: string, s2: string, col: string) => <View key={k} style={{ backgroundColor: col, borderRadius: 4, paddingHorizontal: 3, alignSelf: "flex-start" }}><Text numberOfLines={1} style={{ fontSize: narrow ? 9 : 10.5, color: "#fff", fontWeight: "800" }}>{s2}</Text></View>;
      if (x.match) {
        L.push(chip("m", t("it_match"), c.accent));
        L.push(tx("mz", `${x.match.heim ? "H" : "A"} ${x.match.zeit}`));
        L.push(tx("mg", x.match.gegner, c.ink, true));
        if (past && sess && showI) { const a = E.sessAvg(d); if (a != null) L.push(tx("ma", "Ø " + E.num(a, 1))); }
      }
      const tr = x.train;
      if (tr && tr.kind === "frei") L.push(tx("f", t("k_frei"), c.ok, true));
      else if (tr) {
        if (past && sess) {
          const a = E.sessAvg(d), da = E.D.players.filter(p => E.attStatus(d, p.id) === "da").length;
          L.push(showI && a != null ? chip("r", "Ø " + E.num(a, 1), rpeColor(c, Math.round(a))) : chip("r", t("it_training"), c.build));
          L.push(tx("k", E.kn(tr.kind), c.ink, true)); if (!narrow) L.push(tx("z", `${E.zeitOf(d)} · ${sess.dauer}′`)); L.push(tx("p", `👤 ${da}`));
        } else {
          L.push(showI ? chip("r", "RPE " + tr.rpe, rpeColor(c, tr.rpe)) : chip("r", t("it_training"), c.low));
          L.push(tx("k", E.kn(tr.kind), c.ink, true)); if (!narrow) L.push(tx("z", `${E.zeitOf(d)} · ${tr.dauer}′`)); L.push(tx("p", `👤 ${n - E.absentOn(d).length}`));
        }
      } else if (x.cancelled) L.push(<Text key="c" numberOfLines={1} style={{ fontSize: narrow ? 9.5 : 11, color: c.muted, textDecorationLine: "line-through" }}>{t("it_training")}</Text>);
      else if (x.brk && E.regularDay(d)) L.push(<Text key="b" numberOfLines={1} style={{ fontSize: narrow ? 9.5 : 11, color: "#16a3a3", fontWeight: "700" }}>{t("vb_breakDay")}</Text>);
      x.events.forEach(e => L.push(tx("e" + e.id, "● " + e.titel, c.event)));
      const today = d === E.TODAY;
      cells.push(
        <Pressable key={d} testID={"mcell-" + d} accessibilityRole="button" accessibilityLabel={`${E.wt(d)} ${E.de(d)}`} onPress={() => openDay(d)}
          style={{ width: `${100 / 7}%`, minHeight: narrow ? 82 : 104, padding: 2 }}>
          <View style={{ flex: 1, borderRadius: 7, borderWidth: today ? 2 : 1, borderColor: today ? c.accent : c.line, backgroundColor: inM ? c.surface : c.sunk, padding: narrow ? 3 : 5, gap: 2, opacity: inM ? 1 : 0.55, overflow: "hidden" }}>
            <Row between gap={2}><Text style={{ fontWeight: "800", fontSize: narrow ? 11 : 13, color: today ? c.accentTx : c.ink }}>{parse(d).getDate()}</Text>{x.md && !narrow ? <Text style={{ fontSize: 9.5, color: c.muted, fontWeight: "700" }}>{x.md}</Text> : null}</Row>
            {L}
          </View>
        </Pressable>
      );
    }
    return (
      <>
        <CalNav label={`${E.tl("months")[mo]} ${y}`} todayLabel={t("thisW")}
          onPrev={() => { const z = parse(cal.month); z.setMonth(z.getMonth() - 1); setCal({ month: iso(z) }); }}
          onNext={() => { const z = parse(cal.month); z.setMonth(z.getMonth() + 1); setCal({ month: iso(z) }); }}
          onToday={() => setCal({ month: monthStart(E.TODAY) })} info={<Info title={t("cal_month")} text={t("cal_legend")} />} />
        <Card style={{ padding: 6, gap: 0 }}>
          <View style={{ flexDirection: "row" }}>{[1, 2, 3, 4, 5, 6, 0].map(k => <Text key={k} style={{ width: `${100 / 7}%`, textAlign: "center", fontSize: 11, fontWeight: "700", color: c.muted, paddingVertical: 4 }}>{E.tl("wd")[k]}</Text>)}</View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{cells}</View>
        </Card>
      </>
    );
  };

  const ws = cal.week, we = addDays(ws, 6);
  return (
    <Screen testID="coach-kalender">
      <Header eyebrow={t("cal_sub")} title={t("nav_kalender")} right={<Row gap={8}>
        <Btn testID="cal-import" label={t("imp")} onPress={() => sheets.open({ k: "import" })} />
        <Btn testID="cal-add" kind="primary" label={t("addE")} onPress={() => sheets.open({ k: "add", date: ws <= E.TODAY && E.TODAY <= we ? E.TODAY : ws, type: "training" })} />
      </Row>} />
      <Seg testID="cal-view" value={cal.view} onChange={v => v === "monat" ? setCal({ view: v, month: monthStart(cal.week) }) : setCal({ view: v, week: cal.month === monthStart(E.TODAY) ? monday(E.TODAY) : monday(cal.month) })}
        options={[{ key: "woche", label: t("cal_week") }, { key: "monat", label: t("cal_month") }]} />
      {cal.view === "monat" ? month() : <>
        <CalNav label={`${t("kw")} ${kwOf(ws)} · ${E.de(ws)}–${E.de(we)}`} todayLabel={t("thisW")}
          onPrev={() => setCal({ week: addDays(ws, -7) })} onNext={() => setCal({ week: addDays(ws, 7) })} onToday={() => setCal({ week: monday(E.TODAY) })} />
        <Card style={{ paddingVertical: 4, gap: 0 }}>{wp.items.map(dayRow)}</Card>
      </>}
      <Card>
        <CardTitle title={t("upcoming")} />
        {up.length ? up.map(m => <ListItem key={m.id} testID={"up-" + m.id} title={`${E.wt(m.date)} ${E.de(m.date)} · ${m.zeit}`} sub={`${t("vs")} ${m.gegner} · ${m.heim ? t("home") : t("away")} · ${t("comp_" + m.comp)}`}
          right={<Tag label={`${t("kw")} ${kwOf(m.date)}`} />} onPress={() => sheets.open({ k: "add", date: m.date, type: "match", obj: m })} />) : <Muted>{t("day_none")}</Muted>}
      </Card>
      {sheets.el}
    </Screen>
  );
}
