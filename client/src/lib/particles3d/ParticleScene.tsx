import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Vignette, DepthOfField } from "@react-three/postprocessing";
import ParticleField from "./ParticleField";
import { CAMERA_Z, CAMERA_FOV, type Phase } from "./constants";

interface ParticleSceneProps {
  phase: Phase;
  cardRect: { x: number; y: number; w: number; h: number } | null;
  onConverged: () => void;
  opacity: number;
}

export default function ParticleScene({
  phase,
  cardRect,
  onConverged,
  opacity,
}: ParticleSceneProps) {
  const isMobile =
    typeof navigator !== "undefined" &&
    /Mobi|Android/i.test(navigator.userAgent);

  return (
    <Canvas
      camera={{ position: [0, 0, CAMERA_Z], fov: CAMERA_FOV }}
      dpr={[1, Math.min(window.devicePixelRatio, 2)]}
      gl={{ antialias: false, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Suspense fallback={null}>
        <ParticleField
          phase={phase}
          cardRect={cardRect}
          onConverged={onConverged}
          opacity={opacity}
        />

        {/* Post-processing: skip on mobile for performance */}
        {!isMobile && (
          <EffectComposer>
            <DepthOfField
              focusDistance={0.01}
              focalLength={0.04}
              bokehScale={2.5}
            />
            <Vignette offset={0.3} darkness={0.35} />
          </EffectComposer>
        )}
      </Suspense>
    </Canvas>
  );
}
