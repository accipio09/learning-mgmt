type ParticleRole = "border" | "halo" | "interior";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  size: number;
  color: string;
  opacity: number;
  delay: number;
  elapsed: number;
  orbitAngle: number;
  orbitSpeed: number;
  orbitRadius: number;
  settled: boolean;
  role: ParticleRole;
  morphProgress: number; // 0 = circle dot, 1 = white rectangle tile
}

interface TargetPoint {
  x: number;
  y: number;
  role: ParticleRole;
}

const PALETTE = ["#3F3F46", "#52525B", "#71717A", "#A1A1AA", "#D4D4D8"];
const PARTICLE_COUNT = 150;

export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private mouse = { x: -1000, y: -1000 };
  private animId = 0;
  private resolving = false;
  private convergedCb: (() => void) | null = null;
  private _canvasOpacity = 1;
  private convergedFired = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.initParticles();
  }

  private initParticles() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        tx: -1,
        ty: -1,
        size: 1.5 + Math.random() * 2,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        opacity: 0.3 + Math.random() * 0.5,
        delay: 0,
        elapsed: 0,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitSpeed: 0.005 + Math.random() * 0.01,
        orbitRadius: 3 + Math.random() * 8,
        settled: false,
        role: "border",
        morphProgress: 0,
      });
    }
  }

  resize(w: number, h: number) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.scale(dpr, dpr);

    for (const p of this.particles) {
      if (p.x > w || p.y > h) {
        p.x = Math.random() * w;
        p.y = Math.random() * h;
      }
    }
  }

  setMouse(x: number, y: number) {
    this.mouse.x = x;
    this.mouse.y = y;
  }

  set canvasOpacity(v: number) {
    this._canvasOpacity = v;
  }

  start() {
    const loop = () => {
      this.update();
      this.draw();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.animId);
  }

  onConverged(cb: () => void) {
    this.convergedCb = cb;
  }

  resolve(rect: { x: number; y: number; w: number; h: number }) {
    this.resolving = true;
    this.convergedFired = false;
    const targets = this.distributeTargets(rect);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const t = targets[i % targets.length];
      p.tx = t.x;
      p.ty = t.y;
      p.role = t.role;
      p.elapsed = 0;
      p.settled = false;
      p.morphProgress = 0;
      const dist = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      const maxDist = Math.sqrt(cx ** 2 + cy ** 2);
      p.delay =
        Math.floor((dist / maxDist) * 60) + Math.floor(Math.random() * 30);
    }
  }

  dissolve() {
    this.resolving = false;
    this.convergedFired = false;
    for (const p of this.particles) {
      p.tx = -1;
      p.ty = -1;
      p.elapsed = 0;
      p.delay = 0;
      p.settled = false;
      p.morphProgress = 0;
      p.role = "border";
      const angle = Math.random() * Math.PI * 2;
      const mag = 1 + Math.random() * 2.5;
      p.vx = Math.cos(angle) * mag;
      p.vy = Math.sin(angle) * mag;
    }
  }

  private distributeTargets(rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): TargetPoint[] {
    const points: TargetPoint[] = [];
    const { x, y, w, h } = rect;
    const margin = 12;

    // Interior fill (~50%) — these morph into the card surface
    const interiorCount = Math.floor(PARTICLE_COUNT * 0.5);
    // Grid-like distribution for better coverage
    const cols = Math.ceil(Math.sqrt(interiorCount * (w / h)));
    const rows = Math.ceil(interiorCount / cols);
    for (let i = 0; i < interiorCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      points.push({
        x: x + (col + 0.5) * (w / cols) + (Math.random() - 0.5) * (w / cols) * 0.4,
        y: y + (row + 0.5) * (h / rows) + (Math.random() - 0.5) * (h / rows) * 0.4,
        role: "interior",
      });
    }

    // Border perimeter (~30%)
    const borderCount = Math.floor(PARTICLE_COUNT * 0.3);
    const perimeter = 2 * (w + 2 * margin + h + 2 * margin);
    for (let i = 0; i < borderCount; i++) {
      let d = (i / borderCount) * perimeter;
      const tw = w + 2 * margin;
      const th = h + 2 * margin;
      let px: number, py: number;
      if (d < tw) {
        px = x - margin + d;
        py = y - margin;
      } else if (d < tw + th) {
        d -= tw;
        px = x + w + margin;
        py = y - margin + d;
      } else if (d < 2 * tw + th) {
        d -= tw + th;
        px = x + w + margin - d;
        py = y + h + margin;
      } else {
        d -= 2 * tw + th;
        px = x - margin;
        py = y + h + margin - d;
      }
      points.push({
        x: px + (Math.random() - 0.5) * 8,
        y: py + (Math.random() - 0.5) * 8,
        role: "border",
      });
    }

    // Halo (~20%)
    const haloCount = PARTICLE_COUNT - interiorCount - borderCount;
    for (let i = 0; i < haloCount; i++) {
      const angle = (i / haloCount) * Math.PI * 2;
      const dist = 20 + Math.random() * 40;
      const cx = x + w / 2;
      const cy = y + h / 2;
      points.push({
        x: cx + Math.cos(angle) * (w / 2 + dist),
        y: cy + Math.sin(angle) * (h / 2 + dist),
        role: "halo",
      });
    }

    return points;
  }

  private update() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    let allSettled = true;
    let allMorphed = true;

    for (const p of this.particles) {
      if (this.resolving && p.tx >= 0) {
        p.elapsed++;

        if (p.elapsed < p.delay) {
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          p.vx += dx * 0.003;
          p.vy += dy * 0.003;
          p.vx *= 0.98;
          p.vy *= 0.98;
          allSettled = false;
          allMorphed = false;
        } else {
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (!p.settled && dist <= 12) {
            p.settled = true;
          }

          if (!p.settled) {
            p.vx += dx * 0.025;
            p.vy += dy * 0.025;
            p.vx *= 0.93;
            p.vy *= 0.93;
            allSettled = false;
            allMorphed = false;
          } else {
            // Settled: orbit around target
            p.orbitAngle += p.orbitSpeed;
            // Interior particles orbit tighter as they morph
            const effectiveRadius =
              p.role === "interior"
                ? p.orbitRadius * (1 - p.morphProgress * 0.8)
                : p.orbitRadius;
            const ox = Math.cos(p.orbitAngle) * effectiveRadius;
            const oy = Math.sin(p.orbitAngle) * effectiveRadius;
            const goalX = p.tx + ox;
            const goalY = p.ty + oy;
            p.vx += (goalX - p.x) * 0.06;
            p.vy += (goalY - p.y) * 0.06;
            p.vx *= 0.9;
            p.vy *= 0.9;

            // Interior particles morph into card tiles
            if (p.role === "interior") {
              p.morphProgress = Math.min(1, p.morphProgress + 0.012);
              if (p.morphProgress < 0.85) {
                allMorphed = false;
              }
            }
          }
        }
      } else {
        // Free-floating
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 1) {
          p.vx += (dx / dist) * 0.15;
          p.vy += (dy / dist) * 0.15;
        }

        p.vx += (Math.random() - 0.5) * 0.1;
        p.vy += (Math.random() - 0.5) * 0.1;
        p.vx *= 0.97;
        p.vy *= 0.97;
      }

      p.x += p.vx;
      p.y += p.vy;

      if (!this.resolving) {
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
      }
    }

    // Fire callback once all particles settled AND interior tiles formed
    if (
      this.resolving &&
      allSettled &&
      allMorphed &&
      !this.convergedFired &&
      this.convergedCb
    ) {
      this.convergedFired = true;
      this.convergedCb();
    }
  }

  private draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    this.ctx.clearRect(0, 0, w, h);

    // Draw non-morphing particles first (behind), then morphing (in front)
    for (const pass of [0, 1]) {
      for (const p of this.particles) {
        const isMorphing = p.role === "interior" && p.morphProgress > 0;
        if (pass === 0 && isMorphing) continue; // skip morphing on first pass
        if (pass === 1 && !isMorphing) continue; // skip non-morphing on second pass

        if (isMorphing) {
          const m = p.morphProgress;
          // Tile size grows from dot to fill its grid cell
          const tileW = p.size * 2 + m * 14;
          const tileH = p.size * 2 + m * 10;
          const cornerR = p.size * (1 - m * 0.7);

          // Draw particle-colored base shape (fades out)
          this.ctx.globalAlpha =
            p.opacity * (1 - m * 0.6) * this._canvasOpacity;
          this.ctx.fillStyle = p.color;
          this.roundRect(
            p.x - tileW / 2,
            p.y - tileH / 2,
            tileW,
            tileH,
            cornerR
          );

          // Draw white overlay (fades in) — forms the card surface
          this.ctx.globalAlpha = m * 0.9 * this._canvasOpacity;
          this.ctx.fillStyle = "#FFFFFF";
          this.roundRect(
            p.x - tileW / 2,
            p.y - tileH / 2,
            tileW,
            tileH,
            cornerR
          );

          // Subtle border on the tile for texture
          if (m > 0.3) {
            this.ctx.globalAlpha = (m - 0.3) * 0.15 * this._canvasOpacity;
            this.ctx.strokeStyle = "#E4E4E7";
            this.ctx.lineWidth = 0.5;
            this.ctx.beginPath();
            this.ctx.roundRect(
              p.x - tileW / 2,
              p.y - tileH / 2,
              tileW,
              tileH,
              cornerR
            );
            this.ctx.stroke();
          }
        } else {
          // Standard circle
          this.ctx.globalAlpha = p.opacity * this._canvasOpacity;
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    this.ctx.globalAlpha = 1;
  }

  private roundRect(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    this.ctx.fill();
  }
}
