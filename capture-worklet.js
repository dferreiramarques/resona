// Keep in sync with WORKLET_SRC in index.html (inline fallback).
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.block = new Float32Array(1024);
    this.hist = new Float32Array(2048);   // analysis window (last 2048 samples)
    this.idx = 0;
    this.frame = 0;
  }
  // McLeod NSDF pitch detector: decimate by 2, normalised autocorrelation,
  // first key maximum >= 0.85 * best, parabolic interpolation.
  detect(buf, sr){
    const N = buf.length;
    let rms = 0;
    for(let i=0;i<N;i++){ const v=buf[i]; rms += v*v; }
    rms = Math.sqrt(rms/N);
    if(rms < 0.003) return {f0:-1, clarity:0, rms};
    const D = 2, n = (N/D)|0, b = new Float32Array(n);
    for(let i=0;i<n;i++) b[i] = 0.5*(buf[i*D] + buf[i*D+1]);
    const sr2 = sr/D;
    const minLag = Math.max(2, Math.floor(sr2/1200));
    const maxLag = Math.min(n>>1, Math.ceil(sr2/60));
    const nsdf = new Float32Array(maxLag+2);
    let m = 0; for(let i=0;i<n;i++) m += 2*b[i]*b[i];
    if(m <= 0) return {f0:-1, clarity:0, rms};
    for(let lag=0; lag<=maxLag+1; lag++){
      if(lag>0) m -= b[lag-1]*b[lag-1] + b[n-lag]*b[n-lag];
      let acf=0; for(let j=0;j<n-lag;j++) acf += b[j]*b[j+lag];
      nsdf[lag] = m>0 ? 2*acf/m : 0;
    }
    // collect key maxima (one per positive lobe after the first zero crossing)
    const peaks = [];
    let lag = 1; while(lag<=maxLag && nsdf[lag]>0) lag++;
    let inLobe=false, lobeLag=-1, lobeV=-1, best=-1;
    for(; lag<=maxLag; lag++){
      const v = nsdf[lag];
      if(v>0){
        if(!inLobe){ inLobe=true; lobeV=-1; }
        if(v>lobeV && lag>=minLag){ lobeV=v; lobeLag=lag; }
      } else if(inLobe){
        inLobe=false;
        if(lobeV>0){ peaks.push({lag:lobeLag, v:lobeV}); if(lobeV>best) best=lobeV; }
      }
    }
    if(inLobe && lobeV>0){ peaks.push({lag:lobeLag, v:lobeV}); if(lobeV>best) best=lobeV; }
    if(!peaks.length) return {f0:-1, clarity:0, rms};
    let pick = peaks[0].lag;
    for(const p of peaks){ if(p.v >= 0.85*best){ pick = p.lag; break; } }
    const a = nsdf[pick-1], c = nsdf[pick], d = nsdf[pick+1];
    const den = a - 2*c + d;
    const shift = den !== 0 ? 0.5*(a-d)/den : 0;
    return { f0: sr2/(pick+shift), clarity: c, rms };
  }
  process(inputs){
    const ch = inputs[0][0];
    if(!ch) return true;
    for(let i=0;i<ch.length;i++){
      this.block[this.idx++] = ch[i];
      if(this.idx >= this.block.length){
        const copy = this.block.slice(0);
        this.hist.copyWithin(0, this.block.length);
        this.hist.set(this.block, this.hist.length - this.block.length);
        // f0: 0 = not analysed this block, -1 = analysed but unpitched
        let res = {f0:0, clarity:0, rms:0};
        if((this.frame++ % 3) === 0) res = this.detect(this.hist, sampleRate);
        let r=0; for(let k=0;k<this.block.length;k++) r+=this.block[k]*this.block[k];
        res.rms = Math.sqrt(r/this.block.length);
        this.port.postMessage({samples:copy, f0:res.f0, clarity:res.clarity, rms:res.rms}, [copy.buffer]);
        this.idx = 0;
      }
    }
    return true;
  }
}
registerProcessor('capture', CaptureProcessor);

// PCM crusher: bit-depth quantisation + sample-and-hold (sample-rate reduction).
class CrushProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors(){
    return [{name:'bits',defaultValue:12,minValue:1,maxValue:16,automationRate:'k-rate'},
            {name:'hold',defaultValue:1,minValue:1,maxValue:64,automationRate:'k-rate'}];
  }
  constructor(){ super(); this.c=[0,0]; this.v=[0,0]; }
  process(inputs, outputs, params){
    const inp = inputs[0], out = outputs[0];
    if(!inp || !inp.length) return true;
    const q = Math.pow(2, params.bits[0]-1), hold = Math.max(1, Math.round(params.hold[0]));
    for(let ch=0; ch<out.length; ch++){
      const x = inp[ch] || inp[0], y = out[ch];
      let c = this.c[ch]||0, v = this.v[ch]||0;
      for(let n=0; n<y.length; n++){
        if(c <= 0){ v = Math.round(x[n]*q)/q; c = hold; }
        c--; y[n] = v;
      }
      this.c[ch] = c; this.v[ch] = v;
    }
    return true;
  }
}
registerProcessor('crush', CrushProcessor);
