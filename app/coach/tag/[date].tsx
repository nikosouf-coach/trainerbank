// Trainer – Trainingstag: Einheit, Ablauf mit Zuständigkeiten und Coachingpunkten, Skizzen, verfügbarer Kader,
// individuelle Vorgaben, Aufgaben und Dienste. Co-Trainer sehen zuerst ihre eigenen Blöcke.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { kwOf, monday } from "../../../src/core/dates";
import { blocksTotal, dayBlocks, timeline } from "../../../src/core/day";
import type { DayBlock } from "../../../src/core/types";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { TemplatePicker } from "../../../src/ui/archive";
import { BoardView } from "../../../src/ui/board";
import { BlockSheet, SketchImage, StaffDot } from "../../../src/ui/day/BlockSheet";
import { IndivSummary } from "../../../src/ui/indiv";
import { Banner, Btn, Card, CardTitle, Chip, Col, Header, Info, Muted, Row, Screen, T, Tag } from "../../../src/ui/kit";
import { usePlanSheets } from "../../../src/ui/plan/sheets";
import { PlayerAvatar } from "../../../src/ui/playerAvatar";
import { GroupChip } from "../../../src/ui/squad/Groups";
import { radius, rpeColor, useTheme, withAlpha } from "../../../src/ui/theme";

