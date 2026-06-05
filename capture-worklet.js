class CaptureProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.block = new Float32Array(1024);
    this.idx = 0;
    this.frame = 0;
  }
  // Lightweight detector: decimate by 2, bounded lag search, no parabolic.
  detect(buf, sr){
    const N = buf.length;
    let rms = 0;
    for(let i=0;i<N;i++){ const v=buf[i]; rms += v*v; }
    rms = Math.sqrt(rms/N);
    if(rms < 0.006) return {f0:-1, clarity:0, rms};
    const D = 2, n = (N/D)|0;
    const b = new Float32Array(n);
    for(let i=0;i<n;i++) b[i] = buf[i*D];
    const sr2 = sr/D;
    const minLag = Math.max(2, Math.floor(sr2/1000));
    const maxLag = Math.min(n-2, Math.floor(sr2/65));
    let c0 = 0; for(let i=0;i<n;i++) c0 += b[i]*b[i];
    if(c0 <= 0) return {f0:-1, clarity:0, rms};
    let maxv = -1, pos = -1;
    for(let lag=minLag; lag<=maxLag; lag++){
      let s=0; for(let j=0;j<n-lag;j++) s += b[j]*b[j+lag];
      if(s > maxv){ maxv = s; pos = lag; }
    }
    if(pos < 0) return {f0:-1, clarity:0, rms};
    return { f0: sr2/pos, clarity: maxv/c0, rms };
  }
  process(inputs){
    const ch = inputs[0][0];
    if(!ch) return true;
    for(let i=0;i<ch.length;i++){
      this.block[this.idx++] = ch[i];
      if(this.idx >= this.block.length){
        const copy = this.block.slice(0);
        let res = {f0:-1, clarity:0, rms:0};
        if((this.frame++ % 3) === 0) res = this.detect(this.block, sampleRate);
        else { let r=0; for(let k=0;k<this.block.length;k++) r+=this.block[k]*this.block[k]; res.rms=Math.sqrt(r/this.block.length); }
        this.port.postMessage({samples:copy, f0:res.f0, clarity:res.clarity, rms:res.rms}, [copy.buffer]);
        this.idx = 0;
      }
    }
    return true;
  }
}
registerProcessor('capture', CaptureProcessor);
