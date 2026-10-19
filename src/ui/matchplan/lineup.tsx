// Matchplan: Aufstellung per Ziehen (oder Antippen): Spielfeld mit Grundordnung, Ersatzbank und „nicht im Kader“.
// Ziehen: Spieler auf eine Position (tauschen), frei aufs Feld, auf die Bank oder aus dem Kader. Leere Positionen
// lassen sich verschieben. Antippen: Spieler wählen, dann Ziel antippen – oder die Knöpfe der Auswahlleiste nutzen.
// Am Handy liegt die Aufstellung auf einer scrollbaren Seite: Ziehen startet nach kurzem Halten (oder waagerecht),
// senkrechtes Wischen scrollt die Seite. Während des Ziehens bewegt sich nur das Icon am Finger (flüssig).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { BENCH_DEF, FMTS, MP_LOOKS, formationsOf, lineupFor, moveItem, placePlayer, squadOf, suggestLineup, type MpDrop } from "../../core/matchplan";
import type { MpContent, MpFmt, MpItem, MpLook, MpMode } from "../../core/types";
import { useEngine, useStore } from "../../data/store";
import { Banner, Btn, Col, Muted, Picker, Row, Seg, T, useScrollLock } from "../kit";
import { PlayerAvatar } from "../playerAvatar";
import { radius, useTheme, withAlpha } from "../theme";
import { useAvail, useTokenInfo } from "./common";
import { FULL, LOOKS, Pitch, TokenGhost, geom, tokenPx, usePitchWidth, type TokenInfo } from "./pitch";

const CHIP_H = 42, GAP = 6, HEAD = 28;
type Hit = { k: "token"; it: MpItem } | { k: "chip"; pid: string; zone: "bench" | "out" } | { k: "pitch"; x: number; y: number } | { k: "zone"; zone: "bench" | "out" };
type Drag = { what: { k: "pid"; pid: string } | { k: "slot"; id: string }; x0: number; y0: number; moved: boolean; armed: boolean; timer: ReturnType<typeof setTimeout> | null };
type Pos = { x: number; y: number };

/** Icon am Finger: eigener Zustand, damit beim Ziehen nicht die ganze Aufstellung neu gezeichnet wird */
function Ghost({ bind, d, info, mode, accent, accentInk }: { bind: { current: ((p: Pos | null) => void) | null }; d: number; info: TokenInfo | null; mode: MpMode; accent: string; accentInk: string }) {
  const [p, setP] = useState<Pos | null>(null);
  useEffect(() => { bind.current = setP; return () => { bind.current = null; }; }, [bind]);
  if (!p) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: p.x - d / 2, top: p.y - d / 2, opacity: 0.94, transform: [{ scale: 1.12 }] }}>
      <TokenGhost info={info} d={d} mode={mode} accent={accent} accentInk={accentInk} />
    </View>
  );
}

export const SIZES: { key: string; v: number }[] = [{ key: "S", v: 0.8 }, { key: "M", v: 1 }, { key: "L", v: 1.2 }, { key: "XL", v: 1.4 }];
/** Nächstliegende Größenstufe */
export const sizeKey = (v: number): string => SIZES.reduce((a, b) => Math.abs(b.v - v) < Math.abs(a.v - v) ? b : a).key;
/** Ansicht der Icons, Größe und Spielfeld-Design (gilt für den ganzen Plan, auch für Spieler) */
export function DisplayControls({ c, onChange, testID = "mp" }: { c: MpContent; onChange: (c: MpContent) => void; testID?: string }) {
  const E = useEngine(); const { t } = E; const { c: col } = useTheme();
  const look = c.look || "grass";
  const setLook = (l: MpLook) => { const n = { ...c }; if (l === "grass") delete n.look; else n.look = l; onChange(n); };
  return (
    <Row wrap gap={10} align="flex-end">
      <Col gap={4}><Muted small>{t("mp_mode")}</Muted>
        <Seg testID={testID + "-mode"} value={c.mode} onChange={(m: MpMode) => onChange({ ...c, mode: m })} options={(["num", "name", "photo"] as const).map(k => ({ key: k, label: t("mp_mode_" + k) }))} />
      </Col>
      <Col gap={4}><Muted small>{t("mp_size")}</Muted>
        <Seg testID={testID + "-size"} value={sizeKey(c.size)} onChange={k => onChange({ ...c, size: SIZES.find(x => x.key === k)!.v })} options={SIZES.map(x => ({ key: x.key, label: x.key }))} />
      </Col>
      <Col gap={4}><Muted small>{t("mp_look")}</Muted>
        <Row gap={6} testID={testID + "-look"}>
          {MP_LOOKS.map(l => {
            const on = look === l, L = LOOKS[l];
            return (
              <Pressable key={l} testID={testID + "-look-" + l} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t("mpl_" + l)} onPress={() => setLook(l)}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 9, borderRadius: radius.m, borderWidth: 1.5, borderColor: on ? col.accent : col.line, backgroundColor: on ? col.accentSoft : col.surface }}>
                <View style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: L.bg, borderWidth: 1, borderColor: L.mark }} />
                <Text style={{ fontWeight: "700", fontSize: 13, color: col.ink }}>{t("mpl_" + l)}</Text>
              </Pressable>
            );
          })}
        </Row>
      </Col>
    </Row>
  );
}

