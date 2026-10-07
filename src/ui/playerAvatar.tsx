// Spielerbild: lädt die (zeitlich begrenzte) Bild-URL aus dem Speicher und zeigt sonst Initialen.
import React, { useEffect, useState } from "react";
import type { Player } from "../core/types";
import { useStore } from "../data/store";
import { Avatar } from "./kit";

const cache = new Map<string, { url: string | null; at: number }>();
const TTL = 50 * 60 * 1000; // signierte URLs gelten 60 Minuten

/** Nach dem Hochladen eines neuen Bildes aufrufen, damit die neue Datei geladen wird. */
export function forgetPhoto(path: string): void { cache.delete(path); }

export function usePhotoUrl(path: string | null | undefined): string | null {
  const s = useStore();
  const hit = path ? cache.get(path) : undefined;
  const [url, setUrl] = useState<string | null>(hit && Date.now() - hit.at < TTL ? hit.url : null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    const h = cache.get(path); if (h && Date.now() - h.at < TTL) { setUrl(h.url); return; }
    let live = true;
    s.api.photoUrl(path).then(u => { cache.set(path, { url: u, at: Date.now() }); if (live) setUrl(u); }).catch(() => undefined);
    return () => { live = false; };
  }, [path, s.api, s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  return url;
}

export function PlayerAvatar({ p, size = 44, status }: { p: Player; size?: number; status?: string | null }) {
  const url = usePhotoUrl(p.photo);
  return <Avatar id={p.id} first={p.vn} last={p.nn} url={url} size={size} status={status} />;
}
