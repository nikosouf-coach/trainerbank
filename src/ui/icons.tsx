// Linien-Icons (24×24) als SVG.
import React from "react";
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type IconName =
  | "heute" | "kalender" | "plan" | "kader" | "mehr" | "eintragen" | "daten" | "tipps" | "ich"
  | "spark" | "plus" | "back" | "close" | "check" | "chevron" | "camera" | "person" | "info" | "trash"
  | "flame" | "star" | "trophy" | "moon" | "bolt" | "calendar" | "target"
  | "chat" | "send" | "eye" | "mute" | "reply" | "flag" | "people" | "scout" | "search" | "filter" | "up" | "down"
  | "board" | "ball" | "video" | "stopwatch" | "trend" | "whistle" | "sun" | "book" | "checklist" | "wallet" | "phone" | "shield" | "club"
  | "grid" | "key" | "sliders" | "help" | "pen" | "undo" | "redo" | "copy" | "layers" | "minus" | "curve" | "frame" | "note";

const P: Record<IconName, React.ReactNode> = {
  heute: <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  kalender: <><Rect x={3} y={4} width={18} height={17} rx={2} /><Path d="M3 9h18M8 2v4M16 2v4" /><Circle cx={8} cy={14} r={1} /><Circle cx={12} cy={14} r={1} /><Circle cx={16} cy={14} r={1} /></>,
  plan: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  kader: <><Circle cx={9} cy={8} r={3.2} /><Path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><Circle cx={17} cy={9} r={2.6} /><Path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8" /></>,
  mehr: <><Circle cx={5} cy={12} r={1.6} /><Circle cx={12} cy={12} r={1.6} /><Circle cx={19} cy={12} r={1.6} /></>,
  eintragen: <><Path d="M12 20h9" /><Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  daten: <Path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  tipps: <><Path d="M9 18h6M10 22h4" /><Path d="M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z" /></>,
  ich: <><Circle cx={12} cy={8} r={4} /><Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
  person: <><Circle cx={12} cy={8} r={4} /><Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></>,
  spark: <Path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  back: <Path d="M15 18l-6-6 6-6" />,
  chevron: <Path d="M9 18l6-6-6-6" />,
  close: <Path d="M6 6l12 12M18 6L6 18" />,
  check: <Path d="M5 12l5 5 9-10" />,
  camera: <><Path d="M4 8h3l2-3h6l2 3h3v11H4z" /><Circle cx={12} cy={13} r={3.5} /></>,
  info: <><Circle cx={12} cy={12} r={9} /><Path d="M12 11v6M12 7.5v.5" /></>,
  trash: <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  flame: <Path d="M12 22c4 0 7-2.8 7-6.8 0-3.3-2-5.6-3.6-7.2-.4 1.7-1.4 2.8-2.6 3.3.3-3-1.1-6.2-3.8-8.3.2 3.4-1.6 5.6-3.2 7.4C4.6 11.8 5 13.6 5 15.2 5 19.2 8 22 12 22z" />,
  star: <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  trophy: <><Path d="M8 4h8v5a4 4 0 0 1-8 0z" /><Path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" /></>,
  moon: <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  bolt: <Path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  calendar: <><Rect x={3} y={4} width={18} height={17} rx={2} /><Path d="M3 9h18M8 2v4M16 2v4" /></>,
  target: <><Circle cx={12} cy={12} r={9} /><Circle cx={12} cy={12} r={5} /><Circle cx={12} cy={12} r={1.5} /></>,
  chat: <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />,
  send: <><Path d="M22 2L11 13" /><Path d="M22 2l-7 20-4-9-9-4z" /></>,
  eye: <><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><Circle cx={12} cy={12} r={3} /></>,
  mute: <><Path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17.7 17.7 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M3 3l18 18" /></>,
  reply: <><Path d="M9 14L4 9l5-5" /><Path d="M4 9h10.5A5.5 5.5 0 0 1 20 14.5V20" /></>,
  flag: <><Path d="M4 22V4" /><Path d="M4 4h13l-2 4 2 4H4" /></>,
  scout: <><Circle cx={6.5} cy={15.5} r={3.8} /><Circle cx={17.5} cy={15.5} r={3.8} /><Path d="M10.3 15h3.4M3.6 12.6L6 5h3.2l1 6.3M20.4 12.6L18 5h-3.2l-1 6.3" /></>,
  search: <><Circle cx={11} cy={11} r={6.5} /><Path d="M16 16l5 5" /></>,
  filter: <Path d="M3 5h18l-7 8.2V19l-4 2v-7.8z" />,
  up: <Path d="M6 15l6-6 6 6" />,
  down: <Path d="M6 9l6 6 6-6" />,
  board: <><Rect x={4} y={3.5} width={16} height={17.5} rx={2} /><Path d="M9 3.5V2h6v1.5" /><Circle cx={9} cy={10} r={1.7} /><Path d="M13.5 8.5l3 3M16.5 8.5l-3 3M8.5 16.5c2.2-1.6 4.8-1.6 7 .2" /><Path d="M14 15.6l1.6 1.1-1.2 1.6" /></>,
  ball: <><Circle cx={12} cy={12} r={9} /><Path d="M12 7.6l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" /><Path d="M12 3v4.6M15.6 10.2l4.8-1.5M14.2 14.4l2.9 4.1M9.8 14.4l-2.9 4.1M8.4 10.2L3.6 8.7" /></>,
  video: <><Rect x={3} y={6} width={13} height={12} rx={2} /><Path d="M16 10.2l5-3v9.6l-5-3z" /></>,
  stopwatch: <><Circle cx={12} cy={13.5} r={7.5} /><Path d="M12 9.5v4l2.6 2.2M10 2.5h4M12 2.5V6M18.2 6.3l1.6-1.6" /></>,
  trend: <><Path d="M3 17l6-6 4 4 8-8" /><Path d="M14.5 7H21v6.5" /></>,
  whistle: <><Circle cx={9} cy={14.5} r={5.5} /><Path d="M12.4 10.2L21 7v4.2l-5.8 1.9" /><Circle cx={9} cy={14.5} r={1.4} /><Path d="M5 5l1.6 2.2M9.5 3.5l.3 2.6" /></>,
  sun: <><Circle cx={12} cy={12} r={4} /><Path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  book: <><Path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" /><Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M9 7h7" /></>,
  checklist: <><Path d="M11 6h9M11 12h9M11 18h9" /><Path d="M3.5 6l1.6 1.6L8 4.8M3.5 12l1.6 1.6L8 10.8M3.5 18l1.6 1.6L8 16.8" /></>,
  wallet: <><Rect x={3} y={6.5} width={18} height={13.5} rx={2} /><Path d="M16 13.2h2.5M6 6.5L15.5 3l1.2 3.5" /></>,
  phone: <Path d="M5 3.5h3.5l2 5-2.4 1.6a11.5 11.5 0 0 0 5.8 5.8l1.6-2.4 5 2V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3 5.5a2 2 0 0 1 2-2z" />,
  shield: <Path d="M12 3l8 3v6c0 4.8-3.4 8.1-8 9-4.6-.9-8-4.2-8-9V6z" />,
  club: <><Path d="M3 21h18M5 21V10.5L12 5l7 5.5V21" /><Path d="M10 21v-5h4v5M12 5V2.5l3 1.2-3 1.2" /></>,
  grid: <><Rect x={3.5} y={3.5} width={7} height={7} rx={1.5} /><Rect x={13.5} y={3.5} width={7} height={7} rx={1.5} /><Rect x={3.5} y={13.5} width={7} height={7} rx={1.5} /><Rect x={13.5} y={13.5} width={7} height={7} rx={1.5} /></>,
  key: <><Circle cx={8} cy={15} r={4.2} /><Path d="M11 12l9-9M16.5 6.5l3 3M14 9l2 2" /></>,
  sliders: <><Path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><Circle cx={15} cy={6} r={2} /><Circle cx={9} cy={12} r={2} /><Circle cx={17} cy={18} r={2} /></>,
  help: <><Circle cx={12} cy={12} r={9} /><Path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .9-1 1.6v.5M12 17v.4" /></>,
  pen: <><Path d="M15.5 4.5l4 4L8 20H4v-4z" /><Path d="M13 7l4 4" /></>,
  undo: <><Path d="M9 14L4 9l5-5" /><Path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  redo: <><Path d="M15 14l5-5-5-5" /><Path d="M20 9H9a5 5 0 0 0 0 10h3" /></>,
  copy: <><Rect x={8} y={8} width={12} height={12} rx={2} /><Path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
  layers: <><Path d="M12 3l9 5-9 5-9-5z" /><Path d="M3 13l9 5 9-5" /></>,
  minus: <Path d="M5 12h14" />,
  curve: <Path d="M4 18C6 7 18 7 20 18" />,
  frame: <Path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />,
  note: <><Path d="M5 4h10l4 4v12H5z" /><Path d="M15 4v4h4M8.5 12h7M8.5 16h5" /></>,
  people: <><Circle cx={9} cy={8} r={3.2} /><Path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><Circle cx={17} cy={9} r={2.6} /><Path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8" /></>,
};

export function Icon({ name, size = 22, color = "#000", strokeWidth = 1.8 }: { name: IconName; size?: number; color?: ColorValue; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color as string} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </Svg>
  );
}
