# AKSH Video & Audio Editor

**AKSH Video & Audio Editor** is a professional, completely standalone, offline-first client-side web application that combines a **Professional Web Audio Editor** and a **Dark Cinematic Anime Music Visualizer / Shorts Video Creator**.

It runs 100% inside your browser using native HTML5, CSS3, and modern Vanilla JavaScript (ES2022). No Node.js runtime, no build tools, no servers, no database servers, and zero runtime external CDN dependencies are required.

---

## Final Destination & GitHub Pages Deployment

This application is designed to be placed directly inside:

```text
/apps/aksh-video-audio-editor/
```

inside the GitHub Pages repository:

```text
https://github.com/Aksh-Studio/Aksh-Studio.github.io
```

### Destination Folder Structure:
```text
Aksh-Studio.github.io/
└── apps/
    └── aksh-video-audio-editor/
        ├── index.html
        ├── css/
        │   ├── main.css
        │   ├── editor.css
        │   ├── timeline.css
        │   ├── visualizer.css
        │   └── responsive.css
        ├── js/
        │   ├── app.js
        │   ├── audio-engine.js
        │   ├── audio-editor.js
        │   ├── waveform.js
        │   ├── analyzer.js
        │   ├── effects.js
        │   ├── visualizer.js
        │   ├── particles.js
        │   ├── timeline.js
        │   ├── renderer.js
        │   ├── exporter.js
        │   ├── project-manager.js
        │   ├── storage.js
        │   ├── batch-export.js
        │   ├── ui.js
        │   └── utils.js
        ├── presets/
        │   └── presets.js
        ├── assets/
        │   ├── icons/
        │   └── demo/
        │       ├── demo-audio.js
        │       └── demo-assets.js
        ├── vendor/
        └── README.md
```

### Final Live URL:
```text
https://aksh-studio.github.io/apps/aksh-video-audio-editor/
```

All internal references use relative paths (`css/main.css`, `js/app.js`, etc.) so the entire folder can be copied and moved without modifying a single line of code.

---

## Core Features

### 1. Professional Web Audio Editor
- **Multi-Format Audio Import**: MP3, WAV, OGG, M4A/AAC, FLAC, and WebM audio via `AudioContext.decodeAudioData`.
- **Canvas Waveform Display**: Downsampled peak caching for instant responsive rendering, zooming, and seeking.
- **Audio Buffer Manipulation**: Trim to selection, Crop, Cut, Split at playhead, Silence selection, Fade In, Fade Out, Volume gain, Stereo Pan, Reverse audio buffer.
- **History Management**: Multi-level Undo / Redo stack.
- **Transport Controls**: Play, Pause, Stop, Seek, Looping, Playback Rate (0.25x - 4x).

### 2. Real Web Audio DSP Effects Rack
- **5-Band Parametric EQ**: Low Shelf (80Hz), Low-Mid Peaking (300Hz), Mid Peaking (1kHz), High-Mid Peaking (4kHz), High Shelf (10kHz).
- **Dynamics Compressor**: Threshold (-60dB to 0dB), Ratio (1:1 to 20:1), Knee, Attack, Release, and Makeup Gain.
- **Procedural Reverb**: Convolution Reverb with procedurally synthesized stereo impulse responses (decay time, wet/dry mix) — 100% offline without downloading impulse files.
- **Echo & Delay**: Delay lines with lowpass damping filter, feedback gain, and wet/dry mix.
- **WaveShaper Saturation / Distortion**: Hyperbolic tangent curve with 4x oversampling.
- **Stereo Width & Modulation**: Mid-Side matrix processor and Tremolo LFO.
- **Offline Bouncing**: Recreates identical DSP graphs inside `OfflineAudioContext` for lossless exports.

