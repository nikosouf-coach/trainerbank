// Anzeige der individuellen Vorgaben: Zusammenfassung je Einheit (Trainer) und „Für dich“ (Spieler).
import React, { useState } from "react";
import { Text, View } from "react-native";
import { indivFor, indivLabel, indivOf, type IndivKind, type IndivTarget } from "../core/indiv";
import { useEngine } from "../data/store";
import { Btn, Col, Info, Muted, Row, T } from "./kit";
import { radius, rpeColor, useTheme, withAlpha } from "./theme";

export const INDIV_COLOR: Record<IndivKind, string> = {
  team: "#5c6b7a", comp: "#f0762b", compHalf: "#e8a20c", reha: "#d6336c", return: "#c2255c", build: "#16a3a3",
  tw: "#f0762b", growth: "#7b5fd0", easy: "#c9a400", pause: "#d9452f", absent: "#8b939e", sick: "#8b939e",
};
const ORDER: IndivKind[] = ["comp", "compHalf", "reha", "return", "build", "tw", "growth", "easy", "pause", "sick", "absent"];

/** Kleine farbige Marke für die Art der Vorgabe. */
export function IndivChip({ v }: { v: IndivTarget }) {
  const E = useEngine(); const col = INDIV_COLOR[v.kind];
  return (
    <View style={{ backgroundColor: withAlpha(col, 0.14), borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: col, fontWeight: "800", fontSize: 11.5 }}>{indivLabel(E, v.kind)}{v.rpe ? ` · RPE ${v.rpe}` : ""}</Text>
    </View>
  );
}

/** Trainer: aufklappbare Liste der Spieler mit eigener Vorgabe für eine Einheit, gruppiert nach Art. */
export function IndivSummary({ date, testID }: { date: string; testID?: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const all = indivFor(E, date), list = all.filter(v => v.differs && v.kind !== "absent");
  if (!all.length || E.grp === "u11") return null;
  if (!list.length) return <Muted small>{t("iv_none")}</Muted>;
  const by = ORDER.map(k => ({ k, L: list.filter(v => v.kind === k) })).filter(x => x.L.length);
  return (
    <Col gap={6} testID={testID}>
      <Row gap={6} wrap>
        <Btn small kind="ghost" testID={testID ? testID + "-toggle" : undefined} label={`👤 ${tf("iv_sum", { n: list.length })} ${open ? "▴" : "▾"}`} onPress={() => setOpen(!open)} style={{ paddingHorizontal: 0 }} />
        {!open ? by.slice(0, 4).map(x => <Text key={x.k} style={{ fontSize: 12, fontWeight: "700", color: INDIV_COLOR[x.k] }}>{x.L.length} {indivLabel(E, x.k)}</Text>) : null}
        <Info title={t("iv_title")} text={t("iv_info")} />
      </Row>
      {open ? by.map(x => {
        const v0 = x.L[0], same = x.L.every(v => v.rpe === v0.rpe && v.dauer === v0.dauer);
        return (
          <View key={x.k} testID={testID ? `${testID}-${x.k}` : undefined} style={{ borderLeftWidth: 3, borderLeftColor: INDIV_COLOR[x.k], paddingLeft: 10, gap: 3 }}>
            <Row gap={6} wrap>
              <T v="small" bold style={{ color: INDIV_COLOR[x.k] }}>{indivLabel(E, x.k)} ({x.L.length})</T>
              {same && v0.rpe ? <Muted small>{tf("iv_rpeMin", { r: v0.rpe, m: v0.dauer })}</Muted> : null}
            </Row>
            {x.L.map(v => { const p = E.P(v.pid); if (!p) return null; return (
              <Text key={v.pid} style={{ fontSize: 13, color: c.ink }}>
                <Text style={{ fontWeight: "700" }}>{E.name(p)}</Text>
                {!same && v.rpe ? <Text style={{ color: rpeColor(c, v.rpe), fontWeight: "700" }}> · RPE {v.rpe} · {v.dauer} {t("min")}</Text> : null}
                {v.why.length ? <Text style={{ color: c.muted }}> – {v.why.join(" · ")}</Text> : null}
              </Text>
            ); })}
            {v0.how ? <Muted small>{v0.how}</Muted> : null}
          </View>
        );
      }) : null}
    </Col>
  );
}

/** Spieler: eigene Vorgabe für einen Tag (nur wenn sie von der Mannschaft abweicht). */
export function MyTarget({ pid, date, detail, testID, label }: { pid: string; date: string; detail?: boolean; testID?: string; label?: string }) {
  const E = useEngine(); const { t, tf } = E; const { c } = useTheme();
  const v = indivOf(E, pid, date);
  if (!v || !v.differs || v.kind === "absent" || E.grp === "u11") return null;
  const col = INDIV_COLOR[v.kind];
  return (
    <View testID={testID} style={{ backgroundColor: withAlpha(col, 0.1), borderRadius: radius.s, paddingVertical: 6, paddingHorizontal: 9, gap: 2, alignSelf: "stretch" }}>
      <Text style={{ fontSize: 12.5, fontWeight: "800", color: col }}>
        {label ?? t("iv_forYou")}: {indivLabel(E, v.kind)} · {v.rpe ? tf("iv_rpeMin", { r: v.rpe, m: v.dauer }) : t("iv_off")}
      </Text>
      {v.why.length ? <Text style={{ fontSize: 12, color: c.muted }}>{v.why.join(" · ")}</Text> : null}
      {detail && v.how ? <Text style={{ fontSize: 12.5, color: c.ink }}>{v.how}</Text> : null}
    </View>
  );
}
