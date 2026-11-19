import type { FingerprintSpec } from '@joe/core';

/**
 * Page-level fingerprint consistency payload.
 *
 * SCOPE (honest): this is a JavaScript-level consistency layer. It makes every
 * JS-observable surface agree with ONE observed device sample. It does NOT and
 * cannot change engine-level surfaces (TLS/JA4 ClientHello, HTTP/2 frame order,
 * font rasterisation, GPU driver behaviour, CDP side channels). Those need a
 * patched Chromium/Firefox build, see docs/ARCHITECTURE.md.
 *
 * The same string is injected by Electron (CDP addScriptToEvaluateOnNewDocument,
 * main world, before navigation) and Android (WebView.evaluateJavascript at
 * onPageStarted), so both clients stay byte-for-byte identical.
 *
 * With `selfTestHook`, two non-enumerable helpers are installed:
 *   window.__joeProbe()   → the effective values of every patched surface
 *   window.__joeVerify()  → { passed, total, failures } internal assertions
 * The desktop "Leak check" view and scripts/fingerprint-test.mjs use these.
 */
export interface InjectionOptions {
  selfTestHook?: boolean;
  maskToString?: boolean;
}

export interface FingerprintSurface {
  key: string;
  label: string;
  value: string;
  level: 'js' | 'engine';
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

