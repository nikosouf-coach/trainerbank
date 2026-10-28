// Rückmeldungen aus der App – nur für die Betreiber (app_admins): offen/erledigt, Bildschirmfoto, teilen (ohne Namen),
// löschen. „Teilen“ erzeugt einen Text zum Weitergeben, z. B. an Claude oder in eine Aufgabenliste.
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Share } from "react-native";
import type { FeedbackItem } from "../src/data/api";
import { useStore } from "../src/data/store";
import { Btn, Card, Chip, Col, Header, Muted, Row, Screen, Seg, Sheet, T } from "../src/ui/kit";
import { fmtStamp } from "../src/ui/pilot";
import { useTheme } from "../src/ui/theme";

type Filter = "open" | "done" | "all";

export default function Rueckmeldungen() {
  const s = useStore(); const { t, tf } = s.tr; const router = useRouter(); const { c } = useTheme();
  const [filter, setFilter] = useState<Filter>("open");
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [ask, setAsk] = useState<FeedbackItem | null>(null);
  const [busy, setBusy] = useState(false);
  const back = () => router.canGoBack() ? router.back() : router.replace("/");
  const load = () => s.api.feedbackList(filter).then(setItems).catch(e => { setItems([]); s.toast(s.errText(e)); });
  useEffect(() => { if (s.appAdmin) load(); }, [filter, s.appAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const kindCol = (k: FeedbackItem["kind"]): string => k === "bug" ? c.crit : k === "unclear" ? c.warn : k === "wish" ? c.accentTx : c.ok;
  const roleOf = (x: FeedbackItem): string => !x.role ? "" : x.role === "player" ? t("fbl_player") : t("role_" + x.role);
  const osOf = (x: FeedbackItem): string => !x.osVersion ? "" : (x.platform === "ios" ? "iOS " : x.platform === "android" ? "Android " : "") + x.osVersion;
  const metaOf = (x: FeedbackItem): string => [x.page, x.appVersion ? "App " + x.appVersion : "", [x.device, osOf(x)].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  /** Text zum Weitergeben – ohne Namen und ohne Konto */
  const textOf = (x: FeedbackItem): string => [
    `[${t("fb_k_" + x.kind)}] ${fmtStamp(x.createdAt, s.tr.lang)}${[roleOf(x), x.team].filter(Boolean).length ? " · " + [roleOf(x), x.team].filter(Boolean).join(" · ") : ""}`,
    metaOf(x), x.text, x.shotPath ? "(" + t("fbl_shot") + ")" : "",
  ].filter(Boolean).join("\n");
  const share = (L: FeedbackItem[]) => Share.share({ message: L.map(textOf).join("\n\n---\n\n") }).catch(() => undefined);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await load(); s.refreshFeedback(); } catch (e) { s.toast(s.errText(e)); } finally { setBusy(false); } };
  const openShot = async (path: string) => { try { setShot(await s.api.feedbackShotUrl(path)); } catch (e) { s.toast(s.errText(e)); } };

  if (!s.appAdmin) return (
    <Screen testID="feedback-list" narrow>
      <Header title={t("fbl_title")} onBack={back} backLabel={t("btn_back")} />
      <Muted>{t("fbl_onlyAdmin")}</Muted>
    </Screen>
  );
  return (
    <Screen testID="feedback-list" narrow>
      <Header title={t("fbl_title")} sub={items ? tf(filter === "open" ? "fbl_nOpen" : filter === "done" ? "fbl_nDone" : "fbl_nAll", { n: items.length }) : undefined} onBack={back} backLabel={t("btn_back")}
        right={items && items.length ? <Btn small icon="send" testID="fbl-share-all" label={t("fbl_shareAll")} onPress={() => share(items)} /> : undefined} />
      <Seg testID="fbl-filter" value={filter} onChange={setFilter} options={[{ key: "open", label: t("fbl_open") }, { key: "done", label: t("fbl_done") }, { key: "all", label: t("fbl_all") }]} />
      <Muted small>{t("fbl_shareHint")}</Muted>
      {items == null ? <Muted>{t("loading")}</Muted> : !items.length ? <Muted testID="fbl-none">{t("fbl_none")}</Muted> : items.map(x => (
        <Card key={x.id} testID={"fbl-" + x.id}>
          <Row between gap={8} wrap>
            <Row gap={8} wrap style={{ flexShrink: 1 }}>
              <Chip label={t("fb_k_" + x.kind)} color={kindCol(x.kind)} />
              <Muted small>{fmtStamp(x.createdAt, s.tr.lang)}</Muted>
            </Row>
            {x.status === "done" && x.doneAt ? <Muted small>{tf("fbl_doneAt", { d: fmtStamp(x.doneAt, s.tr.lang) })}</Muted> : null}
          </Row>
          <T selectable>{x.text}</T>
          <Col gap={2}>
            <Muted small>{[roleOf(x), x.team, x.reporter ? tf("fbl_from", { n: x.reporter }) : ""].filter(Boolean).join(" · ")}</Muted>
            <Muted small>{metaOf(x)}</Muted>
          </Col>
          <Row gap={8} wrap>
            <Btn small kind={x.status === "open" ? "primary" : "default"} testID={"fbl-done-" + x.id} disabled={busy}
              label={x.status === "open" ? t("fbl_markDone") : t("fbl_reopen")} onPress={() => run(() => s.api.feedbackSetDone(x.id, x.status === "open"))} />
            {x.shotPath ? <Btn small icon="camera" testID={"fbl-shot-" + x.id} label={t("fbl_shot")} onPress={() => openShot(x.shotPath!)} /> : null}
            <Btn small icon="send" testID={"fbl-share-" + x.id} label={t("fbl_share")} onPress={() => share([x])} />
            <Btn small kind="ghost" testID={"fbl-delete-" + x.id} label={t("fbl_delete")} disabled={busy} onPress={() => setAsk(x)} />
          </Row>
        </Card>
      ))}
      <Sheet visible={!!shot} onClose={() => setShot(null)} title={t("fbl_shot")} testID="fbl-shot-sheet" closeLabel={t("close")}>
        {shot ? <Image source={{ uri: shot }} style={{ width: "100%", aspectRatio: 9 / 16, borderRadius: 10, backgroundColor: c.sunk }} resizeMode="contain" /> : null}
      </Sheet>
      <Sheet visible={!!ask} onClose={() => setAsk(null)} title={t("fbl_deleteQ")} testID="fbl-delete-sheet">
        <T>{t("fbl_deleteText")}</T>
        <Row gap={10}>
          <Btn label={t("no")} onPress={() => setAsk(null)} />
          <Btn testID="fbl-delete-confirm" kind="danger" label={t("fbl_delete")} disabled={busy}
            onPress={() => { const x = ask; setAsk(null); if (x) run(() => s.api.feedbackDelete(x.id)); }} />
        </Row>
      </Sheet>
    </Screen>
  );
}
