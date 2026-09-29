/**
 * AKSH Video & Audio Editor - Waveform Canvas Engine
 * High-performance audio waveform renderer with downsampled peak caching,
 * zoom, selection range, playhead tracking, and click-to-seek
 */

class WaveformRenderer {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioEngine = audioEngine;

    this.audioBuffer = null;
    this.peaks = null; // Downsampled [min, max] pairs cache
    this.zoomLevel = 1.0; // 1.0 = fit full duration
    this.scrollOffset = 0.0; // 0.0 - 1.0

    // Selection range in seconds
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isSelecting = false;
    this.dragStartX = 0;

    // Visual styling
    this.primaryColor = '#00f3ff';
    this.secondaryColor = '#b026ff';
    this.selectionColor = 'rgba(0, 243, 255, 0.22)';
    this.playheadColor = '#ff2a54';

    this._bindEvents();
  }

  /**
   * Set and analyze AudioBuffer for peak visualization
   */
  setBuffer(audioBuffer) {
    this.audioBuffer = audioBuffer;
    this.selectionStart = null;
    this.selectionEnd = null;
    this._computePeaks();
    this.draw();
  }

  /**
   * Downsamples the AudioBuffer into min/max peaks for rapid rendering
   */
  _computePeaks() {
    if (!this.audioBuffer) {
      this.peaks = null;
      return;
    }

    const numChannels = this.audioBuffer.numberOfChannels;
    const length = this.audioBuffer.length;
    // Sample resolution: 1000 - 2400 points across canvas width
    const targetPoints = Math.max(1000, this.canvas.width * 2);
    const blockSize = Math.floor(length / targetPoints);
    const channelData = this.audioBuffer.getChannelData(0); // Primary channel

    this.peaks = new Float32Array(targetPoints * 2);

    for (let i = 0; i < targetPoints; i++) {
      const start = i * blockSize;
      const end = Math.min(length, start + blockSize);
      let min = 1.0;
      let max = -1.0;

      for (let j = start; j < end; j++) {
        const val = channelData[j];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      this.peaks[i * 2] = min;
      this.peaks[i * 2 + 1] = max;
    }
  }

  /**
   * Render waveform, selection highlight, and playhead
   */
  draw(currentTime = null) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.ctx;

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (!this.audioBuffer || !this.peaks) {
      // Empty waveform placeholder
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, height / 2 - 1, width, 2);
      return;
    }

    const midY = height / 2;
    const halfHeight = height * 0.45;
    const totalPoints = this.peaks.length / 2;

    // 1. Draw Waveform Peaks
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, this.primaryColor);
    grad.addColorStop(1, this.secondaryColor);
    ctx.fillStyle = grad;

    for (let x = 0; x < width; x++) {
      const pointIdx = Math.floor((x / width) * totalPoints);
      if (pointIdx < totalPoints) {
        const min = this.peaks[pointIdx * 2];
        const max = this.peaks[pointIdx * 2 + 1];

        const topY = midY - (max * halfHeight);
        const botY = midY - (min * halfHeight);
        const barHeight = Math.max(1.5, botY - topY);

        ctx.fillRect(x, topY, 1.2, barHeight);
      }
    }

    // 2. Draw Selection Range Overlay
    const duration = this.audioBuffer.duration;
    if (this.selectionStart !== null && this.selectionEnd !== null && duration > 0) {
      const s1 = Math.min(this.selectionStart, this.selectionEnd);
      const s2 = Math.max(this.selectionStart, this.selectionEnd);
      const x1 = (s1 / duration) * width;
      const x2 = (s2 / duration) * width;

      ctx.fillStyle = this.selectionColor;
      ctx.fillRect(x1, 0, x2 - x1, height);

      ctx.strokeStyle = this.primaryColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x1, 0, x2 - x1, height);
    }

    // 3. Draw Playhead Needle
    const playTime = (currentTime !== null) ? currentTime : (this.audioEngine ? this.audioEngine.getCurrentTime() : 0);
    if (duration > 0) {
      const playheadX = (playTime / duration) * width;
      ctx.strokeStyle = this.playheadColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.audioBuffer) return;
      const rect = this.canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const t = (clickX / this.canvas.width) * this.audioBuffer.duration;

      if (e.shiftKey) {
        // Range selection
        this.isSelecting = true;
        this.dragStartX = clickX;
        this.selectionStart = t;
        this.selectionEnd = t;
      } else {
        // Direct seek
        this.selectionStart = null;
        this.selectionEnd = null;
        this.audioEngine.seek(t);
      }
      this.draw(t);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isSelecting || !this.audioBuffer) return;
      const rect = this.canvas.getBoundingClientRect();
      const currentX = Utils.clamp(e.clientX - rect.left, 0, this.canvas.width);
      this.selectionEnd = (currentX / this.canvas.width) * this.audioBuffer.duration;
      this.draw();
    });

    window.addEventListener('mouseup', () => {
      if (this.isSelecting) {
        this.isSelecting = false;
        // Ensure start <= end
        if (this.selectionStart !== null && this.selectionEnd !== null) {
          const s1 = Math.min(this.selectionStart, this.selectionEnd);
          const s2 = Math.max(this.selectionStart, this.selectionEnd);
          this.selectionStart = s1;
          this.selectionEnd = s2;
        }
        this.draw();
      }
    });
  }

  /**
   * Get active selection bounds { start, end }
   */
  getSelection() {
    if (this.selectionStart === null || this.selectionEnd === null) {
      return null;
    }
    return {
      start: Math.min(this.selectionStart, this.selectionEnd),
      end: Math.max(this.selectionStart, this.selectionEnd)
    };
  }

  clearSelection() {
    this.selectionStart = null;
    this.selectionEnd = null;
    this.draw();
  }
}

if (typeof window !== 'undefined') {
  window.WaveformRenderer = WaveformRenderer;
}
