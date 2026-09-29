/**
 * AKSH Video & Audio Editor - Multi-Track Timeline Controller
 * Manages time ruler, draggable playhead, multi-track alignment,
 * and keyframe automation tracks
 */

class TimelineController {
  constructor(audioEngine, waveformRenderer) {
    this.audioEngine = audioEngine;
    this.waveformRenderer = waveformRenderer;

    this.rulerCanvas = document.getElementById('timeline-ruler');
    this.rulerCtx = this.rulerCanvas ? this.rulerCanvas.getContext('2d') : null;
    this.playhead = document.getElementById('timeline-playhead');
    this.scrollContainer = document.querySelector('.timeline-lanes-scroll');

    this.isDraggingPlayhead = false;
    this.zoom = 1.0;
    this.pixelsPerSecond = 80;

    // Keyframe Tracks
    this.tracks = [
      { id: 'scale', property: 'logoBaseScale', label: 'Logo Scale', keyframes: [] },
      { id: 'glow', property: 'glowIntensity', label: 'Glow Intensity', keyframes: [] },
      { id: 'ring', property: 'ringRadius', label: 'Ring Radius', keyframes: [] },
      { id: 'bg-bright', property: 'bgBrightness', label: 'BG Brightness', keyframes: [] }
    ];

    this._bindEvents();
    this.drawRuler();
  }

  /**
   * Draw time ruler markings
   */
  drawRuler() {
    if (!this.rulerCtx || !this.rulerCanvas) return;
    const ctx = this.rulerCtx;
    const width = this.rulerCanvas.width;
    const height = this.rulerCanvas.height;
    const duration = this.audioEngine.duration || 15;

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#10141f';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillStyle = '#8b96ad';
    ctx.font = '9px SF Mono, monospace';

    const stepSec = 1.0;
    const totalSecs = Math.ceil(duration);

    for (let s = 0; s <= totalSecs; s += stepSec) {
      const x = (s / duration) * width;

      // Major second tick
      ctx.beginPath();
      ctx.moveTo(x, height - 12);
      ctx.lineTo(x, height);
      ctx.stroke();

      ctx.fillText(`${s}s`, x + 3, 14);

      // Minor sub-ticks
      for (let sub = 1; sub < 4; sub++) {
        const subX = x + (sub / 4) * ((1 / duration) * width);
        if (subX < width) {
          ctx.beginPath();
          ctx.moveTo(subX, height - 6);
          ctx.lineTo(subX, height);
          ctx.stroke();
        }
      }
    }
  }

  /**
   * Update playhead position on clock ticks
   */
  updatePlayhead(currentTime) {
    if (this.isDraggingPlayhead) return;
    const duration = this.audioEngine.duration;
    if (!duration || duration <= 0) return;

    const percent = Utils.clamp(currentTime / duration, 0, 1);
    if (this.playhead) {
      this.playhead.style.left = `${percent * 100}%`;
    }

    if (this.waveformRenderer) {
      this.waveformRenderer.draw(currentTime);
    }
  }

  _bindEvents() {
    if (!this.rulerCanvas) return;

    const handleSeek = (e) => {
      const rect = this.rulerCanvas.getBoundingClientRect();
      const clickX = Utils.clamp(e.clientX - rect.left, 0, rect.width);
      const duration = this.audioEngine.duration;
      if (duration > 0) {
        const seekTime = (clickX / rect.width) * duration;
        this.audioEngine.seek(seekTime);
        this.updatePlayhead(seekTime);
      }
    };

    this.rulerCanvas.addEventListener('mousedown', (e) => {
      this.isDraggingPlayhead = true;
      handleSeek(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDraggingPlayhead) {
        handleSeek(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDraggingPlayhead = false;
    });

    // Resize observer to redraw ruler on window resize
    window.addEventListener('resize', () => {
      if (this.rulerCanvas && this.scrollContainer) {
        this.rulerCanvas.width = this.scrollContainer.clientWidth;
        const waveCanvas = document.getElementById('timeline-waveform');
        if (waveCanvas) waveCanvas.width = this.scrollContainer.clientWidth;
        this.drawRuler();
        if (this.waveformRenderer) {
          this.waveformRenderer._computePeaks();
          this.waveformRenderer.draw();
        }
      }
    });
  }

  /**
   * Add a keyframe point
   */
  addKeyframe(trackId, time, value, easing = 'linear') {
    const track = this.tracks.find(t => t.id === trackId);
    if (!track) return;

    // Remove existing keyframe at same time if present
    track.keyframes = track.keyframes.filter(kf => Math.abs(kf.time - time) > 0.05);

    track.keyframes.push({ time, value, easing });
    track.keyframes.sort((a, b) => a.time - b.time);
  }

  deleteKeyframe(trackId, time) {
    const track = this.tracks.find(t => t.id === trackId);
    if (!track) return;
    track.keyframes = track.keyframes.filter(kf => Math.abs(kf.time - time) > 0.05);
  }
}

if (typeof window !== 'undefined') {
  window.TimelineController = TimelineController;
}
