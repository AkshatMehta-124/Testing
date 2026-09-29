/**
 * AKSH Video & Audio Editor - Application Bootstrapper
 * Orchestrates AudioEngine, Visualizer, Renderer, Waveform, AudioEditor,
 * EffectsRack, TimelineController, ProjectManager, BatchExportManager, and UI.
 */

class App {
  constructor() {
    this.canvas = document.getElementById('visualizer-canvas');
    this.waveformCanvas = document.getElementById('timeline-waveform');

    this.audioEngine = new AudioEngine();
    this.audioAnalyzer = new AudioAnalyzer(this.audioEngine);
    this.visualizer = new Visualizer(this.canvas);
    this.renderer = new Renderer(this.visualizer, this.audioAnalyzer, this.audioEngine);
    this.exporter = new Exporter(this.audioEngine, this.visualizer);

    // Phase 2, 3, 4 Modules
    this.storage = new StorageManager();
    this.projectManager = new ProjectManager(this, this.storage);
    this.batchExporter = new BatchExportManager(this);
    this.effects = new EffectsRack(this.audioEngine);
    this.waveform = new WaveformRenderer(this.waveformCanvas, this.audioEngine);
    this.audioEditor = new AudioEditor(this.audioEngine, this.waveform);
    this.timeline = new TimelineController(this.audioEngine, this.waveform);

    this.ui = new UIController(this);
  }

  async init() {
    console.log('Initializing AKSH Video & Audio Editor (Full Suite)...');

    // 1. Initialize UI bindings
    this.ui.init();

    // 2. Initialize Storage & Project Manager
    try {
      await this.projectManager.init();
      this.ui.populateProjectsList(this.projectManager.projects, this.projectManager.activeProjectId);
    } catch (e) {
      console.warn('Storage init notice:', e);
    }

    // 3. Connect audio editor history listener
    this.audioEditor.onHistoryChange = () => {
      this.ui.updateHistoryButtons(this.audioEditor.canUndo(), this.audioEditor.canRedo());
    };

    // 4. Default visualizer settings
    this.visualizer.applyAnimeEditQuickMode('HIGH');

    // 5. Auto-load Demo Mode on first load so user can immediately play/create edit
    await this.loadDemoMode(false);

    // 6. Connect effects rack into audio context
    if (this.audioEngine.ctx) {
      this.effects.init(this.audioEngine.ctx);
      this.audioEngine.connectEffects(this.effects.input, this.effects.output);
    }

    // 7. Start passive animation loop (idling rings, background drift)
    this.renderer.start();

    // 8. Cleanup URLs on page unload
    window.addEventListener('beforeunload', () => {
      Utils.revokeAllManagedUrls();
    });

    console.log('AKSH Editor successfully initialized.');
  }

  /**
   * Loads self-contained demo assets (Procedural Audio + Vector Logo + Anime Backdrop)
   */
  async loadDemoMode(autoPlay = true) {
    try {
      this.ui.showToast('Loading Demo Mode (100% Offline)...', 'info');

      // 1. Ensure AudioContext is ready
      const ctx = await this.audioEngine.ensureContext();

      // Ensure effects rack is initialized
      if (!this.effects.ctx) {
        this.effects.init(ctx);
        this.audioEngine.connectEffects(this.effects.input, this.effects.output);
      }

      // 2. Synthesize energetic anime cyber trap beat
      if (typeof DemoAudio !== 'undefined') {
        const demoBuffer = DemoAudio.generateDemoTrack(ctx);
        this.audioEngine.setAudioBuffer(demoBuffer);
      }

      // 3. Set embedded stylized anime vector logo
      if (typeof DemoAssets !== 'undefined') {
        this.visualizer.setLogoImage(DemoAssets.LOGO_DATA_URL);

        // 4. Generate anime cyberpunk backdrop canvas
        const bgCanvas = DemoAssets.createDemoBackground(1080, 1920);
        this.visualizer.setBackgroundImage(bgCanvas);
      }

      // 5. Apply Anime Edit High preset
      this.visualizer.applyAnimeEditQuickMode('HIGH');

      // Update UI duration & timeline
      const durLabel = document.getElementById('track-duration-display');
      if (durLabel) {
        durLabel.textContent = Utils.formatTime(this.audioEngine.duration);
      }

      if (this.waveform) {
        this.waveform.setBuffer(this.audioEngine.audioBuffer);
      }

      if (this.timeline) {
        this.timeline.drawRuler();
      }

      this.ui.showToast('Demo loaded! Press Play or Create Edit.', 'success');

      if (autoPlay) {
        this.togglePlay();
      }
    } catch (err) {
      console.error('Demo Mode loading error:', err);
      this.ui.showToast(`Error loading demo: ${err.message}`, 'error');
    }
  }

