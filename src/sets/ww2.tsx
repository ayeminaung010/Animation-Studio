// 1943 environments for "How a Dead Man Beat an Army": a submarine deck at sea, a London
// basement war room, and an occupied-Europe coastal command post.
import React from "react";
import { random } from "remotion";
import { Ink, T } from "../components/toon";
import { canvasTexture, woodFloorTexture } from "../components/textures";
import type { SetProps } from "./index";

const Ground: React.FC<{ color: string; size?: number; y?: number; z?: number; map?: ReturnType<typeof woodFloorTexture> }> = ({
  color, size = 60, y = 0, z = 0, map,
}) => (
  <T color={color} map={map} position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
    <planeGeometry args={[size, size]} />
  </T>
);

const Wall: React.FC<{ color: string; z: number; height?: number; width?: number; map?: ReturnType<typeof canvasTexture> }> = ({
  color, z, height = 5, width = 18, map,
}) => (
  <T color={color} map={map} position={[0, height / 2, z]} outline={false}>
    <planeGeometry args={[width, height]} />
  </T>
);

/** Stylised sea: dark plane plus foam dashes that drift with the frame (deterministic). */
const Sea: React.FC<{ f: number; y?: number; color: string; foam?: string }> = ({ f, y = -0.55, color, foam = "#C9DDE4" }) => (
  <group>
    <Ground color={color} y={y} />
    {Array.from({ length: 14 }, (_, i) => {
      const x = -6 + (i % 7) * 1.8 + Math.sin(f * 0.03 + i) * 0.12;
      const z = -1.2 - Math.floor(i / 7) * 2.4 + Math.cos(f * 0.025 + i * 1.3) * 0.1;
      const w = 0.5 + random(`foam-${i}`) * 0.7;
      return (
        <T key={i} color={foam} position={[x, y + 0.012, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[w, 0.045 + random(`fw-${i}`) * 0.03, 1]} outline={false}>
          <circleGeometry args={[0.5, 10]} />
        </T>
      );
    })}
  </group>
);

/** The far coast: a low dark strip with a couple of roofs, far enough to read as land. */
const Coast: React.FC<{ z: number; color: string }> = ({ z, color }) => (
  <group position={[0, -0.3, z]}>
    <T color={color} position={[-2, 0.1, 0]} scale={[3.4, 0.35, 1]} outline={0.03}>
      <sphereGeometry args={[1, 18, 10]} />
    </T>
    <T color={color} position={[3.4, 0.05, 0]} scale={[2.4, 0.22, 1]} outline={0.03}>
      <sphereGeometry args={[1, 18, 10]} />
    </T>
    {[-2.6, -1.4, 3.2].map((x, i) => (
      <T key={x} color="#4A4038" position={[x, 0.28 + i * 0.03, 0]} outline={0.01}>
        <boxGeometry args={[0.32, 0.22, 0.24]} />
      </T>
    ))}
  </group>
);

/** Wet steel deck, conning tower, rails and a searchlight: the North Atlantic. */
export const Atlantic: React.FC<SetProps> = ({ f }) => (
  <group>
    <Sea f={f} color="#22404F" />
    {/* deck: a low steel platform with plank seams, narrow enough to show open sea both sides */}
    <T color="#5B6670" position={[0, -0.07, 0.15]} outline={0.025}>
      <boxGeometry args={[3.8, 0.16, 2.6]} />
    </T>
    {[-1.55, -0.85, -0.15, 0.55, 1.25, 1.75].map((x) => (
      <Ink key={x} color="#2E363D" position={[x, 0.012, 0.15]}>
        <boxGeometry args={[0.02, 0.012, 2.5]} />
      </Ink>
    ))}
    {[-1.0, 0.0, 0.9, 1.35].map((z) => (
      <Ink key={z} color="#2E363D" position={[0, 0.012, z]}>
        <boxGeometry args={[3.7, 0.012, 0.02]} />
      </Ink>
    ))}
    {/* front rail: posts and a rail, off to the sides so faces stay clear */}
    {[-1.72, -1.3, 1.3, 1.72].map((x) => (
      <group key={x} position={[x, 0, 1.28]}>
        <T color="#3B434B" position={[0, 0.36, 0]} outline={0.012}>
          <cylinderGeometry args={[0.025, 0.03, 0.72, 8]} />
        </T>
        <T color="#3B434B" position={[0, 0.72, 0]} outline={0.01}>
          <sphereGeometry args={[0.035, 8, 6]} />
        </T>
      </group>
    ))}
    {[-1.3, 1.3].map((x) => (
      <Ink key={x} color="#3B434B" position={[x, 0.66, 1.28]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.9, 6]} />
      </Ink>
    ))}
    {/* conning tower behind and to the left, with a periscope and an open hatch */}
    <group position={[-2.0, 0, -2.6]} scale={0.9}>
      <T color="#4E5962" position={[0, 0.65, 0]} outline={0.025}>
        <boxGeometry args={[1.25, 1.3, 0.72]} />
      </T>
      <T color="#3B434B" position={[0, 1.33, 0]} outline={0.02}>
        <boxGeometry args={[1.4, 0.08, 0.85]} />
      </T>
      <T color="#232A30" position={[0, 1.4, 0.05]} outline={0.012}>
        <cylinderGeometry args={[0.16, 0.16, 0.1, 16]} />
      </T>
      <Ink position={[0.38, 1.95, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 1.2, 8]} />
      </Ink>
      <T color="#2C333A" position={[0.38, 2.58, 0]} outline={0.008}>
        <cylinderGeometry args={[0.06, 0.06, 0.18, 10]} />
      </T>
    </group>
    {/* searchlight on the deck edge */}
    <group position={[-1.55, 0, -0.55]} rotation={[0, 0.65, 0]}>
      <T color="#3B434B" position={[0, 0.18, 0]} outline={0.012}>
        <cylinderGeometry args={[0.05, 0.08, 0.36, 10]} />
      </T>
      <T color="#6E7A84" position={[0, 0.44, 0]} rotation={[Math.PI / 2, 0, 0]} outline={0.016}>
        <cylinderGeometry args={[0.17, 0.2, 0.34, 18]} />
      </T>
      <T color="#FFE7B0" emissive="#FFE7B0" emissiveIntensity={1.6} position={[0, 0.44, 0.18]} outline={false}>
        <circleGeometry args={[0.15, 18]} />
      </T>
    </group>
    <Coast z={-9} color="#2B3B46" />
    {/* low sun / horizon glow for the golden pass */}
    <T color="#F2B36A" emissive="#F2B36A" emissiveIntensity={0.6} position={[3.4, 0.15, -13]} outline={false}>
      <circleGeometry args={[1.1, 24]} />
    </T>
  </group>
);

