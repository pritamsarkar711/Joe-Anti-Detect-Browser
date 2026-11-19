import type { FingerprintSpec } from '@joe/core';

/**
 * Builds the page-level fingerprint consistency payload.
 *
 * IMPORTANT — scope: this is a *JavaScript-level* consistency layer. It gives
 * every JS-observable surface the same values as the declared device template,
 * which removes internal contradictions and the most common leaks. It does NOT
 * and cannot change engine-level surfaces (TLS/JA4 ClientHello, HTTP/2 frame
 * order, font rasterisation, GPU driver behaviour, CDP side channels). Those
 * require a patched Chromium/Firefox build — see docs/ARCHITECTURE.md.
 *
 * The exact same string is injected by:
 *   - Electron: CDP Page.addScriptToEvaluateOnNewDocument (main world, pre-nav)
 *   - Android : WebView.evaluateJavascript at onPageStarted
 * so the two clients stay byte-for-byte identical.
 */

export interface InjectionOptions {
  /** expose a non-enumerable self-test hook used by the built-in leak checker */
  selfTestHook?: boolean;
  /** patch Function.prototype.toString for the installed getters */
  maskToString?: boolean;
}

export function buildInjectionScript(spec: FingerprintSpec, opts: InjectionOptions = {}): string {
  const cfg = {
    ua: spec.userAgent,
    platform: spec.platform,
    oscpu: spec.oscpu,
    vendor: spec.vendor,
    major: spec.chromeMajor,
    hint: spec.uaClientHints,
    screen: spec.screen,
    avail: spec.availScreen,
    inner: spec.innerSize,
    cores: spec.cores,
    memory: spec.memoryGb,
    touch: spec.touchPoints,
    gpu: spec.gpu,
    fonts: spec.fonts,
    zone: spec.timezone,
    offset: spec.timezoneOffset,
    locale: spec.locale,
    langs: spec.languages,
    gl: spec.gl,
    glVendor: spec.webglVendor,
    glRenderer: spec.webglRenderer,
    canvas: spec.canvasNoise,
    audio: spec.audioNoise,
    webrtc: spec.webrtcMode,
    publicIp: spec.webrtcPublicIp,
    media: spec.mediaDevices,
    dnt: spec.doNotTrack,
    seed: spec.noiseSeed,
    selfTest: !!opts.selfTestHook,
    mask: opts.maskToString !== false,
  };

  // The payload is a plain string so it can be shipped to a WebView over a JS bridge.
  return `(function(){
'use strict';
var C=${JSON.stringify(cfg)};
var W=window, N=navigator, D=document;
var nativeToString=Function.prototype.toString;
var patched=new WeakSet();
function def(o,k,v,opts){try{Object.defineProperty(o,k,Object.assign({configurable:true,enumerable:true,get:function(){return v}},opts||{}));patched.add(Object.getOwnPropertyDescriptor(o,k).get);}catch(e){}}
function defFn(o,k,fn){try{Object.defineProperty(o,k,{configurable:true,enumerable:true,value:fn,writable:true});patched.add(fn);}catch(e){}}
function rnd(){var s=C.seed>>>0||1;s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;C.seed=s>>>0;return (s>>>0)/4294967296;}

/* ---- navigator ---- */
def(N,'userAgent',C.ua);
def(N,'appVersion',C.ua.replace(/^Mozilla\\//,''));
def(N,'platform',C.platform);
def(N,'oscpu',C.oscpu);
def(N,'vendor',C.vendor);
def(N,'vendorSub','');
def(N,'productSub','20030107');
def(N,'hardwareConcurrency',C.cores);
def(N,'deviceMemory',C.memory);
def(N,'maxTouchPoints',C.touch);
def(N,'language',C.locale);
def(N,'languages',C.langs.slice());
def(N,'webdriver',false);
def(N,'pdfViewerEnabled',true);
def(N,'doNotTrack',C.dnt);
def(N,'cookieEnabled',true);
def(N,'onLine',true);
try{
  var H=C.hint;
  def(N,'userAgentData',{
    brands:H.brands.map(function(b){return {brand:b.brand,version:b.version}}),
    mobile:H.mobile,platform:H.platform,
    getHighEntropyValues:function(keys){
      var out={brands:this.brands,mobile:this.mobile,platform:this.platform,platformVersion:H.platformVersion,
        uaFullVersion:H.fullVersion,fullVersionList:this.brands,architecture:H.mobile?'arm':'x86',bitness:'64',
        model:'',wow64:false};
      return Promise.resolve(out);
    },
    toJSON:function(){return {brands:this.brands,mobile:this.mobile,platform:this.platform}}
  });
}catch(e){}
try{
  var plugins=['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
  var pa=plugins.map(function(n,i){var o={name:n,filename:'internal-pdf-viewer',description:'Portable Document Format',length:1};
    Object.defineProperty(o,'item',{value:function(){return this}});Object.defineProperty(o,'namedItem',{value:function(){return this}});return o;});
  def(N,'plugins',Object.assign(pa,{item:function(i){return this[i]||null},namedItem:function(n){return this.find(function(p){return p.name===n})||null},refresh:function(){}}));
  var mimes=['application/pdf','text/pdf'];
  def(N,'mimeTypes',Object.assign(mimes.map(function(m,i){return {type:m,description:'Portable Document Format',suffixes:'pdf',enabledPlugin:pa[0]}}),
    {item:function(i){return this[i]||null},namedItem:function(n){return this.find(function(m){return m.type===n})||null}}));
}catch(e){}
if(!W.chrome){try{def(W,'chrome',{runtime:{},loadTimes:function(){return {}},csi:function(){return {}},app:{isInstalled:false}});}catch(e){}}

/* ---- screen / window geometry ---- */
try{
  ['width','height','availWidth','availHeight','colorDepth','pixelDepth'].forEach(function(k){
    var v=k.indexOf('avail')===0?(k==='availWidth'?C.avail.width:C.avail.height):(k==='width'?C.screen.width:k==='height'?C.screen.height:24);
    def(screen,k,v);
  });
  def(screen,'availLeft',0);def(screen,'availTop',0);
  def(W,'devicePixelRatio',C.screen.dpr);
  def(W,'outerWidth',C.screen.width);def(W,'outerHeight',C.screen.height);
  def(W,'screenX',0);def(W,'screenY',0);
  if(C.inner.width){ /* innerWidth stays native; forcing it breaks layout on mobile */ }
}catch(e){}

/* ---- timezone / locale ---- */
try{
  var OrigIntl=Intl.DateTimeFormat;
  defFn(W,'Intl',Object.assign({},Intl,{DateTimeFormat:function(locales,options){
    var inst=new OrigIntl(locales||C.locale,options);
    var ro=inst.resolvedOptions.bind(inst);
    inst.resolvedOptions=function(){return Object.assign(ro(),{timeZone:C.zone,locale:C.locale})};
    return inst;
  }}));
  try{Object.setPrototypeOf(W.Intl.DateTimeFormat,OrigIntl);W.Intl.DateTimeFormat.prototype=OrigIntl.prototype;}catch(e){}
  defFn(Date.prototype,'getTimezoneOffset',function(){return C.offset});
}catch(e){}

/* ---- canvas ---- */
try{
  var toDataURL=HTMLCanvasElement.prototype.toDataURL;
  var toBlob=HTMLCanvasElement.prototype.toBlob;
  var getImageData=CanvasRenderingContext2D.prototype.getImageData;
  function jitter(data){
    try{
      var n=Math.max(1,Math.floor(data.length*0.0004));
      for(var i=0;i<n;i++){var idx=Math.floor(rnd()*data.length);
        if(data[idx]!==undefined){data[idx]=Math.max(0,Math.min(255,data[idx]+(rnd()<0.5?-1:1)));}}
    }catch(e){}
    return data;
  }
  defFn(HTMLCanvasElement.prototype,'toDataURL',function(){return toDataURL.apply(this,arguments)});
  defFn(CanvasRenderingContext2D.prototype,'getImageData',function(x,y,w,h){return jitter(getImageData.apply(this,arguments))});
  defFn(HTMLCanvasElement.prototype,'toBlob',function(cb){var self=this;return toBlob.call(self,function(b){cb&&cb(b)},arguments[1],arguments[2])});
}catch(e){}

/* ---- WebGL ---- */
try{
  function patchGL(proto){
    if(!proto)return;
    var gp=proto.getParameter;
    defFn(proto,'getParameter',function(p){
      if(p===37445)return C.gpu.unmaskedVendor||C.glVendor;
      if(p===37446)return C.gpu.unmaskedRenderer||C.glRenderer;
      if(p===7938)return C.glVendor;
      if(p===7937)return C.glRenderer;
      if(p===7936)return 'WebKit WebGL';
      if(p===3379)return C.gl.maxTextureSize;
      if(p===34024)return C.gl.maxRenderbufferSize;
      if(p===3386)return new Int32Array(C.gl.maxViewport);
      if(p===34921)return C.gl.maxVertexAttribs;
      if(p===35724)return 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)';
      return gp.apply(this,arguments);
    });
    var ge=proto.getExtension;
    defFn(proto,'getExtension',function(name){
      if(String(name).toLowerCase()==='webgl_debug_renderer_info')return {UNMASKED_VENDOR_WEBGL:37445,UNMASKED_RENDERER_WEBGL:37446};
      var r=ge.apply(this,arguments);
      if(r&&typeof r.getParameter==='function'){
        var rp=r.getParameter;
        r.getParameter=function(p){if(p===37445)return C.gpu.unmaskedVendor;if(p===37446)return C.gpu.unmaskedRenderer;return rp.apply(this,arguments)};
      }
      return r;
    });
  }
  patchGL(W.WebGLRenderingContext&&W.WebGLRenderingContext.prototype);
  patchGL(W.WebGL2RenderingContext&&W.WebGL2RenderingContext.prototype);
}catch(e){}

/* ---- audio ---- */
try{
  var AC=W.AudioContext||W.webkitAudioContext;
  if(AC){def(AC.prototype,'sampleRate',48000);}
  var AB=W.AudioBuffer&&W.AudioBuffer.prototype;
  if(AB){var g=AB.getChannelData;defFn(AB,'getChannelData',function(i){var d=g.apply(this,arguments);
    try{for(var k=0;k<Math.min(64,d.length);k++)d[k]=d[k]+(rnd()-0.5)*C.audio;}catch(e){}
    return d;});}
}catch(e){}

/* ---- WebRTC: no local / mDNS IP leak ---- */
try{
  var PC=W.RTCPeerConnection||W.webkitRTCPeerConnection;
  if(PC){
    if(C.webrtc==='disabled'){def(W,'RTCPeerConnection',undefined);}
    else{
      var OrigPC=PC;
      var Wrapped=function(){var pc=new OrigPC(arguments[0]);
        try{
          var origCreate=pc.createDataChannel.bind(pc);
          pc.createDataChannel=function(){return origCreate.apply(pc,arguments)};
          var origSdp=pc.setLocalDescription?pc.setLocalDescription.bind(pc):null;
          if(origSdp)pc.setLocalDescription=function(d){if(d&&d.sdp)d.sdp=d.sdp.replace(/a=candidate:[^\\r\\n]*\\r?\\n/g,'');return origSdp(d)};
        }catch(e){}
        return pc;};
      Wrapped.prototype=OrigPC.prototype;
      def(W,'RTCPeerConnection',Wrapped);
    }
  }
}catch(e){}

/* ---- media devices / speech ---- */
try{
  if(N.mediaDevices&&N.mediaDevices.enumerateDevices){
    var ed=N.mediaDevices.enumerateDevices.bind(N.mediaDevices);
    N.mediaDevices.enumerateDevices=function(){
      var out=[];for(var i=0;i<C.media.audioinput;i++)out.push({deviceId:'a'+(i+1),kind:'audioinput',label:'Microphone '+(i+1),groupId:'g1'});
      for(var j=0;j<C.media.audiooutput;j++)out.push({deviceId:'b'+(j+1),kind:'audiooutput',label:'Speaker '+(j+1),groupId:'g1'});
      for(var k=0;k<C.media.videoinput;k++)out.push({deviceId:'v'+(k+1),kind:'videoinput',label:'Camera '+(k+1),groupId:'g2'});
      return Promise.resolve(out);
    };
    void ed;
  }
}catch(e){}
try{
  if(W.speechSynthesis&&W.speechSynthesis.getVoices){
    var gv=W.speechSynthesis.getVoices.bind(W.speechSynthesis);
    W.speechSynthesis.getVoices=function(){var v=gv();return v.length?v:[{voiceURI:'Google US English',name:'Google US English',lang:C.locale,localService:false,default:true}]};
  }
}catch(e){}

/* ---- make patched functions look native ---- */
if(C.mask){
  try{
    defFn(Function.prototype,'toString',function(){
      if(patched.has(this))return 'function () { [native code] }';
      return nativeToString.call(this);
    });
  }catch(e){}
}

/* ---- non-enumerable self-test hook (off by default) ---- */
if(C.selfTest){
  try{Object.defineProperty(W,'__joeProbe',{value:function(){return {
    ua:N.userAgent,platform:N.platform,zone:(new Intl.DateTimeFormat()).resolvedOptions().timeZone,
    cores:N.hardwareConcurrency,dpr:W.devicePixelRatio,screen:screen.width+'x'+screen.height,
    glVendor:C.gpu.unmaskedVendor,webdriver:N.webdriver,seed:C.seed
  };},configurable:true});}catch(e){}
}
})();`;
}

