// Detailseiten: gemeinsame Beschriftungen und „Hintergrund & Quellen“ aus dem Wiki (Begriffe erklärt) – dieselben
// Texte und Quellen wie im Wiki, damit Wissenschaft an einer Stelle gepflegt wird.
import { useRouter } from "expo-router";
import React from "react";
import { parse } from "../core/dates";
import { wikiOf, wikiText, type WikiEntry } from "../core/wiki";
import { useStore } from "../data/store";
import { Background, Btn, Col, T } from "./kit";
import { useTheme } from "./theme";

/** Beschriftungen der Detailseiten-Bausteine */
export function useIx(): { explain: string; tips: string; bg: string } {
  const { t } = useStore().tr;
  return { explain: t("ix_explain"), tips: t("ix_tips"), bg: t("ix_bg") };
}

/** Langes Datum: „Dienstag, 20. Oktober“ bzw. „Tuesday, 20 October“ */
export function longDate(E: { tl: (k: string) => string[]; tr: { lang: string } }, isoDate: string): string {
  const d = parse(isoDate), wd = E.tl("wdl")[d.getDay()] || "", mo = E.tl("months")[d.getMonth()] || "";
  return E.tr.lang === "en" ? `${wd}, ${d.getDate()} ${mo}` : `${wd}, ${d.getDate()}. ${mo}`;
}

/** Aufklappbarer Hintergrund: eigene Absätze (extra), dann die Wiki-Einträge mit Quellen und Sprung ins Wiki */
export function WikiBackground({ keys, extra, testID, title }: { keys: string[]; extra?: string[]; testID?: string; title?: string }) {
  const s = useStore(); const { t } = s.tr; const router = useRouter(); const { c } = useTheme();
  const L = keys.map(wikiOf).filter((e): e is WikiEntry => !!e);
  const src = [...new Set(L.flatMap(e => (e.src || "").split(/;\s*/)).filter(Boolean))];
  return (
    <Background title={title || t("ix_bg")} text={extra} testID={testID || "ix-bg"} sources={src} sourcesLabel={t("wk_src")}>
      {L.map(e => { const x = wikiText(e, s.lang); return (
        <Col key={e.k} gap={4} style={{ marginTop: 4 }}>
          <T bold>{x.t}</T>
          {x.l.map((p, i) => <T key={i} v="small" style={{ fontSize: 14, lineHeight: 20 }}>{p}</T>)}
        </Col>
      ); })}
      {L.length ? <Btn small label={t("wk_open")} onPress={() => router.push("/wiki?k=" + L[0].k)} style={{ alignSelf: "flex-start", marginTop: 4 }} /> : null}
      {!L.length && !extra?.length ? <T v="small" color={c.muted}>–</T> : null}
    </Background>
  );
}
