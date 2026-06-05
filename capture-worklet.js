class CaptureProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.block = new Float32Array(1024);
    this.idx = 0;
    this.frame = 0;
  }
  detect(buf, sr){
    const N = buf.length;
    let rms = 0;
    for(let i=0;i<N;i++){ const v=buf[i]; rms += v*v; }
    rms = Math.sqrt(rms/N);
    if(rms < 0.006) return {f0:-1, clarity:0, rms};
    const thr = 0.18;
    let r1=0, r2=N-1;
    for(let i=0;i<N/2;i++){ if(Math.abs(buf[i])<thr){ r1=i; break; } }
    for(let i=1;i<N/2;i++){ if(Math.abs(buf[N-i])<thr){ r2=N-i; break; } }
    if(r2-r1 < 128) return {f0:-1, clarity:0, rms};
    const n = r2-r1;
    const c = new Float32Array(n);
    for(let lag=0; lag<n; lag++){
      let s=0;
      for(let j=0;j<n-lag;j++) s += buf[r1+j]*buf[r1+j+lag];
      c[lag]=s;
    }
    let d=0; while(d<n-1 && c[d]>c[d+1]) d++;
    let maxv=-1, pos=-1;
    for(let i=d;i<n;i++){ if(c[i]>maxv){ maxv=c[i]; pos=i; } }
    if(pos<=0) return {f0:-1, clarity:0, rms};
    const x1=c[pos-1]||0, x2=c[pos]||0, x3=c[pos+1]||0;
    const den=(x1+x3-2*x2);
    let T=pos; if(den) T = pos - 0.5*(x3-x1)/den;
    const f0 = sr / T;
    const clarity = c[0] ? maxv/c[0] : 0;
    return {f0, clarity, rms};
  }
  process(inputs){
    const ch = inputs[0][0];
    if(!ch) return true;
    for(let i=0;i<ch.length;i++){
      this.block[this.idx++] = ch[i];
      if(this.idx >= this.block.length){
        const copy = this.block.slice(0);
        let res = {f0:-1, clarity:0, rms:0};
        if((this.frame++ & 1) === 0) res = this.detect(this.block, sampleRate);
        else { let r=0; for(let k=0;k<this.block.length;k++) r+=this.block[k]*this.block[k]; res.rms=Math.sqrt(r/this.block.length); }
        this.port.postMessage({samples:copy, f0:res.f0, clarity:res.clarity, rms:res.rms}, [copy.buffer]);
        this.idx = 0;
      }
    }
    return true;
  }
}
registerProcessor('capture', CaptureProcessor);
