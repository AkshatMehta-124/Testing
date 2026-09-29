/**
 * AKSH Video & Audio Editor - Batch Export Module
 * Manages automated sequential rendering queue for multiple songs/projects.
 * States: Waiting, Processing, Completed, Failed, Cancelled
 */

class BatchExportManager {
  constructor(app) {
    this.app = app;
    this.queue = [];
    this.isProcessing = false;
    this.currentIndex = -1;

    this.onQueueChange = null;
  }

  /**
   * Add a project or export job to the batch queue
   */
  addToQueue(projectId, name, type = 'video', options = {}) {
    const job = {
      id: Utils.generateId('job'),
      projectId: projectId,
      name: name,
      type: type, // 'video' or 'audio'
      options: options,
      status: 'Waiting', // 'Waiting', 'Processing', 'Completed', 'Failed', 'Cancelled'
      progress: 0,
      resultBlob: null,
      extension: type === 'video' ? 'webm' : 'wav',
      error: null,
      addedAt: Date.now()
    };
    this.queue.push(job);
    this._notify();
    return job;
  }

  /**
   * Process entire queue sequentially
   */
  async startBatch() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    for (let i = 0; i < this.queue.length; i++) {
      const job = this.queue[i];
      if (job.status !== 'Waiting') continue;

      this.currentIndex = i;
      job.status = 'Processing';
      job.progress = 5;
      this._notify();

      try {
        // Switch to the target project first
        if (job.projectId && this.app.projectManager) {
          await this.app.projectManager.switchProject(job.projectId);
        }
        
        if (job.type === 'video') {
          // Render video
          const res = await this.app.exporter.exportVideo({
            fps: 30,
            duration: job.options.duration || this.app.audioEngine.duration
          });
          job.resultBlob = res.blob;
          job.extension = res.extension;
          job.status = 'Completed';
          job.progress = 100;
        } else {
          // Render audio
          const wavBlob = await this.app.exporter.exportAudioWav();
          job.resultBlob = wavBlob;
          job.extension = 'wav';
          job.status = 'Completed';
          job.progress = 100;
        }
      } catch (err) {
        console.error(`Batch job ${job.id} failed:`, err);
        job.status = 'Failed';
        job.error = err.message;
      }

      this._notify();
    }

    this.isProcessing = false;
    this.currentIndex = -1;
    this._notify();
  }

  /**
   * Cancel active job
   */
  cancelCurrent() {
    if (!this.isProcessing || this.currentIndex === -1) return;
    const job = this.queue[this.currentIndex];
    if (job) {
      job.status = 'Cancelled';
      this.app.exporter.cancel();
      this._notify();
    }
  }

  /**
   * Download individual completed result
   */
  downloadJob(jobId) {
    const job = this.queue.find(j => j.id === jobId);
    if (job && job.resultBlob) {
      Utils.downloadBlob(job.resultBlob, `${job.name.replace(/\s+/g, '_')}_render.${job.extension}`);
    }
  }

  /**
   * Download all completed results
   */
  downloadAll() {
    const completed = this.queue.filter(j => j.status === 'Completed' && j.resultBlob);
    completed.forEach((job, idx) => {
      setTimeout(() => {
        this.downloadJob(job.id);
      }, idx * 600); // Stagger downloads slightly to prevent browser block
    });
  }

  removeJob(jobId) {
    this.queue = this.queue.filter(j => j.id !== jobId);
    this._notify();
  }

  clearQueue() {
    if (this.isProcessing) return;
    this.queue = [];
    this._notify();
  }

  _notify() {
    if (typeof this.onQueueChange === 'function') {
      this.onQueueChange(this.queue);
    }
  }
}

if (typeof window !== 'undefined') {
  window.BatchExportManager = BatchExportManager;
}
