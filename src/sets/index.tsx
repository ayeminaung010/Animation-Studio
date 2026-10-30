// Reusable environments: 3–6 big simple shapes each, plus a little dressing.
import { useTexture } from "@react-three/drei";
import React from "react";
import { random, staticFile } from "remotion";
import * as THREE from "three";
import { Ink, T } from "../components/toon";
import { checkerTexture, stripesTexture, woodFloorTexture } from "../components/textures";
import { Road, TinyHouse } from "../props/buildings";
import { Cottage } from "../props/village";
import type { LightingName } from "../lib/shots";
import { ColdDock, IslandBar, IslandPort, ShipDeck, ShipHold } from "./ice";

export interface SetProps {
  f: number;
}

const Floor: React.FC<{ color: string; size?: number; map?: ReturnType<typeof checkerTexture> }> = ({ color, size = 60, map }) => (
  <T color={color} map={map} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
    <planeGeometry args={[size, size]} />
  </T>
);

const Wall: React.FC<{ color: string; z: number; map?: ReturnType<typeof stripesTexture>; height?: number; width?: number }> = ({
  color, z, map, height = 8, width = 30,
}) => (
  <T color={color} map={map} position={[0, height / 2, z]} outline={false}>
    <planeGeometry args={[width, height]} />
  </T>
);

const Window: React.FC<{ position: [number, number, number]; glass: string; glow?: number; moon?: boolean }> = ({
  position, glass, glow = 0, moon = false,
}) => (
  <group position={position}>
    <T color="#FFFFFF" outline={0.02}>
      <boxGeometry args={[1.2, 1.4, 0.06]} />
    </T>
    <T color={glass} emissive={glass} emissiveIntensity={glow} position={[0, 0, 0.035]} outline={false}>
      <planeGeometry args={[1.05, 1.25]} />
    </T>
    <Ink color="#FFFFFF" position={[0, 0, 0.04]}>
      <planeGeometry args={[0.05, 1.25]} />
    </Ink>
    <Ink color="#FFFFFF" position={[0, 0, 0.04]}>
      <planeGeometry args={[1.05, 0.05]} />
    </Ink>
    {moon ? (
      <Ink color="#F7EFC8" position={[0.25, 0.3, 0.038]}>
        <circleGeometry args={[0.12, 20]} />
      </Ink>
    ) : null}
  </group>
);

const Tree: React.FC<{ position: [number, number, number]; s?: number }> = ({ position, s = 1 }) => (
  <group position={position} scale={s}>
    <T color="#7A5236" position={[0, 0.6, 0]} outline={0.02}>
      <cylinderGeometry args={[0.1, 0.14, 1.2, 8]} />
    </T>
    <T color="#6DBE6A" position={[0, 1.6, 0]} outline={0.03}>
      <sphereGeometry args={[0.7, 16, 12]} />
    </T>
  </group>
);

const Facades: React.FC<{ z: number }> = ({ z }) => {
  const colors = ["#F2A65A", "#9BC4A0", "#E8D8C0", "#7FB4E6", "#E58F8F", "#C9B6E4", "#F2C14E"];
  return (
    <group>
      {colors.map((c, i) => {
        const w = 1.8 + random(`fw${i}`) * 1.2;
        const h = 2.6 + random(`fh${i}`) * 2.2;
        const x = -10 + i * 3.2;
        return (
          <group key={i} position={[x, 0, z]}>
            <T color={c} position={[0, h / 2, 0]} outline={0.03}>
              <boxGeometry args={[w, h, 1.2]} />
            </T>
            {[0.35, -0.35].map((wx) => (
              <T key={wx} color="#FFF2C8" position={[wx * w * 0.8, h * 0.65, 0.61]} outline={0.012}>
                <boxGeometry args={[0.35, 0.45, 0.02]} />
              </T>
            ))}
          </group>
        );
      })}
    </group>
  );
};

