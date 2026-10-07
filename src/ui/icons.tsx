// Linien-Icons (24×24) als SVG.
import React from "react";
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type IconName =
  | "heute" | "kalender" | "plan" | "kader" | "mehr" | "eintragen" | "daten" | "tipps" | "ich"
  | "spark" | "plus" | "back" | "close" | "check" | "chevron" | "camera" | "person" | "info" | "trash"
  | "flame" | "star" | "trophy" | "moon" | "bolt" | "calendar" | "target";

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
};

export function Icon({ name, size = 22, color = "#000", strokeWidth = 1.8 }: { name: IconName; size?: number; color?: ColorValue; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color as string} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </Svg>
  );
}
