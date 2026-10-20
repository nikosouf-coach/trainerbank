// Spieler – Kalender: Woche oder Monat mit Spielen, Training, eigenen Einheiten und Events. Markiert, wo der Trainer
// für dich etwas anderes vorgesehen hat („Für dich“), und zeigt Fristen (Aufgaben, Dienste, Ziele, Vereinbarungen).
import React, { useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { addDays, iso, kwOf, monday, monthStart, parse } from "../../../src/core/dates";
import { useEngine, useStore } from "../../../src/data/store";
import { Icon } from "../../../src/ui/icons";
import { Card, CardTitle, Col, Header, Muted, Row, Screen, Seg } from "../../../src/ui/kit";
import { CalNav } from "../../../src/ui/plan/CalNav";
import { AgendaDay, DueRow, useAgenda } from "../../../src/ui/player/agenda";
import { rpeColor, useTheme, withAlpha } from "../../../src/ui/theme";

export default function PlayerKalender() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const { width } = useWindowDimensions();
  const pid = s.mePid || "";
  const A = useAgenda(pid);
  const [view, setView] = useState<"woche" | "monat">("woche");
  const [week, setWeek] = useState(monday(E.TODAY));
  const [month, setMonth] = useState(monthStart(E.TODAY));
  const [sel, setSel] = useState(E.TODAY);
  const days = useMemo(() => [...Array(7)].map((_, i) => addDays(week, i)), [week]);
  const upcoming = A.due.filter(z => z.date <= addDays(E.TODAY, 28)).slice(0, 6);

  const weekView = () => (
    <>
      <CalNav label={`${t("kw")} ${kwOf(week)} · ${E.de(week).slice(0, 5)}–${E.de(addDays(week, 6)).slice(0, 5)}`} todayLabel={t("thisW")}
        onPrev={() => setWeek(addDays(week, -7))} onNext={() => setWeek(addDays(week, 7))} onToday={() => setWeek(monday(E.TODAY))} />
      <Card style={{ paddingVertical: 4, gap: 0 }} testID="pc-week">
        {days.map(d => {
          const today = d === E.TODAY, past = d < E.TODAY;
          return (
            <View key={d} testID={"pc-day-" + d} style={{ flexDirection: "row", gap: 10, paddingVertical: 10, borderBottomWidth: d === days[6] ? 0 : 1, borderBottomColor: c.line,
              backgroundColor: today ? withAlpha(c.accent, 0.06) : "transparent", borderRadius: today ? 8 : 0, paddingHorizontal: today ? 6 : 0, opacity: past ? 0.6 : 1 }}>
              <View style={{ width: 50, gap: 1 }}>
                <Text style={{ fontWeight: "800", fontSize: 15, color: today ? c.accentTx : c.ink }}>{E.wt(d)}</Text>
                <Text style={{ fontSize: 12, color: c.muted }}>{E.de(d).slice(0, 5)}</Text>
                {today ? <Text style={{ fontSize: 10.5, fontWeight: "800", color: c.accentTx }}>{t("today")}</Text> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}><AgendaDay pid={pid} date={d} /></View>
            </View>
          );
        })}
      </Card>
    </>
  );

  const monthView = () => {
    const first = parse(month), mo = first.getMonth(), y = first.getFullYear();
    const start = monday(month), last = iso(new Date(y, mo + 1, 0)), end = addDays(monday(last), 6);
    const cellW = (Math.min(width, 1100) - 2 * 16 - 12) / 7;
    const cells: React.ReactNode[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const m = A.marks(d), inM = parse(d).getMonth() === mo, today = d === E.TODAY, on = d === sel;
      const dot = (k: string, col: string) => <View key={k} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />;
      const dots = [m.units ? dot("u", "#16a3a3") : null, m.events ? dot("e", c.event) : null, m.due ? dot("d", c.hot) : null].filter(Boolean);
      cells.push(
        <Pressable key={d} testID={"pc-cell-" + d} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${E.wt(d)} ${E.de(d)}`} onPress={() => setSel(d)}
          style={{ width: `${100 / 7}%`, minHeight: cellW >= 80 ? 70 : 58, padding: 2 }}>
          <View style={{ flex: 1, borderRadius: 8, borderWidth: on ? 2 : 1, borderColor: on ? c.accent : today ? c.accentTx : c.line, backgroundColor: inM ? c.surface : c.sunk, padding: 4, gap: 3, opacity: inM ? 1 : 0.5 }}>
            <Row between gap={2}>
              <Text style={{ fontWeight: "700", fontSize: 12, color: today ? c.accentTx : c.ink }}>{parse(d).getDate()}</Text>
              {m.mine ? <View testID={"pc-cell-mine-" + d} style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: c.accentTx }} /> : null}
            </Row>
            {m.match ? <Icon name="ball" size={12} color={c.accentTx} strokeWidth={2} /> : null}
            {m.train != null ? <View style={{ height: 6, borderRadius: 3, backgroundColor: A.showPlan && !A.kids ? rpeColor(c, m.train) : c.ok }} />
              : m.off ? <View style={{ height: 6, borderRadius: 3, borderWidth: 1, borderColor: m.off === "brk" ? "#16a3a3" : c.build }} /> : null}
            {dots.length ? <Row gap={2}>{dots}</Row> : null}
            {m.absent ? <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: c.low, borderBottomLeftRadius: 7, borderBottomRightRadius: 7 }} /> : null}
          </View>
        </Pressable>
      );
    }
    const lg = (k: string, el: React.ReactNode, label: string) => <Row key={k} gap={5}>{el}<Text style={{ fontSize: 11.5, color: c.muted }}>{label}</Text></Row>;
    return (
      <>
        <CalNav label={`${E.tl("months")[mo]} ${y}`} todayLabel={t("thisW")}
          onPrev={() => { const z = parse(month); z.setMonth(z.getMonth() - 1); setMonth(iso(z)); }}
          onNext={() => { const z = parse(month); z.setMonth(z.getMonth() + 1); setMonth(iso(z)); }}
          onToday={() => { setMonth(monthStart(E.TODAY)); setSel(E.TODAY); }} />
        <Card style={{ padding: 6, gap: 0 }} testID="pc-month">
          <View style={{ flexDirection: "row" }}>{[1, 2, 3, 4, 5, 6, 0].map(k => <Text key={k} style={{ width: `${100 / 7}%`, textAlign: "center", fontSize: 11, fontWeight: "700", color: c.muted, paddingVertical: 4 }}>{E.tl("wd")[k]}</Text>)}</View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{cells}</View>
          <Row wrap gap={12} testID="pc-legend" style={{ paddingHorizontal: 4, paddingTop: 8 }}>
            {lg("t", <View style={{ width: 16, height: 6, borderRadius: 3, backgroundColor: A.showPlan && !A.kids ? rpeColor(c, 6) : c.ok }} />, A.showPlan && !A.kids ? t("cal_lgTrainI") : t("it_training"))}
            {lg("m", <Icon name="ball" size={12} color={c.accentTx} strokeWidth={2} />, t("it_match"))}
            {lg("e", <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.event }} />, t("it_event"))}
            {lg("u", <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#16a3a3" }} />, t("pc_lgUnit"))}
            {lg("d", <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.hot }} />, t("pc_lgDue"))}
            {A.showPlan && !A.kids ? lg("y", <View style={{ width: 7, height: 7, borderRadius: 4, borderWidth: 1.5, borderColor: c.accentTx }} />, t("pc_lgMine")) : null}
          </Row>
        </Card>
        <Card testID="pc-sel">
          <CardTitle title={sel === E.TODAY ? t("today") : `${E.wt(sel)} ${E.de(sel)}`} />
          <AgendaDay pid={pid} date={sel} testID="pc-sel-day" />
        </Card>
      </>
    );
  };

  return (
    <Screen testID="player-kalender">
      <Header title={t("pn_kalender")} />
      <Seg testID="pc-view" value={view} onChange={v => { setView(v); if (v === "monat") { setMonth(monthStart(week)); setSel(week <= E.TODAY && E.TODAY <= addDays(week, 6) ? E.TODAY : week); } else setWeek(monday(sel)); }}
        options={[{ key: "woche", label: t("cal_week") }, { key: "monat", label: t("cal_month") }]} />
      {view === "monat" ? monthView() : weekView()}
      <Card testID="pc-due">
        <CardTitle title={t("pc_dueT")} />
        {upcoming.length ? <Col gap={2}>{upcoming.map(z => <DueRow key={z.k} z={z} showDate />)}</Col> : <Muted>{t("pc_dueNone")}</Muted>}
      </Card>
    </Screen>
  );
}
