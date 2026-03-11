import { useRef, useMemo, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import particleVert from "./shaders/particle.vert.glsl?raw";
import particleFrag from "./shaders/particle.frag.glsl?raw";
import {
  PALETTE,
  DRIFT_STRENGTH,
  DAMPING,
  RESOLVE_SPRING,
  RESOLVE_DAMPING,
  SETTLE_DISTANCE,
  ORBIT_SPEED_MIN,
  ORBIT_SPEED_MAX,
  ORBIT_RADIUS_MIN,
  ORBIT_RADIUS_MAX,
  SIZE_MIN,
  SIZE_MAX,
  Z_RANGE,
  MAX_VELOCITY,
  CENTER_PULL,
  ABSTRACT_SHAPE_DURATION,
  getParticleCount,
  type Phase,
} from "./constants";
import {
  getWorldSize,
  generateCardTargets,
  generateAbstractTargets,
  type TargetPoint,
} from "./targets";

interface ParticleFieldProps {
  phase: Phase;
  cardRect: { x: number; y: number; w: number; h: number } | null;
  onConverged: () => void;
  opacity: number;
}

// Per-particle CPU state
interface PState {
  // position
  x: number; y: number; z: number;
  // velocity
  vx: number; vy: number; vz: number;
  // target
  tx: number; ty: number; tz: number;
  // properties
  size: number;
  colorIdx: number;
  opacity: number;
  delay: number;
  elapsed: number;
  orbitAngle: number;
  orbitSpeed: number;
  orbitRadius: number;
  settled: boolean;
  role: "border" | "halo" | "interior";
  morphProgress: number;
  // rotation
  rotX: number; rotY: number; rotZ: number;
  rotVx: number; rotVy: number; rotVz: number;
}

export default function ParticleField({
  phase,
  cardRect,
  onConverged,
  opacity,
}: ParticleFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { size } = useThree();
  const count = useMemo(() => getParticleCount(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const convergedFired = useRef(false);
  const prevPhase = useRef<Phase>(phase);
  const abstractTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolving = useRef(false);

  // Per-particle state arrays
  const particles = useRef<PState[]>([]);

  // Instance attributes for shader
  const colorAttr = useMemo(() => new Float32Array(count * 3), [count]);
  const opacityAttr = useMemo(() => new Float32Array(count), [count]);
  const morphAttr = useMemo(() => new Float32Array(count), [count]);

  // Initialize particles
  useEffect(() => {
    const { worldWidth, worldHeight } = getWorldSize(size.width, size.height);
    const ps: PState[] = [];
    for (let i = 0; i < count; i++) {
      const colorIdx = Math.floor(Math.random() * PALETTE.length);
      ps.push({
        x: (Math.random() - 0.5) * worldWidth,
        y: (Math.random() - 0.5) * worldHeight,
        z: (Math.random() - 0.5) * Z_RANGE * 2,
        vx: (Math.random() - 0.5) * 0.03,
        vy: (Math.random() - 0.5) * 0.03,
        vz: (Math.random() - 0.5) * 0.005,
        tx: -9999, ty: -9999, tz: -9999,
        size: SIZE_MIN + Math.random() * (SIZE_MAX - SIZE_MIN),
        colorIdx,
        opacity: 0.3 + Math.random() * 0.5,
        delay: 0,
        elapsed: 0,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitSpeed: ORBIT_SPEED_MIN + Math.random() * (ORBIT_SPEED_MAX - ORBIT_SPEED_MIN),
        orbitRadius: ORBIT_RADIUS_MIN + Math.random() * (ORBIT_RADIUS_MAX - ORBIT_RADIUS_MIN),
        settled: false,
        role: "border",
        morphProgress: 0,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
        rotVx: (Math.random() - 0.5) * 0.02,
        rotVy: (Math.random() - 0.5) * 0.02,
        rotVz: (Math.random() - 0.5) * 0.01,
      });
    }
    particles.current = ps;
  }, [count, size.width, size.height]);

  // Apply targets to particles
  const applyTargets = useCallback(
    (targets: TargetPoint[]) => {
      const ps = particles.current;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const t = targets[i % targets.length];
        p.tx = t.x;
        p.ty = t.y;
        p.tz = t.z;
        p.role = t.role;
        p.elapsed = 0;
        p.settled = false;
        p.morphProgress = 0;
        // Staggered delay based on distance from center
        const dist = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
        p.delay = Math.floor(dist * 1.5) + Math.floor(Math.random() * 20);
      }
    },
    []
  );

  // Phase transitions
  useEffect(() => {
    if (prevPhase.current === phase) return;
    prevPhase.current = phase;

    if (abstractTimer.current) {
      clearTimeout(abstractTimer.current);
      abstractTimer.current = null;
    }

    const ps = particles.current;

    switch (phase) {
      case "dust":
      case "dust2": {
        resolving.current = false;
        convergedFired.current = false;
        for (const p of ps) {
          p.tx = -9999;
          p.ty = -9999;
          p.tz = -9999;
          p.settled = false;
          p.morphProgress = 0;
          p.role = "border";
        }
        break;
      }
      case "resolving_card": {
        resolving.current = true;
        convergedFired.current = false;

        // Phase 1: abstract icosahedron shape
        const abstractTargets = generateAbstractTargets(
          size.width,
          size.height,
          count
        );
        applyTargets(abstractTargets);

        // Phase 2: transition to card shape after delay
        if (cardRect) {
          abstractTimer.current = setTimeout(() => {
            const cardTargets = generateCardTargets(
              cardRect,
              size.width,
              size.height,
              count
            );
            applyTargets(cardTargets);
          }, ABSTRACT_SHAPE_DURATION);
        }
        break;
      }
      case "dissolving": {
        resolving.current = false;
        convergedFired.current = false;
        for (const p of ps) {
          p.tx = -9999;
          p.ty = -9999;
          p.tz = -9999;
          p.elapsed = 0;
          p.delay = 0;
          p.settled = false;
          p.morphProgress = 0;
          p.role = "border";
          const angle = Math.random() * Math.PI * 2;
          const elevation = (Math.random() - 0.5) * Math.PI;
          const mag = 0.08 + Math.random() * 0.15;
          p.vx = Math.cos(angle) * Math.cos(elevation) * mag;
          p.vy = Math.sin(elevation) * mag;
          p.vz = Math.sin(angle) * Math.cos(elevation) * mag;
          // Gentle spin on dissolve
          p.rotVx = (Math.random() - 0.5) * 0.03;
          p.rotVy = (Math.random() - 0.5) * 0.03;
        }
        break;
      }
      // card, rating, brief: no special transition needed
    }
  }, [phase, cardRect, count, size.width, size.height, applyTargets]);

  // Animation loop
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || particles.current.length === 0) return;

    const ps = particles.current;
    const { worldWidth, worldHeight } = getWorldSize(size.width, size.height);
    let allSettled = true;
    let allMorphed = true;

    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];

      if (resolving.current && p.tx > -9000) {
        p.elapsed++;

        if (p.elapsed < p.delay) {
          // Gentle drift toward target before delay expires
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          const dz = p.tz - p.z;
          p.vx += dx * 0.003;
          p.vy += dy * 0.003;
          p.vz += dz * 0.003;
          p.vx *= 0.98;
          p.vy *= 0.98;
          p.vz *= 0.98;
          allSettled = false;
          allMorphed = false;
        } else {
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          const dz = p.tz - p.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (!p.settled && dist <= SETTLE_DISTANCE) {
            p.settled = true;
          }

          if (!p.settled) {
            p.vx += dx * RESOLVE_SPRING;
            p.vy += dy * RESOLVE_SPRING;
            p.vz += dz * RESOLVE_SPRING;
            p.vx *= RESOLVE_DAMPING;
            p.vy *= RESOLVE_DAMPING;
            p.vz *= RESOLVE_DAMPING;
            allSettled = false;
            allMorphed = false;
          } else {
            // Orbit around target
            p.orbitAngle += p.orbitSpeed;
            const effectiveRadius =
              p.role === "interior"
                ? p.orbitRadius * (1 - p.morphProgress * 0.8)
                : p.orbitRadius;
            const ox = Math.cos(p.orbitAngle) * effectiveRadius;
            const oy = Math.sin(p.orbitAngle) * effectiveRadius;
            const goalX = p.tx + ox;
            const goalY = p.ty + oy;
            const goalZ = p.tz + Math.sin(p.orbitAngle * 0.7) * effectiveRadius * 0.3;
            p.vx += (goalX - p.x) * 0.06;
            p.vy += (goalY - p.y) * 0.06;
            p.vz += (goalZ - p.z) * 0.06;
            p.vx *= 0.9;
            p.vy *= 0.9;
            p.vz *= 0.9;

            // Interior particles morph
            if (p.role === "interior") {
              p.morphProgress = Math.min(1, p.morphProgress + 0.012);
              if (p.morphProgress < 0.85) allMorphed = false;
            }

            // Slow rotation to a stop as morph progresses
            p.rotVx *= 0.98 - p.morphProgress * 0.03;
            p.rotVy *= 0.98 - p.morphProgress * 0.03;
            p.rotVz *= 0.98 - p.morphProgress * 0.03;
          }
        }
      } else {
        // Gentle pull toward viewport center (prevents drift to edges)
        p.vx -= p.x * CENTER_PULL;
        p.vy -= p.y * CENTER_PULL;
        p.vz -= p.z * CENTER_PULL * 3; // stronger Z centering

        // Very subtle random drift for organic floating feel
        p.vx += (Math.random() - 0.5) * DRIFT_STRENGTH;
        p.vy += (Math.random() - 0.5) * DRIFT_STRENGTH;
        p.vz += (Math.random() - 0.5) * DRIFT_STRENGTH * 0.15;
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        p.vz *= DAMPING;
      }

      // Clamp velocity to prevent runaway speed
      p.vx = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, p.vx));
      p.vy = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, p.vy));
      p.vz = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, p.vz));

      // Apply velocity
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      // Rotation
      p.rotX += p.rotVx;
      p.rotY += p.rotVy;
      p.rotZ += p.rotVz;

      // Wrap around for free-floating
      if (!resolving.current) {
        const halfW = worldWidth / 2 + 2;
        const halfH = worldHeight / 2 + 2;
        if (p.x < -halfW) p.x = halfW;
        if (p.x > halfW) p.x = -halfW;
        if (p.y < -halfH) p.y = halfH;
        if (p.y > halfH) p.y = -halfH;
        // Keep Z tightly bounded
        if (p.z < -Z_RANGE) p.z = Z_RANGE;
        if (p.z > Z_RANGE) p.z = -Z_RANGE;
      }

      // Update instance matrix
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      const m = p.morphProgress;
      const s = p.size;
      dummy.scale.set(
        s * (1 + m * 4), // width grows into tile
        s * (1 + m * 2.5), // height grows
        s * (1 - m * 0.8) // depth flattens
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Update shader attributes
      const color = PALETTE[p.colorIdx];
      colorAttr[i * 3] = color.r;
      colorAttr[i * 3 + 1] = color.g;
      colorAttr[i * 3 + 2] = color.b;
      opacityAttr[i] = p.opacity * opacity;
      morphAttr[i] = p.morphProgress;
    }

    // Upload to GPU
    mesh.instanceMatrix.needsUpdate = true;

    const geo = mesh.geometry;
    const cAttr = geo.getAttribute("aColor") as THREE.InstancedBufferAttribute;
    const oAttr = geo.getAttribute("aOpacity") as THREE.InstancedBufferAttribute;
    const mAttr = geo.getAttribute("aMorphProgress") as THREE.InstancedBufferAttribute;
    if (cAttr) cAttr.needsUpdate = true;
    if (oAttr) oAttr.needsUpdate = true;
    if (mAttr) mAttr.needsUpdate = true;

    // Convergence callback
    if (
      resolving.current &&
      allSettled &&
      allMorphed &&
      !convergedFired.current
    ) {
      convergedFired.current = true;
      onConverged();
    }
  });

  // Shader material
  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: particleVert,
        fragmentShader: particleFrag,
        transparent: true,
        depthWrite: false,
      }),
    []
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      material={shaderMaterial}
    >
      <boxGeometry args={[1, 1, 1]}>
        <instancedBufferAttribute
          attach="attributes-aColor"
          args={[colorAttr, 3]}
        />
        <instancedBufferAttribute
          attach="attributes-aOpacity"
          args={[opacityAttr, 1]}
        />
        <instancedBufferAttribute
          attach="attributes-aMorphProgress"
          args={[morphAttr, 1]}
        />
      </boxGeometry>
    </instancedMesh>
  );
}
