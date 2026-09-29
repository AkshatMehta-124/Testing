/**
 * AKSH Video & Audio Editor - Particle & Neon Energy System
 * Canvas particle physics engine: shockwaves, explosive sparks,
 * floating motes, electric arcs, orbiting particles, and anime speed lines
 */

class ParticleSystem {
  constructor() {
    this.sparks = [];
    this.floatingMotes = [];
    this.orbitingParticles = [];
    this.shockwaves = [];
    this.electricArcs = [];
    this.speedLines = [];

    // Global settings
    this.sparkColor = '#ff2a54';
    this.accentColor = '#00f3ff';
    this.maxSparks = 250;
    this.maxFloating = 120;
    this.maxShockwaves = 12;
  }

  /**
   * Initializes floating motes and orbiting particles
   */
  init(width, height, count = 50) {
    this.clear();
    // Ambient floating motes
    for (let i = 0; i < count; i++) {
      this.floatingMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 20,
        vy: -20 - Math.random() * 40,
        size: 1 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.5 ? this.sparkColor : this.accentColor
      });
    }

    // Orbiting particles around central ring
    for (let i = 0; i < 30; i++) {
      this.orbitingParticles.push({
        angle: Math.random() * Math.PI * 2,
        speed: (0.8 + Math.random() * 1.5) * (Math.random() > 0.5 ? 1 : -1),
        baseRadius: 180 + Math.random() * 50,
        radiusOffset: 0,
        size: 2 + Math.random() * 3,
        alpha: 0.4 + Math.random() * 0.5,
        color: i % 2 === 0 ? this.sparkColor : this.accentColor
      });
    }
  }

  clear() {
    this.sparks.length = 0;
    this.shockwaves.length = 0;
    this.electricArcs.length = 0;
    this.speedLines.length = 0;
  }

  /**
   * Trigger explosive radial spark burst on beat hits
   */
  emitBeatBurst(cx, cy, count = 60, color = null, intensity = 1.0) {
    const burstColor = color || this.sparkColor;
    const actualCount = Math.min(count, this.maxSparks - this.sparks.length);

    for (let i = 0; i < actualCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (180 + Math.random() * 550) * intensity;
      const life = 0.4 + Math.random() * 0.6;
      this.sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        drag: 0.94,
        size: (2.5 + Math.random() * 3.5) * intensity,
        color: burstColor,
        life: life,
        maxLife: life,
        alpha: 1.0
      });
    }
  }

  /**
   * Trigger expanding circular neon shockwave on beat / bass drop
   */
  emitShockwave(cx, cy, color = null, maxRadius = 600, thickness = 6) {
    if (this.shockwaves.length >= this.maxShockwaves) {
      this.shockwaves.shift();
    }
    this.shockwaves.push({
      x: cx,
      y: cy,
      radius: 100,
      maxRadius: maxRadius,
      thickness: thickness,
      color: color || this.sparkColor,
      growthRate: 850 + Math.random() * 300, // px per sec
      alpha: 1.0,
      life: 1.0
    });
  }

  /**
   * Trigger random procedural electric lightning arcs
   */
  emitElectricArc(cx, cy, radius, color = '#00f3ff') {
    const startAngle = Math.random() * Math.PI * 2;
    const arcSpan = (0.3 + Math.random() * 0.7) * Math.PI;
    const endAngle = startAngle + arcSpan;
    const segments = 8;
    const points = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = startAngle + (endAngle - startAngle) * t;
      const rJitter = radius + (Math.random() - 0.5) * 35;
      points.push({
        x: cx + Math.cos(a) * rJitter,
        y: cy + Math.sin(a) * rJitter
      });
    }

    this.electricArcs.push({
      points,
      color,
      life: 0.12,
      maxLife: 0.12,
      thickness: 2 + Math.random() * 2
    });
  }

  /**
   * Trigger anime speed lines during intense drops
   */
  emitSpeedLines(width, height, count = 25, intensity = 1.0) {
    this.speedLines.length = 0;
    const cx = width / 2;
    const cy = height / 2;
    const actualCount = Math.floor(count * intensity);

    for (let i = 0; i < actualCount; i++) {
      const angle = (i / actualCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const innerDist = 280 + Math.random() * 120;
      const length = 200 + Math.random() * 450;
      this.speedLines.push({
        x1: cx + Math.cos(angle) * innerDist,
        y1: cy + Math.sin(angle) * innerDist,
        x2: cx + Math.cos(angle) * (innerDist + length),
        y2: cy + Math.sin(angle) * (innerDist + length),
        thickness: 1.5 + Math.random() * 2.5,
        alpha: (0.3 + Math.random() * 0.5) * intensity
      });
    }
  }

  /**
   * Physics update loop
   */
  update(dt, bass = 0, isBeat = false, width = 1080, height = 1920) {
    // 1. Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.alpha = p.life / p.maxLife;
    }

    // 2. Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.growthRate * dt;
      sw.life = 1.0 - (sw.radius / sw.maxRadius);
      sw.alpha = Math.max(0, sw.life);
      if (sw.radius >= sw.maxRadius || sw.alpha <= 0.01) {
        this.shockwaves.splice(i, 1);
      }
    }

    // 3. Update ambient floating motes
    for (let i = 0; i < this.floatingMotes.length; i++) {
      const m = this.floatingMotes[i];
      m.phase += dt * 2;
      m.x += (m.vx + Math.sin(m.phase) * 15) * dt;
      m.y += m.vy * dt;

      // Wrap around screen bounds
      if (m.y < -20) {
        m.y = height + 10;
        m.x = Math.random() * width;
      }
      if (m.x < -20) m.x = width + 10;
      if (m.x > width + 20) m.x = -10;
    }

    // 4. Update orbiting particles
    for (let i = 0; i < this.orbitingParticles.length; i++) {
      const op = this.orbitingParticles[i];
      op.angle += op.speed * dt * (1 + bass * 0.8);
      op.radiusOffset = Math.sin(op.angle * 3) * (15 + bass * 35);
    }

    // 5. Update electric arcs
    for (let i = this.electricArcs.length - 1; i >= 0; i--) {
      const arc = this.electricArcs[i];
      arc.life -= dt;
      if (arc.life <= 0) {
        this.electricArcs.splice(i, 1);
      }
    }
  }

  /**
   * Render all particles to Canvas
   */
  render(ctx, cx, cy) {
    ctx.save();

    // 1. Render Shockwaves
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha * 0.85;
      ctx.lineWidth = sw.thickness * (0.5 + sw.alpha * 0.5);
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Render Anime Speed Lines
    if (this.speedLines.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = this.accentColor;
      ctx.shadowBlur = 8;
      for (let i = 0; i < this.speedLines.length; i++) {
        const sl = this.speedLines[i];
        ctx.globalAlpha = sl.alpha;
        ctx.lineWidth = sl.thickness;
        ctx.beginPath();
        ctx.moveTo(sl.x1, sl.y1);
        ctx.lineTo(sl.x2, sl.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Render Sparks (Additive blending)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.sparks.length; i++) {
      const p = this.sparks[i];
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Render Ambient Floating Motes
    for (let i = 0; i < this.floatingMotes.length; i++) {
      const m = this.floatingMotes[i];
      ctx.save();
      ctx.globalAlpha = m.alpha;
      ctx.fillStyle = m.color;
      ctx.shadowColor = m.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Render Orbiting Particles
    for (let i = 0; i < this.orbitingParticles.length; i++) {
      const op = this.orbitingParticles[i];
      const r = op.baseRadius + op.radiusOffset;
      const px = cx + Math.cos(op.angle) * r;
      const py = cy + Math.sin(op.angle) * r;

      ctx.save();
      ctx.globalAlpha = op.alpha;
      ctx.fillStyle = op.color;
      ctx.shadowColor = op.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(px, py, op.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Render Electric Arcs
    for (let i = 0; i < this.electricArcs.length; i++) {
      const arc = this.electricArcs[i];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(arc.points[0].x, arc.points[0].y);
      for (let p = 1; p < arc.points.length; p++) {
        ctx.lineTo(arc.points[p].x, arc.points[p].y);
      }
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = arc.thickness;
      ctx.shadowColor = arc.color;
      ctx.shadowBlur = 15;
      ctx.globalAlpha = (arc.life / arc.maxLife);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  window.ParticleSystem = ParticleSystem;
}
