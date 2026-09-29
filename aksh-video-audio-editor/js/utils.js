/**
 * AKSH Video & Audio Editor - Utilities Module
 * Pure Vanilla JavaScript utility functions
 * Zero external dependencies
 */

const Utils = (() => {
  // Track active blob URLs to prevent memory leaks
  const activeBlobUrls = new Set();

  /**
   * Encodes an AudioBuffer into a standard 16-bit PCM WAV Blob
   * Faster-than-realtime compatible; pure client-side
   * @param {AudioBuffer} audioBuffer
   * @param {Object} [options]
   * @returns {Blob}
   */
  function audioBufferToWav(audioBuffer, options = {}) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    // Interleave channel data
    const numSamples = audioBuffer.length;
    const dataSize = numSamples * blockAlign;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // Write RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // Write fmt subchunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size for PCM
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // Write data subchunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave and quantize float samples to 16-bit PCM
    const channels = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      for (let c = 0; c < numChannels; c++) {
        let sample = channels[c][i];
        // Clamp sample to [-1, 1]
        sample = Math.max(-1, Math.min(1, sample));
        // Quantize to 16-bit signed integer
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, int16, true);
        offset += 2;
      }
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Format seconds to MM:SS.ms string
   */
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  /**
   * Format seconds to HH:MM:SS:FF timecode
   */
  function formatTimecode(seconds, fps = 30) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const hrs = Math.floor(seconds / 3600);
    const rem = seconds % 3600;
    const mins = Math.floor(rem / 60);
    const secs = Math.floor(rem % 60);
    const frames = Math.floor((rem % 1) * fps);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  const Easing = {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => t * (2 - t),
    easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: t => t * t * t,
    easeOutCubic: t => (--t) * t * t + 1,
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    easeOutElastic: t => {
      const p = 0.3;
      return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    }
  };

  /**
   * Color helpers
   */
  function hexToRgb(hex) {
    let clean = hex.replace('#', '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(clamp(x, 0, 255)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  function rgbaString(r, g, b, a = 1) {
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp(a, 0, 1)})`;
  }

  function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA);
    const b = hexToRgb(hexB);
    return rgbToHex(
      lerp(a.r, b.r, t),
      lerp(a.g, b.g, t),
      lerp(a.b, b.b, t)
    );
  }

  /**
   * Managed Blob URL creation to prevent memory leaks
   */
  function createManagedUrl(blob) {
    const url = URL.createObjectURL(blob);
    activeBlobUrls.add(url);
    return url;
  }

  function revokeManagedUrl(url) {
    if (url && activeBlobUrls.has(url)) {
      URL.revokeObjectURL(url);
      activeBlobUrls.delete(url);
    }
  }

  function revokeAllManagedUrls() {
    activeBlobUrls.forEach(url => URL.revokeObjectURL(url));
    activeBlobUrls.clear();
  }

  /**
   * Trigger direct browser download of Blob
   */
  function downloadBlob(blob, filename) {
    const url = createManagedUrl(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      revokeManagedUrl(url);
    }, 2000);
  }

  /**
   * Unique ID generator
   */
  function generateId(prefix = 'aksh') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Debounce helper
   */
  function debounce(fn, wait = 100) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  return {
    audioBufferToWav,
    formatTime,
    formatTimecode,
    clamp,
    lerp,
    Easing,
    hexToRgb,
    rgbToHex,
    rgbaString,
    lerpColor,
    createManagedUrl,
    revokeManagedUrl,
    revokeAllManagedUrls,
    downloadBlob,
    generateId,
    debounce
  };
})();

// Attach to window for standalone offline scripts
if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
