/**
 * AKSH Video & Audio Editor - UI Controller
 * Manages inspector panels, presets grid, Anime Edit controls,
 * audio editing tools, audio DSP effects rack, project manager,
 * batch export queue, modals, toast alerts, and input bindings.
 */

class UIController {
  constructor(app) {
    this.app = app;
    this.activeTab = 'anime-edit';
    this.activeIntensity = 'HIGH';
    this.currentAspect = '9-16';
  }

  init() {
    this._bindNavigationTabs();
    this._bindInspectorSubtabs();
    this._bindAnimeEditControls();
    this._renderPresetsGrid();
    this._bindVisualizerControls();
    this._bindAudioEditorTools();
    this._bindAudioEffectsControls();
    this._bindProjectControls();
    this._bindBatchExportControls();
    this._bindTransportButtons();
    this._bindAspectButtons();
    this._bindExportModal();
    this._bindFileDropZone();
    this._bindModals();
  }

  /**
   * Navigation Tabs (Left sidebar)
   */
  _bindNavigationTabs() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        this.switchInspectorTab(tab);
      });
    });
  }

  /**
   * Inspector Subtabs
   */
  _bindInspectorSubtabs() {
    const subtabs = document.querySelectorAll('.subtab-btn');
    subtabs.forEach(btn => {
      btn.addEventListener('click', () => {
        subtabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const sectionId = btn.dataset.section;
        this._showInspectorSection(sectionId);
      });
    });
  }

  switchInspectorTab(tabName) {
    this.activeTab = tabName;
    const subtabs = document.querySelectorAll('.subtab-btn');
    subtabs.forEach(btn => {
      if (btn.dataset.section === tabName) {
        btn.click();
      }
    });
  }

  _showInspectorSection(sectionId) {
    const sections = document.querySelectorAll('.inspector-section');
    sections.forEach(sec => {
      sec.style.display = sec.id === `section-${sectionId}` ? 'flex' : 'none';
    });
  }

  /**
   * Dedicated Anime Edit Quick Mode Controls
   */
  _bindAnimeEditControls() {
    const intensityPills = document.querySelectorAll('.intensity-pill');
    intensityPills.forEach(pill => {
      pill.addEventListener('click', () => {
        intensityPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeIntensity = pill.dataset.intensity;
        this.app.visualizer.applyAnimeEditQuickMode(this.activeIntensity);
        this.showToast(`Anime Edit Intensity: ${this.activeIntensity}`);
      });
    });

    const createEditBtn = document.getElementById('btn-create-edit');
    if (createEditBtn) {
      createEditBtn.addEventListener('click', () => {
        this.app.triggerCreateEdit(this.activeIntensity);
      });
    }

    const randomizeBtn = document.getElementById('btn-randomize-edit');
    if (randomizeBtn) {
      randomizeBtn.addEventListener('click', () => {
        this.app.randomizeEdit();
      });
    }
  }

  /**
   * Audio Editor Tools (Trim, Cut, Silence, Fade, Reverse, Norm, Undo/Redo)
   */
  _bindAudioEditorTools() {
    const trimBtn = document.getElementById('btn-edit-trim');
    const cutBtn = document.getElementById('btn-edit-cut');
    const silenceBtn = document.getElementById('btn-edit-silence');
    const fadeinBtn = document.getElementById('btn-edit-fadein');
    const fadeoutBtn = document.getElementById('btn-edit-fadeout');
    const reverseBtn = document.getElementById('btn-edit-reverse');
    const normBtn = document.getElementById('btn-edit-normalize');
    const undoBtn = document.getElementById('btn-edit-undo');
    const redoBtn = document.getElementById('btn-edit-redo');

    if (trimBtn) {
      trimBtn.addEventListener('click', () => {
        const sel = this.app.waveform.getSelection();
        if (!sel) {
          this.showToast('Please select a region on the waveform first (Shift+Drag).', 'warn');
          return;
        }
        this.app.audioEditor.trim(sel.start, sel.end);
        this.showToast(`Trimmed audio to ${sel.start.toFixed(2)}s - ${sel.end.toFixed(2)}s`, 'success');
      });
    }

    if (cutBtn) {
      cutBtn.addEventListener('click', () => {
        const sel = this.app.waveform.getSelection();
        if (!sel) {
          this.showToast('Please select a region to cut.', 'warn');
          return;
        }
        this.app.audioEditor.cut(sel.start, sel.end);
        this.showToast('Cut selection out of audio.', 'success');
      });
    }

    if (silenceBtn) {
      silenceBtn.addEventListener('click', () => {
        const sel = this.app.waveform.getSelection();
        if (!sel) {
          this.showToast('Please select a region to silence.', 'warn');
          return;
        }
        this.app.audioEditor.silence(sel.start, sel.end);
        this.showToast('Silenced selected region.', 'success');
      });
    }

    if (fadeinBtn) {
      fadeinBtn.addEventListener('click', () => {
        this.app.audioEditor.fadeIn(2.0);
        this.showToast('Applied 2s Fade In', 'success');
      });
    }

    if (fadeoutBtn) {
      fadeoutBtn.addEventListener('click', () => {
        this.app.audioEditor.fadeOut(2.0);
        this.showToast('Applied 2s Fade Out', 'success');
      });
    }

    if (reverseBtn) {
      reverseBtn.addEventListener('click', () => {
        this.app.audioEditor.reverse();
        this.showToast('Reversed audio buffer', 'success');
      });
    }

    if (normBtn) {
      normBtn.addEventListener('click', () => {
        this.app.audioEditor.normalize(0.98);
        this.showToast('Normalized audio to 0 dBFS peak', 'success');
      });
    }

    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        this.app.audioEditor.undo();
        this.showToast('Undo', 'info');
      });
    }

    if (redoBtn) {
      redoBtn.addEventListener('click', () => {
        this.app.audioEditor.redo();
        this.showToast('Redo', 'info');
      });
    }
  }

  updateHistoryButtons(canUndo, canRedo) {
    const undoBtn = document.getElementById('btn-edit-undo');
    const redoBtn = document.getElementById('btn-edit-redo');
    if (undoBtn) undoBtn.style.opacity = canUndo ? '1' : '0.4';
    if (redoBtn) redoBtn.style.opacity = canRedo ? '1' : '0.4';
  }

  /**
   * Audio Effects Controls (EQ, Compressor, Reverb, Delay)
   */
  _bindAudioEffectsControls() {
    const fx = this.app.effects;
    
    // Toggles
    const eqToggle = document.getElementById('toggle-eq');
    if (eqToggle) {
      eqToggle.addEventListener('change', (e) => fx.setBypass('eq', !e.target.checked));
    }
    const compToggle = document.getElementById('toggle-comp');
    if (compToggle) {
      compToggle.addEventListener('change', (e) => fx.setBypass('comp', !e.target.checked));
    }

    // EQ Sliders
    ['low', 'low-mid', 'mid', 'high-mid', 'high'].forEach(band => {
      const el = document.getElementById(`eq-${band}`);
      if (el) {
        el.addEventListener('input', (e) => {
          const key = band === 'low-mid' ? 'eqLowMid' : (band === 'high-mid' ? 'eqHighMid' : `eq${band.charAt(0).toUpperCase() + band.slice(1)}`);
          fx.setParam(key, parseFloat(e.target.value));
        });
      }
    });

    // Compressor
    const compThresh = document.getElementById('slider-comp-thresh');
    const compRatio = document.getElementById('slider-comp-ratio');
    if (compThresh && compRatio) {
      const updateComp = () => {
        fx.setParam('compThresh', parseFloat(compThresh.value));
        fx.setParam('compRatio', parseFloat(compRatio.value));
      };
      compThresh.addEventListener('input', (e) => {
        document.getElementById('val-comp-thresh').textContent = `${e.target.value} dB`;
        updateComp();
      });
      compRatio.addEventListener('input', (e) => {
        document.getElementById('val-comp-ratio').textContent = `${e.target.value}:1`;
        updateComp();
      });
    }

    // Reverb
    const reverbMix = document.getElementById('slider-reverb-mix');
    const reverbToggle = document.getElementById('toggle-reverb');
    if (reverbMix) {
      reverbMix.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('val-reverb-mix').textContent = `${Math.round(val * 100)}%`;
        fx.setParam('reverbMix', val);
      });
    }
    if (reverbToggle) {
      reverbToggle.addEventListener('change', (e) => {
        fx.setBypass('reverb', !e.target.checked);
      });
    }

    // Delay
    const delayTime = document.getElementById('slider-delay-time');
    const delayToggle = document.getElementById('toggle-delay');
    if (delayTime) {
      delayTime.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('val-delay-time').textContent = `${val}s`;
        fx.setParam('delayTime', val);
      });
    }
    if (delayToggle) {
      delayToggle.addEventListener('change', (e) => {
        fx.setBypass('delay', !e.target.checked);
        fx.setParam('delayMix', e.target.checked ? 0.35 : 0);
      });
    }
  }

  /**
   * Project Controls (Switch, New, Save, JSON Import/Export)
   */
  _bindProjectControls() {
    const projSelect = document.getElementById('select-project');
    const newProjBtn = document.getElementById('btn-new-project');
    const saveProjBtn = document.getElementById('btn-save-project');
    const exportJsonBtn = document.getElementById('btn-export-project-json');
    const importJsonInput = document.getElementById('input-import-project-json');

    if (projSelect) {
      projSelect.addEventListener('change', async (e) => {
        await this.app.projectManager.switchProject(e.target.value);
      });
    }

    if (newProjBtn) {
      newProjBtn.addEventListener('click', async () => {
        const name = prompt('Enter Project Name:', `Song ${String(this.app.projectManager.projects.length + 1).padStart(2, '0')}`);
        if (name) {
          await this.app.projectManager.createProject(name);
          this.populateProjectsList(this.app.projectManager.projects, this.app.projectManager.activeProjectId);
        }
      });
    }

    if (saveProjBtn) {
      saveProjBtn.addEventListener('click', async () => {
        await this.app.projectManager.saveCurrentProject();
      });
    }

    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        this.app.projectManager.exportProjectJson();
      });
    }

    if (importJsonInput) {
      importJsonInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          await this.app.projectManager.importProjectJson(e.target.files[0]);
          this.populateProjectsList(this.app.projectManager.projects, this.app.projectManager.activeProjectId);
        }
      });
    }
  }

  populateProjectsList(projects, activeId) {
    const select = document.getElementById('select-project');
    if (!select) return;
    select.innerHTML = '';
    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === activeId) opt.selected = true;
      select.appendChild(opt);
    });
  }

  /**
   * Batch Export Controls
   */
  _bindBatchExportControls() {
    const openBatchBtn = document.getElementById('btn-open-batch');
    const addCurrentBtn = document.getElementById('btn-batch-add-current');
    const startBatchBtn = document.getElementById('btn-batch-start');
    const downloadAllBtn = document.getElementById('btn-batch-download-all');

    if (openBatchBtn) {
      openBatchBtn.addEventListener('click', () => {
        this._renderBatchQueue();
        this.openModal('modal-batch');
      });
    }

    if (addCurrentBtn) {
      addCurrentBtn.addEventListener('click', () => {
        const proj = this.app.projectManager.getActiveProject();
        this.app.batchExporter.addToQueue(proj ? proj.id : null, proj ? proj.name : 'Song Export', 'video');
        this.showToast('Added current project to Batch Queue', 'success');
      });
    }

    if (startBatchBtn) {
      startBatchBtn.addEventListener('click', () => {
        this.app.batchExporter.startBatch();
      });
    }

    if (downloadAllBtn) {
      downloadAllBtn.addEventListener('click', () => {
        this.app.batchExporter.downloadAll();
      });
    }

    this.app.batchExporter.onQueueChange = () => {
      this._renderBatchQueue();
    };
  }

  _renderBatchQueue() {
    const container = document.getElementById('batch-queue-list');
    if (!container) return;
    container.innerHTML = '';

    const queue = this.app.batchExporter.queue;
    if (queue.length === 0) {
      container.innerHTML = '<div style="font-size: 11px; color: var(--text-dim); text-align: center; padding: 20px;">Queue is empty. Click "+ Add Current Project" to begin.</div>';
      return;
    }

    queue.forEach(job => {
      const item = document.createElement('div');
      item.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; font-size: 11px;';

      let statusColor = 'var(--text-muted)';
      if (job.status === 'Processing') statusColor = 'var(--neon-cyan)';
      if (job.status === 'Completed') statusColor = 'var(--neon-green)';
      if (job.status === 'Failed') statusColor = 'var(--neon-crimson)';

      item.innerHTML = `
        <div>
          <span style="font-weight: 700; color: #fff;">${job.name}</span>
          <span style="color: var(--text-dim); margin-left: 6px;">(${job.type.toUpperCase()})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 600; color: ${statusColor};">${job.status}</span>
          ${job.status === 'Completed' ? `<button class="btn btn-sm" onclick="app.batchExporter.downloadJob('${job.id}')">Download</button>` : ''}
          <button class="btn btn-sm btn-icon" onclick="app.batchExporter.removeJob('${job.id}')">✕</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  /**
   * Visualizer Presets Grid
   */
  _renderPresetsGrid() {
    const grid = document.getElementById('presets-grid');
    if (!grid || typeof Presets === 'undefined') return;

    grid.innerHTML = '';
    const presets = Presets.VisualizerPresets;

    for (let key in presets) {
      const p = presets[key];
      const card = document.createElement('div');
      card.className = `preset-card ${p.id === this.app.visualizer.activePreset ? 'active' : ''}`;
      card.dataset.preset = p.id;

      card.innerHTML = `
        <div class="preset-color-bar" style="background: linear-gradient(90deg, ${p.primaryColor}, ${p.secondaryColor})"></div>
        <div class="preset-name">${p.name}</div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.app.visualizer.applyPreset(p.id);
        this.showToast(`Applied Preset: ${p.name}`);
      });

      grid.appendChild(card);
    }
  }

  /**
   * Binds range sliders and inputs to Visualizer
   */
  _bindVisualizerControls() {
    const v = this.app.visualizer;

    // Reactivity sliders
    this._bindSlider('slider-bass-sens', val => { v.bassSensitivity = parseFloat(val); }, 'val-bass-sens');
    this._bindSlider('slider-treble-sens', val => { v.trebleSensitivity = parseFloat(val); }, 'val-treble-sens');
    this._bindSlider('slider-reaction-str', val => { v.reactionStrength = parseFloat(val); }, 'val-reaction-str');
    this._bindSlider('slider-chromatic', val => { v.chromaticAberration = parseFloat(val); }, 'val-chromatic');
    this._bindSlider('slider-glow', val => { v.glowIntensity = parseFloat(val); }, 'val-glow');

    // Neon Energy sliders
    this._bindSlider('slider-ring-radius', val => { v.ringRadius = parseInt(val); }, 'val-ring-radius');
    this._bindSlider('slider-ring-thick', val => { v.ringThickness = parseFloat(val); }, 'val-ring-thick');
    this._bindSlider('slider-rot-speed', val => { v.rotationSpeed = parseFloat(val); }, 'val-rot-speed');

    // Beat Detection Controls
    this._bindSlider('slider-beat-sens', val => {
      this.app.audioAnalyzer.beatSensitivity = parseFloat(val);
    }, 'val-beat-sens');

    this._bindSlider('slider-beat-interval', val => {
      this.app.audioAnalyzer.minBeatInterval = parseFloat(val);
    }, 'val-beat-interval');

    const beatEnableToggle = document.getElementById('toggle-beat-detection');
    if (beatEnableToggle) {
      beatEnableToggle.addEventListener('change', (e) => {
        this.app.audioAnalyzer.beatDetectionEnabled = e.target.checked;
        this.showToast(`Beat Detection: ${e.target.checked ? 'Enabled' : 'Disabled'}`);
      });
    }

    // Background Controls
    const bgMotionSelect = document.getElementById('select-bg-motion');
    if (bgMotionSelect) {
      bgMotionSelect.addEventListener('change', (e) => {
        v.bgMotion = e.target.value;
      });
    }

    const bgFitSelect = document.getElementById('select-bg-fit');
    if (bgFitSelect) {
      bgFitSelect.addEventListener('change', (e) => {
        v.bgFit = e.target.value;
      });
    }

    this._bindSlider('slider-bg-brightness', val => { v.bgBrightness = parseFloat(val); }, 'val-bg-brightness');
    this._bindSlider('slider-bg-contrast', val => { v.bgContrast = parseFloat(val); }, 'val-bg-contrast');
    this._bindSlider('slider-bg-vignette', val => { v.vignetteStrength = parseFloat(val); }, 'val-bg-vignette');

    // Logo & Text Controls
    const logoModeSelect = document.getElementById('select-logo-mode');
    if (logoModeSelect) {
      logoModeSelect.addEventListener('change', (e) => {
        v.logoMode = e.target.value;
        const textRow = document.getElementById('row-logo-text');
        const imgRow = document.getElementById('row-logo-img');
        if (textRow) textRow.style.display = v.logoMode === 'text' ? 'flex' : 'none';
        if (imgRow) imgRow.style.display = v.logoMode === 'image' ? 'flex' : 'none';
      });
    }

    const logoTextInput = document.getElementById('input-logo-text');
    if (logoTextInput) {
      logoTextInput.addEventListener('input', (e) => {
        v.logoText = e.target.value || 'AKSH';
      });
    }

    this._bindSlider('slider-logo-size', val => { v.logoSize = parseInt(val); }, 'val-logo-size');
    this._bindSlider('slider-logo-opacity', val => { v.logoOpacity = parseFloat(val); }, 'val-logo-opacity');

    // Color pickers
    const primaryColorInput = document.getElementById('color-primary');
    if (primaryColorInput) {
      primaryColorInput.addEventListener('input', (e) => {
        v.primaryColor = e.target.value;
        v.particleSystem.accentColor = e.target.value;
      });
    }

    const secondaryColorInput = document.getElementById('color-secondary');
    if (secondaryColorInput) {
      secondaryColorInput.addEventListener('input', (e) => {
        v.secondaryColor = e.target.value;
        v.particleSystem.sparkColor = e.target.value;
      });
    }
  }

  _bindSlider(id, callback, valLabelId = null) {
    const el = document.getElementById(id);
    if (!el) return;
    const label = valLabelId ? document.getElementById(valLabelId) : null;
    el.addEventListener('input', (e) => {
      callback(e.target.value);
      if (label) label.textContent = e.target.value;
    });
  }

  /**
   * Transport controls (Play/Pause, Stop, Seek, Volume)
   */
  _bindTransportButtons() {
    const playBtn = document.getElementById('btn-transport-play');
    const stopBtn = document.getElementById('btn-transport-stop');
    const timeDisplay = document.getElementById('timecode-display');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.app.togglePlay();
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.app.audioEngine.stop(true);
      });
    }

    // Audio Engine event listeners
    this.app.audioEngine.onPlay = () => {
      if (playBtn) playBtn.innerHTML = this._getIconSvg('pause');
      this.app.renderer.start();
    };

    this.app.audioEngine.onPause = () => {
      if (playBtn) playBtn.innerHTML = this._getIconSvg('play');
    };

    this.app.audioEngine.onStop = () => {
      if (playBtn) playBtn.innerHTML = this._getIconSvg('play');
      if (timeDisplay) timeDisplay.textContent = '00:00.00';
    };

    this.app.audioEngine.onTimeUpdate = (time) => {
      if (timeDisplay) {
        timeDisplay.textContent = Utils.formatTime(time);
      }
      this.app.updatePlayheadPosition(time);
    };

    // Track Mute & Solo
    const muteBtn = document.getElementById('btn-track-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = this.app.audioEngine.toggleMute();
        muteBtn.classList.toggle('active-mute', isMuted);
      });
    }

    const soloBtn = document.getElementById('btn-track-solo');
    if (soloBtn) {
      soloBtn.addEventListener('click', () => {
        const isSolo = soloBtn.classList.toggle('active-solo');
        if (isSolo && this.app.audioEngine.isMuted) {
          this.app.audioEngine.toggleMute();
          if (muteBtn) muteBtn.classList.remove('active-mute');
        }
      });
    }

    // Master volume slider
    const volSlider = document.getElementById('slider-master-volume');
    if (volSlider) {
      volSlider.addEventListener('input', (e) => {
        this.app.audioEngine.setVolume(parseFloat(e.target.value));
      });
    }

    // Playback rate select
    const rateSelect = document.getElementById('select-playback-rate');
    if (rateSelect) {
      rateSelect.addEventListener('change', (e) => {
        this.app.audioEngine.setPlaybackRate(parseFloat(e.target.value));
      });
    }

    // Demo Mode Button in Header
    const demoBtn = document.getElementById('btn-load-demo');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        this.app.loadDemoMode();
      });
    }
  }

  /**
   * Aspect Ratio Switcher (9:16, 1:1, 16:9)
   */
  _bindAspectButtons() {
    const aspectButtons = document.querySelectorAll('.aspect-btn');
    const wrapper = document.querySelector('.canvas-wrapper');
    const resBadge = document.querySelector('.resolution-badge');

    aspectButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        aspectButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const ratio = btn.dataset.ratio;
        this.currentAspect = ratio;

        wrapper.classList.remove('ratio-9-16', 'ratio-1-1', 'ratio-16-9');
        wrapper.classList.add(`ratio-${ratio}`);

        if (ratio === '9-16') {
          this.app.visualizer.setResolution(1080, 1920);
          if (resBadge) resBadge.textContent = '1080x1920 (9:16)';
        } else if (ratio === '1-1') {
          this.app.visualizer.setResolution(1080, 1080);
          if (resBadge) resBadge.textContent = '1080x1080 (1:1)';
        } else if (ratio === '16-9') {
          this.app.visualizer.setResolution(1920, 1080);
          if (resBadge) resBadge.textContent = '1920x1080 (16:9)';
        }
      });
    });

    // Safe zone toggle
    const safeZoneBtn = document.getElementById('btn-toggle-safe-zone');
    const safeOverlay = document.querySelector('.safe-zone-overlay');
    if (safeZoneBtn && safeOverlay) {
      safeZoneBtn.addEventListener('click', () => {
        safeOverlay.classList.toggle('active');
        safeZoneBtn.classList.toggle('active');
      });
    }

    // Resolution selection (Default, Performance, 4K Experimental)
    const resSelect = document.getElementById('select-render-res');
    if (resSelect) {
      resSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === '4k') {
          // Rule 13: 2160x3840 is experimental and must warn about performance
          alert('EXPERIMENTAL 4K NOTICE:\n\n2160x3840 rendering requires significant GPU and memory resources. On some devices or browsers, rendering or video export may slow down or drop frames.\n\nFor optimal performance, 1080x1920 is recommended.');
          this.app.visualizer.setResolution(2160, 3840);
          if (resBadge) {
            resBadge.textContent = '2160x3840 (4K EXP)';
            resBadge.classList.add('experimental-4k');
          }
        } else if (val === '720p') {
          this.app.visualizer.setResolution(720, 1280);
          if (resBadge) {
            resBadge.textContent = '720x1280 (Fast)';
            resBadge.classList.remove('experimental-4k');
          }
        } else {
          this.app.visualizer.setResolution(1080, 1920);
          if (resBadge) {
            resBadge.textContent = '1080x1920 (9:16)';
            resBadge.classList.remove('experimental-4k');
          }
        }
      });
    }
  }

  /**
   * Export Modal & Codec Selection
   */
  _bindExportModal() {
    const exportBtn = document.getElementById('btn-open-export');
    const startExportVideoBtn = document.getElementById('btn-start-video-export');
    const exportWavBtn = document.getElementById('btn-export-audio-wav');
    const cancelExportBtn = document.getElementById('btn-cancel-export');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this._populateSupportedCodecs();
        this.openModal('modal-export');
      });
    }

    if (startExportVideoBtn) {
      startExportVideoBtn.addEventListener('click', async () => {
        const codecSelect = document.getElementById('select-video-codec');
        const selectedMime = codecSelect ? codecSelect.value : null;
        const progressBox = document.getElementById('export-progress-box');
        const progressBar = document.getElementById('export-progress-fill');
        const progressText = document.getElementById('export-progress-text');

        if (progressBox) progressBox.style.display = 'block';

        this.app.exporter.onProgress = (info) => {
          if (progressBar) progressBar.style.width = `${info.percent}%`;
          if (progressText) progressText.textContent = info.status || `${info.percent}%`;
        };

        try {
          const result = await this.app.exporter.exportVideo({
            mimeType: selectedMime,
            fps: 30
          });
          Utils.downloadBlob(result.blob, `Aksh_Short_${Date.now()}.${result.extension}`);
          this.showToast('Video export completed successfully!', 'success');
        } catch (err) {
          console.error(err);
          this.showToast(`Export error: ${err.message}`, 'error');
        } finally {
          if (progressBox) progressBox.style.display = 'none';
        }
      });
    }

    if (exportWavBtn) {
      exportWavBtn.addEventListener('click', async () => {
        try {
          this.showToast('Rendering lossless WAV audio faster-than-realtime...', 'warn');
          const wavBlob = await this.app.exporter.exportAudioWav(null, this.app.effects);
          Utils.downloadBlob(wavBlob, `Aksh_Audio_${Date.now()}.wav`);
          this.showToast('Audio WAV downloaded successfully!', 'success');
        } catch (err) {
          console.error(err);
          this.showToast(`Audio export error: ${err.message}`, 'error');
        }
      });
    }

    if (cancelExportBtn) {
      cancelExportBtn.addEventListener('click', () => {
        this.app.exporter.cancel();
      });
    }
  }

  _populateSupportedCodecs() {
    const codecSelect = document.getElementById('select-video-codec');
    const codecNotice = document.getElementById('codec-support-notice');
    if (!codecSelect) return;

    codecSelect.innerHTML = '';
    const support = Exporter.getSupportedVideoCodecs();

    if (!support.hasMediaRecorder || support.codecs.length === 0) {
      codecSelect.innerHTML = '<option disabled>MediaRecorder not supported</option>';
      if (codecNotice) {
        codecNotice.textContent = 'Your browser does not support client-side MediaRecorder video export.';
        codecNotice.style.color = 'var(--neon-crimson)';
      }
      return;
    }

    support.codecs.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.mime;
      opt.textContent = c.label;
      if (c.mime === support.primaryCodec) opt.selected = true;
      codecSelect.appendChild(opt);
    });

    if (codecNotice) {
      if (support.mp4Supported) {
        codecNotice.textContent = 'WebM (VP9/VP8) is the primary native format. MP4 is also natively supported by your browser.';
        codecNotice.style.color = 'var(--neon-green)';
      } else {
        codecNotice.textContent = 'WebM is your browser\'s native recording format. Direct client MP4 encoding is not supported by your current browser engine.';
        codecNotice.style.color = 'var(--text-muted)';
      }
    }
  }

  /**
   * Add imported audio to library UI
   */
  addAudioToLibrary(audioMeta) {
    const list = document.getElementById('audio-library-list');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'audio-library-item';
    item.style = 'display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px; cursor: pointer;';
    item.dataset.id = audioMeta.id;

    const info = document.createElement('div');
    info.style = 'display: flex; flex-direction: column; overflow: hidden;';
    
    const name = document.createElement('span');
    name.style = 'font-size: 13px; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;';
    name.textContent = audioMeta.name;

    const meta = document.createElement('span');
    meta.style = 'font-size: 11px; color: var(--text-muted);';
    meta.textContent = `${Utils.formatTime(audioMeta.duration)} • ${(audioMeta.size / (1024*1024)).toFixed(2)} MB`;

    info.appendChild(name);
    info.appendChild(meta);

    const btnPlay = document.createElement('button');
    btnPlay.className = 'btn btn-icon btn-sm';
    btnPlay.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>';
    btnPlay.title = 'Load & Edit';
    
    btnPlay.onclick = (e) => {
      e.stopPropagation();
      this.app.setActiveAudio(audioMeta.id, audioMeta.blob);
    };

    item.onclick = () => {
      this.app.setActiveAudio(audioMeta.id, audioMeta.blob);
    };

    item.appendChild(info);
    item.appendChild(btnPlay);
    list.appendChild(item);
  }

  /**
   * File drop zone & file picker handling
   */
  _bindFileDropZone() {
    const fileAudioInput = document.getElementById('input-file-audio');
    const fileBgInput = document.getElementById('input-file-bg');
    const fileLogoInput = document.getElementById('input-file-logo');
    const audioDropZone = document.getElementById('audio-drop-zone');

    if (fileAudioInput) {
      fileAudioInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length > 0) {
          for (let file of e.target.files) {
            await this.app.importAudioFile(file);
          }
        }
      });
    }

    if (audioDropZone) {
      audioDropZone.addEventListener('click', () => fileAudioInput.click());
      ['dragenter', 'dragover'].forEach(name => {
        audioDropZone.addEventListener(name, (e) => {
          e.preventDefault();
          audioDropZone.style.borderColor = 'var(--accent)';
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        audioDropZone.addEventListener(name, (e) => {
          e.preventDefault();
          audioDropZone.style.borderColor = '#444';
        });
      });
      audioDropZone.addEventListener('drop', async (e) => {
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        for (let file of files) {
          if (file.type.startsWith('audio/')) {
            await this.app.importAudioFile(file);
          }
        }
      });
    }

    if (fileBgInput) {
      fileBgInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const url = Utils.createManagedUrl(file);
          this.app.visualizer.setBackgroundImage(url);
          this.showToast(`Loaded Background: ${file.name}`);
        }
      });
    }

    if (fileLogoInput) {
      fileLogoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const url = Utils.createManagedUrl(file);
          this.app.visualizer.setLogoImage(url);
          this.showToast(`Loaded Logo: ${file.name}`);
        }
      });
    }

    // Drag and drop onto center stage
    const dropArea = document.querySelector('.app-center-stage');
    if (dropArea) {
      ['dragenter', 'dragover'].forEach(name => {
        dropArea.addEventListener(name, (e) => {
          e.preventDefault();
          dropArea.classList.add('drag-active');
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        dropArea.addEventListener(name, (e) => {
          e.preventDefault();
          dropArea.classList.remove('drag-active');
        });
      });
      dropArea.addEventListener('drop', async (e) => {
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;
        for (let file of files) {
          if (file.type.startsWith('audio/')) {
            await this.app.importAudioFile(file);
          } else if (file.type.startsWith('image/')) {
            const url = Utils.createManagedUrl(file);
            this.app.visualizer.setBackgroundImage(url);
            this.showToast(`Loaded Background: ${file.name}`);
          }
        }
      });
    }
  }

  _bindModals() {
    const closeButtons = document.querySelectorAll('.btn-close-modal');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    // Privacy & Settings Modal
    const privacyBtn = document.getElementById('btn-open-privacy');
    if (privacyBtn) {
      privacyBtn.addEventListener('click', async () => {
        const quotaInfo = document.getElementById('storage-quota-info');
        if (quotaInfo && this.app.storage) {
          const est = await this.app.storage.getEstimatedStorageUsage();
          quotaInfo.textContent = `IndexedDB Storage: ${est.usedMB} MB used (Quota: ${est.quotaMB} MB, ${est.percent}%)`;
        }
        this.openModal('modal-privacy');
      });
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (container.contains(toast)) container.removeChild(toast);
      }, 300);
    }, 2800);
  }

  _getIconSvg(name) {
    if (name === 'play') {
      return `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    } else if (name === 'pause') {
      return `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    }
    return '';
  }
}

if (typeof window !== 'undefined') {
  window.UIController = UIController;
}
