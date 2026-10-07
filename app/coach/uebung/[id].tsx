// Trainer – Übung bearbeiten: Titel, Kategorie, Themen, Organisation, Zeichnung, Coachingpunkte mit Zuständigkeit.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import type { CoachPoint, Drawing, Exercise } from "../../../src/core/types";
import { tmpId, useEngine, useStore } from "../../../src/data/store";
import { useAi } from "../../../src/ui/ai";
import { CATS } from "../../../src/ui/archive";
import { BoardEditor, emptyDrawing } from "../../../src/ui/board";
import { Btn, Card, CardTitle, ChoiceChips, Col, Field, Header, Muted, NumField, NumScale, Picker, Row, Screen, T } from "../../../src/ui/kit";
import { radius, rpeColor, useTheme, withAlpha } from "../../../src/ui/theme";

export default function Uebung() {
  const s = useStore(); const E = useEngine(); const { t } = E; const { c } = useTheme(); const router = useRouter();
  const { id = "neu" } = useLocalSearchParams<{ id: string }>();
  const ex0 = E.D.exercises.find(x => x.id === id);
  const [title, setTitle] = useState(ex0?.title || "");
  const [cat, setCat] = useState<Exercise["cat"]>(ex0?.cat || "spielform");
  const [themes, setThemes] = useState<string[]>(ex0?.themes || []);
  const [theme, setTheme] = useState("");
  const [dur, setDur] = useState<number | null>(ex0?.dur ?? 15);
  const [players, setPlayers] = useState(ex0?.players || "");
  const [area, setArea] = useState(ex0?.area || "");
  const [rpe, setRpe] = useState<number | null>(ex0?.rpe ?? null);
  const [desc, setDesc] = useState(ex0?.desc || "");
  const [points, setPoints] = useState<CoachPoint[]>(ex0?.points || []);
  const [pt, setPt] = useState("");
  const [drawing, setDrawing] = useState<Drawing | null>(ex0?.drawing || null);
  const [video, setVideo] = useState(ex0?.video || "");
  const [msg, setMsg] = useState("");
  const ai = useAi();
  const back = () => router.canGoBack() ? router.back() : router.replace("/coach/archiv");
  const save = () => {
    if (!title.trim()) { setMsg(t("ex_need")); return; }
    s.saveExercise({ id: ex0?.id || tmpId(), title: title.trim(), cat, themes, dur: dur || 15, players: players.trim(), area: area.trim(), rpe, desc: desc.trim(), points, drawing, video: /^https?:\/\//i.test(video.trim()) ? video.trim() : "" });
    s.toast(t("ex_saved")); back();
  };
  const suggest = async () => {
    const prompt = E.tr.lang === "en"
      ? `Suggest 4 short, concrete coaching points for this drill: "${title}" (${t("cat_" + cat)}). ${desc}\nOutput only lines starting with "- ".`
      : `Nenne 4 kurze, konkrete Coachingpunkte für diese Übung: „${title}“ (${t("cat_" + cat)}). ${desc}\nNur Zeilen, die mit „- “ beginnen.`;
    const r = await ai.run("coach", prompt, E.aiContext(pid => s.aiPlayers.includes(pid)));
    if (r) setPoints([...points, ...r.split(/\n/).map(l => l.match(/^\s*[-*•]\s*(.+)$/)?.[1]?.replace(/\*\*/g, "").trim()).filter((x): x is string => !!x).slice(0, 6).map(text => ({ text, staffId: null }))]);
  };
  const staffOpts = [{ key: "", label: t("ex_nobody") }, ...E.D.staff.map(x => ({ key: x.id, label: x.name }))];
  return (
    <Screen testID="coach-uebung">
      <Header title={ex0 ? t("ex_edit") : t("ex_new")} onBack={back} backLabel={t("ar_title")} />
      <Card>
        <Field testID="ex-title" label={t("ex_title")} value={title} onChangeText={setTitle} />
        <Col gap={6}><T v="small" bold color={c.muted}>{t("ex_cat")}</T><ChoiceChips testID="ex-cat" value={cat} onChange={setCat} options={CATS.map(k => ({ key: k, label: t("cat_" + k) }))} /></Col>
        <Col gap={6}>
          <T v="small" bold color={c.muted}>{t("ex_themes")}</T>
          <Row wrap gap={6}>{themes.map(th => <Pressable key={th} accessibilityRole="button" accessibilityLabel={t("del") + " " + th} onPress={() => setThemes(themes.filter(x => x !== th))} style={{ backgroundColor: withAlpha(c.accent, 0.12), borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: c.accentTx, fontWeight: "700", fontSize: 13 }}># {th} ✕</Text></Pressable>)}</Row>
          <Row gap={8} align="flex-end">
            <Field testID="ex-theme" label="" value={theme} onChangeText={setTheme} placeholder={t("ex_themesPh")} style={{ flex: 1 }} />
            <Btn small testID="ex-theme-add" label={t("pot_add")} disabled={!theme.trim()} onPress={() => { if (!themes.includes(theme.trim())) setThemes([...themes, theme.trim()]); setTheme(""); }} />
          </Row>
        </Col>
        <Row wrap gap={10}>
          <NumField testID="ex-dur" label={t("ex_dur")} value={dur} onChange={setDur} min={1} max={180} step={1} style={{ width: 120 }} />
          <Field testID="ex-players" label={t("ex_players")} value={players} onChangeText={setPlayers} style={{ width: 120 }} />
          <Field testID="ex-area" label={t("ex_area")} value={area} onChangeText={setArea} style={{ flex: 1, minWidth: 140 }} />
        </Row>
        <Col gap={6}><T v="small" bold color={c.muted}>{t("ex_rpe")}{rpe != null ? `: ${rpe} · ${E.intWord(rpe)}` : ""}</T>
          <NumScale testID="ex-rpe" value={rpe} min={1} max={10} color={n => rpeColor(c, n)} onChange={v => setRpe(rpe === v ? null : v)} /></Col>
        <Field testID="ex-desc" label={t("ex_desc")} value={desc} onChangeText={setDesc} multiline />
      </Card>
      <Card testID="ex-drawing">
        <CardTitle title={t("bd_draw")} right={drawing ? <Btn small kind="ghost" label={t("del")} onPress={() => setDrawing(null)} /> : undefined} />
        {drawing ? <BoardEditor value={drawing} onChange={setDrawing} /> : <Btn testID="ex-draw-add" label={t("bd_add")} icon="plus" onPress={() => setDrawing(emptyDrawing())} style={{ alignSelf: "flex-start" }} />}
      </Card>
      <Card testID="ex-points">
        <CardTitle title={t("ex_points")} />
        {points.map((p, i) => (
          <Row key={i} gap={8} align="flex-start" wrap>
            <Text style={{ color: c.accentTx, fontWeight: "800" }}>{i + 1}.</Text>
            <Text style={{ flex: 1, minWidth: 160, color: c.ink, fontSize: 14.5 }}>{p.text}</Text>
            {E.D.staff.length ? <Picker label="" value={p.staffId || ""} onChange={v => setPoints(points.map((x, j) => j === i ? { ...x, staffId: v || null } : x))} options={staffOpts} style={{ width: 150 }} /> : null}
            <Btn small kind="ghost" icon="trash" label="" a11y={t("del")} onPress={() => setPoints(points.filter((_, j) => j !== i))} />
          </Row>
        ))}
        <Row gap={8} align="flex-end">
          <Field testID="ex-point" label="" value={pt} onChangeText={setPt} placeholder={t("ex_pointPh")} style={{ flex: 1 }} />
          <Btn small testID="ex-point-add" label={t("pot_add")} disabled={!pt.trim()} onPress={() => { setPoints([...points, { text: pt.trim(), staffId: null }]); setPt(""); }} />
        </Row>
        {E.mods.ki ? <Row gap={8}><Btn small icon="spark" testID="ex-ai" label={t("ex_aiPoints")} disabled={ai.busy || !title.trim()} onPress={suggest} />{ai.busy ? <ActivityIndicator color={c.accent} /> : null}</Row> : null}
        {ai.err ? <Muted small>{ai.err}</Muted> : null}
      </Card>
      <Card><Field testID="ex-video" label={t("ex_video")} value={video} onChangeText={setVideo} placeholder="https://…" autoCapitalize="none" /></Card>
      {msg ? <Muted>{msg}</Muted> : null}
      <Row gap={8} wrap>
        <Btn testID="ex-save" kind="primary" label={t("save")} onPress={save} />
        {ex0 ? <Btn kind="ghost" testID="ex-del" label={t("ex_del")} onPress={() => { s.deleteExercise(ex0.id); back(); }} /> : null}
      </Row>
    </Screen>
  );
}
