// Info-Button zu einem Fachbegriff aus dem Wiki (z. B. ACWR) – mit Sprung ins Wiki.
import { useRouter } from "expo-router";
import React from "react";
import { wikiOf, wikiText } from "../core/wiki";
import { useStore } from "../data/store";
import { Btn, Col, Info, Muted, T } from "./kit";

export function TermInfo({ k, testID }: { k: string; testID?: string }) {
  const s = useStore(); const router = useRouter(); const e = wikiOf(k);
  if (!e) return null;
  const x = wikiText(e, s.lang);
  return (
    <Info title={x.t} testID={testID || "term-" + k}>
      <Col gap={10}>
        <T bold>{x.s}</T>
        {x.l.map((p, i) => <T key={i}>{p}</T>)}
        {e.src ? <Muted small>{s.tr.t("wk_src")}: {e.src}</Muted> : null}
        <Btn small label={s.tr.t("wk_open")} onPress={() => router.push("/wiki?k=" + k)} style={{ alignSelf: "flex-start" }} />
      </Col>
    </Info>
  );
}
