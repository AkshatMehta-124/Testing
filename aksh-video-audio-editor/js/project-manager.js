/**
 * AKSH Video & Audio Editor - Multi-Project Manager
 * Manages multiple independent projects (Song 01, Song 02, etc.),
 * project switching, New/Save/Duplicate/Delete, and JSON settings import/export.
 */

class ProjectManager {
  constructor(app, storageManager) {
    this.app = app;
    this.storage = storageManager;

    this.projects = [];
    this.activeProjectId = null;
    this.autosaveTimer = null;
  }

  async init() {
    await this.storage.init();
    this.projects = await this.storage.getAllProjects();

    if (this.projects.length === 0) {
      // Create initial project
      const initial = this._createDefaultProject('Song 01');
      await this.storage.saveProject(initial);
      this.projects.push(initial);
      this.activeProjectId = initial.id;
    } else {
      this.activeProjectId = this.projects[0].id;
    }

    this._startAutosave();
  }

  _createDefaultProject(name = 'Song 01') {
    return {
      id: Utils.generateId('proj'),
      name: name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      visualizer: {
        preset: 'anime-edit',
        primaryColor: '#b026ff',
        secondaryColor: '#ff2a54',
        accentColor: '#00f3ff',
        ringRadius: 185,
        ringThickness: 4.5,
        rotationSpeed: 1.2,
        glowIntensity: 1.8,
        bgMotion: 'beat-shake',
        bgFit: 'cover',
        chromaticAberration: 0.8,
        bassSensitivity: 1.5,
        reactionStrength: 1.4
      },
      logo: {
        mode: 'image',
        text: 'AKSH',
        size: 160,
        opacity: 1.0
      },
      fx: {
        eqLow: 3,
        eqLowMid: 1,
        eqMid: 0,
        eqHighMid: 2,
        eqHigh: 4,
        compThresh: -18,
        compRatio: 4,
        reverbMix: 0.25,
        delayTime: 0.3
      },
      timeline: {
        volume: 1.0,
        playbackRate: 1.0
      },
      audioBlobId: null,
      bgBlobId: null,
      logoBlobId: null
    };
  }

  getActiveProject() {
    return this.projects.find(p => p.id === this.activeProjectId) || this.projects[0];
  }

  /**
   * Save current application state into the active project
   */
  async saveCurrentProject() {
    const proj = this.getActiveProject();
    if (!proj) return;

    const v = this.app.visualizer;
    proj.visualizer = {
      preset: v.activePreset,
      primaryColor: v.primaryColor,
      secondaryColor: v.secondaryColor,
      accentColor: v.accentColor,
      ringRadius: v.ringRadius,
      ringThickness: v.ringThickness,
      ringCount: v.ringCount,
      rotationSpeed: v.rotationSpeed,
      glowIntensity: v.glowIntensity,
      vignetteStrength: v.vignetteStrength,
      bgFit: v.bgFit,
      bgPosX: v.bgPosX,
      bgPosY: v.bgPosY,
      bgScale: v.bgScale,
      bgBlur: v.bgBlur,
      bgBrightness: v.bgBrightness,
      bgContrast: v.bgContrast,
      bgSaturation: v.bgSaturation,
      bgHue: v.bgHue,
      bgMotion: v.bgMotion,
      chromaticAberration: v.chromaticAberration,
      speedLinesEnabled: v.speedLinesEnabled,
      filmGrainEnabled: v.filmGrainEnabled,
      bassSensitivity: v.bassSensitivity,
      trebleSensitivity: v.trebleSensitivity,
      reactionStrength: v.reactionStrength,
      maxScale: v.maxScale
    };

    proj.logo = {
      mode: v.logoMode,
      text: v.logoText,
      size: v.logoSize,
      baseScale: v.logoBaseScale,
      posX: v.logoPosX,
      posY: v.logoPosY,
      rotation: v.logoRotation,
      opacity: v.logoOpacity,
      glow: v.logoGlow,
      font: v.logoFont
    };

    proj.timeline = {
      volume: this.app.audioEngine.volume,
      playbackRate: this.app.audioEngine.playbackRate,
      tracks: this.app.timeline ? JSON.parse(JSON.stringify(this.app.timeline.tracks)) : []
    };
    
    // We will save FX settings when the FX rack is fully implemented, we'll store everything from this.app.effects.params or similar
    if (this.app.effects) {
      proj.fx = JSON.parse(JSON.stringify(this.app.effects.params || {}));
    }

    await this.storage.saveProject(proj);
    this.app.ui.showToast(`Saved: ${proj.name}`, 'info');
  }

