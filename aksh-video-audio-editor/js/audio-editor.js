/**
 * AKSH Video & Audio Editor - Audio Editor Module
 * Non-destructive & destructive AudioBuffer manipulations:
 * Trim, Crop, Cut, Split, Silence, Fade In, Fade Out, Reverse, Normalize,
 * with multi-level Undo / Redo history stack.
 */

class AudioEditor {
  constructor(audioEngine, waveformRenderer) {
    this.audioEngine = audioEngine;
    this.waveformRenderer = waveformRenderer;

    // Undo / Redo History Stack (Max 15 levels to conserve memory)
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 15;

    this.onHistoryChange = null;
  }

  /**
   * Clones an AudioBuffer
   */
  static cloneBuffer(buffer, audioCtx) {
    if (!buffer) return null;
    const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const clone = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      clone.copyToChannel(buffer.getChannelData(c), c);
    }
    return clone;
  }

  /**
   * Pushes current state to Undo Stack
   */
  _pushUndo(description = 'Edit Action') {
    const current = this.audioEngine.audioBuffer;
    if (!current) return;

    if (this.undoStack.length >= this.maxHistory) {
      this.undoStack.shift();
    }

    this.undoStack.push({
      buffer: AudioEditor.cloneBuffer(current, this.audioEngine.ctx),
      description: description
    });
    this.redoStack.length = 0; // Clear redo on new action

    if (typeof this.onHistoryChange === 'function') {
      this.onHistoryChange();
    }
  }

  /**
   * Trim / Crop buffer to selection [startSec, endSec]
   */
  trim(startSec, endSec) {
    const orig = this.audioEngine.audioBuffer;
    if (!orig) return;

    const s1 = Math.max(0, Math.min(startSec, endSec));
    const s2 = Math.min(orig.duration, Math.max(startSec, endSec));
    if (s2 - s1 < 0.05) return; // Minimum 50ms

    this._pushUndo(`Trim to ${s1.toFixed(2)}s - ${s2.toFixed(2)}s`);

    const sampleRate = orig.sampleRate;
    const startSample = Math.floor(s1 * sampleRate);
    const endSample = Math.floor(s2 * sampleRate);
    const newLen = endSample - startSample;

    const newBuffer = this.audioEngine.ctx.createBuffer(orig.numberOfChannels, newLen, sampleRate);

    for (let c = 0; c < orig.numberOfChannels; c++) {
      const src = orig.getChannelData(c);
      const dest = newBuffer.getChannelData(c);
      for (let i = 0; i < newLen; i++) {
        dest[i] = src[startSample + i];
      }
    }

    this._applyNewBuffer(newBuffer);
  }

  /**
   * Cut selection [startSec, endSec] out of the buffer, splicing remainder together
   */
  cut(startSec, endSec) {
    const orig = this.audioEngine.audioBuffer;
    if (!orig) return;

    const s1 = Math.max(0, Math.min(startSec, endSec));
    const s2 = Math.min(orig.duration, Math.max(startSec, endSec));
    if (s2 - s1 < 0.05) return;

    this._pushUndo(`Cut ${s1.toFixed(2)}s - ${s2.toFixed(2)}s`);

    const sampleRate = orig.sampleRate;
    const cutStart = Math.floor(s1 * sampleRate);
    const cutEnd = Math.floor(s2 * sampleRate);
    const cutLength = cutEnd - cutStart;
    const newLen = orig.length - cutLength;

    const newBuffer = this.audioEngine.ctx.createBuffer(orig.numberOfChannels, newLen, sampleRate);

    for (let c = 0; c < orig.numberOfChannels; c++) {
      const src = orig.getChannelData(c);
      const dest = newBuffer.getChannelData(c);

      // Part 1: before cut
      for (let i = 0; i < cutStart; i++) {
        dest[i] = src[i];
      }
      // Part 2: after cut
      for (let i = cutEnd; i < orig.length; i++) {
        dest[i - cutLength] = src[i];
      }
    }

    this._applyNewBuffer(newBuffer);
  }

  /**
   * Silence selection [startSec, endSec]
   */
  silence(startSec, endSec) {
    const orig = this.audioEngine.audioBuffer;
    if (!orig) return;

    const s1 = Math.max(0, Math.min(startSec, endSec));
    const s2 = Math.min(orig.duration, Math.max(startSec, endSec));

    this._pushUndo(`Silence ${s1.toFixed(2)}s - ${s2.toFixed(2)}s`);

    const sampleRate = orig.sampleRate;
    const startSample = Math.floor(s1 * sampleRate);
    const endSample = Math.floor(s2 * sampleRate);

    for (let c = 0; c < orig.numberOfChannels; c++) {
      const data = orig.getChannelData(c);
      for (let i = startSample; i < endSample; i++) {
        data[i] = 0;
      }
    }

    this._applyNewBuffer(orig);
  }

  /**
   * Apply Fade In (Linear or Exponential)
   */
  fadeIn(durationSec = 2.0, isExp = false) {
    const orig = this.audioEngine.audioBuffer;
    if (!orig) return;

    this._pushUndo(`Fade In (${durationSec}s)`);

    const sampleRate = orig.sampleRate;
    const fadeSamples = Math.min(orig.length, Math.floor(durationSec * sampleRate));

    for (let c = 0; c < orig.numberOfChannels; c++) {
      const data = orig.getChannelData(c);
      for (let i = 0; i < fadeSamples; i++) {
        const t = i / fadeSamples;
        const gain = isExp ? t * t : t;
        data[i] *= gain;
      }
    }

    this._applyNewBuffer(orig);
  }

  /**
   * Apply Fade Out (Linear or Exponential)
   */
  fadeOut(durationSec = 2.0, isExp = false) {
    const orig = this.audioEngine.audioBuffer;
    if (!orig) return;

    this._pushUndo(`Fade Out (${durationSec}s)`);

    const sampleRate = orig.sampleRate;
    const fadeSamples = Math.min(orig.length, Math.floor(durationSec * sampleRate));
    const startIdx = orig.length - fadeSamples;

    for (let c = 0; c < orig.numberOfChannels; c++) {
      const data = orig.getChannelData(c);
      for (let i = 0; i < fadeSamples; i++) {
        const t = 1.0 - (i / fadeSamples);
        const gain = isExp ? t * t : t;
        data[startIdx + i] *= gain;
      }
    }

    this._applyNewBuffer(orig);
  }

  /**
   * Reverse entire audio buffer across all channels
   */
  reverse() {
    const orig = this.audioEngine.audioBuffer;
    if (!orig) return;

    this._pushUndo('Reverse Audio');

    const channels = orig.numberOfChannels;
    for (let c = 0; c < channels; c++) {
      const data = orig.getChannelData(c);
      Array.prototype.reverse.call(data);
    }

    this._applyNewBuffer(orig);
  }

  /**
   * Normalize audio to target peak amplitude
   */
  normalize(targetPeak = 0.98) {
    const orig = this.audioEngine.audioBuffer;
    if (!orig) return;

    let peak = 0;
    const channels = orig.numberOfChannels;
    for (let c = 0; c < channels; c++) {
      const data = orig.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        const absVal = Math.abs(data[i]);
        if (absVal > peak) peak = absVal;
      }
    }

    if (peak <= 0.0001) return;

    this._pushUndo('Normalize Audio');

    const multiplier = targetPeak / peak;
    for (let c = 0; c < channels; c++) {
      const data = orig.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        data[i] *= multiplier;
      }
    }

    this._applyNewBuffer(orig);
  }

  /**
   * Undo last operation
   */
  undo() {
    if (this.undoStack.length === 0) return;

    const current = this.audioEngine.audioBuffer;
    this.redoStack.push({
      buffer: AudioEditor.cloneBuffer(current, this.audioEngine.ctx),
      description: 'Redo Action'
    });

    const previous = this.undoStack.pop();
    this._applyNewBuffer(previous.buffer);

    if (typeof this.onHistoryChange === 'function') {
      this.onHistoryChange();
    }
  }

  /**
   * Redo previously undone operation
   */
  redo() {
    if (this.redoStack.length === 0) return;

    const current = this.audioEngine.audioBuffer;
    this.undoStack.push({
      buffer: AudioEditor.cloneBuffer(current, this.audioEngine.ctx),
      description: 'Undo Action'
    });

    const next = this.redoStack.pop();
    this._applyNewBuffer(next.buffer);

    if (typeof this.onHistoryChange === 'function') {
      this.onHistoryChange();
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  _applyNewBuffer(newBuffer) {
    this.audioEngine.setAudioBuffer(newBuffer);
    if (this.waveformRenderer) {
      this.waveformRenderer.setBuffer(newBuffer);
    }
  }
}

if (typeof window !== 'undefined') {
  window.AudioEditor = AudioEditor;
}