const TownStreet: React.FC<SetProps> = () => (
  <group>
    <Floor color="#D8C7A8" />
    <Road />
    <Facades z={-4.5} />
    <Tree position={[-3.2, 0, -2.4]} />
    <Tree position={[3.6, 0, -2.8]} s={1.2} />
    <group position={[2.4, 0, -1.2]}>
      <Ink position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 2.6, 8]} />
      </Ink>
      <T color="#FFF2C8" emissive="#FFD58A" emissiveIntensity={0.6} position={[0, 2.65, 0]} outline={0.015}>
        <sphereGeometry args={[0.16, 12, 10]} />
      </T>
    </group>
  </group>
);

const BankExterior: React.FC<SetProps> = () => (
  <group>
    <Floor color="#D8C7A8" />
    <Road />
    <Tree position={[-4.4, 0, -2.0]} s={1.3} />
    <Tree position={[4.6, 0, -2.2]} s={1.2} />
    <Facades z={-9} />
  </group>
);

const GroceryAisle: React.FC<SetProps> = () => {
  const goods = ["#F2C14E", "#E58F8F", "#7FB4E6", "#7BC67E", "#F2A65A", "#C9B6E4"];
  return (
    <group>
      <Floor color="#FFFFFF" map={checkerTexture("#E9E4DA", "#F8F5EE", 2)} />
      <Wall color="#F3EDE0" z={-7} />
      {[-1.9, 1.9].map((x) => (
        <group key={x} position={[x, 0, -2]}>
          <T color="#E1E5EA" position={[0, 1.1, 0]} outline={0.025}>
            <boxGeometry args={[0.7, 2.2, 9]} />
          </T>
          {[0.4, 0.95, 1.5].flatMap((y) =>
            Array.from({ length: 9 }, (_, i) => (
              <T key={`${y}-${i}`} color={goods[(i + Math.round(y * 10)) % goods.length]}
                position={[-Math.sign(x) * 0.38, y + 0.14, -4 + i * 1.0]} outline={0.01}>
                <boxGeometry args={[0.08, 0.28, 0.7]} />
              </T>
            )),
          )}
        </group>
      ))}
    </group>
  );
};

const GenericLivingRoom: React.FC<SetProps> = () => (
  <group>
    <Floor color="#B98A60" />
    <Wall color="#FFFFFF" z={-2} map={stripesTexture("#D6CBB8", "#E6DCC8", 12)} />
    <Window position={[1.3, 1.7, -1.95]} glass="#22325A" moon />
    <T color="#8A5A3B" position={[-1.3, 0.35, -1.2]} outline={0.02}>
      <boxGeometry args={[0.6, 0.7, 0.6]} />
    </T>
  </group>
);

const InterviewOffice: React.FC<SetProps> = () => {
  const wood = woodFloorTexture();
  wood.repeat.set(5, 5);
  return (
    <group>
      <T color="#FFFFFF" map={wood} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
        <planeGeometry args={[30, 30]} />
      </T>
      <Wall color="#FFFFFF" z={-2} map={stripesTexture("#B8CBD6", "#C6D7E0", 10)} />
      <Window position={[-1.6, 1.9, -1.95]} glass="#9ED3F0" />
      {/* framed certificate */}
      <group position={[1.5, 2.0, -1.96]}>
        <T color="#C79A3C" outline={0.015}>
          <boxGeometry args={[0.8, 0.6, 0.04]} />
        </T>
        <T color="#FFF7E0" position={[0, 0, 0.025]} outline={false}>
          <planeGeometry args={[0.66, 0.46]} />
        </T>
      </group>
      {/* potted plant */}
      <group position={[2.6, 0, -1.5]}>
        <T color="#C0623A" position={[0, 0.25, 0]} outline={0.02}>
          <cylinderGeometry args={[0.22, 0.17, 0.5, 14]} />
        </T>
        <T color="#5BAF5E" position={[0, 0.85, 0]} outline={0.025}>
          <sphereGeometry args={[0.42, 14, 10]} />
        </T>
      </group>
    </group>
  );
};

