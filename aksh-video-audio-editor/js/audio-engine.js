/**
 * AKSH Video & Audio Editor - Audio Engine
 * Central Web Audio API Manager
 * Handles AudioContext lifecycle, master bus, playback state, and stream destination for recording
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.audioBuffer = null;
    this.sourceNode = null;
    this.masterGain = null;
    this.pannerNode = null;
    this.analyserNode = null;
    this.streamDestination = null;

    // Transport state
    this.isPlaying = false;
    this.isPaused = false;
    this.playbackRate = 1.0;
    this.volume = 1.0;
    this.pan = 0.0;
    this.isMuted = false;
    this.isLooping = false;
    this.loopStart = 0;
    this.loopEnd = 0;

    // Timing tracking
    this.startTime = 0;
    this.pausedAt = 0;
    this.duration = 0;

    // Callbacks
    this.onPlay = null;
    this.onPause = null;
    this.onStop = null;
    this.onTimeUpdate = null;
    this.onEnded = null;

    // Effects chain input/output hooks
    this.effectsInput = null;
    this.effectsOutput = null;

    // Clock ticker interval
    this.clockInterval = null;
  }

  /**
   * Initializes or resumes the AudioContext
   */
  async ensureContext() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        throw new Error('Web Audio API is not supported in this browser.');
      }
      this.ctx = new AudioCtxClass();
      this._buildGraph();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    return this.ctx;
  }

  /**
   * Constructs the internal node graph:
   * [Source] -> [Effects Chain Input] -> [Effects Chain Output] -> [Panner] -> [Master Gain] -> [Analyser] -> [Destination + StreamDestination]
   */
  _buildGraph() {
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

    // Stereo Panner
    if (this.ctx.createStereoPanner) {
      this.pannerNode = this.ctx.createStereoPanner();
    } else {
      // Fallback gain node
      this.pannerNode = this.ctx.createGain();
    }

    // Master Analyser
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Stream Destination for MediaRecorder video/audio capture
    this.streamDestination = this.ctx.createMediaStreamDestination();

    // Default passthrough if effects chain is not yet plugged in
    this.effectsInput = this.ctx.createGain();
    this.effectsOutput = this.ctx.createGain();
    this.effectsInput.connect(this.effectsOutput);

    // Wire up master bus
    this.effectsOutput.connect(this.pannerNode);
    this.pannerNode.connect(this.masterGain);
    this.masterGain.connect(this.analyserNode);

    // Analyser splits to speaker destination AND recording stream destination
    this.analyserNode.connect(this.ctx.destination);
    this.analyserNode.connect(this.streamDestination);
  }

  /**
   * Connects a custom external effects rack
   */
  connectEffects(inputNode, outputNode) {
    if (!this.ctx) return;
    try {
      this.effectsInput.disconnect();
      this.effectsInput.connect(inputNode);
      outputNode.connect(this.pannerNode);
    } catch (e) {
      console.warn('Effects reconnection notice:', e);
    }
  }

  /**
   * Decodes an uploaded File or Blob into an AudioBuffer
   */
  async decodeAudioFile(fileOrBlob) {
    await this.ensureContext();
    const arrayBuffer = await fileOrBlob.arrayBuffer();
    // decodeAudioData handles MP3, WAV, OGG, M4A/AAC, FLAC, WebM
    const decodedBuffer = await new Promise((resolve, reject) => {
      this.ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });
    this.setAudioBuffer(decodedBuffer);
    return decodedBuffer;
  }

  /**
   * Sets the active AudioBuffer
   */
  setAudioBuffer(buffer) {
    this.stop();
    this.audioBuffer = buffer;
    this.duration = buffer ? buffer.duration : 0;
    this.loopEnd = this.duration;
    this.pausedAt = 0;
  }

  /**
   * Starts playback from specific offset in seconds
   */
  async play(offset = null) {
    if (!this.audioBuffer) return;
    await this.ensureContext();

    if (this.isPlaying) {
      this.stop(false);
    }

    let seekTime = (offset !== null) ? offset : this.pausedAt;
    if (seekTime >= this.duration) {
      seekTime = 0;
    }

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.playbackRate.setValueAtTime(this.playbackRate, this.ctx.currentTime);
    this.sourceNode.loop = this.isLooping;
    if (this.isLooping) {
      this.sourceNode.loopStart = this.loopStart;
      this.sourceNode.loopEnd = this.loopEnd || this.duration;
    }

    // Connect source to effects input
    this.sourceNode.connect(this.effectsInput);

    this.startTime = this.ctx.currentTime - (seekTime / this.playbackRate);
    this.sourceNode.start(0, seekTime);

    this.isPlaying = true;
    this.isPaused = false;

    this.sourceNode.onended = () => {
      if (this.isPlaying && !this.isLooping) {
        this.stop();
        if (typeof this.onEnded === 'function') {
          this.onEnded();
        }
      }
    };

    this._startClock();

    if (typeof this.onPlay === 'function') {
      this.onPlay(seekTime);
    }
  }

  /**
   * Pauses playback
   */
  pause() {
    if (!this.isPlaying) return;
    this.pausedAt = this.getCurrentTime();
    this.stop(false);
    this.isPaused = true;
    this.isPlaying = false;
    this._stopClock();

    if (typeof this.onPause === 'function') {
      this.onPause(this.pausedAt);
    }
  }

  /**
   * Stops playback and resets playhead
   */
  stop(resetTime = true) {
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // Ignored if already stopped
      }
      this.sourceNode = null;
    }

    this._stopClock();
    this.isPlaying = false;
    this.isPaused = false;

    if (resetTime) {
      this.pausedAt = 0;
    }

    if (resetTime && typeof this.onStop === 'function') {
      this.onStop();
    }
  }

  /**
   * Seeks to specific time in seconds
   */
  seek(time) {
    time = Utils.clamp(time, 0, this.duration);
    this.pausedAt = time;
    if (this.isPlaying) {
      this.play(time);
    } else {
      if (typeof this.onTimeUpdate === 'function') {
        this.onTimeUpdate(time);
      }
    }
  }

  /**
   * Returns current playback position in seconds
   */
  getCurrentTime() {
    if (!this.isPlaying || !this.ctx) {
      return this.pausedAt;
    }
    const elapsed = (this.ctx.currentTime - this.startTime) * this.playbackRate;
    if (this.isLooping && this.loopEnd > this.loopStart) {
      const loopLen = this.loopEnd - this.loopStart;
      if (elapsed >= this.loopStart) {
        return this.loopStart + ((elapsed - this.loopStart) % loopLen);
      }
    }
    return Math.min(this.duration, Math.max(0, elapsed));
  }

  setVolume(val) {
    this.volume = Utils.clamp(val, 0, 2.0);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  setPan(val) {
    this.pan = Utils.clamp(val, -1.0, 1.0);
    if (this.pannerNode && this.ctx && this.pannerNode.pan) {
      this.pannerNode.pan.setValueAtTime(this.pan, this.ctx.currentTime);
    }
  }

  setPlaybackRate(val) {
    this.playbackRate = Utils.clamp(val, 0.25, 4.0);
    if (this.sourceNode && this.ctx) {
      this.sourceNode.playbackRate.setValueAtTime(this.playbackRate, this.ctx.currentTime);
    }
  }

  setLoop(loop, start = 0, end = null) {
    this.isLooping = loop;
    this.loopStart = Math.max(0, start);
    this.loopEnd = end !== null ? end : this.duration;
    if (this.sourceNode) {
      this.sourceNode.loop = this.isLooping;
      this.sourceNode.loopStart = this.loopStart;
      this.sourceNode.loopEnd = this.loopEnd;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.setVolume(this.volume);
    return this.isMuted;
  }

  _startClock() {
    this._stopClock();
    this.clockInterval = setInterval(() => {
      if (this.isPlaying && typeof this.onTimeUpdate === 'function') {
        this.onTimeUpdate(this.getCurrentTime());
      }
    }, 33); // ~30 fps update
  }

  _stopClock() {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.AudioEngine = AudioEngine;
}