  return `(function(){
'use strict';
var C=${JSON.stringify(cfg)};
var W=window,N=navigator,D=document;
var nativeToString=Function.prototype.toString;
var patched=new WeakSet();
function def(o,k,v){try{Object.defineProperty(o,k,{configurable:true,enumerable:true,get:function(){return v}});patched.add(Object.getOwnPropertyDescriptor(o,k).get);}catch(e){}}
function defFn(o,k,fn){try{Object.defineProperty(o,k,{configurable:true,enumerable:true,value:fn,writable:true});patched.add(fn);}catch(e){}}
function rnd(){var s=C.seed>>>0||1;s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;C.seed=s>>>0;return (s>>>0)/4294967296;}

/* navigator */
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
  var B=(C.hint.brands&&C.hint.brands.length)?C.hint.brands:[{brand:'Google Chrome',version:String(C.major)},{brand:'Chromium',version:String(C.major)}];
  def(N,'userAgentData',{
    brands:B.map(function(b){return {brand:b.brand,version:b.version}}),
    mobile:!!C.hint.mobile,platform:C.hint.platform,
    getHighEntropyValues:function(){
      return Promise.resolve({brands:this.brands,mobile:this.mobile,platform:this.platform,
        platformVersion:C.hint.platformVersion,uaFullVersion:C.hint.fullVersion,
        fullVersionList:this.brands,architecture:C.hint.mobile?'arm':'x86',bitness:'64',
        model:'',wow64:false,languages:C.langs,timezone:C.zone});
    },
    toJSON:function(){return {brands:this.brands,mobile:this.mobile,platform:this.platform}}
  });
}catch(e){}
try{
  var names=['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','WebKit built-in PDF'];
  var pa=names.map(function(n){var o={name:n,filename:'internal-pdf-viewer',description:'Portable Document Format',length:1};
    Object.defineProperty(o,'item',{value:function(){return this}});Object.defineProperty(o,'namedItem',{value:function(){return this}});return o;});
  def(N,'plugins',Object.assign(pa,{item:function(i){return this[i]||null},namedItem:function(n){return this.find(function(p){return p.name===n})||null},refresh:function(){}}));
  def(N,'mimeTypes',Object.assign(['application/pdf','text/pdf'].map(function(m){return {type:m,description:'Portable Document Format',suffixes:'pdf',enabledPlugin:pa[0]}}),
    {item:function(i){return this[i]||null},namedItem:function(n){return this.find(function(m){return m.type===n})||null}}));
}catch(e){}
if(!W.chrome){try{def(W,'chrome',{runtime:{},loadTimes:function(){return {}},csi:function(){return {}},app:{isInstalled:false}});}catch(e){}}

/* screen and window geometry */
try{
  ['width','height','availWidth','availHeight','colorDepth','pixelDepth'].forEach(function(k){
    var v=k==='availWidth'?C.avail.width:k==='availHeight'?C.avail.height:k==='width'?C.screen.width:k==='height'?C.screen.height:24;
    def(screen,k,v);
  });
  def(screen,'availLeft',0);def(screen,'availTop',0);
  def(W,'devicePixelRatio',C.screen.dpr);
  def(W,'outerWidth',C.screen.width);def(W,'outerHeight',C.screen.height);
  def(W,'screenX',0);def(W,'screenY',0);
  if(screen.orientation&&screen.orientation.type!==undefined){try{def(screen.orientation,'type',C.hint.mobile?'portrait-primary':'landscape-primary');}catch(e){}}
}catch(e){}

/* timezone and locale */
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

/* canvas: tiny deterministic, seeded noise so two profiles differ stably */
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
  defFn(CanvasRenderingContext2D.prototype,'getImageData',function(){return jitter(getImageData.apply(this,arguments))});
  defFn(HTMLCanvasElement.prototype,'toBlob',function(cb){var self=this;return toBlob.call(self,function(b){cb&&cb(b)},arguments[1],arguments[2])});
}catch(e){}

/* WebGL: renderer, vendor and plausible limits */
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

/* audio */
try{
  var AC=W.AudioContext||W.webkitAudioContext;
  if(AC){def(AC.prototype,'sampleRate',48000);}
  var AB=W.AudioBuffer&&W.AudioBuffer.prototype;
  if(AB){var g=AB.getChannelData;defFn(AB,'getChannelData',function(){var d=g.apply(this,arguments);
    try{for(var k=0;k<Math.min(64,d.length);k++)d[k]=d[k]+(rnd()-0.5)*C.audio;}catch(e){}
    return d;});}
}catch(e){}

/* WebRTC: strip private / mDNS candidates, optionally inject the proxy IP */
try{
  var PC=W.RTCPeerConnection||W.webkitRTCPeerConnection;
  if(PC){
    if(C.webrtc==='disabled'){def(W,'RTCPeerConnection',undefined);}
    else{
      var OrigPC=PC;
      var Wrapped=function(){var pc=new OrigPC(arguments[0]);
        try{
          var sdp=pc.setLocalDescription?pc.setLocalDescription.bind(pc):null;
          if(sdp)pc.setLocalDescription=function(d){
            if(d&&d.sdp){d.sdp=d.sdp.replace(/a=candidate:[^\\r\\n]*\\r?\\n/g,'');
              if(C.publicIp)d.sdp=d.sdp.replace(/(c=IN IP4 )\\S+/, '$1'+C.publicIp);}
            return sdp(d);
          };
        }catch(e){}
        return pc;};
      Wrapped.prototype=OrigPC.prototype;
      def(W,'RTCPeerConnection',Wrapped);
    }
  }
}catch(e){}

/* media devices, speech, notifications, connection, battery */
try{
  if(N.mediaDevices&&N.mediaDevices.enumerateDevices){
    defFn(N.mediaDevices,'enumerateDevices',function(){
      var out=[],i;
      for(i=0;i<C.media.audioinput;i++)out.push({deviceId:'a'+(i+1),kind:'audioinput',label:'Microphone '+(i+1),groupId:'g1'});
      for(i=0;i<C.media.audiooutput;i++)out.push({deviceId:'b'+(i+1),kind:'audiooutput',label:'Speaker '+(i+1),groupId:'g2'});
      for(i=0;i<C.media.videoinput;i++)out.push({deviceId:'v'+(i+1),kind:'videoinput',label:'Camera '+(i+1),groupId:'g3'});
      return Promise.resolve(out);
    });
  }
}catch(e){}
try{
  if(W.speechSynthesis&&W.speechSynthesis.getVoices){
    var gv=W.speechSynthesis.getVoices.bind(W.speechSynthesis);
    defFn(W.speechSynthesis,'getVoices',function(){var v=gv();return v.length?v:[{voiceURI:'Google US English',name:'Google US English',lang:C.locale,localService:false,default:true}]});
  }
}catch(e){}
try{
  if(W.Notification&&W.Notification.permission!==undefined){def(W.Notification,'permission','default');}
  if(N.connection){def(N.connection,'effectiveType','4g');def(N.connection,'downlink',10);def(N.connection,'rtt',50);}
  if(N.getBattery){var gb=N.getBattery;defFn(N,'getBattery',function(){return gb.call(N).then(function(b){try{def(b,'level',0.87);def(b,'charging',true);}catch(e){}return b;});});}
}catch(e){}

/* native-code mask for installed getters */
if(C.mask){
  try{
    defFn(Function.prototype,'toString',function(){
      if(patched.has(this))return 'function () { [native code] }';
      return nativeToString.call(this);
    });
  }catch(e){}
}

/* non-enumerable self-test hooks */
if(C.selfTest){
  try{
    Object.defineProperty(W,'__joeProbe',{configurable:true,enumerable:false,value:function(){
      var gl=null;
      try{var c=D.createElement('canvas');var g=c.getContext('webgl')||c.getContext('experimental-webgl');
        if(g){var e=g.getExtension('WEBGL_debug_renderer_info');gl={vendor:e?g.getParameter(e.UNMASKED_VENDOR_WEBGL):g.getParameter(7938),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(7937)};}}catch(e){}
      var can='ok';try{D.createElement('canvas').toDataURL();}catch(e){can='error';}
      return {
        ua:N.userAgent,platform:N.platform,oscpu:N.oscpu,vendor:N.vendor,
        cores:N.hardwareConcurrency,memory:N.deviceMemory,touch:N.maxTouchPoints,
        language:N.language,languages:N.languages.slice(),webdriver:N.webdriver,
        dnt:N.doNotTrack,brands:N.userAgentData?N.userAgentData.brands.map(function(b){return b.brand+':'+b.version}):[],
        chPlatform:N.userAgentData?N.userAgentData.platform:'',chMobile:N.userAgentData?N.userAgentData.mobile:false,
        zone:(new Intl.DateTimeFormat()).resolvedOptions().timeZone,offset:new Date().getTimezoneOffset(),
        screen:screen.width+'x'+screen.height,dpr:W.devicePixelRatio,outer:W.outerWidth+'x'+W.outerHeight,
        gl:gl,canvas:can,plugins:N.plugins?N.plugins.length:0,chrome:!!W.chrome,
        hasProbeKey:Object.keys(W).indexOf('__joeProbe')>=0,
        getterNative:(function(){try{var g=Object.getOwnPropertyDescriptor(N,'userAgent').get;return Function.prototype.toString.call(g).indexOf('[native code]')>=0;}catch(e){return false}})(),
        fonts:C.fonts.length,seed:C.seed,major:C.major
      };
    }});
    Object.defineProperty(W,'__joeVerify',{configurable:true,enumerable:false,value:function(){
      var p=W.__joeProbe(),f=[],total=0;
      function ck(name,ok){total++;if(!ok)f.push(name);}
      ck('userAgent',p.ua===C.ua);
      ck('platform',p.platform===C.platform);
      ck('webdriver',p.webdriver===false);
      ck('cores',p.cores===C.cores);
      ck('memory',p.memory===C.memory);
      ck('touch',p.touch===C.touch);
      ck('language',p.language===C.locale);
      ck('languages',p.languages[0]===C.locale);
      ck('timezone',p.zone===C.zone);
      ck('utcOffset',p.offset===C.offset);
      ck('screen',p.screen===C.screen.width+'x'+C.screen.height);
      ck('dpr',p.dpr===C.screen.dpr);
      ck('outer',p.outer===C.screen.width+'x'+C.screen.height);
      ck('clientHints',p.brands.some(function(b){return b.indexOf(':'+C.major)>=0}));
      ck('chPlatform',p.chPlatform===C.hint.platform);
      ck('chMobile',p.chMobile===!!C.hint.mobile);
      ck('chromeRuntime',p.chrome===true);
      ck('plugins',p.plugins>=1);
      ck('canvas',p.canvas==='ok');
      ck('nativeGetters',p.getterNative===true);
      ck('hiddenProbe',p.hasProbeKey===false);
      ck('webgl',!!p.gl&&p.gl.vendor===C.gpu.unmaskedVendor&&p.gl.renderer===C.gpu.unmaskedRenderer);
      return {passed:total-f.length,total:total,failures:f,probe:p};
    }});
  }catch(e){}
}
})();`;
}