  /**
   * Create New Project
   */
  async createProject(name = null) {
    const projName = name || `Song ${String(this.projects.length + 1).padStart(2, '0')}`;
    const newProj = this._createDefaultProject(projName);
    await this.storage.saveProject(newProj);
    this.projects.push(newProj);
    await this.switchProject(newProj.id);
    return newProj;
  }

  /**
   * Switch to a different project
   */
  async switchProject(id) {
    await this.saveCurrentProject();
    const target = this.projects.find(p => p.id === id);
    if (!target) return;

    this.activeProjectId = target.id;

    // Apply project settings to visualizer
    const v = this.app.visualizer;
    if (target.visualizer) {
      Object.assign(v, target.visualizer);
      v.applyPreset(target.visualizer.preset || 'anime-edit');
    }

    if (target.logo) {
      Object.assign(v, target.logo);
      // Map to proper v.logo* variables
      v.logoMode = target.logo.mode || v.logoMode;
      v.logoText = target.logo.text || v.logoText;
      v.logoSize = target.logo.size || v.logoSize;
      v.logoBaseScale = target.logo.baseScale || v.logoBaseScale;
      v.logoPosX = target.logo.posX || v.logoPosX;
      v.logoPosY = target.logo.posY || v.logoPosY;
      v.logoRotation = target.logo.rotation || v.logoRotation;
      v.logoOpacity = target.logo.opacity || v.logoOpacity;
      v.logoGlow = target.logo.glow || v.logoGlow;
      v.logoFont = target.logo.font || v.logoFont;
    }
    
    if (target.timeline) {
      this.app.audioEngine.setVolume(target.timeline.volume || 1.0);
      this.app.audioEngine.setPlaybackRate(target.timeline.playbackRate || 1.0);
      if (this.app.timeline && target.timeline.tracks) {
        this.app.timeline.tracks = JSON.parse(JSON.stringify(target.timeline.tracks));
      }
    }
    
    if (target.fx && this.app.effects) {
      this.app.effects.params = target.fx;
      // Note: we should apply the FX when effects rack is done
    }

    // Load media blobs if attached
    if (target.audioBlobId) {
      const audioBlob = await this.storage.getMediaBlob(target.audioBlobId);
      if (audioBlob) {
        // use setActiveAudio to prevent duplicates in library
        await this.app.setActiveAudio(target.audioBlobId, audioBlob);
      }
    }

    this.app.ui.showToast(`Switched to: ${target.name}`, 'success');
  }

  /**
   * Duplicate Project
   */
  async duplicateProject(id) {
    const src = this.projects.find(p => p.id === id);
    if (!src) return;

    const dup = JSON.parse(JSON.stringify(src));
    dup.id = Utils.generateId('proj');
    dup.name = `${src.name} (Copy)`;
    dup.createdAt = Date.now();
    dup.updatedAt = Date.now();

    await this.storage.saveProject(dup);
    this.projects.push(dup);
    await this.switchProject(dup.id);
  }

  /**
   * Delete Project
   */
  async deleteProject(id) {
    if (this.projects.length <= 1) {
      alert('Cannot delete the only remaining project.');
      return;
    }

    await this.storage.deleteProject(id);
    this.projects = this.projects.filter(p => p.id !== id);

    if (this.activeProjectId === id) {
      this.activeProjectId = this.projects[0].id;
      await this.switchProject(this.activeProjectId);
    }
  }

  /**
   * Export Project JSON (Pure settings metadata without huge blobs)
   */
  exportProjectJson() {
    const proj = this.getActiveProject();
    if (!proj) return;

    const jsonStr = JSON.stringify(proj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    Utils.downloadBlob(blob, `${proj.name.replace(/\s+/g, '_')}_settings.json`);
    this.app.ui.showToast('Exported Project JSON settings.', 'success');
  }

  /**
   * Import Project JSON
   */
  async importProjectJson(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.visualizer && !data.id) {
        throw new Error('Invalid project JSON structure.');
      }
      data.id = Utils.generateId('proj');
      data.name = `${data.name || 'Imported Song'} [Imported]`;
      await this.storage.saveProject(data);
      this.projects.push(data);
      await this.switchProject(data.id);
      this.app.ui.showToast(`Imported ${data.name}`, 'success');
    } catch (err) {
      console.error(err);
      this.app.ui.showToast(`Import failed: ${err.message}`, 'error');
    }
  }

  _startAutosave() {
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    // Autosave every 60 seconds
    this.autosaveTimer = setInterval(() => {
      this.saveCurrentProject();
    }, 60000);
  }
}

if (typeof window !== 'undefined') {
  window.ProjectManager = ProjectManager;
}