export function LineupEditor({ c, onChange, date, ro }: { c: MpContent; onChange: (c: MpContent) => void; date: string | null; ro?: boolean }) {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c: col } = useTheme();
  const info = useTokenInfo(), av = useAvail(date);
  const [W, setW] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  /** gerade gezogen (Spieler bzw. leere Position) – die Position am Finger kennt nur das Icon (Ghost) */
  const [ghost, setGhost] = useState<{ pid: string | null; id?: string } | null>(null);
  const drag = useRef<Drag | null>(null), ghostAt = useRef<((p: Pos | null) => void) | null>(null);
  const lock = useScrollLock(), hold = Platform.OS !== "web";
  useEffect(() => () => { if (drag.current?.timer) clearTimeout(drag.current.timer); }, []);

  const pw = usePitchWidth(FULL, W), g = geom(FULL, pw), ox = Math.max(0, (W - pw) / 2), d = tokenPx(pw, c.size);
  const squad = squadOf(c);
  const outList = useMemo(() => E.D.players.filter(p => !squad.includes(p.id)).sort((a, b) => Number(av.out(a.id)) - Number(av.out(b.id)) || (a.nr ?? 99) - (b.nr ?? 99)).map(p => p.id),
    [E, squad.join(","), av]); // eslint-disable-line react-hooks/exhaustive-deps
  // Raster für Bank und „nicht im Kader“ (feste Größen – so lassen sich Ziele beim Ziehen genau bestimmen)
  const cols = Math.max(2, Math.floor((W + GAP) / (118 + GAP))), chipW = W ? (W - GAP * (cols - 1)) / cols : 110;
  const rows = (n: number) => Math.max(1, Math.ceil(n / cols));
  const benchTop = g.h + 16, benchH = HEAD + rows(c.bench.length) * (CHIP_H + GAP);
  const outTop = benchTop + benchH + 12, outH = HEAD + rows(outList.length) * (CHIP_H + GAP);
  const total = outTop + outH;
  const chipPos = (zone: "bench" | "out", i: number) => ({ left: (i % cols) * (chipW + GAP), top: (zone === "bench" ? benchTop : outTop) + HEAD + Math.floor(i / cols) * (CHIP_H + GAP) });

  const hit = (x: number, y: number): Hit | null => {
    if (x >= ox && x <= ox + pw && y >= 0 && y <= g.h) {
      const m = g.m(x - ox, y);
      let best: MpItem | null = null, bd = (d / 2 + 8) / g.k;
      for (const it of c.lineup) { const dist = Math.hypot(it.x - m.x, it.y - m.y); if (dist < bd) { bd = dist; best = it; } }
      return best ? { k: "token", it: best } : { k: "pitch", x: m.x, y: m.y };
    }
    for (const zone of ["bench", "out"] as const) {
      const top = zone === "bench" ? benchTop : outTop, h = zone === "bench" ? benchH : outH;
      if (y < top - 6 || y > top + h) continue;
      const L = zone === "bench" ? c.bench : outList;
      for (let i = 0; i < L.length; i++) { const p = chipPos(zone, i); if (x >= p.left && x <= p.left + chipW && y >= p.top && y <= p.top + CHIP_H) return { k: "chip", pid: L[i], zone }; }
      return { k: "zone", zone };
    }
    return null;
  };
  const where = (pid: string): "pitch" | "bench" | "out" => c.lineup.some(x => x.pid === pid) ? "pitch" : c.bench.includes(pid) ? "bench" : "out";
  const apply = (pid: string, to: MpDrop) => {
    const n = placePlayer(c, pid, to);
    if (n === c && to.k === "free") s.toast(t("mp_full"));
    if (n !== c) onChange(n);
  };
  const drop = (pid: string, h: Hit | null) => {
    if (!h) return;
    if (h.k === "token") { if (h.it.pid !== pid) apply(pid, { k: "slot", id: h.it.id }); return; }
    if (h.k === "pitch") { apply(pid, { k: "free", x: h.x, y: h.y }); return; }
    const zone = h.zone; if (where(pid) !== zone) apply(pid, { k: zone });
  };

  const pt = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
  const start = (e: GestureResponderEvent): boolean => {
    if (ro) return false;
    const { x, y } = pt(e), h = hit(x, y);
    if (!h) return false;
    if (h.k === "token" || h.k === "chip") return true;
    return !!sel; // freie Fläche nur mit Auswahl (sonst darf die Seite scrollen)
  };
  /** Ziehen beginnt: Icon anheben (Original ausblenden), Seite nicht mehr scrollen */
  const lift = (dr: Drag, p: Pos) => {
    if (!dr.armed) { dr.armed = true; if (hold) lock(true); }
    setGhost({ pid: dr.what.k === "pid" ? dr.what.pid : null, id: dr.what.k === "slot" ? dr.what.id : c.lineup.find(z => dr.what.k === "pid" && z.pid === dr.what.pid)?.id });
    ghostAt.current?.(p);
  };
  const stop = () => { const dr = drag.current; if (dr?.timer) clearTimeout(dr.timer); if (dr?.armed && hold) lock(false); drag.current = null; setGhost(null); ghostAt.current?.(null); };
  const grant = (e: GestureResponderEvent) => {
    const { x, y } = pt(e), h = hit(x, y);
    const what: Drag["what"] | null = h?.k === "token" ? (h.it.pid ? { k: "pid", pid: h.it.pid } : { k: "slot", id: h.it.id }) : h?.k === "chip" ? { k: "pid", pid: h.pid } : null;
    drag.current = what ? { what, x0: x, y0: y, moved: false, armed: !hold, timer: null } : null;
    // Handy: kurz halten hebt das Icon an
    if (drag.current && hold) { const dr = drag.current; dr.timer = setTimeout(() => { if (drag.current === dr && !dr.moved) lift(dr, { x: dr.x0, y: dr.y0 }); }, 170); }
  };
  const move = (e: GestureResponderEvent) => {
    const dr = drag.current; if (!dr) return; const { x, y } = pt(e);
    if (!dr.moved) {
      if (Math.hypot(x - dr.x0, y - dr.y0) < 7) return;
      // ohne Halten: senkrecht = Seite scrollen, waagerecht = ziehen
      if (!dr.armed && Math.abs(x - dr.x0) <= Math.abs(y - dr.y0) * 1.2) { stop(); return; }
      dr.moved = true; lift(dr, { x, y });
    }
    ghostAt.current?.({ x, y });
  };
  const release = (e: GestureResponderEvent) => {
    const dr = drag.current; stop();
    const { x, y } = pt(e), h = hit(x, y);
    if (dr?.moved) {
      if (dr.what.k === "pid") drop(dr.what.pid, h);
      else if (h?.k === "pitch") onChange({ ...c, lineup: moveItem(c.lineup, dr.what.id, h.x, h.y) });
      setSel(null); return;
    }
    // Antippen
    if (!h) return;
    if (h.k === "token" && h.it.pid) {
      if (sel && sel !== h.it.pid) { apply(sel, { k: "slot", id: h.it.id }); setSel(null); } else setSel(sel === h.it.pid ? null : h.it.pid);
      return;
    }
    if (h.k === "token") { if (sel) { apply(sel, { k: "slot", id: h.it.id }); setSel(null); } else s.toast(t("mp_tapHint")); return; }
    if (h.k === "chip") {
      if (sel && sel !== h.pid && where(sel) === "pitch") { const slot = c.lineup.find(z => z.pid === sel)!; apply(h.pid, { k: "slot", id: slot.id }); setSel(null); }
      else setSel(sel === h.pid ? null : h.pid);
      return;
    }
    if (!sel) return;
    if (h.k === "pitch") apply(sel, { k: "free", x: h.x, y: h.y });
    else if (where(sel) !== h.zone) apply(sel, { k: h.zone });
    setSel(null);
  };

  const chip = (pid: string, zone: "bench" | "out", i: number) => {
    const inf = info(pid), p = inf?.p, pos = chipPos(zone, i), on = sel === pid, dot = av.dot(pid), off = zone === "out" && av.out(pid);
    if (!p) return null;
    return (
      <View key={pid} testID={"chip-" + pid} accessibilityLabel={E.name(p)} style={{ position: "absolute", left: pos.left, top: pos.top, width: chipW, height: CHIP_H, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 7,
        borderRadius: radius.m, borderWidth: on ? 2 : 1, borderColor: on ? "#e0a800" : col.line, backgroundColor: on ? withAlpha("#ffe066", 0.25) : col.surface, opacity: ghost?.pid === pid ? 0.35 : off ? 0.55 : 1 }}>
        <PlayerAvatar p={p} size={26} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "700", color: col.ink }}>{p.nr != null ? p.nr + " " : ""}{inf?.label}</Text>
          <Text numberOfLines={1} style={{ fontSize: 10.5, color: dot ? dot : col.muted }}>{av.why(pid) || p.pos}</Text>
        </View>
      </View>
    );
  };
  const zoneHead = (zone: "bench" | "out", top: number, h: number) => {
    const n = zone === "bench" ? c.bench.length : outList.length, hot = !!ghost || (!!sel && where(sel) !== zone);
    return (
      <View key={"z" + zone} style={{ position: "absolute", left: 0, right: 0, top: top - 6, height: h + 6, borderRadius: radius.l, borderWidth: hot ? 1.5 : 0, borderStyle: "dashed", borderColor: col.accent, backgroundColor: hot ? withAlpha(col.accent, 0.05) : "transparent" }}>
        <Text style={{ position: "absolute", left: 4, top: 8, fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: col.muted }}>
          {zone === "bench" ? tf("mp_bench", { n }) + (c.bench.length > BENCH_DEF[c.fmt] + 2 ? " ⚠" : "") : tf("mp_out", { n })}</Text>
      </View>
    );
  };
  const selP = sel ? info(sel) : null;
  const ghostInfo = ghost?.pid ? info(ghost.pid) : null;

  return (
    <Col gap={12}>
      <View testID="mp-lineup" onLayout={(e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width))} style={{ width: "100%", height: W ? total : 300 }}>
        {W ? <>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
            <View style={{ position: "absolute", left: ox, top: 0 }}>
              <Pitch frame={FULL} items={c.lineup} width={pw} mode={c.mode} size={c.size} accent={col.accent} accentInk={col.accentInk} info={info} captain={c.captain} look={c.look}
                selected={sel ? c.lineup.find(z => z.pid === sel)?.id || null : null} hidden={ghost?.id || null} dot={av.dot} testID="mp-pitch" />
            </View>
            {zoneHead("bench", benchTop, benchH)}
            {zoneHead("out", outTop, outH)}
            {c.bench.map((pid, i) => chip(pid, "bench", i))}
            {outList.map((pid, i) => chip(pid, "out", i))}
            {!c.bench.length ? <Text style={{ position: "absolute", left: 4, top: benchTop + HEAD + 10, fontSize: 12.5, color: col.muted }}>{t("mp_benchEmpty")}</Text> : null}
          </View>
          <View testID="mp-lineup-surface" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
            onStartShouldSetResponder={start} onMoveShouldSetResponder={() => !!drag.current} onResponderTerminationRequest={() => !drag.current?.armed}
            onResponderGrant={grant} onResponderMove={move} onResponderRelease={release} onResponderTerminate={stop} />
          <Ghost bind={ghostAt} d={d} info={ghostInfo} mode={c.mode} accent={col.accent} accentInk={col.accentInk} />
        </> : null}
      </View>
      {selP?.p && !ro ? <View testID="mp-selbar" style={{ padding: 10, borderRadius: radius.l, backgroundColor: withAlpha("#ffe066", 0.2), borderWidth: 1, borderColor: "#e0a800", gap: 8 }}>
        <T v="small" bold>{E.name(selP.p)}{av.why(sel!) ? " · " + av.why(sel!) : ""} – {t("mp_selHint")}</T>
        <Row wrap gap={6}>
          {where(sel!) !== "bench" ? <Btn small testID="mp-sel-bench" label={t("mp_toBench")} onPress={() => { apply(sel!, { k: "bench" }); setSel(null); }} /> : null}
          {where(sel!) !== "out" ? <Btn small testID="mp-sel-out" label={t("mp_toOut")} onPress={() => { apply(sel!, { k: "out" }); setSel(null); }} /> : null}
          {where(sel!) !== "out" ? <Btn small testID="mp-sel-captain" label={c.captain === sel ? t("mp_captainOff") : t("mp_captain")} onPress={() => { onChange({ ...c, captain: c.captain === sel ? null : sel }); setSel(null); }} /> : null}
          <Btn small kind="ghost" testID="mp-sel-cancel" label={t("cancel")} onPress={() => setSel(null)} />
        </Row>
      </View> : null}
      {!ro ? <Muted small>{t("mp_dragHint")}</Muted> : null}
    </Col>
  );
}

