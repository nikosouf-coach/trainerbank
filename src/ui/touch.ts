// Touch im Browser (Handy, Web-Version): Flächen, auf denen gezeichnet oder gezogen wird.
// Ohne Vorkehrung übernimmt der Browser die Fingerbewegung zum Scrollen (die Linie bricht ab) – oder, wenn die Fläche
// jede Bewegung schluckt, lässt sich die Seite über ihr gar nicht mehr scrollen. Deshalb zwei Arten:
// - fest (Vollbild-Editor): die Fläche scrollt und zoomt nie (touch-action: none), jede Bewegung gehört der Tafel.
// - auf einer scrollbaren Seite (Aufstellung, Gegner): senkrechtes Wischen scrollt die Seite wie gewohnt; gezogen wird
//   ein Element erst nach kurzem Halten oder bei waagerechter Bewegung (wie in der App). Ab dann (active) blockiert die
//   Fläche das Scrollen.
// isTouch(): letzte Eingabe war ein Finger (nicht Maus/Stift) – mit der Maus wird sofort gezogen.
// Dazu kein Markieren und keine Lupe beim langen Drücken (iOS). In der App (iOS/Android) ohne Wirkung: dort sperrt die
// Seite das Scrollen während des Ziehens (useScrollLock).
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

type Ev = { cancelable?: boolean; preventDefault?: () => void; pointerType?: string };
type DomEl = {
  addEventListener?: (t: string, f: (e: Ev) => void, o?: { passive: boolean }) => void;
  removeEventListener?: (t: string, f: (e: Ev) => void) => void;
  style?: Record<string, string>;
};

/** Ref für die Fläche (View). fixed: Vollbild (nie scrollen); sonst nur blockieren, solange active() zutrifft. */
export function useTouchSurface(fixed: boolean, active?: () => boolean): { ref: (el: unknown) => void; isTouch: () => boolean } {
  const [el, setEl] = useState<DomEl | null>(null);
  const act = useRef(active); act.current = active;
  const touch = useRef(false);
  useEffect(() => {
    if (Platform.OS !== "web" || !el || typeof el.addEventListener !== "function") return;
    const st = el.style;
    if (st) {
      // Vollbild: keine Gesten des Browsers; auf Seiten: senkrecht scrollen erlaubt (Ziehen blockiert es bei Bedarf)
      st.touchAction = fixed ? "none" : "pan-y";
      st.userSelect = "none"; st.webkitUserSelect = "none"; st.webkitTouchCallout = "none";
    }
    const onDown = (e: Ev) => { touch.current = e.pointerType === "touch"; };
    const onTouch = () => { touch.current = true; };
    const onMove = (e: Ev) => { if ((fixed || act.current?.()) && e.cancelable) e.preventDefault?.(); };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("touchstart", onTouch, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => { el.removeEventListener?.("pointerdown", onDown); el.removeEventListener?.("touchstart", onTouch); el.removeEventListener?.("touchmove", onMove); };
  }, [el, fixed]);
  return { ref: setEl as (x: unknown) => void, isTouch: () => touch.current };
}
