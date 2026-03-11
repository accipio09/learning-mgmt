import {
  CAMERA_Z,
  CAMERA_FOV,
  type ParticleRole,
} from "./constants";

/**
 * Convert screen pixel coordinates to Three.js world coordinates at Z=0 plane.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  canvasW: number,
  canvasH: number
): [number, number] {
  const fovRad = CAMERA_FOV * (Math.PI / 180);
  const worldHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
  const worldWidth = worldHeight * (canvasW / canvasH);

  const wx = (screenX / canvasW - 0.5) * worldWidth;
  const wy = -(screenY / canvasH - 0.5) * worldHeight;
  return [wx, wy];
}

/**
 * Get world-space dimensions of the viewport at Z=0.
 */
export function getWorldSize(canvasW: number, canvasH: number) {
  const fovRad = CAMERA_FOV * (Math.PI / 180);
  const worldHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
  const worldWidth = worldHeight * (canvasW / canvasH);
  return { worldWidth, worldHeight };
}

export interface TargetPoint {
  x: number;
  y: number;
  z: number;
  role: ParticleRole;
}

/**
 * Generate card-shape targets in world coordinates from a screen-space rect.
 */
export function generateCardTargets(
  rect: { x: number; y: number; w: number; h: number },
  canvasW: number,
  canvasH: number,
  count: number
): TargetPoint[] {
  const [rx, ry] = screenToWorld(rect.x, rect.y, canvasW, canvasH);
  const [rx2, ry2] = screenToWorld(
    rect.x + rect.w,
    rect.y + rect.h,
    canvasW,
    canvasH
  );
  const w = rx2 - rx;
  const h = ry2 - ry; // negative because Y is flipped

  const points: TargetPoint[] = [];

  // Interior fill (~50%)
  const interiorCount = Math.floor(count * 0.5);
  const cols = Math.ceil(Math.sqrt(interiorCount * (Math.abs(w) / Math.abs(h))));
  const rows = Math.ceil(interiorCount / cols);
  for (let i = 0; i < interiorCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    points.push({
      x:
        rx +
        ((col + 0.5) * w) / cols +
        (Math.random() - 0.5) * (w / cols) * 0.4,
      y:
        ry +
        ((row + 0.5) * h) / rows +
        (Math.random() - 0.5) * (h / rows) * 0.4,
      z: 0,
      role: "interior",
    });
  }

  // Border perimeter (~30%)
  const borderCount = Math.floor(count * 0.3);
  const margin = 1.0; // world units
  const absW = Math.abs(w) + 2 * margin;
  const absH = Math.abs(h) + 2 * margin;
  const perimeter = 2 * (absW + absH);
  for (let i = 0; i < borderCount; i++) {
    let d = (i / borderCount) * perimeter;
    let px: number, py: number;
    if (d < absW) {
      px = rx - margin + d * Math.sign(w);
      py = ry - margin * Math.sign(-h);
    } else if (d < absW + absH) {
      d -= absW;
      px = rx + w + margin * Math.sign(w);
      py = ry + (d / absH) * h;
    } else if (d < 2 * absW + absH) {
      d -= absW + absH;
      px = rx + w + margin * Math.sign(w) - d * Math.sign(w);
      py = ry + h + margin * Math.sign(h);
    } else {
      d -= 2 * absW + absH;
      px = rx - margin * Math.sign(w);
      py = ry + h + margin * Math.sign(h) - (d / absH) * h;
    }
    points.push({
      x: px + (Math.random() - 0.5) * 0.8,
      y: py + (Math.random() - 0.5) * 0.8,
      z: (Math.random() - 0.5) * 2,
      role: "border",
    });
  }

  // Halo (~20%)
  const haloCount = count - interiorCount - borderCount;
  const cx = rx + w / 2;
  const cy = ry + h / 2;
  for (let i = 0; i < haloCount; i++) {
    const angle = (i / haloCount) * Math.PI * 2;
    const dist = 3 + Math.random() * 5;
    points.push({
      x: cx + Math.cos(angle) * (Math.abs(w) / 2 + dist),
      y: cy + Math.sin(angle) * (Math.abs(h) / 2 + dist),
      z: (Math.random() - 0.5) * 10,
      role: "halo",
    });
  }

  return points;
}

/**
 * Generate abstract icosahedron-like shape targets for the intermediate formation.
 */
export function generateAbstractTargets(
  _canvasW: number,
  _canvasH: number,
  count: number
): TargetPoint[] {
  // Icosahedron vertices (normalized)
  const phi = (1 + Math.sqrt(5)) / 2;
  const icoVerts = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ];

  const scale = 8; // world units radius
  const points: TargetPoint[] = [];

  for (let i = 0; i < count; i++) {
    // Distribute particles around icosahedron vertices with some scatter
    const vert = icoVerts[i % icoVerts.length];
    const len = Math.sqrt(vert[0] ** 2 + vert[1] ** 2 + vert[2] ** 2);
    const scatter = 1.5 + Math.random() * 2;

    points.push({
      x: (vert[0] / len) * scale + (Math.random() - 0.5) * scatter,
      y: (vert[1] / len) * scale + (Math.random() - 0.5) * scatter,
      z: (vert[2] / len) * scale + (Math.random() - 0.5) * scatter,
      role: i % 3 === 0 ? "border" : i % 3 === 1 ? "interior" : "halo",
    });
  }

  return points;
}