export default function Trainingstag() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter();
  const { date = "" } = useLocalSearchParams<{ date: string }>();
  const sheets = usePlanSheets();
  const me = s.myStaff, coMode = !!me && me.role !== "chef";
  const [mine, setMine] = useState<boolean>(coMode);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<DayBlock | undefined>(undefined);
  const [tpl, setTpl] = useState(false);
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/kalender");

  const x = useMemo(() => E.weekPlan(monday(date)).items.find(i => i.date === date), [s.version, date, E]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !x) return <Screen testID="coach-tag"><Header title={t("nav_kalender")} onBack={back} backLabel={t("nav_kalender")} /><Muted>{t("td_none")}</Muted></Screen>;

  const tr = x.train && x.train.kind !== "frei" ? x.train : null, past = date < E.TODAY, showI = E.lvl(1) && E.grp !== "u11";
  const sess = E.D.sessions.find(z => z.date === date);
  const blocks = dayBlocks(E.D, date), timed = timeline(blocks, E.zeitOf(date)), total = blocksTotal(blocks);
  const shown = mine && me ? timed.filter(tb => tb.b.staffId === me.id) : timed;
  const ab = E.absentOn(date), avail = E.D.players.filter(p => !ab.includes(p));
  const title = x.match ? `${t("it_match")} ${t("vs")} ${x.match.gegner}` : tr ? E.kn(tr.kind) : x.brk ? t("vb_breakDay") : x.cancelled ? `${t("it_training")} ${t("cancelled")}` : t("td_free");
  const nextSort = blocks.length ? Math.max(...blocks.map(b => b.sort)) + 1 : 0;
  const newBlock = (p: Partial<DayBlock> = {}): DayBlock => ({ id: tmpId(), date, sort: nextSort, title: "", min: 15, staffId: coMode && me ? me.id : null, exId: null, text: "", points: [], drawing: null, photo: null, groupId: null, ...p });
  const move = async (b: DayBlock, d: number) => {
    const L = blocks.slice(), i = L.findIndex(y => y.id === b.id), j = i + d; if (j < 0 || j >= L.length) return;
    [L[i], L[j]] = [L[j], L[i]];
    for (let k = 0; k < L.length; k++) if (L[k].sort !== k) await s.saveBlock({ ...L[k], sort: k });
  };

  return (
    <Screen testID="coach-tag">
      <Header onBack={back} backLabel={t("nav_kalender")} eyebrow={`${E.wt(date)} ${E.de(date)}${x.md ? " · " + x.md : ""} · ${t("kw")} ${kwOf(date)}`} title={title}
        right={<Btn small testID="td-edit-day" label={t("td_editDay")} onPress={() => sheets.open({ k: "day", date })} />} />

      {/* Einheit */}
      {tr ? <Card testID="td-session" tone={showI ? rpeColor(c, tr.rpe) : undefined}>
        <Row wrap gap={8}>
          <Chip label={`${E.zeitOf(date)} · ${tr.dauer} ${t("min")}`} color={c.accentTx} />
          <Chip label={t("p_" + tr.platz)} color={c.muted} />
          {showI ? <Chip label={`${E.intWord(tr.rpe)} · RPE ${tr.rpe}`} color={rpeColor(c, tr.rpe)} /> : null}
          {showI && past && E.sessAvg(date) != null ? <Chip label={tf("pl_avgRpe", { r: E.num(E.sessAvg(date)!, 1) })} color={rpeColor(c, Math.round(E.sessAvg(date)!))} /> : null}
        </Row>
        <T v="small">{tr.inhalt}</T>
        {!past && showI && tr.notReady.length ? <T v="small" color={c.crit}>⚠ {tf("notReadyN", { n: tr.notReady.length })}: {tr.notReady.map(q => q.vn).join(", ")}</T> : null}
        <Row wrap gap={6}>
          {E.mods.planung && !past ? <Btn small testID="td-plan" label={t("day_plan")} onPress={() => router.push("/coach/plan?date=" + date)} /> : null}
          {E.mods.ki && !past ? <Btn small icon="spark" testID="td-ai" label={t("ki_session")} onPress={() => sheets.open({ k: "ai", date })} /> : null}
          {sess && E.mods.beteiligung ? <Btn small kind="primary" testID="td-att" label={t("day_attOpen")} onPress={() => router.push("/coach/einheit/" + date)} /> : null}
        </Row>
      </Card> : null}
      {x.match ? <Card testID="td-match" tone={c.accentTx}>
        <T v="small">{x.match.zeit} · {x.match.heim ? t("home") : t("away")} · {t("comp_" + x.match.comp)}</T>
        <Row wrap gap={6}>
          {E.mods.spielanalyse && date <= E.TODAY ? <Btn small kind="primary" label={t("sp_open")} onPress={() => router.push("/coach/spiel/" + x.match!.id)} /> : null}
          {sess && E.mods.beteiligung ? <Btn small label={t("day_attOpen")} onPress={() => router.push("/coach/einheit/" + date)} /> : null}
        </Row>
      </Card> : null}
      {x.events.map(e => <Card key={e.id} tone={c.event}><T bold>{t("it_event")}: {e.titel}</T>{e.zeit ? <Muted small>{e.zeit}</Muted> : null}</Card>)}
      {!tr && !x.match ? <Banner testID="td-free">{x.brk ? t("vb_noTraining") : t("td_freeD")}</Banner> : null}

      {/* Ablauf */}
      {tr ? <Card testID="td-blocks">
        <CardTitle title={t("td_blocks")} info={<Info title={t("td_blocks")} text={t("td_blocksInfo")} />}
          right={me ? <Btn small kind={mine ? "primary" : "default"} testID="td-mine" label={mine ? t("td_mineOn") : t("td_mine")} onPress={() => setMine(!mine)} /> : undefined} />
        {coMode && me ? <Muted small>{tf("td_coHint", { n: me.name.split(" ")[0] })}</Muted> : null}
        {shown.length ? shown.map(({ b, from, to, parallel }) => {
          const o = !!open[b.id], g = b.groupId ? E.D.groups.find(y => y.id === b.groupId) : null, st = b.staffId ? E.D.staff.find(y => y.id === b.staffId) : null;
          const isMine = !!me && b.staffId === me.id;
          return (
            <View key={b.id} testID={"td-block-" + b.id} style={{ borderLeftWidth: 4, borderLeftColor: isMine ? c.accent : parallel ? c.event : c.line, backgroundColor: isMine ? withAlpha(c.accent, 0.06) : "transparent", borderRadius: radius.s, paddingVertical: 8, paddingHorizontal: 10, gap: 6 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={b.title} onPress={() => setOpen(v => ({ ...v, [b.id]: !o }))} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Col gap={0} style={{ width: 50 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: c.ink, fontVariant: ["tabular-nums"] }}>{from}</Text>
                  <Text style={{ fontSize: 11, color: c.muted, fontVariant: ["tabular-nums"] }}>{to}</Text>
                </Col>
                <Col gap={2} style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: "700", color: c.ink }}>{b.title}</Text>
                  <Text style={{ fontSize: 12, color: c.muted }}>{b.min} {t("min")}{st ? " · " + st.name : ""}{parallel ? " · " + t("td_parallel") : ""}{b.points.length ? " · " + tf("td_points", { n: b.points.length }) : ""}{b.drawing || b.photo ? " · ✎" : ""}</Text>
                </Col>
                {g ? <GroupChip group={g} /> : null}
                <StaffDot staffId={b.staffId} />
                <Text style={{ color: c.muted }}>{o ? "▴" : "▾"}</Text>
              </Pressable>
              {o ? <Col gap={8} testID={"td-block-open-" + b.id}>
                {b.text ? <T v="small">{b.text}</T> : null}
                {b.points.length ? <Col gap={3}>
                  <T v="eyebrow">{t("blk_points")}</T>
                  {b.points.map((p, i) => <Row key={i} gap={6} align="flex-start"><Text style={{ color: c.accentTx, fontWeight: "800" }}>•</Text><Text style={{ flex: 1, color: c.ink, fontSize: 14 }}>{p}</Text></Row>)}
                </Col> : null}
                {b.drawing ? <BoardView value={b.drawing} /> : null}
                {b.photo ? <SketchImage path={b.photo} /> : null}
                <Row gap={6} wrap>
                  <Btn small testID={"td-block-edit-" + b.id} label={t("edit")} onPress={() => setEdit(b)} />
                  {!mine ? <><Btn small kind="ghost" label="↑" a11y="↑" onPress={() => move(b, -1)} /><Btn small kind="ghost" label="↓" a11y="↓" onPress={() => move(b, 1)} /></> : null}
                </Row>
              </Col> : null}
            </View>
          );
        }) : <Muted>{mine ? t("td_noMine") : t("td_noBlocks")}</Muted>}
        {!mine || !blocks.length ? <Row between wrap gap={8}>
          <Muted small>{tf("td_total", { a: total, b: tr.dauer })}</Muted>
          {total > tr.dauer + 5 ? <Tag label={t("td_tooLong")} /> : null}
        </Row> : null}
        <Row gap={8} wrap>
          <Btn small icon="plus" kind="primary" testID="td-add" label={t("td_add")} onPress={() => setEdit(newBlock())} />
          {E.mods.archiv && E.D.templates.length && !blocks.length ? <Btn small testID="td-tpl" label={t("tp_fromArchive")} onPress={() => setTpl(true)} /> : null}
        </Row>
      </Card> : null}

      {/* Kader */}
      {tr || x.match ? <Card testID="td-squad">
        <CardTitle title={tf("day_avail", { a: avail.length, n: E.D.players.length })} />
        <Row wrap gap={6}>
          <Chip label={tf("td_tw", { n: avail.filter(p => p.pos === "TW").length })} color={c.muted} />
          <Chip label={tf("td_field", { n: avail.filter(p => p.pos !== "TW").length })} color={c.muted} />
        </Row>
        {tr ? <IndivSummary date={date} testID="td-iv" /> : null}
        {ab.length ? <Col gap={4}>
          <T v="eyebrow">{t("td_absent")}</T>
          {ab.map(p => { const a = E.absenceOn(p.id, date)!; return (
            <Row key={p.id} gap={8}><PlayerAvatar p={p} size={26} /><Text style={{ flex: 1, color: c.ink, fontSize: 14 }}>{E.name(p)}</Text><Muted small>{t("ab_" + a.typ)}{a.bis ? " " + t("until") + " " + E.de(a.bis) : ""}</Muted></Row>
          ); })}
        </Col> : <Muted small>{t("day_all")}</Muted>}
      </Card> : null}

      <BlockSheet block={edit} onClose={() => setEdit(undefined)} />
      <TemplatePicker visible={tpl} onClose={() => setTpl(false)} onPick={async tp => {
        let k = nextSort;
        for (const tb of tp.blocks) {
          const ex = tb.exId ? E.D.exercises.find(e => e.id === tb.exId) : null;
          await s.saveBlock(newBlock({ sort: k++, title: ex ? ex.title : tb.text || t("blk_untitled"), min: tb.min, staffId: tb.staffId || null, exId: ex?.id || null,
            text: ex ? ex.desc : "", points: ex ? ex.points.map(p => p.text) : [], drawing: ex?.drawing || null }));
        }
        s.toast(t("t_saved"));
      }} />
      {sheets.el}
    </Screen>
  );
}
