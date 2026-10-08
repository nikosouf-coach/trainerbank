// Begriffe erklärt (Wiki / Legende) – für Trainer und Spieler.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { WIKI_CATS, searchWiki, wikiText, type WikiCat } from "../src/core/wiki";
import { useStore } from "../src/data/store";
import { Icon } from "../src/ui/icons";
import { Card, ChoiceChips, Col, Field, Header, Muted, Screen, T } from "../src/ui/kit";
import { radius, useTheme, withAlpha } from "../src/ui/theme";

export default function Wiki() {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme(); const router = useRouter();
  const params = useLocalSearchParams<{ k?: string }>();
  const [q, setQ] = useState(""), [cat, setCat] = useState<WikiCat | "all">("all");
  const [open, setOpen] = useState<string | null>(params.k || null);
  const list = searchWiki(q, s.lang).filter(e => cat === "all" || e.cat === cat)
    .sort((a, b) => (a.k === params.k ? -1 : b.k === params.k ? 1 : 0));
  const back = () => router.canGoBack() ? router.back() : router.replace("/");
  return (
    <Screen testID="wiki">
      <Header title={t("wk_title")} onBack={back} backLabel={t("btn_back")} />
      <Muted>{t("wk_sub")}</Muted>
      <Field testID="wiki-search" label={t("wk_search")} value={q} onChangeText={setQ} placeholder={t("wk_searchPh")} />
      <ChoiceChips testID="wiki-cat" value={cat} onChange={setCat} options={[{ key: "all" as const, label: t("ar_all") }, ...WIKI_CATS.map(k => ({ key: k, label: t("wk_c_" + k) }))]} />
      {list.length ? list.map(e => {
        const x = wikiText(e, s.lang), on = open === e.k || !!q.trim();
        return (
          <Card key={e.k} testID={"wiki-" + e.k} style={{ gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => setOpen(open === e.k ? null : e.k)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Col gap={4} style={{ flex: 1 }}>
                <Text style={{ fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, color: c.accentTx, textTransform: "uppercase" }}>{t("wk_c_" + e.cat)}</Text>
                <T v="h3">{x.t}</T>
                <T v="small">{x.s}</T>
              </Col>
              <View style={{ transform: [{ rotate: on ? "90deg" : "0deg" }], paddingTop: 18 }}><Icon name="chevron" size={16} color={c.muted} /></View>
            </Pressable>
            {on ? <Col gap={8} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}>
              {x.l.map((p, i) => <T key={i}>{p}</T>)}
              {e.src ? <View style={{ backgroundColor: withAlpha(c.accentTx, 0.07), borderRadius: radius.s, padding: 8 }}><Muted small>{t("wk_src")}: {e.src}</Muted></View> : null}
            </Col> : null}
          </Card>
        );
      }) : <Muted>{t("wk_none")}</Muted>}
    </Screen>
  );
}
