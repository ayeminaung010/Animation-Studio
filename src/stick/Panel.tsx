// The phone-call frame: split screen (Grandpa's room on top, the Agent's office below) or one full room.
// Each room clips its own content and gets a slow push-in, so the divider never moves.
import React from "react";
import { H, SPLIT_Y, W, type PanelName } from "./geometry";
import { INK, ROOM } from "./style";

type Side = "grandpa" | "agent";

const Room: React.FC<{ side: Side; y0: number; y1: number; zoom: number; children: React.ReactNode }> = ({ side, y0, y1, zoom, children }) => {
  const cy = (y0 + y1) / 2;
  return (
    <g>
      <clipPath id={`room-${side}`}>
        <rect x={0} y={y0} width={W} height={y1 - y0} />
      </clipPath>
      <g clipPath={`url(#room-${side})`}>
        <rect x={0} y={y0} width={W} height={y1 - y0} fill={ROOM[side]} />
        <g transform={`translate(${W / 2} ${cy}) scale(${zoom}) translate(${-W / 2} ${-cy})`}>{children}</g>
      </g>
    </g>
  );
};

/** Which room a y position belongs to in this panel layout. */
export const sideAt = (panel: PanelName, y: number): Side => (panel === "split" ? (y < SPLIT_Y ? "grandpa" : "agent") : panel);

export const Panel: React.FC<{ panel: PanelName; zoom: number; content: Record<Side, React.ReactNode> }> = ({ panel, zoom, content }) =>
  panel === "split" ? (
    <>
      <Room side="grandpa" y0={0} y1={SPLIT_Y} zoom={zoom}>{content.grandpa}</Room>
      <Room side="agent" y0={SPLIT_Y} y1={H} zoom={zoom}>{content.agent}</Room>
      <path d={`M0 ${SPLIT_Y} L${W} ${SPLIT_Y}`} stroke={INK} strokeWidth={8} />
    </>
  ) : (
    <Room side={panel} y0={0} y1={H} zoom={zoom}>{content[panel]}</Room>
  );
