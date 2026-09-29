/**
 * AKSH Video & Audio Editor - Demo Audio Generator
 * Procedurally generates a punchy Anime / Cyber Trap beat into an AudioBuffer
 * Completely client-side, zero network dependencies
 */

const DemoAudio = (() => {
  /**
   * Generates a 16-second high-energy anime cyber trap beat
   * @param {AudioContext} audioCtx
   * @returns {AudioBuffer}
   */
  function generateDemoTrack(audioCtx) {
    const sampleRate = audioCtx.sampleRate;
    const bpm = 140;
    const beatDuration = 60 / bpm; // ~0.4285s
    const totalBars = 8;
    const duration = totalBars * 4 * beatDuration; // ~13.71s
    const numSamples = Math.floor(sampleRate * duration);

    // Create 2-channel stereo buffer
    const buffer = audioCtx.createBuffer(2, numSamples, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const totalSteps = totalBars * 16; // 16th notes
    const stepDuration = beatDuration / 4;

    // Helper to add sample with bounds check and soft saturation
    function addSample(ch, idx, val) {
      if (idx >= 0 && idx < numSamples) {
        ch[idx] += val;
      }
    }

    // Synth notes: D minor scale (D3, F3, G3, A3, C4, D4)
    const freqs = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66];

    // Render step-by-step
    for (let step = 0; step < totalSteps; step++) {
      const time = step * stepDuration;
      const startSample = Math.floor(time * sampleRate);
      const bar = Math.floor(step / 16);
      const beatInBar = Math.floor((step % 16) / 4);
      const stepInBeat = step % 4;

      // 1. KICK DRUM: on beats 0 and 2.5 (bars 0-3), and heavy syncopation (bars 4-7)
      const isKick = (step % 16 === 0) || (step % 16 === 10) || (bar >= 4 && (step % 16 === 6 || step % 16 === 14));
      if (isKick) {
        const kickLen = Math.floor(sampleRate * 0.35);
        for (let i = 0; i < kickLen; i++) {
          const t = i / sampleRate;
          // Pitch envelope: fast drop from 160Hz to 45Hz
          const pitch = 45 + 115 * Math.exp(-t * 28);
          const amp = Math.exp(-t * 8.5);
          const sample = Math.sin(2 * Math.PI * pitch * t) * amp * 0.85;
          addSample(left, startSample + i, sample);
          addSample(right, startSample + i, sample);
        }
      }

      // 2. 808 SUB BASS: follows kick with deep sustained pitch drop
      if (isKick && bar >= 2) {
        const bassLen = Math.floor(sampleRate * 0.8);
        const rootFreq = bar % 2 === 0 ? 55 : 43.65; // A1 or F1
        for (let i = 0; i < bassLen; i++) {
          const t = i / sampleRate;
          const pitch = rootFreq * (1 + 0.3 * Math.exp(-t * 15));
          const amp = Math.exp(-t * 2.8);
          // Soft saturated sine
          let sample = Math.sin(2 * Math.PI * pitch * t) * amp * 0.7;
          // Add 2nd harmonic for warmth
          sample += Math.sin(4 * Math.PI * pitch * t) * amp * 0.25;
          addSample(left, startSample + i, sample * 0.9);
          addSample(right, startSample + i, sample * 0.9);
        }
      }

      // 3. SNARE / CLAP: on beats 2 and 4 (step 4, 12 in each bar)
      const isSnare = (step % 16 === 4) || (step % 16 === 12);
      if (isSnare) {
        const snareLen = Math.floor(sampleRate * 0.22);
        for (let i = 0; i < snareLen; i++) {
          const t = i / sampleRate;
          // Tonal body (180Hz) + white noise burst
          const tone = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 25) * 0.4;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.55;
          const sample = (tone + noise);
          addSample(left, startSample + i, sample * 0.9);
          addSample(right, startSample + i, sample * 0.95);
        }
      }

      // 4. HI-HATS: 16th notes with velocity accents and rolls
      const hatLen = Math.floor(sampleRate * 0.05);
      const isRoll = bar >= 3 && (step % 8 === 6 || step % 8 === 7);
      const hatVelocity = isRoll ? 0.35 : (stepInBeat === 0 ? 0.45 : 0.22);
      for (let i = 0; i < hatLen; i++) {
        const t = i / sampleRate;
        // High frequency filtered noise
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 55) * hatVelocity;
        // Slight stereo panning on hats
        addSample(left, startSample + i, noise * 0.8);
        addSample(right, startSample + i, noise * 1.1);
      }

      // 5. ANIME CYBER SYNTH ARPEGGIO: fast melodic runs
      const noteIdx = (step * 2) % freqs.length;
      const noteFreq = freqs[noteIdx] * (bar >= 4 ? 2 : 1);
      const synthLen = Math.floor(sampleRate * 0.18);
      const synthPan = (step % 2 === 0) ? 0.3 : -0.3; // Stereo ping-pong

      for (let i = 0; i < synthLen; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 12);
        // Sawtooth approximation (sum of first 4 harmonics)
        let wave = Math.sin(2 * Math.PI * noteFreq * t) +
                   0.5 * Math.sin(4 * Math.PI * noteFreq * t) +
                   0.25 * Math.sin(6 * Math.PI * noteFreq * t);
        wave *= env * 0.28;
        addSample(left, startSample + i, wave * (0.5 - synthPan));
        addSample(right, startSample + i, wave * (0.5 + synthPan));
      }
    }

    // Apply master soft limiter / normalization to avoid clipping
    let peak = 0;
    for (let i = 0; i < numSamples; i++) {
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }

    if (peak > 0.001) {
      const targetGain = 0.92 / peak;
      for (let i = 0; i < numSamples; i++) {
        // Soft clipping tanh curve
        left[i] = Math.tanh(left[i] * targetGain);
        right[i] = Math.tanh(right[i] * targetGain);
      }
    }

    return buffer;
  }

  return {
    generateDemoTrack
  };
})();

if (typeof window !== 'undefined') {
  window.DemoAudio = DemoAudio;
}
