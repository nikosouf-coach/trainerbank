// KI-Coach: Anfrage an den Server (Funktion "ai") und Darstellung der Antwort (einfaches Markdown).
import React, { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ApiError } from "../data/api";
import { useStore } from "../data/store";
import { Icon } from "./icons";
import { Btn, Card, Col, Field, Info, Muted, Row, T } from "./kit";
import { useTheme } from "./theme";

export type AiMode = "coach" | "player" | "session" | "potentials" | "kind";

/** Zeigt Markdown-Text (### Überschrift, - Liste, 1. Liste, **fett**) als native Elemente. */
export function Markdown({ text, testID }: { text: string; testID?: string }) {
  const { c } = useTheme();
  const inline = (s: string, key: string): React.ReactNode[] => s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? <T key={key + i} bold>{part.slice(2, -2)}</T> : part.replace(/(^|[^*])\*(?!\s)([^*]+)\*/g, "$1$2"));
  const out: React.ReactNode[] = [];
  String(text || "").split(/\n/).forEach((l, i) => {
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^\s*#{1,4}\s+(.*)/))) out.push(<T key={i} v="h3" style={{ marginTop: out.length ? 6 : 0 }}>{m[1].replace(/\*\*/g, "")}</T>);
    else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) out.push(<Row key={i} gap={8} align="flex-start"><T color={c.accentTx}>•</T><T style={{ flex: 1 }}>{inline(m[1], "b" + i)}</T></Row>);
    else if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)/))) out.push(<Row key={i} gap={8} align="flex-start"><T color={c.accentTx} bold>{m[1]}.</T><T style={{ flex: 1 }}>{inline(m[2], "n" + i)}</T></Row>);
    else if (l.trim()) out.push(<T key={i}>{inline(l, "p" + i)}</T>);
  });
  return <Col gap={6} testID={testID}>{out}</Col>;
}

/** Fehlertext für KI-Anfragen. */
export function aiErrText(e: unknown, t: (k: string) => string): string {
  const code = e instanceof ApiError ? e.code : "";
  if (code === "consent_required") return t("ki_denied");
  if (code === "limit") return t("err_limit");
  if (code === "ki_disabled") return t("err_ki_disabled");
  if (code === "demo_ai") return t("err_demo_ai");
  if (code === "upstream") return t("err_upstream");
  return t("ki_err");
}

/** Hook für eine KI-Anfrage mit Lade- und Fehlerzustand. */
export function useAi() {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const seq = useRef(0);
  const run = async (mode: AiMode, prompt: string, context: string): Promise<string | null> => {
    const my = ++seq.current; setBusy(true); setErr("");
    try { const r = await s.ai(mode, prompt, context); if (my === seq.current) setText(r); return r; }
    catch (e) { if (my === seq.current) setErr(aiErrText(e, s.tr.t)); return null; }
    finally { if (my === seq.current) setBusy(false); }
  };
  const stop = () => { seq.current++; setBusy(false); };
  return { busy, text, err, run, stop, setText };
}

/**
 * Karte mit Schnellfragen, Eingabefeld und Antwort.
 * mode: "coach" (Trainer) oder "player" (Spieler-App); context: Text aus der Fachlogik (engine.aiContext / playerAiContext).
 */
export function AiPanel({ mode, context, quick, placeholder, note, testID = "ai", onQuick }: { mode: AiMode; context: () => string; quick: string[]; placeholder: string; note?: string; testID?: string; onQuick?: (key: string) => boolean }) {
  const s = useStore(); const { t } = s.tr; const { c } = useTheme();
  const [q, setQ] = useState("");
  const ai = useAi();
  const on = !!s.D?.team.modules.ki;
  if (!on) return null;
  const ask = (prompt: string) => { if (!prompt.trim()) return; ai.run(mode, prompt.trim(), context()); };
  return (
    <Card testID={testID}>
      <Row gap={8}><Icon name="spark" color={c.accentTx} /><T v="h2" style={{ flexShrink: 1 }}>{t("ki_title")}</T>{note ? <Info title={t("ki_title")} text={note} /> : null}</Row>
      <Row wrap gap={6}>
        {quick.map((k, i) => <Btn key={k} small testID={testID + "-q" + (i + 1)} label={t(k)} disabled={ai.busy} onPress={() => { if (onQuick?.(k)) return; setQ(t(k)); ask(t(k)); }} />)}
      </Row>
      <Field testID={testID + "-input"} label={placeholder} value={q} onChangeText={setQ} multiline />
      <Row gap={8}>
        <Btn testID={testID + "-ask"} kind="primary" label={t("ki_ask")} disabled={ai.busy || !q.trim()} onPress={() => ask(q)} />
        {ai.busy ? <Btn label={t("ki_stop")} onPress={ai.stop} /> : null}
      </Row>
      {ai.busy ? <Row gap={8}><ActivityIndicator color={c.accent} /><Muted>{t("ki_think")}</Muted></Row> : null}
      {ai.err ? <Muted>{ai.err}</Muted> : null}
      {ai.text && !ai.busy ? <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}><Markdown testID={testID + "-out"} text={ai.text} /></View> : null}
    </Card>
  );
}
