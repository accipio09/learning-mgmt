import { lazy, Suspense } from "react";
import { detectWebGL, type Phase } from "@/lib/particles3d/constants";

const ParticleScene3D = lazy(
  () => import("@/lib/particles3d/ParticleScene")
);

interface ParticleCanvasProps {
  phase: Phase;
  cardRect: { x: number; y: number; w: number; h: number } | null;
  onConverged: () => void;
  opacity: number;
}

// Simple static dots fallback while 3D loads or when WebGL unavailable
function StaticFallback() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(1px 1px at random, #71717A 50%, transparent 50%)",
        opacity: 0.3,
      }}
    />
  );
}

export default function ParticleCanvas(props: ParticleCanvasProps) {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion || !detectWebGL()) {
    return <StaticFallback />;
  }

  return (
    <Suspense fallback={<StaticFallback />}>
      <ParticleScene3D {...props} />
    </Suspense>
  );
}
