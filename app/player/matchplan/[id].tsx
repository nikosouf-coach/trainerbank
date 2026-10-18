// Spieler – Matchplan ansehen: nur freigegebene Bereiche, bis Spielende. Wasserzeichen mit Name und Uhrzeit,
// Bildschirmschutz (Android gesperrt, iOS Aufnahmen geschwärzt, Screenshots werden erkannt); jeder Aufruf wird protokolliert.
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, ScrollView, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { iso } from "../../../src/core/dates";
import type { MpOpened } from "../../../src/core/types";
import { useEngine, useStore } from "../../../src/data/store";
import { Banner, Btn, Col, Header, Info, Muted, T } from "../../../src/ui/kit";
import { PlanContentView, Watermark } from "../../../src/ui/matchplan/viewer";
import { useScreenProtect } from "../../../src/ui/matchplan/protect";
import { space, useTheme } from "../../../src/ui/theme";

export default function PlayerMatchplan() {
  const s = useStore(); const E = useEngine(); const { t, tf } = E; const { c } = useTheme(); const router = useRouter(); const ins = useSafeAreaInsets();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<MpOpened | null>(null);
  const [state, setState] = useState<"load" | "ok" | "gone" | "offline">("load");
  const [shot, setShot] = useState(false);
  const [h, setH] = useState(800);
  const back = () => router.canGoBack() ? router.back() : router.replace("/player/heute");
  useEffect(() => {
    let live = true;
    (async () => {
      try { const o = await s.openPlan(id); if (!live) return; if (o) { setPlan(o); setState("ok"); } else setState("gone"); }
      catch (e) { if (live) setState(String((e as Error)?.message || "").toLowerCase().includes("network") ? "offline" : "gone"); }
    })();
    return () => { live = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useScreenProtect(state === "ok", () => { setShot(true); s.planShot(id); });
  // Freigabe läuft ab: Plan schließen
  useEffect(() => {
    if (!plan) return;
    const ms = new Date(plan.until).getTime() - Date.now(); if (ms <= 0) { setState("gone"); return; }
    const tm = setTimeout(() => { setPlan(null); setState("gone"); }, Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(tm);
  }, [plan]);

  const m = plan?.matchId ? E.D.matches.find(x => x.id === plan.matchId) || null : null;
  const opened = new Date(), stamp = `${E.de(E.TODAY)} ${String(opened.getHours()).padStart(2, "0")}:${String(opened.getMinutes()).padStart(2, "0")}`;
  const until = plan ? new Date(plan.until) : null;
  return (
    <ScrollView testID="player-matchplan" style={{ flex: 1, backgroundColor: c.bg }}>
      <View onLayout={(e: LayoutChangeEvent) => setH(Math.ceil(e.nativeEvent.layout.height))}
        style={{ width: "100%", maxWidth: 820, alignSelf: "center", gap: 18, paddingHorizontal: space.l, paddingTop: ins.top + space.l, paddingBottom: space.xxl * 2 }}>
        <Header onBack={back} backLabel={t("nav_heute")} eyebrow={m ? `${t("mp_title")} · ${E.wt(m.date)} ${E.de(m.date)} · ${m.zeit}` : t("mp_title")}
          title={plan?.title || t("mp_title")} info={<Info title={t("mp_title")} text={[t("pv_info"), t("pv_privacy")]} />} />
        {state === "load" ? <Muted>{t("loading")}</Muted> : null}
        {state === "gone" ? <Col gap={10}><Banner testID="pv-gone">{t("pv_gone")}</Banner><Btn label={t("nav_heute")} onPress={back} style={{ alignSelf: "flex-start" }} /></Col> : null}
        {state === "offline" ? <Banner testID="pv-offline">{t("pv_offline")}</Banner> : null}
        {plan ? <>
          <Banner testID="pv-confidential"><Col gap={2}><T v="small" bold>{t("pv_conf")}</T><T v="small">{tf("pv_confD", { d: until ? `${E.wt(iso(until))} ${E.de(iso(until))} ${String(until.getHours()).padStart(2, "0")}:${String(until.getMinutes()).padStart(2, "0")}` : "" })}</T>
            {Platform.OS === "web" ? <T v="small">{t("pv_web")}</T> : null}</Col></Banner>
          {shot ? <Banner color={c.warn} testID="pv-shot">{t("pv_shot")}</Banner> : null}
          <PlanContentView pub={plan.content} pid={plan.pid} match={m} />
        </> : null}
        {plan ? <Watermark text={`${plan.name} · ${stamp}`} height={h} /> : null}
      </View>
    </ScrollView>
  );
}
