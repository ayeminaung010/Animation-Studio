// Generic props for the 2D stickman episodes: black line art, a few flat fills, no brands or text.
// Each prop draws around (0, 0) = its bottom centre; the shot places and scales it.
import React from "react";
import { HEADSET, INK, LED, PAPER, STROKE } from "./style";

export interface StickPropProps {
  f: number;
  fps: number;
  state?: string;
}

const line = { stroke: INK, strokeWidth: STROKE * 0.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const Router: React.FC<StickPropProps> = ({ f, fps, state }) => {
  const on = state !== "off" && Math.floor((f / fps) * 3) % 2 === 0;
  return (
    <g {...line}>
      <path d="M-60 -70 L-80 -170 M60 -70 L80 -170" />
      <rect x={-110} y={-70} width={220} height={70} rx={14} fill="#DADADA" />
      {[-60, -25, 10].map((x) => (
        <circle key={x} cx={x} cy={-35} r={11} fill={on ? LED : "#7A7A7A"} stroke="none" />
      ))}
    </g>
  );
};

const Computer: React.FC<StickPropProps> = ({ f, fps, state }) => {
  const frozen = state === "frozen";
  const back = state === "back";
  const blink = Math.floor((f / fps) * 2) % 2 === 0;
  return (
    <g {...line}>
      <path d="M0 0 L0 -60 M-60 0 L60 0" />
      <rect x={-170} y={-290} width={340} height={230} rx={14} fill={PAPER} />
      <rect x={-150} y={-270} width={300} height={190} rx={6} fill={frozen ? "#9FB3C8" : back ? "#CFF3D7" : "#D6E8FA"} strokeWidth={STROKE * 0.4} />
      {frozen ? (
        <g strokeWidth={STROKE * 0.45}>
          {/* A stuck window and a spinner that never moves: frozen. */}
          <rect x={-110} y={-250} width={170} height={110} fill={PAPER} transform="rotate(-8 -25 -195)" />
          <path d="M60 -150 A26 26 0 1 1 86 -124" fill="none" />
        </g>
      ) : back ? (
        <path d="M-50 -175 L-10 -135 L60 -215" strokeWidth={STROKE * 0.9} stroke="#1E9E45" fill="none" />
      ) : (
        <g strokeWidth={STROKE * 0.4}>
          {[-235, -205, -175, -145].map((y, i) => (
            <path key={y} d={`M-120 ${y} L${[90, 40, 70, 10][i]} ${y}`} />
          ))}
          {blink ? <path d="M30 -145 L30 -125" /> : null}
        </g>
      )}
    </g>
  );
};

const Desk: React.FC<StickPropProps> = () => (
  <g {...line}>
    <path d="M-230 -190 L230 -190 M-200 -190 L-200 0 M200 -190 L200 0" />
  </g>
);

const Armchair: React.FC<StickPropProps> = () => (
  <g {...line} fill="#C98B5A">
    <rect x={-150} y={-330} width={300} height={260} rx={50} />
    <rect x={-190} y={-180} width={80} height={150} rx={30} />
    <rect x={110} y={-180} width={80} height={150} rx={30} />
    <path d="M-140 -30 L-140 0 M140 -30 L140 0" fill="none" />
  </g>
);

const Fridge: React.FC<StickPropProps> = ({ state }) => (
  <g {...line}>
    <rect x={-120} y={-460} width={240} height={460} rx={18} fill={PAPER} />
    <path d="M-120 -300 L120 -300 M85 -420 L85 -340 M85 -260 L85 -180" />
    {state === "unplugged" ? <path d="M120 -40 Q190 -20 170 0" fill="none" strokeWidth={STROKE * 0.4} /> : null}
  </g>
);

const Oven: React.FC<StickPropProps> = ({ f, fps, state }) => {
  const glow = 0.75 + 0.25 * Math.sin((f / fps) * 5);
  return (
    <g {...line}>
      <rect x={-150} y={-280} width={300} height={280} rx={16} fill={PAPER} />
      <path d="M-150 -220 L150 -220" />
      {[-90, -30, 30, 90].map((x) => (
        <circle key={x} cx={x} cy={-250} r={12} fill={INK} stroke="none" />
      ))}
      <rect x={-110} y={-190} width={220} height={150} rx={12} fill="#F6A04D" fillOpacity={glow} />
      {state === "router" ? (
        <g transform="translate(0 -75) scale(0.55)">
          <Router f={f} fps={fps} />
        </g>
      ) : null}
    </g>
  );
};

const CerealBox: React.FC<StickPropProps> = () => (
  <g {...line}>
    <rect x={-80} y={-240} width={160} height={240} rx={8} fill="#FFD23F" />
    <path d="M-50 -90 Q0 -30 50 -90 Z" fill={PAPER} />
    <circle cx={-15} cy={-105} r={10} fill="#E8743B" stroke="none" />
    <circle cx={15} cy={-110} r={10} fill="#E8743B" stroke="none" />
    <path d="M-50 -190 L50 -190 M-35 -160 L35 -160" strokeWidth={STROKE * 0.45} />
  </g>
);

const CoffeeMachine: React.FC<StickPropProps> = () => (
  <g {...line}>
    <rect x={-80} y={-220} width={160} height={220} rx={14} fill="#8C6A52" />
    <rect x={-40} y={-90} width={80} height={70} rx={6} fill={PAPER} />
    <path d="M80 -40 Q140 -10 120 0" fill="none" strokeWidth={STROKE * 0.4} />
  </g>
);

const Window: React.FC<StickPropProps> = () => (
  <g {...line}>
    <rect x={-150} y={-260} width={300} height={260} rx={8} fill="#CFE6FF" />
    <path d="M0 -260 L0 0 M-150 -130 L150 -130" />
  </g>
);

const Lamp: React.FC<StickPropProps> = () => (
  <g {...line}>
    <path d="M0 0 L0 -300 M-60 0 L60 0" />
    <path d="M-70 -300 L70 -300 L40 -400 L-40 -400 Z" fill="#FFE9A8" />
  </g>
);

const Mug: React.FC<StickPropProps> = () => (
  <g {...line}>
    <rect x={-30} y={-70} width={60} height={70} rx={8} fill={HEADSET} />
    <path d="M30 -55 Q60 -40 30 -20" fill="none" />
  </g>
);

export const STICK_PROPS: Record<string, React.FC<StickPropProps>> = {
  router: Router,
  computer: Computer,
  desk: Desk,
  armchair: Armchair,
  fridge: Fridge,
  oven: Oven,
  "cereal-box": CerealBox,
  "coffee-machine": CoffeeMachine,
  window: Window,
  lamp: Lamp,
  mug: Mug,
};

export const stickProp = (name: string): React.FC<StickPropProps> => {
  const p = STICK_PROPS[name];
  if (!p) throw new Error(`Unknown prop "${name}" — add it to STICK_PROPS in src/stick/props.tsx`);
  return p;
};
