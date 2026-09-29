/**
 * AKSH Video & Audio Editor - Real Export Engine
 * Handles genuine client-side exports:
 * - Lossless 16-bit PCM WAV (rendered faster-than-realtime via OfflineAudioContext)
 * - Real-time/near-realtime video recording via canvas.captureStream() + Web Audio stream + MediaRecorder
 * - Strict runtime codec detection (WebM primary, MP4 optional browser-dependent)
 * - Zero fake exports
 */

class Exporter {
  constructor(audioEngine, visualizer) {
    this.audioEngine = audioEngine;
    this.visualizer = visualizer;

    this.isExporting = false;
    this.activeRecorder = null;
    this.activeStream = null;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  /**
   * Evaluates browser MediaRecorder codec support dynamically at runtime
   * @returns {Object}
   */
  static getSupportedVideoCodecs() {
    if (typeof MediaRecorder === 'undefined') {
      return {
        hasMediaRecorder: false,
        codecs: [],
        primaryCodec: null,
        mp4Supported: false
      };
    }

    const testCodecs = [
      { mime: 'video/webm;codecs=vp9,opus', label: 'WebM (VP9 + Opus) [High Quality]', ext: 'webm', primary: true },
      { mime: 'video/webm;codecs=vp8,opus', label: 'WebM (VP8 + Opus) [Fast]', ext: 'webm', primary: false },
      { mime: 'video/webm', label: 'WebM (Default)', ext: 'webm', primary: false },
      { mime: 'video/mp4;codecs=avc1,mp4a.40.2', label: 'MP4 (H.264 + AAC) [Browser Dependent]', ext: 'mp4', primary: false },
      { mime: 'video/mp4', label: 'MP4 (Default) [Browser Dependent]', ext: 'mp4', primary: false }
    ];

    const supported = [];
    let mp4Supported = false;
    let primary = null;

    for (let c of testCodecs) {
      if (MediaRecorder.isTypeSupported(c.mime)) {
        supported.push(c);
        if (c.ext === 'mp4') mp4Supported = true;
        if (!primary && c.primary) primary = c;
      }
    }

    if (!primary && supported.length > 0) {
      primary = supported[0];
    }

    return {
      hasMediaRecorder: true,
      codecs: supported,
      primaryCodec: primary ? primary.mime : null,
      primaryExt: primary ? primary.ext : 'webm',
      mp4Supported: mp4Supported
    };
  }

  /**
   * Faster-than-realtime Lossless WAV Export via OfflineAudioContext
   * @param {AudioBuffer} audioBuffer 
   * @param {Object} [effectsChain]
   * @returns {Promise<Blob>}
   */
  async exportAudioWav(audioBuffer = null, effectsChain = null) {
    const bufferToRender = audioBuffer || this.audioEngine.audioBuffer;
    if (!bufferToRender) {
      throw new Error('No audio buffer available for export.');
    }

    this.isExporting = true;
    if (typeof this.onProgress === 'function') {
      this.onProgress({ percent: 10, status: 'Initializing Offline Audio Context...' });
    }

    const sampleRate = bufferToRender.sampleRate;
    const channels = bufferToRender.numberOfChannels;
    const duration = bufferToRender.duration;
    const length = bufferToRender.length;

    // 1. Create OfflineAudioContext (renders faster than realtime)
    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtxClass(channels, length, sampleRate);

    // Source
    const source = offlineCtx.createBufferSource();
    source.buffer = bufferToRender;

    // Master volume in offline graph
    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(this.audioEngine.volume, 0);

    // Apply effects if provided, otherwise connect directly
    if (effectsChain && typeof effectsChain.buildOfflineGraph === 'function') {
      const { inputNode, outputNode } = effectsChain.buildOfflineGraph(offlineCtx);
      source.connect(inputNode);
      outputNode.connect(masterGain);
    } else {
      source.connect(masterGain);
    }

    masterGain.connect(offlineCtx.destination);
    source.start(0);

    if (typeof this.onProgress === 'function') {
      this.onProgress({ percent: 35, status: 'Rendering audio faster-than-realtime...' });
    }

    // 2. Render audio
    const renderedBuffer = await offlineCtx.startRendering();

    if (typeof this.onProgress === 'function') {
      this.onProgress({ percent: 75, status: 'Encoding 16-bit PCM WAV chunks...' });
    }

    // 3. Encode to standard WAV
    const wavBlob = Utils.audioBufferToWav(renderedBuffer);

    this.isExporting = false;
    if (typeof this.onProgress === 'function') {
      this.onProgress({ percent: 100, status: 'Audio export complete!' });
    }

    return wavBlob;
  }

  /**
   * Real-time / near-realtime Video Export
   * Captures Canvas Stream + Web Audio Stream via MediaRecorder
   * @param {Object} options
   * @returns {Promise<Blob>}
   */
  async exportVideo(options = {}) {
    if (this.isExporting) {
      throw new Error('An export is already in progress.');
    }

    const duration = options.duration || (this.audioEngine ? this.audioEngine.duration : 10);
    const fps = options.fps || 30;
    const selectedMime = options.mimeType || Exporter.getSupportedVideoCodecs().primaryCodec;
    const bitrate = options.bitrate || 6000000; // 6 Mbps default for 1080p

    if (!selectedMime || !MediaRecorder.isTypeSupported(selectedMime)) {
      throw new Error(`The requested video codec (${selectedMime}) is not supported by your browser.`);
    }

    this.isExporting = true;
    const canvas = this.visualizer.canvas;

    // 1. Capture stream from canvas at target FPS
    const canvasStream = canvas.captureStream(fps);

    // 2. Extract audio track from Web Audio engine destination
    await this.audioEngine.ensureContext();
    const audioStream = this.audioEngine.streamDestination.stream;
    const combinedTracks = [...canvasStream.getVideoTracks()];

    if (audioStream && audioStream.getAudioTracks().length > 0) {
      combinedTracks.push(...audioStream.getAudioTracks());
    }

    this.activeStream = new MediaStream(combinedTracks);

    // 3. Initialize MediaRecorder
    const recordedChunks = [];
    const recorder = new MediaRecorder(this.activeStream, {
      mimeType: selectedMime,
      videoBitsPerSecond: bitrate
    });
    this.activeRecorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    return new Promise((resolve, reject) => {
      let startTime = 0;
      let progressTimer = null;

      recorder.onstop = () => {
        clearInterval(progressTimer);
        this.audioEngine.stop(true);
        this.isExporting = false;

        // Clean up stream tracks
        if (this.activeStream) {
          this.activeStream.getTracks().forEach(track => track.stop());
          this.activeStream = null;
        }

        const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
        const finalBlob = new Blob(recordedChunks, { type: selectedMime });

        if (typeof this.onProgress === 'function') {
          this.onProgress({ percent: 100, status: 'Video encoding complete!' });
        }
        if (typeof this.onComplete === 'function') {
          this.onComplete(finalBlob, ext);
        }

        resolve({ blob: finalBlob, extension: ext });
      };

      recorder.onerror = (err) => {
        clearInterval(progressTimer);
        this.isExporting = false;
        if (typeof this.onError === 'function') {
          this.onError(err);
        }
        reject(err);
      };

      // 4. Start recording and start playback from beginning
      recorder.start(500); // 500ms time slices
      this.audioEngine.play(0);
      startTime = performance.now();

      // Progress monitor (Real-time tracking)
      progressTimer = setInterval(() => {
        if (!this.isExporting) {
          clearInterval(progressTimer);
          return;
        }

        const elapsed = (performance.now() - startTime) / 1000.0;
        const percent = Math.min(99, Math.round((elapsed / duration) * 100));

        if (typeof this.onProgress === 'function') {
          this.onProgress({
            percent: percent,
            time: elapsed,
            duration: duration,
            status: `Recording video in near-realtime (${percent}%)...`
          });
        }

        // Auto-stop when duration is reached
        if (elapsed >= duration) {
          clearInterval(progressTimer);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }
      }, 100);
    });
  }

  /**
   * Cancel ongoing export
   */
  cancel() {
    if (!this.isExporting) return;
    if (this.activeRecorder && this.activeRecorder.state !== 'inactive') {
      try {
        this.activeRecorder.stop();
      } catch (e) {
        // Ignored
      }
    }
    if (this.activeStream) {
      this.activeStream.getTracks().forEach(track => track.stop());
      this.activeStream = null;
    }
    if (this.audioEngine) {
      this.audioEngine.stop(true);
    }
    this.isExporting = false;
    if (typeof this.onProgress === 'function') {
      this.onProgress({ percent: 0, status: 'Export cancelled.' });
    }
  }
}

if (typeof window !== 'undefined') {
  window.Exporter = Exporter;
}
