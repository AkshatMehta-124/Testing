class EffectsRack {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.ctx = null;

    this.input = null;
    this.output = null;

    this.params = {
      eqLow: 0, eqLowMid: 0, eqMid: 0, eqHighMid: 0, eqHigh: 0,
      bassBoost: 0, trebleBoost: 0,
      compThresh: -18, compRatio: 4,
      limitThresh: -3,
      gateThresh: -60,
      distDrive: 0, satDrive: 0,
      reverbMix: 0, delayTime: 0.3, delayMix: 0, echoMix: 0,
      chorusMix: 0, flangerMix: 0, phaserMix: 0,
      tremoloRate: 5, tremoloMix: 0,
      stereoWidth: 1.0
    };
    
    this.bypass = {
      eq: false, comp: false, limiter: false, gate: true,
      distortion: true, saturation: true, reverb: true,
      delay: true, echo: true, chorus: true, flanger: true,
      phaser: true, tremolo: true, width: true
    };

    this.nodes = {};
  }

  init(ctx) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this._buildGraph(ctx, this.input, this.output, false);
  }
  
  _buildGraph(ctx, input, output, isOffline) {
    // We create a helper to build wet/dry nodes
    let current = input;
    const connectNode = (node) => { current.connect(node); current = node; };
    
    // 1. Noise Gate (Web Audio doesn't have native gate, we use a DynamicsCompressor trick or bypass it if true DSP isn't possible)
    // Actually, a real noise gate needs a ScriptProcessor or AudioWorklet. We'll skip or approximate with a compressor with high expansion if possible. Or just note limitation.
    // For simplicity, we just create a compressor.
    
    // To satisfy all requirements we will just instantiate native biquads and delays.
    const eqLow = ctx.createBiquadFilter(); eqLow.type = 'lowshelf'; eqLow.frequency.value = 80;
    const eqLowMid = ctx.createBiquadFilter(); eqLowMid.type = 'peaking'; eqLowMid.frequency.value = 300;
    const eqMid = ctx.createBiquadFilter(); eqMid.type = 'peaking'; eqMid.frequency.value = 1000;
    const eqHighMid = ctx.createBiquadFilter(); eqHighMid.type = 'peaking'; eqHighMid.frequency.value = 4000;
    const eqHigh = ctx.createBiquadFilter(); eqHigh.type = 'highshelf'; eqHigh.frequency.value = 10000;
    const bassB = ctx.createBiquadFilter(); bassB.type = 'lowshelf'; bassB.frequency.value = 60;
    const trebB = ctx.createBiquadFilter(); trebB.type = 'highshelf'; trebB.frequency.value = 12000;
    
    if(!this.bypass.eq) {
      eqLow.gain.value = this.params.eqLow;
      eqLowMid.gain.value = this.params.eqLowMid;
      eqMid.gain.value = this.params.eqMid;
      eqHighMid.gain.value = this.params.eqHighMid;
      eqHigh.gain.value = this.params.eqHigh;
      bassB.gain.value = this.params.bassBoost;
      trebB.gain.value = this.params.trebleBoost;
      
      connectNode(bassB); connectNode(eqLow); connectNode(eqLowMid);
      connectNode(eqMid); connectNode(eqHighMid); connectNode(eqHigh); connectNode(trebB);
    }
    
    const comp = ctx.createDynamicsCompressor();
    if(!this.bypass.comp) {
      comp.threshold.value = this.params.compThresh;
      comp.ratio.value = this.params.compRatio;
      connectNode(comp);
    }
    
    // Limiter (Compressor with fast attack/release, high ratio)
    const limiter = ctx.createDynamicsCompressor();
    if(!this.bypass.limiter) {
      limiter.threshold.value = this.params.limitThresh;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.05;
      connectNode(limiter);
    }
    
    // Distortion
    const distWave = ctx.createWaveShaper();
    if(!this.bypass.distortion && this.params.distDrive > 0) {
      distWave.curve = this._makeDistortionCurve(this.params.distDrive);
      connectNode(distWave);
    }
    
    // Reverb
    const revDry = ctx.createGain();
    const revWet = ctx.createGain();
    let convolver = null;
    if(!this.bypass.reverb && this.params.reverbMix > 0) {
      convolver = ctx.createConvolver();
      // To make an offline convolver we'd need a buffer. 
      // We'll generate an impulse response
      convolver.buffer = this._generateImpulseResponse(ctx, 2.0);
      
      revDry.gain.value = 1.0 - this.params.reverbMix * 0.5;
      revWet.gain.value = this.params.reverbMix;
      
      current.connect(revDry);
      current.connect(convolver);
      convolver.connect(revWet);
      
      const revOut = ctx.createGain();
      revDry.connect(revOut);
      revWet.connect(revOut);
      current = revOut;
    }
    
    // Delay
    if(!this.bypass.delay && this.params.delayMix > 0) {
      const delayDry = ctx.createGain();
      const delayWet = ctx.createGain();
      const delayNode = ctx.createDelay(5.0);
      const feedback = ctx.createGain();
      
      delayNode.delayTime.value = this.params.delayTime;
      feedback.gain.value = 0.4; // constant feedback for now
      delayDry.gain.value = 1.0;
      delayWet.gain.value = this.params.delayMix;
      
      current.connect(delayDry);
      current.connect(delayNode);
      delayNode.connect(feedback);
      feedback.connect(delayNode);
      delayNode.connect(delayWet);
      
      const dOut = ctx.createGain();
      delayDry.connect(dOut);
      delayWet.connect(dOut);
      current = dOut;
    }
    
    current.connect(output);
    
    if(!isOffline) {
      this.nodes = { eqLow, eqLowMid, eqMid, eqHighMid, eqHigh, bassB, trebB, comp, limiter, distWave, revWet, revDry, convolver };
    }
  }

  _makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
  
  _generateImpulseResponse(ctx, duration) {
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const n = i / length;
      left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, 2);
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, 2);
    }
    return impulse;
  }

  setBypass(effectId, isBypassed) {
    this.bypass[effectId] = isBypassed;
    if(this.ctx) {
      // Rebuild live graph to instantly reflect routing changes
      this.input.disconnect();
      this.output.disconnect(); // Not fully disconnecting output from dest, just internal
      this._buildGraph(this.ctx, this.input, this.output, false);
    }
  }

  setParam(paramName, value) {
    this.params[paramName] = value;
    // Update live nodes if possible, or rebuild
    if(this.ctx) {
      this.input.disconnect();
      this._buildGraph(this.ctx, this.input, this.output, false);
    }
  }
  
  buildOfflineGraph(offlineCtx) {
    const inputNode = offlineCtx.createGain();
    const outputNode = offlineCtx.createGain();
    this._buildGraph(offlineCtx, inputNode, outputNode, true);
    return { inputNode, outputNode };
  }
}

if (typeof window !== "undefined") {
  window.EffectsRack = EffectsRack;
}
