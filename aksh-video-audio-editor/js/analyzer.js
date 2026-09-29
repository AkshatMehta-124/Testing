/**
 * AKSH Video & Audio Editor - Audio Analyzer
 * FFT spectrum analysis, RMS extraction, Bass/Mid/Treble band division,
 * and configurable heuristic beat transient detector
 */

class AudioAnalyzer {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.analyserNode = null;
    this.fftSize = 2048;
    this.freqData = null;
    this.timeData = null;

    // Analysis metrics
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.rms = 0;
    this.peak = 0;

    // Smoothed metrics for visual stability
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothTreble = 0;
    this.smoothVolume = 0;

    // Heuristic Beat Detection parameters (Configurable by user)
    this.beatDetectionEnabled = true;
    this.beatSensitivity = 1.3;     // Multiplier above local average energy (0.8 - 2.5)
    this.beatThreshold = 0.15;       // Minimum absolute energy to trigger beat (0.05 - 0.5)
    this.minBeatInterval = 0.22;     // Cooldown in seconds between beats (~270 bpm ceiling)
    this.energyHistory = [];
    this.historySize = 45;           // ~0.75 second history buffer at 60fps
    this.lastBeatTime = 0;
    this.isBeat = false;
    this.beatIntensity = 0;

    // Callbacks
    this.onBeat = null;
  }

  /**
   * Initializes analyzer buffers using engine's AnalyserNode
   */
  init() {
    if (this.audioEngine && this.audioEngine.analyserNode) {
      this.analyserNode = this.audioEngine.analyserNode;
      this.analyserNode.fftSize = this.fftSize;
      const bufferLength = this.analyserNode.frequencyBinCount;
      this.freqData = new Uint8Array(bufferLength);
      this.timeData = new Uint8Array(bufferLength);
    }
  }

  /**
   * Updates analysis state on each render frame
   * @param {number} currentTime (seconds)
   */
  update(currentTime = 0) {
    if (!this.analyserNode && this.audioEngine && this.audioEngine.analyserNode) {
      this.init();
    }
    if (!this.analyserNode || !this.audioEngine.isPlaying) {
      this._decayMetrics();
      this.isBeat = false;
      return;
    }

    this.analyserNode.getByteFrequencyData(this.freqData);
    this.analyserNode.getByteTimeDomainData(this.timeData);

    const binCount = this.analyserNode.frequencyBinCount;
    const sampleRate = this.audioEngine.ctx ? this.audioEngine.ctx.sampleRate : 44100;
    const hzPerBin = (sampleRate / 2) / binCount;

    // Bin index boundaries
    const bassEndBin = Math.max(1, Math.floor(250 / hzPerBin));
    const midEndBin = Math.max(bassEndBin + 1, Math.floor(4000 / hzPerBin));
    const trebleEndBin = Math.min(binCount - 1, Math.floor(18000 / hzPerBin));

    // 1. Calculate Bass Energy (20Hz - 250Hz)
    let bassSum = 0;
    for (let i = 1; i <= bassEndBin; i++) {
      bassSum += this.freqData[i];
    }
    this.bass = (bassSum / bassEndBin) / 255.0;

    // 2. Calculate Mid Energy (250Hz - 4kHz)
    let midSum = 0;
    const midRange = midEndBin - bassEndBin;
    for (let i = bassEndBin + 1; i <= midEndBin; i++) {
      midSum += this.freqData[i];
    }
    this.mid = (midSum / Math.max(1, midRange)) / 255.0;

    // 3. Calculate Treble Energy (4kHz - 18kHz)
    let trebleSum = 0;
    const trebleRange = trebleEndBin - midEndBin;
    for (let i = midEndBin + 1; i <= trebleEndBin; i++) {
      trebleSum += this.freqData[i];
    }
    this.treble = (trebleSum / Math.max(1, trebleRange)) / 255.0;

    // 4. Calculate RMS & Peak from Time Domain
    let sumSquares = 0;
    let peakVal = 0;
    for (let i = 0; i < binCount; i++) {
      const normalized = (this.timeData[i] - 128) / 128.0;
      sumSquares += normalized * normalized;
      const absVal = Math.abs(normalized);
      if (absVal > peakVal) peakVal = absVal;
    }
    this.rms = Math.sqrt(sumSquares / binCount);
    this.peak = peakVal;

    // 5. Exponential Moving Average Smoothing
    const smoothing = 0.25;
    this.smoothBass += (this.bass - this.smoothBass) * smoothing;
    this.smoothMid += (this.mid - this.smoothMid) * smoothing;
    this.smoothTreble += (this.treble - this.smoothTreble) * smoothing;
    this.smoothVolume += (this.rms - this.smoothVolume) * smoothing;

    // 6. Heuristic Beat Transient Detection
    this._detectBeat(currentTime);
  }

  _detectBeat(currentTime) {
    this.isBeat = false;
    if (!this.beatDetectionEnabled) return;

    // Instantaneous composite energy heavily weighting bass and low-mids
    const instantEnergy = (this.bass * 0.75) + (this.rms * 0.25);

    // Keep running history
    this.energyHistory.push(instantEnergy);
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift();
    }

    // Compute local mean energy
    let historySum = 0;
    for (let i = 0; i < this.energyHistory.length; i++) {
      historySum += this.energyHistory[i];
    }
    const localMean = historySum / this.energyHistory.length;

    // Check beat criteria:
    // 1. Minimum cooldown elapsed
    // 2. Instant energy exceeds threshold
    // 3. Instant energy exceeds local average by sensitivity factor
    const timeSinceLastBeat = currentTime - this.lastBeatTime;
    const thresholdTarget = Math.max(this.beatThreshold, localMean * this.beatSensitivity);

    if (timeSinceLastBeat >= this.minBeatInterval && instantEnergy > thresholdTarget) {
      this.isBeat = true;
      this.lastBeatTime = currentTime;
      // Normalized beat intensity
      this.beatIntensity = Math.min(2.0, (instantEnergy - thresholdTarget) / Math.max(0.01, thresholdTarget) + 1.0);

      if (typeof this.onBeat === 'function') {
        this.onBeat({
          time: currentTime,
          intensity: this.beatIntensity,
          bass: this.bass,
          rms: this.rms
        });
      }
    }
  }

  _decayMetrics() {
    this.bass *= 0.9;
    this.mid *= 0.9;
    this.treble *= 0.9;
    this.rms *= 0.9;
    this.peak *= 0.9;
    this.smoothBass *= 0.9;
    this.smoothMid *= 0.9;
    this.smoothTreble *= 0.9;
    this.smoothVolume *= 0.9;
    this.beatIntensity *= 0.85;
  }
}

if (typeof window !== 'undefined') {
  window.AudioAnalyzer = AudioAnalyzer;
}
