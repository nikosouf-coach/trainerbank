// Dateien teilen (Datenexport) und Textdateien einlesen (Spielplan-Import) – auf Handy und im Browser.
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";

/** Dateiname ohne Umlaute und Sonderzeichen („Größen U19“ → „Groessen_U19“) */
export const fileSafe = (x: string): string => x.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
  .replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

/** Speichert Text als Datei und öffnet „Teilen“ (Handy) bzw. lädt sie herunter (Browser). */
export async function shareTextFile(name: string, text: string, mime = "application/json"): Promise<void> {
  if (Platform.OS === "web") {
    const doc = (globalThis as unknown as { document?: Document }).document; if (!doc) return;
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = doc.createElement("a"); a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000); return;
  }
  const uri = (FileSystem.cacheDirectory || "") + name;
  await FileSystem.writeAsStringAsync(uri, text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name });
}

/**
 * Text weitergeben: am Handy über „Teilen“ (Mail, Messenger, Notizen …), im Browser in die Zwischenablage – geht das
 * nicht, als Textdatei. Ergebnis für den passenden Hinweis.
 */
export async function shareOrCopy(text: string, fileName: string): Promise<"shared" | "copied" | "file"> {
  if (Platform.OS !== "web") { await Share.share({ message: text }); return "shared"; }
  const nav = (globalThis as unknown as { navigator?: { clipboard?: { writeText?: (s: string) => Promise<void> } } }).navigator;
  try { if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(text); return "copied"; } } catch { /* weiter mit der Datei */ }
  await shareTextFile(fileName, text, "text/plain");
  return "file";
}

/** Lässt eine Textdatei (z. B. .ics, .csv, .txt) auswählen und liefert ihren Inhalt (oder null bei Abbruch). */
export async function pickTextFile(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: ["text/*", "text/calendar", "text/csv", "application/octet-stream"], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.length) return null;
  const uri = r.assets[0].uri;
  if (Platform.OS === "web") return await (await fetch(uri)).text();
  return await FileSystem.readAsStringAsync(uri);
}