const PhoneBedroom: React.FC<SetProps> = () => (
  <group>
    <Floor color="#7D6A8A" />
    <Wall color="#FFFFFF" z={-2.2} map={stripesTexture("#4E5A7A", "#56638A", 10)} />
    {/* short partition: splits the two rooms without hiding anyone */}
    <T color="#2E3550" position={[0.15, 2, -1.45]} outline={0.02}>
      <boxGeometry args={[0.12, 4, 1.5]} />
    </T>
    {[-1.5, 1.8].map((x, i) => (
      <group key={x} position={[x, 0, -1.4]}>
        <T color={i ? "#C9B6E4" : "#7FB4E6"} position={[0, 0.25, 0]} outline={0.02}>
          <boxGeometry args={[1.2, 0.5, 1.2]} />
        </T>
        <T color="#FFFFFF" position={[0, 0.56, -0.4]} outline={0.015}>
          <boxGeometry args={[0.7, 0.14, 0.32]} />
        </T>
      </group>
    ))}
  </group>
);

const MansionBlock: React.FC<SetProps> = () => (
  <group>
    <Floor color="#8FD07A" />
    <T color="#5E5A63" position={[0, 0.003, 3.2]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <planeGeometry args={[60, 2.4]} />
    </T>
    {[-7.5, 7.5].map((x) => (
      <T key={x} color="#5FA65A" position={[x, 0.3, 1.6]} outline={0.02}>
        <boxGeometry args={[3, 0.6, 0.5]} />
      </T>
    ))}
    <Tree position={[-9.5, 0, -2]} s={1.4} />
    <Tree position={[9.8, 0, -1.5]} s={1.3} />
    <group position={[-12.5, 0, -1]}>
      <TinyHouse f={0} d={1} fps={30} color="#E8D8C0" />
    </group>
  </group>
);

const MomLivingRoom: React.FC<SetProps & { night?: boolean }> = ({ night = false }) => (
  <group>
    <Floor color={night ? "#6E5440" : "#B98A60"} />
    <Wall color="#FFFFFF" z={-1.6} map={night ? stripesTexture("#5E5470", "#665C7A", 14) : stripesTexture("#D9C8E8", "#EFE6F5", 14)} />
    <Window position={[-1.6, 1.75, -1.55]} glass={night ? "#1B2440" : "#BFE3F7"} glow={night ? 0 : 0.35} moon={night} />
    <T color={night ? "#7A3A44" : "#C0392B"} position={[0, 0.006, 0.2]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <circleGeometry args={[1.6, 40]} />
    </T>
    {/* family photo frame: a mother and a small boy */}
    <group position={[1.65, 2.05, -1.56]}>
      <T color="#C79A3C" outline={0.015}>
        <boxGeometry args={[0.6, 0.5, 0.04]} />
      </T>
      <T color="#F4EEE2" position={[0, 0, 0.022]} outline={false}>
        <planeGeometry args={[0.48, 0.38]} />
      </T>
      <Ink color="#8E7CC3" position={[-0.08, -0.03, 0.025]}>
        <circleGeometry args={[0.09, 16]} />
      </Ink>
      <Ink color="#D94F30" position={[0.1, -0.07, 0.025]}>
        <circleGeometry args={[0.06, 16]} />
      </Ink>
    </group>
  </group>
);

const Restaurant: React.FC<SetProps> = () => (
  <group>
    <Floor color="#FFFFFF" map={checkerTexture("#B3352B", "#F4EEE2", 2)} />
    <Wall color="#F4E1C1" z={-2.2} />
    {[-2.2, 2.4].map((x) => (
      <T key={x} color="#7A2E2A" position={[x, 0.55, -1.7]} outline={0.02}>
        <boxGeometry args={[1.6, 1.1, 0.6]} />
      </T>
    ))}
    {[-1.4, 1.4].map((x) => (
      <group key={x} position={[x, 2.6, -0.8]}>
        <Ink position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 1.2, 6]} />
        </Ink>
        <T color="#2E4A3A" outline={0.015}>
          <coneGeometry args={[0.25, 0.2, 16, 1, true]} />
        </T>
      </group>
    ))}
  </group>
);

