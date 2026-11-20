import type { FingerprintSpec } from '@joe/core';

/**
 * Page-level fingerprint consistency payload.
 *
 * SCOPE: This is a JavaScript-level consistency layer installed on prototypes
 * before any page script executes. Electron injects it via CDP
 * (`Page.addScriptToEvaluateOnNewDocument` in the main world) and Android
 * injects it in `BrowserActivity` on every page load.
 *
 * With `selfTestHook`, two non-enumerable helpers are installed:
 *   window.__joeProbe()   -> observed surface values
 *   window.__joeVerify()  -> { passed, total, failures, probe }
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
    oscpu: spec.oscpu || '',
    vendor: spec.vendor ?? '',
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
var NProto=Object.getPrototypeOf(N);
var SProto=typeof Screen!=='undefined'?Screen.prototype:Object.getPrototypeOf(screen);
var nativeToString=Function.prototype.toString;
var patched=new WeakSet();
var fnNames=new WeakMap();
var SEED=(C.seed>>>0)||1;

function sHash(a,b,c){
  var h=(SEED^((a+1)*2654435761)^((b+1)*2246822519)^((c+1)*3266489917))>>>0;
  h^=h>>>15;h=Math.imul(h,2246822519)>>>0;
  h^=h>>>13;h=Math.imul(h,3266489917)>>>0;
  return (h^(h>>>16))>>>0;
}
function markFn(fn,name){
  try{Object.defineProperty(fn,'name',{configurable:true,value:name});}catch(e){}
  patched.add(fn);
  fnNames.set(fn,'function '+name+'() { [native code] }');
  return fn;
}
function def(o,k,v){
  if(!o)return false;
  try{
    var getter=markFn(function(){return v;},'get '+k);
    Object.defineProperty(o,k,{configurable:true,enumerable:true,get:getter});
    return true;
  }catch(e){return false;}
}
function defProto(proto,k,v){
  if(!proto)return false;
  try{
    var getter=markFn(function(){return v;},'get '+k);
    Object.defineProperty(proto,k,{configurable:true,enumerable:true,get:getter});
    return true;
  }catch(e){return false;}
}
function defFn(o,k,fn){
  if(!o)return false;
  try{
    markFn(fn,k);
    Object.defineProperty(o,k,{configurable:true,enumerable:false,value:fn,writable:true});
    return true;
  }catch(e){return false;}
}
function delProp(proto,inst,k){
  try{if(inst&&Object.prototype.hasOwnProperty.call(inst,k))delete inst[k];}catch(e){}
  try{if(proto&&k in proto)delete proto[k];}catch(e){}
  try{if(inst&&k in inst){defProto(proto,k,undefined);}}catch(e){}
}

var isFirefox=C.ua.indexOf('Firefox/')>=0;
var isWebKit=!isFirefox&&C.ua.indexOf('Chrome/')<0&&C.ua.indexOf('Edg/')<0&&C.ua.indexOf('EdgA/')<0;
var isChromium=!isFirefox&&!isWebKit;
var isBrave=isChromium&&C.hint&&Array.isArray(C.hint.brands)&&C.hint.brands.some(function(b){return b.brand==='Brave';});

/* navigator installed on Navigator.prototype (no instance shadow lies) */
defProto(NProto,'userAgent',C.ua);
defProto(NProto,'appVersion',C.ua.replace(/^Mozilla\\//,''));
defProto(NProto,'platform',C.platform);
defProto(NProto,'vendor',C.vendor);
defProto(NProto,'vendorSub','');
defProto(NProto,'productSub',isFirefox?'20100101':'20030107');
defProto(NProto,'hardwareConcurrency',C.cores);
defProto(NProto,'maxTouchPoints',C.touch);
defProto(NProto,'language',C.locale);
defProto(NProto,'languages',Object.freeze(C.langs.slice()));
defProto(NProto,'webdriver',false);
defProto(NProto,'pdfViewerEnabled',true);
defProto(NProto,'doNotTrack',C.dnt);
defProto(NProto,'cookieEnabled',true);
defProto(NProto,'onLine',true);

if(isFirefox){
  defProto(NProto,'oscpu',C.oscpu||'Windows NT 10.0; Win64; x64');
  delProp(NProto,N,'deviceMemory');
  delProp(NProto,N,'connection');
}else if(isWebKit){
  delProp(NProto,N,'oscpu');
  delProp(NProto,N,'deviceMemory');
  delProp(NProto,N,'connection');
}else{
  delProp(NProto,N,'oscpu');
  defProto(NProto,'deviceMemory',C.memory);
}

/* Client Hints & engine-specific globals */
try{
  if(isWebKit||isFirefox){
    delProp(NProto,N,'userAgentData');
    delProp(NProto,N,'brave');
    try{delete W.chrome;}catch(e){}
    if('chrome' in W&&W.chrome!==undefined){
      try{Object.defineProperty(W,'chrome',{configurable:true,enumerable:false,get:markFn(function(){return undefined;},'get chrome')});}catch(e){}
    }
  }else{
    var B=(C.hint.brands&&C.hint.brands.length)?C.hint.brands:[{brand:'Google Chrome',version:String(C.major)},{brand:'Chromium',version:String(C.major)}];
    var highEntropy=markFn(function(hints){
      var base={brands:this.brands,mobile:this.mobile,platform:this.platform};
      if(Array.isArray(hints)){
        if(hints.indexOf('platformVersion')>=0)base.platformVersion=C.hint.platformVersion;
        if(hints.indexOf('uaFullVersion')>=0)base.uaFullVersion=C.hint.fullVersion;
        if(hints.indexOf('fullVersionList')>=0)base.fullVersionList=B.map(function(b){return {brand:b.brand,version:C.hint.fullVersion||b.version};});
        if(hints.indexOf('architecture')>=0)base.architecture=C.hint.mobile?'arm':'x86';
        if(hints.indexOf('bitness')>=0)base.bitness='64';
        if(hints.indexOf('model')>=0)base.model='';
        if(hints.indexOf('wow64')>=0)base.wow64=false;
      }
      return Promise.resolve(base);
    },'getHighEntropyValues');
    var toJson=markFn(function(){return {brands:this.brands,mobile:this.mobile,platform:this.platform};},'toJSON');
    var uaDataObj={
      brands:B.map(function(b){return {brand:b.brand,version:b.version};}),
      mobile:!!C.hint.mobile,
      platform:C.hint.platform,
      getHighEntropyValues:highEntropy,
      toJSON:toJson
    };
    defProto(NProto,'userAgentData',uaDataObj);
    if(isBrave){
      defProto(NProto,'brave',{isBrave:markFn(function(){return Promise.resolve(true);},'isBrave')});
    }else{
      delProp(NProto,N,'brave');
    }
    if(!W.chrome){
      try{def(W,'chrome',{runtime:{},loadTimes:markFn(function(){return {};},'loadTimes'),csi:markFn(function(){return {};},'csi'),app:{isInstalled:false}});}catch(e){}
    }
  }
}catch(e){}

/* Plugins & mimeTypes */
try{
  var names=isFirefox
    ?['PDF Viewer','Firefox PDF Viewer']
    :isWebKit
      ?['WebKit built-in PDF']
      :['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','WebKit built-in PDF'];
  var pa=names.map(function(n){
    var o={name:n,filename:'internal-pdf-viewer',description:'Portable Document Format',length:1};
    Object.defineProperty(o,'item',{value:markFn(function(){return this;},'item')});
    Object.defineProperty(o,'namedItem',{value:markFn(function(){return this;},'namedItem')});
    return o;
  });
  defProto(NProto,'plugins',Object.assign(pa,{
    item:markFn(function(i){return this[i]||null;},'item'),
    namedItem:markFn(function(n){return this.find(function(p){return p.name===n;})||null;},'namedItem'),
    refresh:markFn(function(){},'refresh')
  }));
  defProto(NProto,'mimeTypes',Object.assign(['application/pdf','text/pdf'].map(function(m){
    return {type:m,description:'Portable Document Format',suffixes:'pdf',enabledPlugin:pa[0]};
  }),{
    item:markFn(function(i){return this[i]||null;},'item'),
    namedItem:markFn(function(n){return this.find(function(m){return m.type===n;})||null;},'namedItem')
  }));
}catch(e){}

/* Screen & window geometry */
try{
  var sVals={
    width:C.screen.width,height:C.screen.height,
    availWidth:C.avail.width,availHeight:C.avail.height,
    colorDepth:24,pixelDepth:24,availLeft:0,availTop:0
  };
  Object.keys(sVals).forEach(function(k){
    if(!defProto(SProto,k,sVals[k]))def(screen,k,sVals[k]);
  });
  def(W,'devicePixelRatio',C.screen.dpr);
  def(W,'outerWidth',C.screen.width);
  def(W,'outerHeight',C.screen.height);
  def(W,'screenX',0);def(W,'screenY',0);
  if(screen.orientation&&screen.orientation.type!==undefined){
    var oriProto=Object.getPrototypeOf(screen.orientation);
    defProto(oriProto,'type',C.hint.mobile?'portrait-primary':'landscape-primary');
  }
}catch(e){}

/* Media query pointer/hover coherence for mobile/tablet vs desktop */
try{
  if(typeof W.matchMedia==='function'){
    var origMM=W.matchMedia.bind(W);
    var isTouch=C.touch>0;
    defFn(W,'matchMedia',function matchMedia(query){
      var mql=origMM(query);
      var q=String(query||'').toLowerCase().replace(/\\s+/g,' ');
      var override=null;
      if(q.indexOf('hover: none')>=0||q.indexOf('any-hover: none')>=0)override=isTouch;
      else if(q.indexOf('hover: hover')>=0||q.indexOf('any-hover: hover')>=0)override=!isTouch;
      else if(q.indexOf('pointer: coarse')>=0||q.indexOf('any-pointer: coarse')>=0)override=isTouch;
      else if(q.indexOf('pointer: fine')>=0||q.indexOf('any-pointer: fine')>=0)override=!isTouch;
      if(override!==null){
        try{Object.defineProperty(mql,'matches',{configurable:true,get:markFn(function(){return override;},'get matches')});}catch(e){}
      }
      return mql;
    });
  }
}catch(e){}

/* Timezone & locale coherence (Date + Intl.DateTimeFormat format + resolvedOptions) */
try{
  var OrigIntl=Intl.DateTimeFormat;
  function WrappedDTF(locales,options){
    var loc=locales===undefined?C.locale:locales;
    var opts=options?Object.assign({},options):{};
    if(!opts.timeZone)opts.timeZone=C.zone;
    var inst=new OrigIntl(loc,opts);
    var ro=inst.resolvedOptions.bind(inst);
    inst.resolvedOptions=markFn(function(){
      var r=ro();
      r.timeZone=opts.timeZone||C.zone;
      if(locales===undefined)r.locale=C.locale;
      return r;
    },'resolvedOptions');
    return inst;
  }
  markFn(WrappedDTF,'DateTimeFormat');
  WrappedDTF.supportedLocalesOf=OrigIntl.supportedLocalesOf?markFn(function(locales,options){
    return OrigIntl.supportedLocalesOf(locales,options);
  },'supportedLocalesOf'):undefined;
  try{WrappedDTF.prototype=OrigIntl.prototype;}catch(e){}
  Object.defineProperty(Intl,'DateTimeFormat',{configurable:true,writable:true,value:WrappedDTF});

  defFn(Date.prototype,'getTimezoneOffset',function getTimezoneOffset(){return C.offset;});
  var origToLoc=Date.prototype.toLocaleString;
  var origToLocD=Date.prototype.toLocaleDateString;
  var origToLocT=Date.prototype.toLocaleTimeString;
  function patchLocaleDate(orig,name){
    defFn(Date.prototype,name,function(locales,options){
      var loc=locales===undefined?C.locale:locales;
      var opts=options?Object.assign({},options):{};
      if(!opts.timeZone)opts.timeZone=C.zone;
      return orig.call(this,loc,opts);
    });
  }
  patchLocaleDate(origToLoc,'toLocaleString');
  patchLocaleDate(origToLocD,'toLocaleDateString');
  patchLocaleDate(origToLocT,'toLocaleTimeString');
}catch(e){}

/* Deterministic, idempotent Canvas spoofing */
try{
  var toDataURL=HTMLCanvasElement.prototype.toDataURL;
  var toBlob=HTMLCanvasElement.prototype.toBlob;
  var getImageData=CanvasRenderingContext2D.prototype.getImageData;
  function perturbPixels(data,w,h){
    if(!data||!data.length)return data;
    var step=Math.max(4,Math.floor(data.length/48));
    var applied=0;
    for(var i=0;i<data.length-3;i+=step){
      if(data[i+3]>0){
        var ch=(sHash(i,w,h)%3);
        var idx=i+ch;
        var delta=(sHash(idx,w,h)&1)?1:-1;
        var v=data[idx];
        data[idx]=v===0?1:v===255?254:v+delta;
        applied++;
      }
    }
    if(applied===0){
      for(var j=0;j<Math.min(data.length-3,16384);j+=4){
        if(data[j+3]>0){
          var v0=data[j];
          data[j]=v0===0?1:v0===255?254:v0+((sHash(j,w,h)&1)?1:-1);
          break;
        }
      }
    }
    return data;
  }
  function cloneSpoofCanvas(src){
    var w=src.width|0,h=src.height|0;
    if(w<=0||h<=0)return src;
    var copy=D.createElement('canvas');
    copy.width=w;copy.height=h;
    var ctx=copy.getContext('2d');
    if(!ctx)return src;
    ctx.drawImage(src,0,0);
    var img=getImageData.call(ctx,0,0,w,h);
    perturbPixels(img.data,w,h);
    ctx.putImageData(img,0,0);
    return copy;
  }
  defFn(CanvasRenderingContext2D.prototype,'getImageData',function getImageDataPatched(sx,sy,sw,sh){
    var img=getImageData.apply(this,arguments);
    try{perturbPixels(img.data,sw|0,sh|0);}catch(e){}
    return img;
  });
  defFn(HTMLCanvasElement.prototype,'toDataURL',function toDataURLPatched(){
    try{
      if(this.getContext('2d'))return toDataURL.apply(cloneSpoofCanvas(this),arguments);
    }catch(e){}
    return toDataURL.apply(this,arguments);
  });
  defFn(HTMLCanvasElement.prototype,'toBlob',function toBlobPatched(cb){
    var args=arguments;
    try{
      if(this.getContext('2d'))return toBlob.call(cloneSpoofCanvas(this),function(b){cb&&cb(b);},args[1],args[2]);
    }catch(e){}
    return toBlob.call(this,function(b){cb&&cb(b);},args[1],args[2]);
  });
  if(typeof OffscreenCanvas!=='undefined'&&OffscreenCanvas.prototype.convertToBlob){
    var origConv=OffscreenCanvas.prototype.convertToBlob;
    defFn(OffscreenCanvas.prototype,'convertToBlob',function convertToBlobPatched(){
      return origConv.apply(this,arguments);
    });
  }
}catch(e){}

/* WebGL: vendor, renderer and hardware limits */
try{
  function patchGL(proto){
    if(!proto)return;
    var gp=proto.getParameter;
    defFn(proto,'getParameter',function getParameter(p){
      if(p===37445)return C.gpu.unmaskedVendor||C.glVendor;
      if(p===37446)return C.gpu.unmaskedRenderer||C.glRenderer;
      if(p===7938)return C.glVendor;
      if(p===7937)return C.glRenderer;
      if(p===7936)return isFirefox?'Mozilla':'WebKit WebGL';
      if(p===3379)return C.gl.maxTextureSize;
      if(p===34024)return C.gl.maxRenderbufferSize;
      if(p===3386)return new Int32Array(C.gl.maxViewport);
      if(p===34921)return C.gl.maxVertexAttribs;
      if(p===35724)return isFirefox?'WebGL GLSL ES 3.00':'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)';
      return gp.apply(this,arguments);
    });
    var ge=proto.getExtension;
    defFn(proto,'getExtension',function getExtension(name){
      if(String(name).toLowerCase()==='webgl_debug_renderer_info')return {UNMASKED_VENDOR_WEBGL:37445,UNMASKED_RENDERER_WEBGL:37446};
      var r=ge.apply(this,arguments);
      if(r&&typeof r.getParameter==='function'){
        var rp=r.getParameter;
        r.getParameter=markFn(function(p){
          if(p===37445)return C.gpu.unmaskedVendor||C.glVendor;
          if(p===37446)return C.gpu.unmaskedRenderer||C.glRenderer;
          return rp.apply(this,arguments);
        },'getParameter');
      }
      return r;
    });
  }
  patchGL(W.WebGLRenderingContext&&W.WebGLRenderingContext.prototype);
  patchGL(W.WebGL2RenderingContext&&W.WebGL2RenderingContext.prototype);
}catch(e){}

/* Idempotent AudioBuffer perturbation */
try{
  var AC=W.AudioContext||W.webkitAudioContext;
  if(AC){defProto(AC.prototype,'sampleRate',48000);}
  var AB=W.AudioBuffer&&W.AudioBuffer.prototype;
  if(AB){
    var g=AB.getChannelData;
    var seenBuf=new WeakSet();
    defFn(AB,'getChannelData',function getChannelData(ch){
      var d=g.apply(this,arguments);
      try{
        if(!seenBuf.has(this)){
          seenBuf.add(this);
          var lim=Math.min(64,d.length);
          for(var k=0;k<lim;k++){
            d[k]=d[k]+((sHash(SEED,ch|0,k)/4294967296)-0.5)*C.audio;
          }
        }
      }catch(e){}
      return d;
    });
  }
}catch(e){}

/* WebRTC: strip private / mDNS ICE candidates & scrub SDP */
try{
  var PC=W.RTCPeerConnection||W.webkitRTCPeerConnection;
  if(PC){
    if(C.webrtc==='disabled'){
      def(W,'RTCPeerConnection',undefined);
      if('webkitRTCPeerConnection' in W)def(W,'webkitRTCPeerConnection',undefined);
    }else{
      var OrigPC=PC;
      var scrubSdp=function(sdp){
        if(!sdp)return sdp;
        var lines=sdp.split(/\\r?\\n/).filter(function(ln){
          if(ln.indexOf('a=candidate:')!==0)return true;
          return !/\\b(10\\.\\d+|192\\.168\\.\\d+|172\\.(1[6-9]|2\\d|3[01])\\.\\d+|169\\.254\\.\\d+|fe80:|fd[0-9a-f]{2}:|[^\\s]+\\.local)\\b/i.test(ln);
        });
        var out=lines.join('\\r\\n');
        if(C.publicIp){
          out=out.replace(/(c=IN IP4 )\\S+/g,'$1'+C.publicIp);
        }
        return out;
      };
      var isPrivateCand=function(cStr){
        if(!cStr)return false;
        return /\\b(10\\.\\d+|192\\.168\\.\\d+|172\\.(1[6-9]|2\\d|3[01])\\.\\d+|169\\.254\\.\\d+|fe80:|fd[0-9a-f]{2}:|[^\\s]+\\.local)\\b/i.test(cStr);
      };
      var WrappedPC=function RTCPeerConnection(){
        var pc=new OrigPC(arguments[0]);
        try{
          var origSLD=pc.setLocalDescription?pc.setLocalDescription.bind(pc):null;
          if(origSLD)pc.setLocalDescription=markFn(function(d){
            if(d&&d.sdp)d=Object.assign({},d,{sdp:scrubSdp(d.sdp)});
            return origSLD(d);
          },'setLocalDescription');
          var origCO=pc.createOffer?pc.createOffer.bind(pc):null;
          if(origCO)pc.createOffer=markFn(function(){
            return origCO.apply(pc,arguments).then(function(d){
              if(d&&d.sdp)return Object.assign({},d,{sdp:scrubSdp(d.sdp)});
              return d;
            });
          },'createOffer');
          var origAEL=pc.addEventListener.bind(pc);
          pc.addEventListener=markFn(function(type,listener,opts){
            if(type==='icecandidate'&&typeof listener==='function'){
              var wrapL=function(ev){
                if(ev&&ev.candidate&&isPrivateCand(ev.candidate.candidate))return;
                listener.call(this,ev);
              };
              return origAEL(type,wrapL,opts);
            }
            return origAEL(type,listener,opts);
          },'addEventListener');
        }catch(e){}
        return pc;
      };
      markFn(WrappedPC,'RTCPeerConnection');
      WrappedPC.prototype=OrigPC.prototype;
      def(W,'RTCPeerConnection',WrappedPC);
    }
  }
}catch(e){}

/* Media devices, speech, notifications, connection, battery */
try{
  if(N.mediaDevices&&N.mediaDevices.enumerateDevices){
    defFn(N.mediaDevices,'enumerateDevices',function enumerateDevices(){
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
    defFn(W.speechSynthesis,'getVoices',function getVoices(){
      var v=gv();
      return v.length?v:[{voiceURI:'Google US English',name:'Google US English',lang:C.locale,localService:false,default:true}];
    });
  }
}catch(e){}
try{
  if(W.Notification&&W.Notification.permission!==undefined){def(W.Notification,'permission','default');}
  if(!isFirefox&&!isWebKit&&N.connection){
    var connProto=Object.getPrototypeOf(N.connection);
    defProto(connProto,'effectiveType','4g');
    defProto(connProto,'downlink',10);
    defProto(connProto,'rtt',50);
  }
  if(N.getBattery){
    var gb=N.getBattery;
    defFn(N,'getBattery',function getBattery(){
      return gb.call(N).then(function(b){try{def(b,'level',0.87);def(b,'charging',true);}catch(e){}return b;});
    });
  }
}catch(e){}

/* Native-code mask for installed functions & getters */
if(C.mask){
  try{
    var tsFn=function toString(){
      if(patched.has(this))return fnNames.get(this)||'function () { [native code] }';
      return nativeToString.call(this);
    };
    markFn(tsFn,'toString');
    Object.defineProperty(Function.prototype,'toString',{configurable:true,enumerable:false,writable:true,value:tsFn});
  }catch(e){}
}

/* Non-enumerable self-test hooks */
if(C.selfTest){
  try{
    Object.defineProperty(W,'__joeProbe',{configurable:true,enumerable:false,value:function(){
      var gl=null;
      try{
        var c=D.createElement('canvas');
        var g=c.getContext('webgl')||c.getContext('experimental-webgl');
        if(g){
          var e=g.getExtension('WEBGL_debug_renderer_info');
          gl={vendor:e?g.getParameter(e.UNMASKED_VENDOR_WEBGL):g.getParameter(7938),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(7937)};
        }
      }catch(e){}
      var can='ok',canvasStable=false;
      try{
        var tc=D.createElement('canvas');tc.width=180;tc.height=48;
        var ctx=tc.getContext('2d',{willReadFrequently:true});
        ctx.fillStyle='#f60';ctx.fillRect(10,10,80,22);
        ctx.fillStyle='#069';ctx.font='14px Arial';ctx.fillText('Joe-Verify-Canvas',14,28);
        var u1=tc.toDataURL(),u2=tc.toDataURL();
        var d1=ctx.getImageData(0,0,180,48).data,d2=ctx.getImageData(0,0,180,48).data;
        canvasStable=(u1===u2)&&(d1[48*4]===d2[48*4]);
      }catch(e){can='error';}
      var getterNative=false;
      try{
        var desc=Object.getOwnPropertyDescriptor(NProto,'userAgent')||Object.getOwnPropertyDescriptor(N,'userAgent');
        getterNative=!!(desc&&desc.get&&Function.prototype.toString.call(desc.get).indexOf('[native code]')>=0);
      }catch(e){}
      var noInstanceShadow=false;
      try{
        noInstanceShadow=!Object.prototype.hasOwnProperty.call(N,'userAgent')&&!Object.prototype.hasOwnProperty.call(N,'platform');
      }catch(e){}
      return {
        ua:N.userAgent,platform:N.platform,oscpu:N.oscpu,vendor:N.vendor,
        cores:N.hardwareConcurrency,memory:N.deviceMemory,touch:N.maxTouchPoints,
        language:N.language,languages:N.languages.slice(),webdriver:N.webdriver,
        dnt:N.doNotTrack,brands:N.userAgentData?N.userAgentData.brands.map(function(b){return b.brand+':'+b.version;}):[],
        chPlatform:N.userAgentData?N.userAgentData.platform:'',chMobile:N.userAgentData?N.userAgentData.mobile:false,
        zone:(new Intl.DateTimeFormat()).resolvedOptions().timeZone,offset:new Date().getTimezoneOffset(),
        screen:screen.width+'x'+screen.height,dpr:W.devicePixelRatio,outer:W.outerWidth+'x'+W.outerHeight,
        gl:gl,canvas:can,canvasStable:canvasStable,plugins:N.plugins?N.plugins.length:0,
        chrome:!!W.chrome,brave:!!N.brave,
        hasProbeKey:Object.keys(W).indexOf('__joeProbe')>=0,
        getterNative:getterNative,noInstanceShadow:noInstanceShadow,
        fonts:C.fonts.length,seed:SEED,major:C.major,
        isFirefox:isFirefox,isWebKit:isWebKit,isBrave:isBrave
      };
    }});
    Object.defineProperty(W,'__joeVerify',{configurable:true,enumerable:false,value:function(){
      var p=W.__joeProbe(),f=[],total=0;
      function ck(name,ok){total++;if(!ok)f.push(name);}
      ck('userAgent',p.ua===C.ua);
      ck('platform',p.platform===C.platform);
      ck('vendor',p.vendor===C.vendor);
      ck('webdriver',p.webdriver===false);
      ck('cores',p.cores===C.cores);
      ck('touch',p.touch===C.touch);
      ck('language',p.language===C.locale);
      ck('languages',p.languages[0]===C.locale);
      ck('timezone',p.zone===C.zone);
      ck('utcOffset',p.offset===C.offset);
      ck('screen',p.screen===C.screen.width+'x'+C.screen.height);
      ck('dpr',p.dpr===C.screen.dpr);
      ck('outer',p.outer===C.screen.width+'x'+C.screen.height);
      if(isWebKit||isFirefox){
        ck('noClientHints',p.brands.length===0&&!N.userAgentData);
        ck('noChromeRuntime',p.chrome===false);
        ck('noDeviceMemory',p.memory===undefined);
        if(isFirefox)ck('oscpu',typeof p.oscpu==='string'&&p.oscpu.length>0);
        else ck('noOscpu',p.oscpu===undefined);
      }else{
        ck('memory',p.memory===C.memory);
        ck('clientHints',p.brands.some(function(b){return b.indexOf(':'+C.major)>=0;}));
        ck('chPlatform',p.chPlatform===C.hint.platform);
        ck('chMobile',p.chMobile===!!C.hint.mobile);
        ck('chromeRuntime',p.chrome===true);
        ck('noOscpu',p.oscpu===undefined);
        if(isBrave)ck('braveApi',p.brave===true);
      }
      ck('plugins',p.plugins>=1);
      ck('canvas',p.canvas==='ok');
      ck('canvasStable',p.canvasStable===true);
      ck('nativeGetters',p.getterNative===true);
      ck('noInstanceShadow',p.noInstanceShadow===true);
      ck('hiddenProbe',p.hasProbeKey===false);
      ck('webgl',!!p.gl&&p.gl.vendor===(C.gpu.unmaskedVendor||C.glVendor)&&p.gl.renderer===(C.gpu.unmaskedRenderer||C.glRenderer));
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

export {
  humanPasteSchedule, scheduleDuration, describeSchedule,
  type Keystroke, type TypingOptions,
} from './humanize';