/** Spielform, Grundordnung, Vorschlag, Leeren */
export function FormationControls({ c, onChange, date }: { c: MpContent; onChange: (c: MpContent) => void; date: string | null }) {
  const E = useEngine(); const { t } = E; const av = useAvail(date);
  const setFormation = (fmt: MpFmt, key: string) => {
    const r = lineupFor(fmt, key, c.lineup);
    onChange({ ...c, fmt, formation: key, lineup: r.lineup, bench: [...c.bench, ...r.out.filter(x => !c.bench.includes(x))] });
  };
  const lastStart = useMemo(() => {
    // Startelf im letzten Spiel zuerst (Spieldaten), sonst Rückennummer
    const past = E.D.matches.filter(m => m.date < (date || E.TODAY)).sort((a, b) => a.date < b.date ? 1 : -1)[0];
    const st = past ? E.D.stats[past.id] || {} : {};
    return (pid: string) => st[pid]?.start ? 0 : st[pid] ? 1 : 2;
  }, [E, date]);
  return (
    <Col gap={10}>
      <Row wrap gap={10} align="flex-end">
        <Col gap={4}><Muted small>{t("mp_fmt")}</Muted>
          <Seg testID="mp-fmt" value={String(c.fmt)} onChange={k => { const fmt = Number(k) as MpFmt; setFormation(fmt, formationsOf(fmt)[0]); }} options={FMTS.map(f => ({ key: String(f), label: f + "er" }))} />
        </Col>
        <Picker testID="mp-formation" label={t("mp_formation")} value={c.formation} onChange={k => setFormation(c.fmt, k)} options={formationsOf(c.fmt).map(k => ({ key: k, label: k }))} style={{ width: 150 }} />
      </Row>
      <Row wrap gap={8}>
        <Btn small icon="spark" testID="mp-suggest" label={t("mp_suggest")} onPress={() => onChange(suggestLineup(c, E.D.players, pid => !av.out(pid), lastStart, p => E.isGK(p)))} />
        <Btn small kind="ghost" testID="mp-clear" label={t("mp_clear")} onPress={() => onChange({ ...c, lineup: c.lineup.map(x => ({ ...x, pid: null })), bench: [], captain: null })} />
      </Row>
      {c.lineup.some(x => x.pid && av.out(x.pid)) ? <Banner color="#c8402a" testID="mp-unavail">{t("mp_unavail")}</Banner> : null}
    </Col>
  );
}