const ChapelExterior: React.FC<SetProps> = () => (
  <group>
    <Floor color="#9BD38A" />
    <T color="#E9E1D2" position={[0, 0.004, -1]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <planeGeometry args={[0.9, 10]} />
    </T>
    <Tree position={[-4, 0, -3]} s={1.3} />
    <Tree position={[4.2, 0, -3.4]} s={1.1} />
  </group>
);

const JerryDen: React.FC<SetProps> = () => (
  <group>
    <Floor color="#3E4058" />
    <Wall color="#4A4E69" z={-1.8} />
    {/* sports pennant */}
    <T color="#F2C14E" position={[-1.3, 2.0, -1.78]} rotation={[0, 0, -Math.PI / 2]} outline={0.015}>
      <circleGeometry args={[0.35, 3]} />
    </T>
    <T color="#3FA7D6" position={[1.4, 1.9, -1.78]} outline={0.015}>
      <planeGeometry args={[0.7, 0.9]} />
    </T>
  </group>
);

/**
 * A painted back wall (public/sets/<name>) behind a real 3D floor. Unlit, so the painting keeps its own light.
 * Images are 4:3; the plate is 6.4 wide so wide shots never see its edges.
 */
const PaintedPlate: React.FC<{ src: string; z?: number }> = ({ src, z = -2 }) => {
  const tex = useTexture(staticFile(src), (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
  });
  const w = 6.4;
  const img = tex.image as HTMLImageElement;
  const h = (w * img.height) / img.width;
  return (
    <mesh position={[0, h / 2, z]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

const WaitingRoom: React.FC<SetProps> = () => {
  const wood = woodFloorTexture();
  wood.repeat.set(5, 5);
  return (
    <group>
      <PaintedPlate src="sets/waiting-room.png" />
      <T color="#FFFFFF" map={wood} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 4]} outline={false}>
        <planeGeometry args={[12, 12]} />
      </T>
    </group>
  );
};

// ---------- old Welsh village (sin-eater) ----------

const Beam: React.FC<{ y: number; z: number }> = ({ y, z }) => (
  <T color="#4A3220" position={[0, y, z]} outline={0.02}>
    <boxGeometry args={[30, 0.22, 0.25]} />
  </T>
);

const WakeRoom: React.FC<SetProps> = () => (
  <group>
    <Floor color="#7D756A" map={checkerTexture("#857C70", "#776F64", 6)} />
    <Wall color="#E6DCC8" z={-2.2} />
    <Beam y={3.1} z={-2.05} />
    <Window position={[2.2, 1.9, -2.15]} glass="#1B2440" moon />
    {/* dresser with plates against the back wall */}
    <T color="#6B4A30" position={[-2.4, 0.9, -1.85]} outline={0.02}>
      <boxGeometry args={[1.4, 1.8, 0.5]} />
    </T>
    {[-2.8, -2.4, -2.0].map((x) => (
      <T key={x} color="#7FB4E6" position={[x, 1.5, -1.58]} outline={0.01}>
        <cylinderGeometry args={[0.15, 0.15, 0.02, 20]} />
      </T>
    ))}
  </group>
);

const HostStudy: React.FC<SetProps> = () => {
  const books = ["#8E2A2A", "#2E4A3A", "#C79A3C", "#3F4A5C", "#6B4A30", "#7A3A44"];
  return (
    <group>
      <Floor color="#6E4B33" />
      <Wall color="#2F4538" z={-1.8} />
      {[-1.6, 1.6].map((x) => (
        <group key={x} position={[x, 0, -1.6]}>
          <T color="#4A3220" position={[0, 1.4, 0]} outline={0.02}>
            <boxGeometry args={[1.2, 2.8, 0.4]} />
          </T>
          {[0.6, 1.3, 2.0].flatMap((y) =>
            Array.from({ length: 6 }, (_, i) => (
              <T key={`${y}-${i}`} color={books[(i + Math.round(y * 3)) % books.length]} position={[-0.45 + i * 0.18, y + 0.2, 0.18]} outline={0.008}>
                <boxGeometry args={[0.14, 0.4 + random(`bk${x}${y}${i}`) * 0.1, 0.06]} />
              </T>
            )),
          )}
        </group>
      ))}
    </group>
  );
};

const VillageLane: React.FC<SetProps> = () => (
  <group>
    <Floor color="#8E9A6A" />
    <T color="#A79B86" position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} outline={false} map={checkerTexture("#ADA18C", "#9C907B", 8)}>
      <planeGeometry args={[4, 40]} />
    </T>
    {[-4.2, 3.9, 8.5, -8.6].map((x, i) => (
      <group key={x} position={[x, 0, -4.5 - (i % 2) * 0.6]}>
        <Cottage f={0} d={1} fps={30} wall={["#EFE8DA", "#E7DCC4", "#F2EDE3", "#DCCDB4"][i]} />
      </group>
    ))}
    <T color="#6AA557" position={[0, -6, -18]} scale={[22, 9, 4]} outline={0.03}>
      <sphereGeometry args={[1, 24, 16]} />
    </T>
    <Tree position={[-1.6, 0, -6]} s={1.2} />
  </group>
);

const WidowKitchen: React.FC<SetProps> = () => (
  <group>
    <Floor color="#8B7B68" map={checkerTexture("#93836F", "#857561", 6)} />
    <Wall color="#D9CDB4" z={-1.9} />
    <Beam y={3.0} z={-1.75} />
    {/* hanging copper pots */}
    {[-1.9, -1.5, -1.1].map((x, i) => (
      <group key={x} position={[x, 2.4 - i * 0.08, -1.6]}>
        <Ink position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.6, 6]} />
        </Ink>
        <T color="#C27A44" outline={0.012}>
          <cylinderGeometry args={[0.16 + i * 0.03, 0.12, 0.2, 16]} />
        </T>
      </group>
    ))}
    <T color="#7A5236" position={[1.9, 0.45, -0.9]} outline={0.02}>
      <boxGeometry args={[1.4, 0.9, 0.8]} />
    </T>
  </group>
);

