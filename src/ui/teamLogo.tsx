// Vereinslogo des aktiven Teams (oder Farbkreis mit Initialen) und Trainerfoto.
import React from "react";
import type { StaffProfile } from "../core/types";
import { useStore } from "../data/store";
import { Avatar } from "./kit";
import { usePhotoUrl } from "./playerAvatar";
import { TeamBadge } from "./setupParts";

export function TeamLogo({ size = 44 }: { size?: number }) {
  const s = useStore(); const team = s.D?.team;
  const url = usePhotoUrl(team?.logo || null);
  if (!team) return null;
  return <TeamBadge logo={url} club={team.club} name={team.name} accent={team.accent} size={size} />;
}

export function StaffAvatar({ x, size = 40 }: { x: StaffProfile; size?: number }) {
  const url = usePhotoUrl(x.photo || null);
  const [vn, ...rest] = x.name.split(/\s+/);
  return <Avatar id={x.id} first={vn || "?"} last={rest.join(" ")} url={url} size={size} />;
}
