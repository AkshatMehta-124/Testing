/**
 * AKSH Video & Audio Editor - Storage Module
 * Native IndexedDB wrapper for local media blob storage and project manifests.
 * Prevents blob duplication, manages memory lifecycle, and inspects storage quotas.
 */

class StorageManager {
  constructor() {
    this.dbName = 'AkshEditorDB';
    this.dbVersion = 1;
    this.db = null;
  }

  /**
   * Open or initialize the IndexedDB database
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Store for project manifests
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }

        // Store for binary audio and image blobs
        if (!db.objectStoreNames.contains('mediaBlobs')) {
          db.createObjectStore('mediaBlobs', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        reject(e.target.error);
      };
    });
  }

  /**
   * Save a project manifest (JSON metadata)
   */
  async saveProject(project) {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        project.updatedAt = Date.now();
        const req = store.put(project);
        req.onsuccess = () => resolve(project);
        req.onerror = (e) => {
          if (e.target.error && e.target.error.name === 'QuotaExceededError') {
            alert('Storage quota exceeded. Please delete unused projects or clear temporary cache.');
          }
          reject(e.target.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Retrieve a project by ID
   */
  async getProject(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieve all saved projects
   */
  async getAllProjects() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Delete a project
   */
  async deleteProject(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Save Media Blob (Audio file or Image file) without duplicating
   */
  async saveMediaBlob(blobId, blob, meta = {}) {
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction('mediaBlobs', 'readwrite');
        const store = tx.objectStore('mediaBlobs');
        const entry = {
          id: blobId,
          blob: blob,
          type: blob.type,
          size: blob.size,
          name: meta.name || 'media',
          savedAt: Date.now()
        };
        const req = store.put(entry);
        req.onsuccess = () => resolve(entry);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Retrieve Media Blob by ID
   */
  async getMediaBlob(blobId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('mediaBlobs', 'readonly');
      const store = tx.objectStore('mediaBlobs');
      const req = store.get(blobId);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Estimates browser storage usage
   */
  async getEstimatedStorageUsage() {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
      const quotaMB = ((estimate.quota || 0) / (1024 * 1024)).toFixed(1);
      return { usedMB, quotaMB, percent: Math.round(((estimate.usage || 0) / (estimate.quota || 1)) * 100) };
    }
    return { usedMB: '0.0', quotaMB: 'N/A', percent: 0 };
  }

  /**
   * Clears database
   */
  async clearAllData() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['projects', 'mediaBlobs'], 'readwrite');
      tx.objectStore('projects').clear();
      tx.objectStore('mediaBlobs').clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