const IfanHut: React.FC<SetProps> = () => (
  <group>
    <Floor color="#6E5A44" />
    <Wall color="#7A6248" z={-1.6} map={stripesTexture("#806850", "#735C44", 9)} />
    {/* straw pallet and an upturned crate */}
    <T color="#D9B85C" position={[1.5, 0.12, -0.9]} outline={0.02}>
      <boxGeometry args={[1.6, 0.24, 0.9]} />
    </T>
    <T color="#8A6A48" position={[0, 0.25, -0.3]} outline={0.018}>
      <boxGeometry args={[0.7, 0.5, 0.5]} />
    </T>
    <Window position={[-1.6, 1.8, -1.55]} glass="#22325A" />
  </group>
);

const LordHall: React.FC<SetProps> = () => (
  <group>
    <Floor color="#FFFFFF" map={checkerTexture("#2B2B33", "#D8D2C4", 2)} />
    <Wall color="#6E1F24" z={-2.6} height={10} />
    {[-2.4, 2.4].map((x) => (
      <group key={x}>
        <T color="#D8D2C4" position={[x, 2.5, -2.3]} outline={0.025}>
          <cylinderGeometry args={[0.28, 0.32, 5, 16]} />
        </T>
        <T color="#B9A26A" position={[x * 0.5, 2.6, -2.55]} outline={0.02}>
          <boxGeometry args={[0.9, 2.2, 0.06]} />
        </T>
      </group>
    ))}
    <group position={[0, 4.2, -0.6]}>
      <Ink position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 1.6, 6]} />
      </Ink>
      <T color="#D4A93C" outline={0.015}>
        <torusGeometry args={[0.6, 0.04, 8, 30]} />
      </T>
    </group>
  </group>
);

