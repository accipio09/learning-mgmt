import * as THREE from "three";

export const CAMERA_Z = 50;
export const CAMERA_FOV = 45;

// Particle counts by device capability
export const PARTICLE_COUNT_DESKTOP = 800;
export const PARTICLE_COUNT_MOBILE = 400;

// Zinc palette matching existing 2D system
export const PALETTE = [
  new THREE.Color("#3F3F46"), // zinc-700
  new THREE.Color("#52525B"), // zinc-600
  new THREE.Color("#71717A"), // zinc-500
  new THREE.Color("#A1A1AA"), // zinc-400
  new THREE.Color("#D4D4D8"), // zinc-300
];

// Physics
export const MOUSE_RADIUS = 18; // world units (~25% of viewport width)
export const MOUSE_STRENGTH = 0.004; // gentle nudge in direction of mouse
export const DRIFT_STRENGTH = 0.006; // very subtle random drift
export const DAMPING = 0.985; // high damping for slow, floaty movement
export const RESOLVE_SPRING = 0.025;
export const RESOLVE_DAMPING = 0.93;
export const SETTLE_DISTANCE = 1.5;
export const ORBIT_SPEED_MIN = 0.005;
export const ORBIT_SPEED_MAX = 0.015;
export const ORBIT_RADIUS_MIN = 0.5;
export const ORBIT_RADIUS_MAX = 2.0;

// Particle size range
export const SIZE_MIN = 0.15;
export const SIZE_MAX = 0.4;

// Z depth range for free-floating particles (keep thin so fog doesn't hide them)
export const Z_RANGE = 5;

// Max velocity per axis (prevents runaway accumulation)
export const MAX_VELOCITY = 0.15;

// Gentle pull toward viewport center (prevents drift to edges)
export const CENTER_PULL = 0.0003;

// Abstract shape duration (ms) before transitioning to card shape
export const ABSTRACT_SHAPE_DURATION = 800;

export type Phase =
  | "dust"
  | "resolving_card"
  | "card"
  | "rating"
  | "dissolving"
  | "dust2"
  | "brief";

export type ParticleRole = "border" | "halo" | "interior";

export function getParticleCount(): number {
  if (
    typeof navigator !== "undefined" &&
    /Mobi|Android/i.test(navigator.userAgent)
  ) {
    return PARTICLE_COUNT_MOBILE;
  }
  return PARTICLE_COUNT_DESKTOP;
}

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl2") || canvas.getContext("webgl")
    );
  } catch {
    return false;
  }
}