/** Compact summary used by the UI and the desktop REST API. */
export function surfaces(spec: FingerprintSpec): FingerprintSurface[] {
  return [
    { key: 'ua', label: 'User agent', value: spec.userAgent.slice(0, 52) + '…', level: 'js' },
    { key: 'hints', label: 'Client hints', value: `${spec.uaClientHints.platform} · ${spec.chromeMajor}`, level: 'js' },
    { key: 'screen', label: 'Screen', value: `${spec.screen.width}×${spec.screen.height} @${spec.screen.dpr}`, level: 'js' },
    { key: 'gpu', label: 'WebGL', value: spec.gpu.renderer.slice(0, 52) + '…', level: 'js' },
    { key: 'tz', label: 'Timezone', value: `${spec.timezone} (UTC${spec.timezoneOffset > 0 ? '-' : '+'}${Math.abs(spec.timezoneOffset / 60)})`, level: 'js' },
    { key: 'locale', label: 'Locale', value: `${spec.locale} · ${spec.languages.slice(0, 2).join(', ')}`, level: 'js' },
    { key: 'hardware', label: 'Hardware', value: `${spec.cores} cores · ${spec.memoryGb} GB · ${spec.touchPoints} touch`, level: 'js' },
    { key: 'fonts', label: 'Fonts', value: `${spec.fonts.length} fonts from one device`, level: 'js' },
    { key: 'canvas', label: 'Canvas', value: `seeded noise ±${spec.canvasNoise.toFixed(4)}`, level: 'js' },
    { key: 'audio', label: 'Audio', value: `48 kHz · ±${spec.audioNoise.toFixed(5)}`, level: 'js' },
    { key: 'webrtc', label: 'WebRTC', value: spec.webrtcMode === 'replace' ? 'private candidates stripped' : spec.webrtcMode, level: 'js' },
    { key: 'tls', label: 'TLS / JA4', value: 'native Chromium stack', level: 'engine' },
    { key: 'h2', label: 'HTTP/2 order', value: 'native Chromium stack', level: 'engine' },
    { key: 'raster', label: 'Font raster', value: 'system fonts', level: 'engine' },
    { key: 'cdp', label: 'CDP side channels', value: 'engine level', level: 'engine' },
  ];
}
