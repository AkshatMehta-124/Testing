/**
 * AKSH Video & Audio Editor - Renderer Loop & Coordinator
 * Drives requestAnimationFrame, timing, FPS computation,
 * keyframe interpolation, and passes analyzer metrics to the Visualizer
 */

class Renderer {
  constructor(visualizer, audioAnalyzer, audioEngine) {
    this.visualizer = visualizer;
    this.audioAnalyzer = audioAnalyzer;
    this.audioEngine = audioEngine;

    this.isRunning = false;
    this.animationFrameId = null;
    this.lastTime = 0;
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = 0;

    // Keyframes manager hook
    this.keyframeTracks = [];

    // Connect beat listener to visualizer
    if (this.audioAnalyzer) {
      this.audioAnalyzer.onBeat = (beatData) => {
        if (this.visualizer) {
          this.visualizer.onBeatHit(beatData);
        }
      };
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  _loop(now) {
    if (!this.isRunning) return;

    let dt = (now - this.lastTime) / 1000.0;
    this.lastTime = now;
    // Clamp delta time to avoid large jumps if tab is backgrounded
    if (dt > 0.1) dt = 0.1;
    if (dt < 0.001) dt = 0.001;

    // FPS calculation
    this.frameCount++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.frameCount / this.fpsTimer);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // 1. Update Audio Analyzer
    const currentTime = this.audioEngine ? this.audioEngine.getCurrentTime() : 0;
    if (this.audioAnalyzer) {
      this.audioAnalyzer.update(currentTime);
    }

    // 2. Interpolate Active Keyframes
    this._applyKeyframes(currentTime);

    // 3. Render Visualizer
    if (this.visualizer) {
      const metrics = this.audioAnalyzer ? {
        bass: this.audioAnalyzer.bass,
        mid: this.audioAnalyzer.mid,
        treble: this.audioAnalyzer.treble,
        rms: this.audioAnalyzer.rms,
        isBeat: this.audioAnalyzer.isBeat,
        freqData: this.audioAnalyzer.freqData
      } : null;

      this.visualizer.render(dt, metrics);
    }

    this.animationFrameId = requestAnimationFrame(t => this._loop(t));
  }

  _applyKeyframes(currentTime) {
    if (!this.keyframeTracks || this.keyframeTracks.length === 0) return;

    for (let track of this.keyframeTracks) {
      if (!track.keyframes || track.keyframes.length === 0) continue;
      const val = this._interpolateTrack(track, currentTime);
      if (val !== null && this.visualizer) {
        this._setVisualizerProperty(track.property, val);
      }
    }
  }

  _interpolateTrack(track, time) {
    const kfs = track.keyframes;
    if (kfs.length === 1) return kfs[0].value;
    if (time <= kfs[0].time) return kfs[0].value;
    if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

    for (let i = 0; i < kfs.length - 1; i++) {
      const k1 = kfs[i];
      const k2 = kfs[i + 1];
      if (time >= k1.time && time <= k2.time) {
        const span = k2.time - k1.time;
        if (span <= 0) return k1.value;
        const t = (time - k1.time) / span;
        const easeFn = Utils.Easing[k1.easing || 'linear'] || Utils.Easing.linear;
        return Utils.lerp(k1.value, k2.value, easeFn(t));
      }
    }
    return null;
  }

  _setVisualizerProperty(prop, val) {
    switch (prop) {
      case 'logoBaseScale':
        this.visualizer.logoBaseScale = val;
        break;
      case 'logoOpacity':
        this.visualizer.logoOpacity = val;
        break;
      case 'logoRotation':
        this.visualizer.logoRotation = val;
        break;
      case 'ringRadius':
        this.visualizer.ringRadius = val;
        break;
      case 'glowIntensity':
        this.visualizer.glowIntensity = val;
        break;
      case 'bgBrightness':
        this.visualizer.bgBrightness = val;
        break;
      case 'vignetteStrength':
        this.visualizer.vignetteStrength = val;
        break;
    }
  }
}

if (typeof window !== 'undefined') {
  window.Renderer = Renderer;
}
