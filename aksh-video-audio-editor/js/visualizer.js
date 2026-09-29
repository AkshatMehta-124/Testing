/**
 * AKSH Video & Audio Editor - Music Visualizer & Canvas Compositor
 * Dark Cinematic Anime Edit Engine
 * Renders 9:16 portrait Shorts/Reels video with reactive neon energy,
 * glowing logo, background motion, chromatic aberration, and particle physics
 */

class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.particleSystem = new ParticleSystem();

    // Canvas resolution (1080x1920 default)
    this.width = 1080;
    this.height = 1920;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Active visualizer preset & settings
    this.activePreset = 'anime-edit';
    this.primaryColor = '#b026ff';
    this.secondaryColor = '#ff2a54';
    this.accentColor = '#00f3ff';
    this.ringRadius = 185;
    this.ringThickness = 4.5;
    this.ringCount = 3;
    this.rotationSpeed = 1.2;
    this.glowIntensity = 1.8;
    this.vignetteStrength = 0.75;

    // Reactivity mapping matrix
    this.bassSensitivity = 1.5;
    this.trebleSensitivity = 1.2;
    this.reactionStrength = 1.4;
    this.maxScale = 1.35;
    this.smoothing = 0.2;

    // Background configuration
    this.backgroundImage = null;
    this.bgFit = 'cover'; // 'cover', 'contain', 'stretch', 'crop'
    this.bgPosX = 0;
    this.bgPosY = 0;
    this.bgScale = 1.05;
    this.bgBlur = 0;
    this.bgBrightness = 1.0;
    this.bgContrast = 1.1;
    this.bgSaturation = 1.15;
    this.bgHue = 0;
    this.bgMotion = 'beat-shake'; // 'ken-burns', 'slow-zoom-in', 'slow-zoom-out', 'beat-zoom', 'beat-shake', 'subtle-motion'

    // Central Logo configuration
    this.logoMode = 'image'; // 'image' or 'text'
    this.logoImage = null;
    this.logoText = 'AKSH';
    this.logoSize = 160;
    this.logoBaseScale = 1.0;
    this.logoPosX = 0; // Relative to center
    this.logoPosY = 0;
    this.logoRotation = 0;
    this.logoOpacity = 1.0;
    this.logoGlow = '#00f3ff';
    this.logoFont = 'Impact, sans-serif';

    // Camera shake & post-processing states
    this.cameraShakeX = 0;
    this.cameraShakeY = 0;
    this.cameraShakeTrauma = 0;
    this.chromaticAberration = 0.8;
    this.speedLinesEnabled = true;
    this.filmGrainEnabled = true;

    // Timing and animation states
    this.time = 0;
    this.ringAngle = 0;
    this.smoothedBass = 0;
    this.smoothedMid = 0;
    this.smoothedTreble = 0;

    // Offscreen buffer for chromatic aberration / post-effects
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.width;
    this.offscreenCanvas.height = this.height;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');

    // Initialize particle system
    this.particleSystem.init(this.width, this.height, 60);
  }

  /**
   * Set resolution with performance safeguard
   */
  setResolution(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.offscreenCanvas.width = w;
    this.offscreenCanvas.height = h;
    this.particleSystem.init(w, h, 60);
  }

  /**
   * Loads background image from Image element, Blob or URL
   */
  setBackgroundImage(imgElementOrUrl) {
    if (typeof imgElementOrUrl === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.backgroundImage = img;
      };
      img.src = imgElementOrUrl;
    } else {
      this.backgroundImage = imgElementOrUrl;
    }
  }

  /**
   * Loads central logo image
   */
  setLogoImage(imgElementOrUrl) {
    if (typeof imgElementOrUrl === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.logoImage = img;
        this.logoMode = 'image';
      };
      img.src = imgElementOrUrl;
    } else {
      this.logoImage = imgElementOrUrl;
      this.logoMode = 'image';
    }
  }

  /**
   * Applies one of the 10 visualizer presets
   */
  applyPreset(presetId) {
    if (typeof Presets !== 'undefined' && Presets.VisualizerPresets[presetId]) {
      const p = Presets.VisualizerPresets[presetId];
      this.activePreset = p.id;
      this.primaryColor = p.primaryColor;
      this.secondaryColor = p.secondaryColor;
      this.accentColor = p.accentColor;
      this.ringCount = p.ringCount;
      this.ringThickness = p.ringThickness;
      this.ringRadius = p.ringRadius;
      this.rotationSpeed = p.rotationSpeed;
      this.glowIntensity = p.glowIntensity;
      this.vignetteStrength = p.vignette;
      this.bgMotion = p.bgMotion;
      this.chromaticAberration = p.chromaticAberration;
      this.particleSystem.sparkColor = p.secondaryColor;
      this.particleSystem.accentColor = p.primaryColor;
    }
  }

  /**
   * Applies the dedicated Anime Edit Quick Mode configuration
   */
  applyAnimeEditQuickMode(intensityKey = 'HIGH') {
    this.applyPreset('anime-edit');
    if (typeof Presets !== 'undefined' && Presets.AnimeEditIntensities[intensityKey]) {
      const config = Presets.AnimeEditIntensities[intensityKey];
      this.bassSensitivity = config.bassSensitivity;
      this.reactionStrength = config.reactionStrength;
      this.chromaticAberration = config.chromaticAberration;
      this.speedLinesEnabled = true;
      this.bgMotion = 'beat-shake';
    }
  }

  /**
   * Triggered when audio analyzer detects a beat transient
   */
  onBeatHit(beatData) {
    const intensity = beatData.intensity || 1.0;
    const cx = this.width / 2;
    const cy = this.height / 2;

    // 1. Add camera trauma (clamped)
    this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + 0.5 * intensity);

    // 2. Emit explosive sparks from center
    const sparkCount = Math.floor(60 * intensity);
    this.particleSystem.emitBeatBurst(cx, cy, sparkCount, this.secondaryColor, intensity);

    // 3. Emit expanding circular neon shockwave
    this.particleSystem.emitShockwave(cx, cy, this.primaryColor, this.width * 0.75, this.ringThickness * 1.5);

    // 4. Emit random electric lightning arcs around rings
    if (Math.random() > 0.3) {
      this.particleSystem.emitElectricArc(cx, cy, this.ringRadius * 1.1, this.accentColor);
    }

    // 5. Flare speed lines on intense beats
    if (this.speedLinesEnabled && intensity > 1.2) {
      this.particleSystem.emitSpeedLines(this.width, this.height, 24, intensity);
    }
  }

  /**
   * Main render loop method called by animation coordinator
   */
  render(dt, audioMetrics = null) {
    this.time += dt;

    // 1. Process audio reactive metrics
    let bass = 0;
    let mid = 0;
    let treble = 0;
    let isBeat = false;
    let freqData = null;

    if (audioMetrics) {
      bass = audioMetrics.bass || 0;
      mid = audioMetrics.mid || 0;
      treble = audioMetrics.treble || 0;
      isBeat = audioMetrics.isBeat || false;
      freqData = audioMetrics.freqData || null;
    }

    // Smooth reactive parameters
    this.smoothedBass += (bass - this.smoothedBass) * this.smoothing;
    this.smoothedMid += (mid - this.smoothedMid) * this.smoothing;
    this.smoothedTreble += (treble - this.smoothedTreble) * this.smoothing;

    const dynamicBass = this.smoothedBass * this.bassSensitivity * this.reactionStrength;

    // 2. Update camera shake with exponential decay
    if (this.cameraShakeTrauma > 0.001) {
      const shakeAmt = Math.pow(this.cameraShakeTrauma, 2) * 28;
      this.cameraShakeX = (Math.random() * 2 - 1) * shakeAmt;
      this.cameraShakeY = (Math.random() * 2 - 1) * shakeAmt;
      this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 2.8);
    } else {
      this.cameraShakeX = 0;
      this.cameraShakeY = 0;
    }

    // 3. Update particle engine
    const cx = this.width / 2;
    const cy = this.height / 2;
    this.ringAngle += dt * this.rotationSpeed * (1 + dynamicBass * 0.7);
    this.particleSystem.update(dt, dynamicBass, isBeat, this.width, this.height);

    // 4. Render to offscreen canvas or directly to main canvas
    const targetCtx = this.chromaticAberration > 0.1 ? this.offscreenCtx : this.ctx;

    targetCtx.save();
    // Clear viewport
    targetCtx.fillStyle = '#05070d';
    targetCtx.fillRect(0, 0, this.width, this.height);

    // Apply Camera Shake transformation
    targetCtx.translate(this.cameraShakeX, this.cameraShakeY);

    // LAYER A: Background Image & Motion
    this._renderBackground(targetCtx, dynamicBass);

    // LAYER B: Radial Spectrum Equalizer Bars
    if (freqData) {
      this._renderRadialSpectrum(targetCtx, cx, cy, freqData, dynamicBass);
    }

    // LAYER C: Neon Energy System (Rotating Arcs, Rings)
    this._renderNeonRings(targetCtx, cx, cy, dynamicBass);

    // LAYER D: Particles, Sparks & Shockwaves
    this.particleSystem.render(targetCtx, cx, cy);

    // LAYER E: Central Logo / Text
    this._renderLogo(targetCtx, cx, cy, dynamicBass);

    // LAYER F: Vignette & Atmosphere Overlays
    this._renderAtmosphere(targetCtx, cx, cy);

    targetCtx.restore();

    // 5. Post-processing: Chromatic Aberration (RGB Split) if enabled
    if (this.chromaticAberration > 0.1) {
      this._applyChromaticAberration(dynamicBass);
    }
  }

  /**
   * Renders background image with motion & CSS filter styling
   */
  _renderBackground(ctx, dynamicBass) {
    if (!this.backgroundImage) return;

    ctx.save();

    // Calculate motion offset & scale
    let motionScale = this.bgScale;
    let motionX = this.bgPosX;
    let motionY = this.bgPosY;

    switch (this.bgMotion) {
      case 'slow-zoom-in':
        motionScale += (Math.sin(this.time * 0.2) * 0.05 + 0.05);
        break;
      case 'slow-zoom-out':
        motionScale += (Math.cos(this.time * 0.2) * 0.05);
        break;
      case 'ken-burns':
        motionScale += 0.06 * Math.sin(this.time * 0.15);
        motionX += Math.cos(this.time * 0.12) * 20;
        motionY += Math.sin(this.time * 0.18) * 20;
        break;
      case 'beat-zoom':
        motionScale += dynamicBass * 0.08;
        break;
      case 'beat-shake':
        motionScale += dynamicBass * 0.06;
        motionX += Math.sin(this.time * 1.5) * 8;
        motionY += Math.cos(this.time * 1.8) * 8;
        break;
      case 'subtle-motion':
        motionX += Math.sin(this.time * 0.5) * 12;
        motionY += Math.cos(this.time * 0.4) * 8;
        break;
    }

    // Canvas filters
    const blurPx = Math.max(0, this.bgBlur);
    const bright = Math.max(0, this.bgBrightness);
    const cont = Math.max(0, this.bgContrast);
    const sat = Math.max(0, this.bgSaturation);
    ctx.filter = `blur(${blurPx}px) brightness(${bright}) contrast(${cont}) saturate(${sat})`;

    const img = this.backgroundImage;
    const imgW = img.width || 1080;
    const imgH = img.height || 1920;

    // Fit calculations: cover, contain, stretch, crop
    let drawW = this.width * motionScale;
    let drawH = this.height * motionScale;

    if (this.bgFit === 'cover') {
      const scale = Math.max(this.width / imgW, this.height / imgH) * motionScale;
      drawW = imgW * scale;
      drawH = imgH * scale;
    } else if (this.bgFit === 'contain') {
      const scale = Math.min(this.width / imgW, this.height / imgH) * motionScale;
      drawW = imgW * scale;
      drawH = imgH * scale;
    }

    const drawX = (this.width - drawW) / 2 + motionX;
    const drawY = (this.height - drawH) / 2 + motionY;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  /**
   * Radial circular frequency spectrum equalizer bars
   */
  _renderRadialSpectrum(ctx, cx, cy, freqData, dynamicBass) {
    ctx.save();
    const barCount = 72;
    const radius = this.ringRadius * (1 + dynamicBass * 0.15) + 20;
    const maxBarHeight = 90 * (1 + dynamicBass * 0.6);

    ctx.shadowBlur = 12 * this.glowIntensity;
    ctx.shadowColor = this.primaryColor;

    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2 + this.ringAngle * 0.3;
      // Map bar index to frequency bin
      const binIdx = Math.floor((i / barCount) * 64) + 1;
      const binVal = (freqData[binIdx] || 0) / 255.0;
      const barHeight = Math.max(4, binVal * maxBarHeight);

      const x1 = cx + Math.cos(angle) * radius;
      const y1 = cy + Math.sin(angle) * radius;
      const x2 = cx + Math.cos(angle) * (radius + barHeight);
      const y2 = cy + Math.sin(angle) * (radius + barHeight);

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, this.primaryColor);
      grad.addColorStop(1, this.secondaryColor);

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Procedural neon rings & segmented rotating arcs
   */
  _renderNeonRings(ctx, cx, cy, dynamicBass) {
    ctx.save();
    const baseRadius = this.ringRadius * (1 + dynamicBass * 0.22);

    for (let r = 0; r < this.ringCount; r++) {
      const direction = (r % 2 === 0) ? 1 : -1;
      const angleOffset = this.ringAngle * direction * (0.8 + r * 0.4);
      const ringR = baseRadius + (r - (this.ringCount - 1) / 2) * 24;

      ctx.save();
      ctx.lineWidth = this.ringThickness * (r === 0 ? 1.2 : 0.85);
      ctx.shadowBlur = (15 + r * 5) * this.glowIntensity;
      ctx.shadowColor = (r % 2 === 0) ? this.primaryColor : this.secondaryColor;
      ctx.strokeStyle = (r % 2 === 0) ? this.primaryColor : this.secondaryColor;

      // Segmented arcs
      const segments = 4 + r * 2;
      const arcLen = (Math.PI * 2 / segments) * 0.65;
      for (let s = 0; s < segments; s++) {
        const startA = angleOffset + (s * (Math.PI * 2 / segments));
        const endA = startA + arcLen;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, startA, endA);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Outer continuous faint neon boundary ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius + 45, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 12]);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  /**
   * Central Logo / Stylized Text Layer
   */
  _renderLogo(ctx, cx, cy, dynamicBass) {
    ctx.save();
    const posX = cx + this.logoPosX;
    const posY = cy + this.logoPosY;

    // Audio reactive scaling with maxScale clamp
    const reactiveScale = Math.min(this.maxScale, this.logoBaseScale * (1 + dynamicBass * 0.35));
    ctx.translate(posX, posY);
    ctx.rotate(this.logoRotation);
    ctx.scale(reactiveScale, reactiveScale);
    ctx.globalAlpha = this.logoOpacity;

    // Glowing Neon Drop Shadow / Aura
    ctx.shadowColor = this.logoGlow || this.primaryColor;
    ctx.shadowBlur = (20 + dynamicBass * 25) * this.glowIntensity;

    if (this.logoMode === 'image' && this.logoImage) {
      const halfSize = this.logoSize / 2;
      ctx.drawImage(this.logoImage, -halfSize, -halfSize, this.logoSize, this.logoSize);
    } else {
      // Text Logo mode
      ctx.font = `bold ${this.logoSize * 0.45}px ${this.logoFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.logoText, 0, 0);

      ctx.strokeStyle = this.primaryColor;
      ctx.lineWidth = 3;
      ctx.strokeText(this.logoText, 0, 0);
    }

    ctx.restore();
  }

  /**
   * Atmospheric overlays: vignette, film grain, scanlines
   */
  _renderAtmosphere(ctx, cx, cy) {
    // 1. Vignette
    if (this.vignetteStrength > 0) {
      ctx.save();
      const outerR = Math.max(this.width, this.height) * 0.65;
      const vigGrad = ctx.createRadialGradient(cx, cy, this.width * 0.25, cx, cy, outerR);
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(0.75, `rgba(5, 7, 13, ${this.vignetteStrength * 0.6})`);
      vigGrad.addColorStop(1, `rgba(2, 3, 6, ${this.vignetteStrength * 0.95})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    // 2. Scanlines
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = 0; y < this.height; y += 6) {
      ctx.fillRect(0, y, this.width, 2);
    }
    ctx.restore();
  }

  /**
   * Chromatic Aberration post-processing (RGB Split Displacement)
   */
  _applyChromaticAberration(dynamicBass) {
    const shift = Math.floor((this.chromaticAberration * 8) * (1 + dynamicBass * 1.5));
    if (shift <= 0) {
      this.ctx.drawImage(this.offscreenCanvas, 0, 0);
      return;
    }

    // Fast Canvas Chromatic Aberration Approximation
    this.ctx.save();
    
    // Base layer
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.globalAlpha = 1.0;
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);
    
    // Fast color bleeding effect using canvas blending
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.globalAlpha = 0.4;
    
    // Shift left and right
    this.ctx.drawImage(this.offscreenCanvas, shift, 0);
    this.ctx.drawImage(this.offscreenCanvas, -shift, 0);
    
    this.ctx.restore();
  }
}

if (typeof window !== 'undefined') {
  window.Visualizer = Visualizer;
}