### 3. Dark Cinematic Anime Music Visualizer / Shorts Video Creator
- **Native Resolution**: 1080x1920 (9:16 vertical Shorts/Reels/TikTok default), 720x1280 (Fast Performance), 2160x3840 (4K Experimental), 1920x1080 (16:9), and 1080x1080 (1:1).
- **Anime Edit Quick Mode**: 1-Click creation workflow with LOW, MEDIUM, HIGH, EXTREME intensity profiles.
- **Audio-Reactive Central Emblem**: PNG/JPG/SVG upload or stylized neon typography with reactive bass scaling, glow halo, and rotational spin.
- **Neon Energy System**: Concentric glowing neon rings, counter-rotating segmented arcs, and radial frequency spectrum equalizer bars.
- **2D Particle Physics Engine**:
  - Expanding circular neon shockwaves triggered by beat transients.
  - Explosive spark bursts radiating outwards on drum impacts.
  - Ambient floating ember motes and dust particles.
  - Orbiting stardust motes circling the central core.
  - Procedural electric lightning arcs.
  - Anime speed lines flaring during peak volume drops.
- **Background Motion & Parallax**:
  - Cover, Contain, Stretch, Crop image fit modes.
  - Animations: Ken Burns pan/zoom, Beat Shake, Beat Zoom, Slow Zoom In/Out, Subtle Drift.
  - Real-time CSS and Canvas filters (brightness, contrast, saturation, hue, vignette).
- **Atmospheric Effects**: Chromatic aberration (RGB split displacement proportional to bass energy), dark vignette, scanlines, camera shake with exponential decay.
- **10 Core Visualizer Presets**:
  1. *Neon Core*
  2. *Energy Ring*
  3. *Cyber Pulse*
  4. *Anime Edit*
  5. *Aura*
  6. *Spectrum*
  7. *Bass Shock*
  8. *Galaxy*
  9. *Dark Cinematic*
  10. *Minimal Glow*

### 4. Real Export Capabilities
- **Lossless Audio Export**:
  - Full 16-bit PCM stereo **WAV** export rendered faster-than-realtime using `OfflineAudioContext` and a custom pure-JavaScript RIFF WAVE encoder.
- **Real-Time Video Recording**:
  - Combines `canvas.captureStream(30)` and `audioContext.createMediaStreamDestination()` with browser `MediaRecorder`.
  - Dynamically detects supported codecs at runtime using `MediaRecorder.isTypeSupported()`.
  - **WebM (VP9/VP8 + Opus)**: Primary guaranteed browser-native video format.
  - **MP4 (H.264 + AAC)**: Optional, enabled only on browsers natively supporting client-side MP4 recording.
  - Zero fake export buttons.

### 5. Multi-Project System & Storage
- Support for multiple independent songs (Song 01, Song 02, etc.).
- Native **IndexedDB** storage for project manifests and binary media Blobs, with quota checking and URL lifecycle cleanup.
- **Project JSON**: Pure settings metadata export/import.
- **Batch Export Queue**: Sequential background rendering queue with individual and batch download options.

### 6. Built-in Offline Demo Mode
- Includes a procedural audio synthesizer (`assets/demo/demo-audio.js`) that creates a high-energy anime/cyber trap beat in Web Audio memory on demand.
- Includes embedded vector SVG logo and procedural anime cyberpunk background generator.
- Allows testing all visualizer and editor features immediately without requiring any uploaded files.

---

## Browser Requirements

To run this application locally:
- A modern browser with support for:
  - **Web Audio API** (`AudioContext`, `OfflineAudioContext`)
  - **Canvas 2D API** (`HTMLCanvasElement.captureStream`)
  - **MediaRecorder API**
  - **IndexedDB**
  - Modern JavaScript (ES2022)

Recommended browsers:
- Google Chrome 90+
- Microsoft Edge 90+
- Mozilla Firefox 95+
- Apple Safari 15+

---

## Running Locally

Because modern web browsers enforce security policies preventing `AudioContext` and Canvas operations on raw `file://` URLs, run a simple local web server:

Using Python (built into macOS, Linux, and Windows):
```powershell
python -m http.server 8080 --directory "aksh-video-audio-editor"
```

Then open in your browser:
```text
http://localhost:8080/
```

No Node.js or npm is required.

---

## Privacy Policy

> *"Your media is processed locally in your browser whenever possible. This application does not upload your media to a server."*

- 100% Client-side.
- Zero network analytics or tracking scripts.
- Your audio files, images, and exported videos never leave your computer.
