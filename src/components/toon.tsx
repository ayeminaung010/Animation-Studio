// Shared toon look: 3-step gradient shading + thick black outlines.
import { Outlines } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";

export const INK = "#141414";
/** Pixels of outline per unit of the `outline` prop. */
export const OUTLINE_PX = 280;

let gradient: THREE.DataTexture | null = null;
/** 3-step light/mid/shadow ramp, shared by every toon material. */
export const toonGradient = () => {
  if (!gradient) {
    const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
};

export interface ToonOptions {
  emissive?: string;
  emissiveIntensity?: number;
  map?: THREE.Texture | null;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}

/** One material per component instance, created once and disposed on unmount. */
export const useToon = (color: string, o: ToonOptions = {}) => {
  const { emissive, emissiveIntensity = 1, map = null, transparent = false, opacity = 1, side = THREE.FrontSide } = o;
  const mat = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color,
        gradientMap: toonGradient(),
        emissive: emissive ?? "#000000",
        emissiveIntensity: emissive ? emissiveIntensity : 0,
        map,
        transparent,
        opacity,
        side,
      }),
    [color, emissive, emissiveIntensity, map, transparent, opacity, side],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
};

type MeshProps = Omit<ThreeElements["mesh"], "material">;

export type ToonProps = MeshProps &
  ToonOptions & {
    color: string;
    /** Outline weight (0.02 ≈ 5.6 px at 1080 wide), or false for none (floors, walls, tiny details). */
    outline?: number | false;
  };

/** A toon-shaded mesh. Put the geometry as the child: <T color="#f00"><boxGeometry /></T> */
export const T: React.FC<ToonProps> = ({
  color,
  outline = 0.018,
  emissive,
  emissiveIntensity,
  map,
  transparent,
  opacity,
  side,
  children,
  ...rest
}) => {
  const mat = useToon(color, { emissive, emissiveIntensity, map, transparent, opacity, side });
  return (
    <mesh material={mat} {...rest}>
      {children}
      {/* drei's non-screenspace thickness is in pixels: lines stay bold at any distance */}
      {outline ? <Outlines thickness={outline * OUTLINE_PX} color={INK} /> : null}
    </mesh>
  );
};

/** Flat ink-black detail (eyes, mouths, brows). Unlit so it stays solid black in any light. */
export const Ink: React.FC<MeshProps & { color?: string }> = ({ color = INK, children, ...rest }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color }), [color]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} {...rest}>
      {children}
    </mesh>
  );
};