const Graveyard: React.FC<SetProps> = () => (
  <group>
    <Floor color="#6E8F5A" />
    {/* low stone wall and an old chapel against the dawn */}
    <T color="#8E8A80" position={[0, 0.35, -5]} outline={0.025}>
      <boxGeometry args={[30, 0.7, 0.5]} />
    </T>
    <group position={[3.5, 0, -9]}>
      <T color="#7A7F86" position={[0, 1.6, 0]} outline={0.03}>
        <boxGeometry args={[2.4, 3.2, 2]} />
      </T>
      <T color="#7A7F86" position={[-1.6, 2.6, 0]} outline={0.03}>
        <boxGeometry args={[0.9, 5.2, 0.9]} />
      </T>
      <T color="#4A5560" position={[-1.6, 5.7, 0]} outline={0.03}>
        <coneGeometry args={[0.7, 1.2, 4]} />
      </T>
    </group>
    {[-3.4, -2.2, 2.4, 4.6, -4.8].map((x, i) => (
      <T key={x} color="#8B9096" position={[x, 0.35, -2.8 - (i % 2) * 1.2]} rotation={[0, 0, (random(`gs${i}`) - 0.5) * 0.25]} outline={0.018}>
        <boxGeometry args={[0.45, 0.7, 0.12]} />
      </T>
    ))}
    {/* bare tree */}
    <group position={[-3.2, 0, -4]}>
      <T color="#3E2E24" position={[0, 1.2, 0]} outline={0.02}>
        <cylinderGeometry args={[0.08, 0.16, 2.4, 8]} />
      </T>
      {[0.7, -0.6, 0.3].map((r, i) => (
        <T key={i} color="#3E2E24" position={[Math.sin(r) * 0.5, 2.2 + i * 0.25, 0]} rotation={[0, 0, -r]} outline={0.015}>
          <cylinderGeometry args={[0.03, 0.06, 1.1, 6]} />
        </T>
      ))}
    </group>
  </group>
);

interface SetDef {
  component: React.FC<SetProps>;
  /** Background colour override per lighting (outdoor skies). */
  sky?: Partial<Record<LightingName, string>>;
}

const DAY_SKY = { "warm-key": "#9ED3F0", "cold-blue": "#6F8DB8" };

export const SETS: Record<string, SetDef> = {
  "town-street": { component: TownStreet, sky: DAY_SKY },
  "bank-exterior": { component: BankExterior, sky: DAY_SKY },
  "grocery-aisle": { component: GroceryAisle },
  "generic-living-room": { component: GenericLivingRoom },
  "phone-bedroom": { component: PhoneBedroom },
  "jerry-mansion-block": { component: MansionBlock, sky: DAY_SKY },
  "mom-living-room": { component: MomLivingRoom },
  "mom-living-room-night": { component: (p) => <MomLivingRoom {...p} night /> },
  restaurant: { component: Restaurant },
  "chapel-exterior": { component: ChapelExterior, sky: { "cold-blue": "#8EA6C8", "warm-key": "#9ED3F0" } },
  "jerry-den": { component: JerryDen },
  "waiting-room": { component: WaitingRoom },
  "interview-office": { component: InterviewOffice },
  "wake-room": { component: WakeRoom },
  "host-study": { component: HostStudy },
  "village-lane": { component: VillageLane, sky: { "warm-key": "#9ED3F0", "cold-blue": "#7F93B0" } },
  "widow-kitchen": { component: WidowKitchen },
  "ifan-hut": { component: IfanHut },
  "lord-hall": { component: LordHall },
  graveyard: { component: Graveyard, sky: { "cold-blue": "#C9B8C8", "warm-key": "#F2C9A0" } },
  "cold-dock": { component: ColdDock, sky: { "warm-key": "#BFD6EC" } },
  "ship-deck": { component: ShipDeck, sky: { "warm-key": "#8FD3F5" } },
  "ship-hold": { component: ShipHold },
  "island-port": { component: IslandPort, sky: { "warm-key": "#8FD8F7" } },
  "island-bar": { component: IslandBar, sky: { "warm-key": "#F7B77A" } },
};

export const setDef = (name: string): SetDef => {
  const s = SETS[name];
  if (!s) throw new Error(`Unknown set "${name}". Add it to src/sets/index.tsx`);
  return s;
};