const MapPanel: React.FC<{ x: number; y: number; z: number; w?: number; h?: number; cycle?: number }> = ({ x, y, z, w = 1.5, h = 1.05, cycle = 0 }) => {
  const tex = React.useMemo(
    () =>
      canvasTexture(`ww2-map:${w}:${h}:${cycle}`, 768, 540, (ctx, cw, ch) => {
        ctx.fillStyle = "#E8D9B4";
        ctx.fillRect(0, 0, cw, ch);
        ctx.strokeStyle = "rgba(120, 96, 60, 0.35)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 12; i++) {
          ctx.beginPath();
          ctx.moveTo(0, (i / 12) * ch);
          ctx.lineTo(cw, (i / 12) * ch + 8);
          ctx.stroke();
        }
        ctx.fillStyle = "#C9B98E";
        ctx.beginPath();
        ctx.ellipse(cw * 0.42, ch * 0.42, cw * 0.22, ch * 0.17, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cw * 0.65, ch * 0.55, cw * 0.16, ch * 0.1, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8FA97A";
        ctx.beginPath();
        ctx.moveTo(cw * 0.56, ch * 0.72);
        ctx.lineTo(cw * 0.66, ch * 0.68);
        ctx.lineTo(cw * 0.63, ch * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#B23A32";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cw * 0.68, ch * 0.66);
        ctx.quadraticCurveTo(cw * 0.78, ch * 0.56, cw * 0.8, ch * 0.42);
        ctx.stroke();
        ctx.fillStyle = "#B23A32";
        [[0.68, 0.66], [0.8, 0.42]].forEach(([px, py]) => {
          ctx.beginPath();
          ctx.arc(cw * px, ch * py, 6, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "#3A2E1E";
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("MEDITERRANEAN", 26, 40);
        ctx.font = "16px sans-serif";
        ctx.fillText("SICILY", cw * 0.5, ch * 0.78);
        ctx.fillText("GREECE", cw * 0.68, ch * 0.4);
      }),
    [w, h, cycle],
  );
  return (
    <group position={[x, y, z]}>
      <T color="#6B4A30" outline={0.014}>
        <boxGeometry args={[w + 0.1, h + 0.1, 0.05]} />
      </T>
      <T color="#FFFFFF" map={tex} position={[0, 0, 0.032]} outline={false}>
        <planeGeometry args={[w, h]} />
      </T>
    </group>
  );
};

/** Green-enamel hanging lamp over the map table. */
const MapLamp: React.FC<{ x: number; z: number }> = ({ x, z }) => (
  <group position={[x, 2.75, z]}>
    <Ink position={[0, -0.35, 0]}>
      <cylinderGeometry args={[0.008, 0.008, 0.7, 6]} />
    </Ink>
    <T color="#2E4A3A" position={[0, -0.72, 0]} rotation={[Math.PI, 0, 0]} outline={0.014}>
      <coneGeometry args={[0.3, 0.22, 20, 1, true]} />
    </T>
    <T color="#FFF0C2" emissive="#FFC46B" emissiveIntensity={2.2} position={[0, -0.82, 0]} outline={false}>
      <sphereGeometry args={[0.08, 14, 10]} />
    </T>
  </group>
);

/** Cramped London basement: long map table, wall map, blackout curtains, green lamps. */
const WarRoomBody: React.FC<SetProps & { table?: boolean }> = ({ f, table = true }) => {
  const wood = woodFloorTexture(9);
  wood.repeat.set(4, 4);
  return (
    <group>
      <T color="#FFFFFF" map={wood} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
        <planeGeometry args={[16, 16]} />
      </T>
      <Wall color="#CFC3A8" z={-2.0} height={5.2} width={16} />
      {/* green wainscot and skirting */}
      <T color="#5E6B4E" position={[0, 0.65, -1.985]} outline={false}>
        <planeGeometry args={[16, 1.3]} />
      </T>
      <Ink color="#3E4636" position={[0, 1.32, -1.98]}>
        <boxGeometry args={[16, 0.06, 0.02]} />
      </Ink>
      <MapPanel x={-0.15} y={1.62} z={-1.96} w={1.55} h={1.1} />
      {table ? (
        <>
      {/* long map table, papers and ashtray */}
      <group position={[0, 0, 0.72]}>
        <T color="#6B4A30" position={[0, 0.74, 0]} outline={0.02}>
          <boxGeometry args={[2.8, 0.09, 1.0]} />
        </T>
        <T color="#7D5838" position={[0, 0.79, 0]} outline={false}>
          <boxGeometry args={[2.7, 0.012, 0.92]} />
        </T>
        {[-1.15, 1.15].map((x) => (
          <T key={x} color="#553A26" position={[x, 0.36, 0]} outline={0.014}>
            <boxGeometry args={[0.1, 0.72, 0.8]} />
          </T>
        ))}
        <T color="#E8D9B4" position={[-0.55, 0.8, 0.02]} rotation={[0, 0.2, 0]} outline={0.006}>
          <planeGeometry args={[0.62, 0.44]} />
        </T>
        <T color="#F2EAD4" position={[0.32, 0.802, 0.12]} rotation={[0, -0.12, 0]} outline={0.006}>
          <planeGeometry args={[0.5, 0.36]} />
        </T>
        <T color="#7A2E2A" position={[0.9, 0.82, -0.1]} outline={0.008}>
          <cylinderGeometry args={[0.11, 0.1, 0.035, 18]} />
        </T>
      </group>
      <MapLamp x={-0.7} z={0.75} />
      <MapLamp x={0.75} z={0.75} />
      {/* chairs pushed back from the table */}
      {[-1.0, -0.1, 0.85].map((x) => (
        <group key={x} position={[x, 0, -0.55]}>
          <T color="#5E4026" position={[0, 0.44, 0]} outline={0.014}>
            <boxGeometry args={[0.46, 0.06, 0.44]} />
          </T>
          <T color="#5E4026" position={[0, 0.78, -0.2]} outline={0.014}>
            <boxGeometry args={[0.46, 0.62, 0.06]} />
          </T>
          {[[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]].map(([dx, dz]) => (
            <Ink key={`${dx}${dz}`} position={[dx, 0.21, dz]}>
              <boxGeometry args={[0.035, 0.42, 0.035]} />
            </Ink>
          ))}
        </group>
      ))}
        </>
      ) : null}
      {/* blackout curtain on the right wall */}
      <group position={[1.85, 0, -0.4]} rotation={[0, -Math.PI / 2, 0]}>
        <T color="#3A3F33" position={[0, 1.55, 0]} outline={0.02}>
          <boxGeometry args={[1.5, 3.1, 0.08]} />
        </T>
        {[-0.55, -0.15, 0.25, 0.62].map((x) => (
          <T key={x} color="#2E3329" position={[x, 1.55, 0.05]} outline={false}>
            <boxGeometry args={[0.09, 3.05, 0.02]} />
          </T>
        ))}
      </group>
      {/* coat rack */}
      <group position={[-1.85, 0, -1.15]}>
        <T color="#4A3220" position={[0, 0.03, 0]} outline={0.014}>
          <cylinderGeometry args={[0.2, 0.24, 0.06, 16]} />
        </T>
        <Ink position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 1.75, 8]} />
        </Ink>
        <T color="#4B4F3E" position={[0.16, 1.15, 0]} scale={[1, 0.9, 0.5]} outline={0.014}>
          <coneGeometry args={[0.18, 0.9, 10]} />
        </T>
      </group>
      {/* cigarette haze, static soft shapes */}
      {[[-0.4, 1.7], [0.5, 1.8]].map(([x, y], i) => (
        <T key={i} color="#D8D2C4" transparent opacity={0.08} position={[x + Math.sin(f * 0.01 + i), y, 0.2]} outline={false}>
          <sphereGeometry args={[0.6, 14, 10]} />
        </T>
      ))}
    </group>
  );
};

export const WarRoom: React.FC<SetProps> = (p) => <WarRoomBody {...p} />;
/** The same basement without the map table: room to lay a body out on a slab. */
export const PrepRoom: React.FC<SetProps> = (p) => <WarRoomBody {...p} table={false} />;

/** Concrete coastal command post: steel desk, radio, map wall, tall window over a grey sea. */
export const EnemyHQ: React.FC<SetProps> = ({ f }) => (
  <group>
    <Ground color="#6E675A" />
    <Wall color="#8A8272" z={-2.0} height={5.0} width={16} />
    {/* concrete seams */}
    {[-1.2, -0.4, 0.4, 1.2].map((x) => (
      <Ink key={x} color="#6E675A" position={[x, 2.5, -1.99]}>
        <boxGeometry args={[0.02, 5, 0.01]} />
      </Ink>
    ))}
    <Ink color="#6E675A" position={[0, 2.3, -1.99]}>
      <boxGeometry args={[16, 0.02, 0.01]} />
    </Ink>
    {/* tall window over the sea */}
    <group position={[1.15, 1.65, -1.97]}>
      <T color="#4A4E46" position={[0, 0, 0]} outline={0.02}>
        <boxGeometry args={[1.05, 2.0, 0.08]} />
      </T>
      <T color="#53718A" emissive="#7A98AE" emissiveIntensity={0.35} position={[0, 0, 0.045]} outline={false}>
        <planeGeometry args={[0.9, 1.85]} />
      </T>
      <T color="#D9A05E" emissive="#E8B46A" emissiveIntensity={0.5} position={[0, -0.55, 0.05]} outline={false}>
        <planeGeometry args={[0.9, 0.45]} />
      </T>
      <Ink color="#4A4E46" position={[0, 0, 0.05]}>
        <boxGeometry args={[0.04, 1.85, 0.01]} />
      </Ink>
      <Ink color="#4A4E46" position={[0, 0.1, 0.05]}>
        <boxGeometry args={[0.9, 0.04, 0.01]} />
      </Ink>
      {Array.from({ length: 5 }, (_, i) => (
        <T key={i} color="#C9DDE4" position={[-0.3 + i * 0.16, -0.62 + Math.sin(f * 0.05 + i) * 0.02, 0.055]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.12, 0.03, 1]} outline={false}>
          <circleGeometry args={[0.5, 8]} />
        </T>
      ))}
    </group>
    <MapPanel x={-0.95} y={1.72} z={-1.96} w={1.35} h={1.0} cycle={1} />
    {/* steel desk */}
    <group position={[0, 0, 0.66]}>
      <T color="#4E574A" position={[0, 0.74, 0]} outline={0.022}>
        <boxGeometry args={[2.0, 0.08, 0.86]} />
      </T>
      <T color="#5B6658" position={[0, 0.69, 0]} outline={0.016}>
        <boxGeometry args={[1.92, 0.04, 0.8]} />
      </T>
      {[-0.85, 0.85].map((x) => (
        <T key={x} color="#3E463C" position={[x, 0.35, 0]} outline={0.014}>
          <boxGeometry args={[0.08, 0.7, 0.76]} />
        </T>
      ))}
      <T color="#3E463C" position={[0.55, 0.42, 0.18]} outline={0.012}>
        <boxGeometry args={[0.5, 0.34, 0.4]} />
      </T>
      {[0.5, 0.38].map((y) => (
        <Ink key={y} position={[0.55, y, 0.39]}>
          <boxGeometry args={[0.28, 0.02, 0.02]} />
        </Ink>
      ))}
    </group>
    {/* chair behind the desk */}
    <group position={[0.05, 0, -0.5]}>
      <T color="#4A4038" position={[0, 0.44, 0]} outline={0.014}>
        <boxGeometry args={[0.5, 0.06, 0.46]} />
      </T>
      <T color="#4A4038" position={[0, 0.8, -0.21]} outline={0.014}>
        <boxGeometry args={[0.5, 0.66, 0.06]} />
      </T>
      {[[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]].map(([dx, dz]) => (
        <Ink key={`${dx}${dz}`} position={[dx, 0.21, dz]}>
          <boxGeometry args={[0.035, 0.42, 0.035]} />
        </Ink>
      ))}
    </group>
    {/* cable and bulb over the desk */}
    <group position={[0.1, 2.7, 0.45]}>
      <Ink position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.6, 6]} />
      </Ink>
      <T color="#3A3A40" position={[0, -0.63, 0]} outline={0.012}>
        <coneGeometry args={[0.22, 0.16, 18, 1, true]} />
      </T>
      <T color="#FFE7B0" emissive="#FFC46B" emissiveIntensity={2.0} position={[0, -0.72, 0]} outline={false}>
        <sphereGeometry args={[0.07, 16, 12]} />
      </T>
    </group>
    {/* distant ships beyond the window, only visible in the wide keys */}
    <group position={[3.2, -0.5, -7.5]}>
      <T color="#414B4A" position={[0, 0.2, 0]} outline={0.02}>
        <boxGeometry args={[2.4, 0.24, 0.6]} />
      </T>
      <T color="#414B4A" position={[0.2, 0.42, 0]} outline={0.02}>
        <boxGeometry args={[0.7, 0.28, 0.4]} />
      </T>
      <Ink position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.9, 6]} />
      </Ink>
    </group>
  </group>
);