/** Compact summary used by the UI and the desktop REST API. */
export function surfaces(spec: FingerprintSpec): Array<{ key: string; label: string; value: string; level: 'js' | 'engine' }> {
  return [
    { key: 'ua', label: 'User agent', value: spec.userAgent.slice(0, 52) + '…', level: 'js' },
    { key: 'hints', label: 'Client hints', value: `${spec.uaClientHints.platform} · ${spec.chromeMajor}`, level: 'js' },
    { key: 'screen', label: 'Screen', value: `${spec.screen.width}×${spec.screen.height} @${spec.screen.dpr}`, level: 'js' },
    { key: 'gpu', label: 'WebGL', value: spec.gpu.renderer.slice(0, 52) + '…', level: 'js' },
    { key: 'tz', label: 'Timezone', value: `${spec.timezone} (UTC${spec.timezoneOffset > 0 ? '-' : '+'}${Math.abs(spec.timezoneOffset / 60)})`, level: 'js' },
    { key: 'canvas', label: 'Canvas', value: `seeded noise ±${spec.canvasNoise.toFixed(4)}`, level: 'js' },
    { key: 'audio', label: 'Audio', value: `48 kHz · ±${spec.audioNoise.toFixed(5)}`, level: 'js' },
    { key: 'webrtc', label: 'WebRTC', value: spec.webrtcMode === 'replace' ? 'local candidates stripped' : spec.webrtcMode, level: 'js' },
    { key: 'tls', label: 'TLS / JA4', value: 'native Chromium stack', level: 'engine' },
    { key: 'h2', label: 'HTTP/2 order', value: 'native Chromium stack', level: 'engine' },
    { key: 'fonts', label: 'Font raster', value: 'system fonts · header-pinned', level: 'engine' },
  ];
}
