export interface PropProps {
  /** Shot-local frame. */
  f: number;
  /** Shot duration in frames. */
  d: number;
  fps: number;
}

/** Sunday flips happen at 20%, 45% and 70% of the clue shot. Shared by calendar and scale. */
export const sundayIndex = (f: number, d: number) =>
  [0.2, 0.45, 0.7].filter((k) => f >= Math.round(d * k)).length;

/** Frame the piggy bank breaks in the crack shot. Shared by the prop and Jerry's action. */
export const crackFrame = (d: number) => Math.round(d * 0.45);