  /**
   * Import user audio file into local library
   */
  async importAudioFile(file) {
    try {
      this.ui.showToast(`Importing ${file.name}...`, 'warn');
      const blobId = Utils.generateId('audio');
      
      const buffer = await this.audioEngine.decodeAudioFile(file);
      await this.projectManager.storage.saveMediaBlob(blobId, file, { name: file.name, duration: buffer.duration });
      
      if (this.ui) {
        this.ui.addAudioToLibrary({
          id: blobId,
          name: file.name,
          duration: buffer.duration,
          size: file.size,
          blob: file
        });
      }

      this.ui.showToast(`Imported: ${file.name}`, 'success');
      return blobId;
    } catch (err) {
      console.error('Audio import error:', err);
      this.ui.showToast(`Could not import audio: ${err.message}`, 'error');
    }
  }

  /**
   * Set an audio blob as the active project track
   */
  async setActiveAudio(blobId, blob) {
    try {
      this.ui.showToast(`Loading track...`, 'warn');
      const buffer = await this.audioEngine.decodeAudioFile(blob);
      this.audioEngine.setAudioBuffer(buffer);

      // Ensure effects rack is plugged in
      if (!this.effects.ctx && this.audioEngine.ctx) {
        this.effects.init(this.audioEngine.ctx);
        this.audioEngine.connectEffects(this.effects.input, this.effects.output);
      }

      const durLabel = document.getElementById('track-duration-display');
      if (durLabel) {
        durLabel.textContent = Utils.formatTime(buffer.duration);
      }

      if (this.waveform) {
        this.waveform.setBuffer(buffer);
      }

      if (this.timeline) {
        this.timeline.drawRuler();
      }

      // Update project manager
      const proj = this.projectManager.getActiveProject();
      if (proj) {
        proj.audioBlobId = blobId;
        this.projectManager.saveCurrentProject();
      }

      this.ui.showToast(`Track loaded`, 'success');
    } catch (err) {
      console.error('Audio load error:', err);
      this.ui.showToast(`Could not load audio: ${err.message}`, 'error');
    }
  }

  /**
   * One-Click "CREATE EDIT" Action
   */
  triggerCreateEdit(intensityKey = 'HIGH') {
    if (!this.audioEngine.audioBuffer) {
      this.ui.showToast('Please load audio first or click Load Demo.', 'warn');
      return;
    }

    this.ui.showToast(`Creating Anime Edit [${intensityKey}]...`, 'warn');

    // 1. Calibrate visualizer settings to audio profile
    this.visualizer.applyAnimeEditQuickMode(intensityKey);

    // 2. Rewind and start playback
    this.audioEngine.seek(0);
    this.audioEngine.play(0);

    this.ui.showToast('Anime Edit created! Synchronized preview running.', 'success');
  }

  /**
   * Randomize Edit Styling
   */
  randomizeEdit() {
    const presets = Object.keys(Presets.VisualizerPresets);
    const randomPreset = presets[Math.floor(Math.random() * presets.length)];
    this.visualizer.applyPreset(randomPreset);

    const motions = ['slow-zoom-in', 'slow-zoom-out', 'ken-burns', 'beat-zoom', 'beat-shake', 'subtle-motion'];
    this.visualizer.bgMotion = motions[Math.floor(Math.random() * motions.length)];

    this.ui.showToast(`Randomized: ${Presets.VisualizerPresets[randomPreset].name}`, 'info');
  }

  togglePlay() {
    if (this.audioEngine.isPlaying) {
      this.audioEngine.pause();
    } else {
      this.audioEngine.play();
    }
  }

  updatePlayheadPosition(currentTime) {
    if (this.timeline) {
      this.timeline.updatePlayhead(currentTime);
    }
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
