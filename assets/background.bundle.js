/*! 4eNEXT to owlbear · background.bundle.js  (v2.5.1)
 * ---------------------------------------------------------------------------
 * 这是后台页唯一加载的脚本：纯「经典脚本」，没有 type="module"，没有 import/export，
 * 不依赖任何 CDN。内容是：
 *   1) vendor/obr-sdk.js —— @owlbear-rodeo/sdk 3.1.0（esm.sh 打包），去掉末尾的 export{}
 *   2) assets/background.core.js —— 右键菜单 / 工具栏 / 浮动按钮 / token 血条 / 自诊断
 *
 * 不要手改本文件。改逻辑请改 assets/background.core.js，然后：
 *     node dev/build-background.mjs
 * 生成时间：2026-11-27T09:41:53.323Z
 * --------------------------------------------------------------------------- */
(function () {
"use strict";

/* ==================== 1/2  SDK（vendor/obr-sdk.js） ==================== */
/* esm.sh - @owlbear-rodeo/sdk@3.1.0 */
var be=class{__unenv__=!0;_currentStore;_enterStore;_enabled=!0;getStore(){return this._currentStore??this._enterStore}disable(){this._enabled=!1}enable(){this._enabled=!0}enterWith(t){this._enterStore=t}run(t,e,...s){this._currentStore=t;let i=e(...s);return this._currentStore=void 0,i}exit(t,...e){let s=this._currentStore;this._currentStore=void 0;let i=t(...e);return this._currentStore=s,i}static snapshot(){throw new Error("[unenv] `AsyncLocalStorage.snapshot` is not implemented!")}},rn=globalThis.AsyncLocalStorage||be,Me=Symbol("init"),Le=Symbol("before"),we=Symbol("after"),Pe=Symbol("destroy"),De=Symbol("promiseResolve"),on=class{__unenv__=!0;_enabled=!1;_callbacks={};constructor(t={}){this._callbacks=t}enable(){return this._enabled=!0,this}disable(){return this._enabled=!1,this}get[Me](){return this._callbacks.init}get[Le](){return this._callbacks.before}get[we](){return this._callbacks.after}get[Pe](){return this._callbacks.destroy}get[De](){return this._callbacks.promiseResolve}};var ke=function(){return 0};var ln=Object.assign(Object.create(null),{NONE:0,DIRHANDLE:1,DNSCHANNEL:2,ELDHISTOGRAM:3,FILEHANDLE:4,FILEHANDLECLOSEREQ:5,BLOBREADER:6,FSEVENTWRAP:7,FSREQCALLBACK:8,FSREQPROMISE:9,GETADDRINFOREQWRAP:10,GETNAMEINFOREQWRAP:11,HEAPSNAPSHOT:12,HTTP2SESSION:13,HTTP2STREAM:14,HTTP2PING:15,HTTP2SETTINGS:16,HTTPINCOMINGMESSAGE:17,HTTPCLIENTREQUEST:18,JSSTREAM:19,JSUDPWRAP:20,MESSAGEPORT:21,PIPECONNECTWRAP:22,PIPESERVERWRAP:23,PIPEWRAP:24,PROCESSWRAP:25,PROMISE:26,QUERYWRAP:27,QUIC_ENDPOINT:28,QUIC_LOGSTREAM:29,QUIC_PACKET:30,QUIC_SESSION:31,QUIC_STREAM:32,QUIC_UDP:33,SHUTDOWNWRAP:34,SIGNALWRAP:35,STATWATCHER:36,STREAMPIPE:37,TCPCONNECTWRAP:38,TCPSERVERWRAP:39,TCPWRAP:40,TTYWRAP:41,UDPSENDWRAP:42,UDPWRAP:43,SIGINTWATCHDOG:44,WORKER:45,WORKERHEAPSNAPSHOT:46,WRITEWRAP:47,ZLIB:48,CHECKPRIMEREQUEST:49,PBKDF2REQUEST:50,KEYPAIRGENREQUEST:51,KEYGENREQUEST:52,KEYEXPORTREQUEST:53,CIPHERREQUEST:54,DERIVEBITSREQUEST:55,HASHREQUEST:56,RANDOMBYTESREQUEST:57,RANDOMPRIMEREQUEST:58,SCRYPTREQUEST:59,SIGNREQUEST:60,TLSWRAP:61,VERIFYREQUEST:62}),Ge=100,Ue=class{__unenv__=!0;type;_asyncId;_triggerAsyncId;constructor(t,e=ke()){this.type=t,this._asyncId=-1*Ge++,this._triggerAsyncId=typeof e=="number"?e:e?.triggerAsyncId}static bind(t,e,s){return new gt(e??"anonymous").bind(t)}bind(t,e){let s=(...i)=>this.runInAsyncScope(t,e,...i);return s.asyncResource=this,s}runInAsyncScope(t,e,...s){return t.apply(e,s)}emitDestroy(){return this}asyncId(){return this._asyncId}triggerAsyncId(){return this._triggerAsyncId}},gt=globalThis.AsyncResource||Ue;function We(t){return new Error(`[unenv] ${t} is not implemented yet!`)}function Ct(t){return Object.assign(()=>{throw We(t)},{__unenv__:!0})}var F=10,Ve=Object.getPrototypeOf(Object.getPrototypeOf(async function*(){}).prototype),ne=(t,e)=>t,Y=Error,He=Error,G=Error,ut=Error,je=Error,Rt=Symbol.for("nodejs.rejection"),w=Symbol.for("kCapture"),Ot=Symbol.for("events.errorMonitor"),j=Symbol.for("shapeMode"),ht=Symbol.for("events.maxEventTargetListeners"),Fe=Symbol.for("kEnhanceStackBeforeInspector"),Ye=Symbol.for("nodejs.watermarkData"),Tt=Symbol.for("kEventEmitter"),k=Symbol.for("kAsyncResource"),ze=Symbol.for("kFirstEventParam"),Bt=Symbol.for("kResistStopPropagation"),Zt=Symbol.for("events.maxEventTargetListenersWarned"),xt=class J{_events=void 0;_eventsCount=0;_maxListeners=F;[w]=!1;[j]=!1;static captureRejectionSymbol=Rt;static errorMonitor=Ot;static kMaxEventTargetListeners=ht;static kMaxEventTargetListenersWarned=Zt;static usingDomains=!1;static get on(){return $e}static get once(){return Xe}static get getEventListeners(){return Ze}static get getMaxListeners(){return qe}static get addAbortListener(){return re}static get EventEmitterAsyncResource(){return Ke}static get EventEmitter(){return J}static setMaxListeners(e=F,...s){if(s.length===0)F=e;else for(let i of s)if(le(i))i[ht]=e,i[Zt]=!1;else if(typeof i.setMaxListeners=="function")i.setMaxListeners(e);else throw new G("eventTargets",["EventEmitter","EventTarget"],i)}static listenerCount(e,s){if(typeof e.listenerCount=="function")return e.listenerCount(s);J.prototype.listenerCount.call(e,s)}static init(){throw new Error("EventEmitter.init() is not implemented.")}static get captureRejections(){return this[w]}static set captureRejections(e){this[w]=e}static get defaultMaxListeners(){return F}static set defaultMaxListeners(e){F=e}constructor(e){this._events===void 0||this._events===Object.getPrototypeOf(this)._events?(this._events={__proto__:null},this._eventsCount=0,this[j]=!1):this[j]=!0,this._maxListeners=this._maxListeners||void 0,e?.captureRejections?this[w]=!!e.captureRejections:this[w]=J.prototype[w]}setMaxListeners(e){return this._maxListeners=e,this}getMaxListeners(){return It(this)}emit(e,...s){let i=e==="error",r=this._events;if(r!==void 0)i&&r[Ot]!==void 0&&this.emit(Ot,...s),i=i&&r.error===void 0;else if(!i)return!1;if(i){let o;if(s.length>0&&(o=s[0]),o instanceof Error){try{let a={};Error.captureStackTrace?.(a,J.prototype.emit),Object.defineProperty(o,Fe,{__proto__:null,value:Function.prototype.bind(ts,this,o,a),configurable:!0})}catch{}throw o}let h;try{h=ne(o)}catch{h=o}let c=new He(h);throw c.context=o,c}let n=r[e];if(n===void 0)return!1;if(typeof n=="function"){let o=n.apply(this,s);o!=null&&te(this,o,e,s)}else{let o=n.length,h=Nt(n);for(let c=0;c<o;++c){let a=h[c].apply(this,s);a!=null&&te(this,a,e,s)}}return!0}addListener(e,s){return ee(this,e,s,!1),this}on(e,s){return this.addListener(e,s)}prependListener(e,s){return ee(this,e,s,!0),this}once(e,s){return this.on(e,se(this,e,s)),this}prependOnceListener(e,s){return this.prependListener(e,se(this,e,s)),this}removeListener(e,s){let i=this._events;if(i===void 0)return this;let r=i[e];if(r===void 0)return this;if(r===s||r.listener===s)this._eventsCount-=1,this[j]?i[e]=void 0:this._eventsCount===0?this._events={__proto__:null}:(delete i[e],i.removeListener&&this.emit("removeListener",e,r.listener||s));else if(typeof r!="function"){let n=-1;for(let o=r.length-1;o>=0;o--)if(r[o]===s||r[o].listener===s){n=o;break}if(n<0)return this;n===0?r.shift():ns(r,n),r.length===1&&(i[e]=r[0]),i.removeListener!==void 0&&this.emit("removeListener",e,s)}return this}off(e,s){return this.removeListener(e,s)}removeAllListeners(e){let s=this._events;if(s===void 0)return this;if(s.removeListener===void 0)return arguments.length===0?(this._events={__proto__:null},this._eventsCount=0):s[e]!==void 0&&(--this._eventsCount===0?this._events={__proto__:null}:delete s[e]),this[j]=!1,this;if(arguments.length===0){for(let r of Reflect.ownKeys(s))r!=="removeListener"&&this.removeAllListeners(r);return this.removeAllListeners("removeListener"),this._events={__proto__:null},this._eventsCount=0,this[j]=!1,this}let i=s[e];if(typeof i=="function")this.removeListener(e,i);else if(i!==void 0)for(let r=i.length-1;r>=0;r--)this.removeListener(e,i[r]);return this}listeners(e){return ie(this,e,!0)}rawListeners(e){return ie(this,e,!1)}eventNames(){return this._eventsCount>0?Reflect.ownKeys(this._events):[]}listenerCount(e,s){let i=this._events;if(i!==void 0){let r=i[e];if(typeof r=="function")return s!=null?s===r||s===r.listener?1:0:1;if(r!==void 0){if(s!=null){let n=0;for(let o=0,h=r.length;o<h;o++)(r[o]===s||r[o].listener===s)&&n++;return n}return r.length}}return 0}},Ke=class extends xt{constructor(t){let e;typeof t=="string"?(e=t,t=void 0):e=t?.name||new.target.name,super(t),this[k]=new Qe(this,e,t)}emit(t,...e){if(this[k]===void 0)throw new Y("EventEmitterAsyncResource");let{asyncResource:s}=this;return Array.prototype.unshift(e,super.emit,this,t),Reflect.apply(s.runInAsyncScope,s,e)}emitDestroy(){if(this[k]===void 0)throw new Y("EventEmitterAsyncResource");this.asyncResource.emitDestroy()}get asyncId(){if(this[k]===void 0)throw new Y("EventEmitterAsyncResource");return this.asyncResource.asyncId()}get triggerAsyncId(){if(this[k]===void 0)throw new Y("EventEmitterAsyncResource");return this.asyncResource.triggerAsyncId()}get asyncResource(){if(this[k]===void 0)throw new Y("EventEmitterAsyncResource");return this[k]}},Qe=class extends gt{constructor(t,e,s){super(e,s),this[Tt]=t}get eventEmitter(){if(this[Tt]===void 0)throw new Y("EventEmitterReferencingAsyncResource");return this[Tt]}},$e=function(t,e,s={}){let i=s.signal;if(i?.aborted)throw new ut(void 0,{cause:i?.reason});let r=s.highWaterMark??s.highWatermark??Number.MAX_SAFE_INTEGER,n=s.lowWaterMark??s.lowWatermark??1,o=new Jt,h=new Jt,c=!1,a=null,l=!1,u=0,f=Object.setPrototypeOf({next(){if(u){let _=o.shift();return u--,c&&u<n&&(t.resume?.(),c=!1),Promise.resolve(At(_,!1))}if(a){let _=Promise.reject(a);return a=null,_}return l?I():new Promise(function(_,R){h.push({resolve:_,reject:R})})},return(){return I()},throw(_){if(!_||!(_ instanceof Error))throw new G("EventEmitter.AsyncIterator","Error",_);y(_)},[Symbol.asyncIterator](){return this},[Ye]:{get size(){return u},get low(){return n},get high(){return r},get isPaused(){return c}}},Ve),{addEventListener:E,removeAll:p}=is();E(t,e,s[ze]?d:function(..._){return d(_)}),e!=="error"&&typeof t.on=="function"&&E(t,"error",y);let O=s?.close;if(O?.length)for(let _ of O)E(t,_,I);let m=i?re(i,g):null;return f;function g(){y(new ut(void 0,{cause:i?.reason}))}function d(_){h.isEmpty()?(u++,!c&&u>r&&(c=!0,t.pause?.()),o.push(_)):h.shift().resolve(At(_,!1))}function y(_){h.isEmpty()?a=_:h.shift().reject(_),I()}function I(){m?.[Symbol.dispose](),p(),l=!0;let _=At(void 0,!0);for(;!h.isEmpty();)h.shift().resolve(_);return Promise.resolve(_)}},Xe=async function(t,e,s={}){let i=s?.signal;if(i?.aborted)throw new ut(void 0,{cause:i?.reason});return new Promise((r,n)=>{let o=l=>{typeof t.removeListener=="function"&&t.removeListener(e,h),i!=null&&tt(i,"abort",a),n(l)},h=(...l)=>{typeof t.removeListener=="function"&&t.removeListener("error",o),i!=null&&tt(i,"abort",a),r(l)},c={__proto__:null,once:!0,[Bt]:!0};St(t,e,h,c),e!=="error"&&typeof t.once=="function"&&t.once("error",o);function a(){tt(t,e,h),tt(t,"error",o),n(new ut(void 0,{cause:i?.reason}))}i!=null&&St(i,"abort",a,{__proto__:null,once:!0,[Bt]:!0})})},re=function(t,e){if(t===void 0)throw new G("signal","AbortSignal",t);let s;return t.aborted?queueMicrotask(()=>e()):(t.addEventListener("abort",e,{__proto__:null,once:!0,[Bt]:!0}),s=()=>{t.removeEventListener("abort",e)}),{__proto__:null,[Symbol.dispose](){s?.()}}},Ze=function(t,e){if(typeof t.listeners=="function")return t.listeners(e);if(le(t)){let s=t[kEvents].get(e),i=[],r=s?.next;for(;r?.listener!==void 0;){let n=r.listener?.deref?r.listener.deref():r.listener;i.push(n),r=r.next}return i}throw new G("emitter",["EventEmitter","EventTarget"],t)},qe=function(t){if(typeof t?.getMaxListeners=="function")return It(t);if(t?.[ht])return t[ht];throw new G("emitter",["EventEmitter","EventTarget"],t)},oe=2048,vt=oe-1,qt=class{bottom;top;list;next;constructor(){this.bottom=0,this.top=0,this.list=new Array(oe),this.next=null}isEmpty(){return this.top===this.bottom}isFull(){return(this.top+1&vt)===this.bottom}push(t){this.list[this.top]=t,this.top=this.top+1&vt}shift(){let t=this.list[this.bottom];return t===void 0?null:(this.list[this.bottom]=void 0,this.bottom=this.bottom+1&vt,t)}},Jt=class{head;tail;constructor(){this.head=this.tail=new qt}isEmpty(){return this.head.isEmpty()}push(t){this.head.isFull()&&(this.head=this.head.next=new qt),this.head.push(t)}shift(){let t=this.tail,e=t.shift();return t.isEmpty()&&t.next!==null&&(this.tail=t.next,t.next=null),e}};function le(t){return typeof t?.addEventListener=="function"}function te(t,e,s,i){if(t[w])try{let r=e.then;typeof r=="function"&&r.call(e,void 0,function(n){setTimeout(Je,0,t,n,s,i)})}catch(r){t.emit("error",r)}}function Je(t,e,s,i){if(typeof t[Rt]=="function")t[Rt](e,s,...i);else{let r=t[w];try{t[w]=!1,t.emit("error",e)}finally{t[w]=r}}}function It(t){return t._maxListeners===void 0?F:t._maxListeners}function ts(t,e){let s="";try{let{name:n}=this.constructor;n!=="EventEmitter"&&(s=` on ${n} instance`)}catch{}let i=`
Emitted 'error' event${s} at:
`,r=(e.stack||"").split(`
`).slice(1);return t.stack+i+r.join(`
`)}function ee(t,e,s,i){let r,n,o;if(n=t._events,n===void 0?(n=t._events={__proto__:null},t._eventsCount=0):(n.newListener!==void 0&&(t.emit("newListener",e,s.listener??s),n=t._events),o=n[e]),o===void 0)n[e]=s,++t._eventsCount;else if(typeof o=="function"?o=n[e]=i?[s,o]:[o,s]:i?o.unshift(s):o.push(s),r=It(t),r>0&&o.length>r&&!o.warned){o.warned=!0;let h=new je(`Possible EventEmitter memory leak detected. ${o.length} ${String(e)} listeners added to ${ne(t,{depth:-1})}. MaxListeners is ${r}. Use emitter.setMaxListeners() to increase limit`,{name:"MaxListenersExceededWarning",emitter:t,type:e,count:o.length});console.warn(h)}return t}function es(){if(!this.fired)return this.target.removeListener(this.type,this.wrapFn),this.fired=!0,arguments.length===0?this.listener.call(this.target):this.listener.apply(this.target,arguments)}function se(t,e,s){let i={fired:!1,wrapFn:void 0,target:t,type:e,listener:s},r=es.bind(i);return r.listener=s,i.wrapFn=r,r}function ie(t,e,s){let i=t._events;if(i===void 0)return[];let r=i[e];return r===void 0?[]:typeof r=="function"?s?[r.listener||r]:[r]:s?ss(r):Nt(r)}function Nt(t){switch(t.length){case 2:return[t[0],t[1]];case 3:return[t[0],t[1],t[2]];case 4:return[t[0],t[1],t[2],t[3]];case 5:return[t[0],t[1],t[2],t[3],t[4]];case 6:return[t[0],t[1],t[2],t[3],t[4],t[5]]}return Array.prototype.slice.call(t)}function ss(t){let e=Nt(t);for(let s=0;s<e.length;++s){let i=e[s].listener;typeof i=="function"&&(e[s]=i)}return e}function At(t,e){return{value:t,done:e}}function tt(t,e,s,i){if(typeof t.removeListener=="function")t.removeListener(e,s);else if(typeof t.removeEventListener=="function")t.removeEventListener(e,s,i);else throw new G("emitter","EventEmitter",t)}function St(t,e,s,i){if(typeof t.on=="function")i?.once?t.once(e,s):t.on(e,s);else if(typeof t.addEventListener=="function")t.addEventListener(e,s,i);else throw new G("emitter","EventEmitter",t)}function is(){let t=[];return{addEventListener(e,s,i,r){St(e,s,i,r),Array.prototype.push(t,[e,s,i,r])},removeAll(){for(;t.length>0;)Reflect.apply(tt,void 0,t.pop())}}}function ns(t,e){for(;e+1<t.length;e++)t[e]=t[e+1];t.pop()}var _n=Ct("node:events.setMaxListeners"),fn=Ct("node:events.listenerCount"),yn=Ct("node:events.init");var S=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},rs=class{constructor(t){this.messageBus=t}get id(){if(!this.messageBus.userId)throw Error("Unable to get user ID: not ready");return this.messageBus.userId}getSelection(){return S(this,void 0,void 0,function*(){let{selection:t}=yield this.messageBus.sendAsync("OBR_PLAYER_GET_SELECTION",{});return t})}select(t,e){return S(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_PLAYER_SELECT",{items:t,replace:e})})}deselect(t){return S(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_PLAYER_DESELECT",{items:t})})}getName(){return S(this,void 0,void 0,function*(){let{name:t}=yield this.messageBus.sendAsync("OBR_PLAYER_GET_NAME",{});return t})}setName(t){return S(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_PLAYER_SET_NAME",{name:t})})}getColor(){return S(this,void 0,void 0,function*(){let{color:t}=yield this.messageBus.sendAsync("OBR_PLAYER_GET_COLOR",{});return t})}setColor(t){return S(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_PLAYER_SET_COLOR",{color:t})})}getSyncView(){return S(this,void 0,void 0,function*(){let{syncView:t}=yield this.messageBus.sendAsync("OBR_PLAYER_GET_SYNC_VIEW",{});return t})}setSyncView(t){return S(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_PLAYER_SET_SYNC_VIEW",{syncView:t})})}getId(){return S(this,void 0,void 0,function*(){let{id:t}=yield this.messageBus.sendAsync("OBR_PLAYER_GET_ID",{});return t})}getRole(){return S(this,void 0,void 0,function*(){let{role:t}=yield this.messageBus.sendAsync("OBR_PLAYER_GET_ROLE",{});return t})}getMetadata(){return S(this,void 0,void 0,function*(){let{metadata:t}=yield this.messageBus.sendAsync("OBR_PLAYER_GET_METADATA",{});return t})}setMetadata(t){return S(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_PLAYER_SET_METADATA",{update:t})})}hasPermission(t){return S(this,void 0,void 0,function*(){if((yield this.getRole())==="GM")return!0;let{permissions:e}=yield this.messageBus.sendAsync("OBR_ROOM_GET_PERMISSIONS",{});return e.indexOf(t)>-1})}getConnectionId(){return S(this,void 0,void 0,function*(){let{connectionId:t}=yield this.messageBus.sendAsync("OBR_PLAYER_GET_CONNECTION_ID",{});return t})}onChange(t){let e=s=>{t(s.player)};return this.messageBus.send("OBR_PLAYER_SUBSCRIBE",{}),this.messageBus.on("OBR_PLAYER_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_PLAYER_UNSUBSCRIBE",{}),this.messageBus.off("OBR_PLAYER_EVENT_CHANGE",e)}}},os=rs,L=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},ls=class{constructor(t){this.messageBus=t}reset(){return L(this,void 0,void 0,function*(){let{transform:t}=yield this.messageBus.sendAsync("OBR_VIEWPORT_RESET",{});return t})}animateTo(t){return L(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_VIEWPORT_ANIMATE_TO",{transform:t})})}animateToBounds(t){return L(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_VIEWPORT_ANIMATE_TO_BOUNDS",{bounds:t})})}getPosition(){return L(this,void 0,void 0,function*(){let{position:t}=yield this.messageBus.sendAsync("OBR_VIEWPORT_GET_POSITION",{});return t})}setPosition(t){return L(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_VIEWPORT_SET_POSITION",{position:t})})}getScale(){return L(this,void 0,void 0,function*(){let{scale:t}=yield this.messageBus.sendAsync("OBR_VIEWPORT_GET_SCALE",{});return t})}setScale(t){return L(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_VIEWPORT_SET_SCALE",{scale:t})})}getWidth(){return L(this,void 0,void 0,function*(){let{width:t}=yield this.messageBus.sendAsync("OBR_VIEWPORT_GET_WIDTH",{});return t})}getHeight(){return L(this,void 0,void 0,function*(){let{height:t}=yield this.messageBus.sendAsync("OBR_VIEWPORT_GET_HEIGHT",{});return t})}transformPoint(t){return L(this,void 0,void 0,function*(){let{point:e}=yield this.messageBus.sendAsync("OBR_VIEWPORT_TRANSFORM_POINT",{point:t});return e})}inverseTransformPoint(t){return L(this,void 0,void 0,function*(){let{point:e}=yield this.messageBus.sendAsync("OBR_VIEWPORT_INVERSE_TRANSFORM_POINT",{point:t});return e})}},as=ls;function us(t){return typeof t.id=="string"}var ct,hs=new Uint8Array(16);function cs(){if(!ct&&(ct=typeof crypto<"u"&&crypto.getRandomValues&&crypto.getRandomValues.bind(crypto),!ct))throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");return ct(hs)}var A=[];for(let t=0;t<256;++t)A.push((t+256).toString(16).slice(1));function ds(t,e=0){return A[t[e+0]]+A[t[e+1]]+A[t[e+2]]+A[t[e+3]]+"-"+A[t[e+4]]+A[t[e+5]]+"-"+A[t[e+6]]+A[t[e+7]]+"-"+A[t[e+8]]+A[t[e+9]]+"-"+A[t[e+10]]+A[t[e+11]]+A[t[e+12]]+A[t[e+13]]+A[t[e+14]]+A[t[e+15]]}var _s=typeof crypto<"u"&&crypto.randomUUID&&crypto.randomUUID.bind(crypto),ae={randomUUID:_s};function fs(t,e,s){if(ae.randomUUID&&!e&&!t)return ae.randomUUID();t=t||{};let i=t.random||(t.rng||cs)();if(i[6]=i[6]&15|64,i[8]=i[8]&63|128,e){s=s||0;for(let r=0;r<16;++r)e[s+r]=i[r];return e}return ds(i)}var ve=fs,ys=class extends xt{constructor(t,e){super(),this.ready=!1,this.userId=null,this.ref=null,this.handleMessage=s=>{let i=s.data;if(s.origin===this.targetOrigin&&us(i)){if(i.id==="OBR_READY"){this.ready=!0;let r=i.data;this.ref=r.ref,this.userId=r.userId}this.emit(i.id,i.data)}},this.send=(s,i,r)=>{var n;if(!this.ref)throw Error("Unable to send message: not ready");(n=window.parent)===null||n===void 0||n.postMessage({id:s,data:i,ref:this.ref,nonce:r},this.targetOrigin)},this.sendAsync=(s,i,r=5e3)=>{let n=`_${ve()}`;return this.send(s,i,n),Promise.race([new Promise((o,h)=>{let c=this;function a(u){c.off(`${s}_RESPONSE${n}`,a),c.off(`${s}_ERROR${n}`,l),o(u)}function l(u){c.off(`${s}_RESPONSE${n}`,a),c.off(`${s}_ERROR${n}`,l),h(u)}this.on(`${s}_RESPONSE${n}`,a),this.on(`${s}_ERROR${n}`,l)}),...r>0?[new Promise((o,h)=>window.setTimeout(()=>h(new Error(`Message ${s} took longer than ${r}ms to get a result`)),r))]:[]])},this.roomId=e,this.targetOrigin=t,window.addEventListener("message",this.handleMessage),this.setMaxListeners(100)}destroy(){window.removeEventListener("message",this.handleMessage)}},Es=ys,ue=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},ms=class{constructor(t){this.messageBus=t}show(t,e){return ue(this,void 0,void 0,function*(){let{id:s}=yield this.messageBus.sendAsync("OBR_NOTIFICATION_SHOW",{message:t,variant:e});return s})}close(t){return ue(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_NOTIFICATION_CLOSE",{id:t})})}},ps=ms,z=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},gs=class{constructor(t){this.messageBus=t}getColor(){return z(this,void 0,void 0,function*(){let{color:t}=yield this.messageBus.sendAsync("OBR_SCENE_FOG_GET_COLOR",{});return t})}setColor(t){return z(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_FOG_SET_COLOR",{color:t})})}getStrokeWidth(){return z(this,void 0,void 0,function*(){let{strokeWidth:t}=yield this.messageBus.sendAsync("OBR_SCENE_FOG_GET_STROKE_WIDTH",{});return t})}setStrokeWidth(t){return z(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_FOG_SET_STROKE_WIDTH",{strokeWidth:t})})}getFilled(){return z(this,void 0,void 0,function*(){let{filled:t}=yield this.messageBus.sendAsync("OBR_SCENE_FOG_GET_FILLED",{});return t})}setFilled(t){return z(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_FOG_SET_FILLED",{filled:t})})}onChange(t){let e=s=>{t(s.fog)};return this.messageBus.send("OBR_SCENE_FOG_SUBSCRIBE",{}),this.messageBus.on("OBR_SCENE_FOG_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_SCENE_FOG_UNSUBSCRIBE",{}),this.messageBus.off("OBR_SCENE_FOG_EVENT_CHANGE",e)}}},Os=gs,v=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},Ts=class{constructor(t){this.messageBus=t}getDpi(){return v(this,void 0,void 0,function*(){let{dpi:t}=yield this.messageBus.sendAsync("OBR_SCENE_GRID_GET_DPI",{});return t})}getScale(){return v(this,void 0,void 0,function*(){return yield this.messageBus.sendAsync("OBR_SCENE_GRID_GET_SCALE",{})})}setScale(t){return v(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_GRID_SET_SCALE",{scale:t})})}getColor(){return v(this,void 0,void 0,function*(){let{color:t}=yield this.messageBus.sendAsync("OBR_SCENE_GRID_GET_COLOR",{});return t})}setColor(t){return v(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_GRID_SET_COLOR",{color:t})})}getOpacity(){return v(this,void 0,void 0,function*(){let{opacity:t}=yield this.messageBus.sendAsync("OBR_SCENE_GRID_GET_OPACITY",{});return t})}setOpacity(t){return v(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_GRID_SET_OPACITY",{opacity:t})})}getType(){return v(this,void 0,void 0,function*(){let{type:t}=yield this.messageBus.sendAsync("OBR_SCENE_GRID_GET_TYPE",{});return t})}setType(t){return v(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_GRID_SET_TYPE",{type:t})})}getLineType(){return v(this,void 0,void 0,function*(){let{lineType:t}=yield this.messageBus.sendAsync("OBR_SCENE_GRID_GET_LINE_TYPE",{});return t})}setLineType(t){return v(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_GRID_SET_LINE_TYPE",{lineType:t})})}getMeasurement(){return v(this,void 0,void 0,function*(){let{measurement:t}=yield this.messageBus.sendAsync("OBR_SCENE_GRID_GET_MEASUREMENT",{});return t})}setMeasurement(t){return v(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_GRID_SET_MEASUREMENT",{measurement:t})})}getLineWidth(){return v(this,void 0,void 0,function*(){let{lineWidth:t}=yield this.messageBus.sendAsync("OBR_SCENE_GRID_GET_LINE_WIDTH",{});return t})}setLineWidth(t){return v(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_GRID_SET_LINE_WIDTH",{lineWidth:t})})}snapPosition(t,e,s,i){return v(this,void 0,void 0,function*(){let{position:r}=yield this.messageBus.sendAsync("OBR_SCENE_GRID_SNAP_POSITION",{position:t,snappingSensitivity:e,useCorners:s,useCenter:i});return r})}getDistance(t,e){return v(this,void 0,void 0,function*(){let{distance:s}=yield this.messageBus.sendAsync("OBR_SCENE_GRID_GET_DISTANCE",{from:t,to:e});return s})}onChange(t){let e=s=>{t(s.grid)};return this.messageBus.send("OBR_SCENE_GRID_SUBSCRIBE",{}),this.messageBus.on("OBR_SCENE_GRID_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_SCENE_GRID_UNSUBSCRIBE",{}),this.messageBus.off("OBR_SCENE_GRID_EVENT_CHANGE",e)}}},vs=Ts,dt=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},As=class{constructor(t){this.messageBus=t}undo(){return dt(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_HISTORY_UNDO",{})})}redo(){return dt(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_HISTORY_REDO",{})})}canUndo(){return dt(this,void 0,void 0,function*(){let{canUndo:t}=yield this.messageBus.sendAsync("OBR_SCENE_HISTORY_CAN_UNDO",{});return t})}canRedo(){return dt(this,void 0,void 0,function*(){let{canRedo:t}=yield this.messageBus.sendAsync("OBR_SCENE_HISTORY_CAN_REDO",{});return t})}},Rs=As,Yt=Symbol.for("immer-nothing"),st=Symbol.for("immer-draftable"),N=Symbol.for("immer-state");function B(t,...e){throw new Error(`[Immer] minified error nr: ${t}. Full error at: https://bit.ly/3cXEKWf`)}var Z=Object.getPrototypeOf;function W(t){return!!t&&!!t[N]}function D(t){return t?Ae(t)||Array.isArray(t)||!!t[st]||!!t.constructor?.[st]||q(t)||at(t):!1}var Bs=Object.prototype.constructor.toString(),he=new WeakMap;function Ae(t){if(!t||typeof t!="object")return!1;let e=Object.getPrototypeOf(t);if(e===null||e===Object.prototype)return!0;let s=Object.hasOwnProperty.call(e,"constructor")&&e.constructor;if(s===Object)return!0;if(typeof s!="function")return!1;let i=he.get(s);return i===void 0&&(i=Function.toString.call(s),he.set(s,i)),i===Bs}function nt(t,e,s=!0){V(t)===0?(s?Reflect.ownKeys(t):Object.keys(t)).forEach(i=>{e(i,t[i],t)}):t.forEach((i,r)=>e(r,i,t))}function V(t){let e=t[N];return e?e.type_:Array.isArray(t)?1:q(t)?2:at(t)?3:0}function rt(t,e){return V(t)===2?t.has(e):Object.prototype.hasOwnProperty.call(t,e)}function bt(t,e){return V(t)===2?t.get(e):t[e]}function Re(t,e,s){let i=V(t);i===2?t.set(e,s):i===3?t.add(s):t[e]=s}function Ss(t,e){return t===e?t!==0||1/t===1/e:t!==t&&e!==e}function q(t){return t instanceof Map}function at(t){return t instanceof Set}function U(t){return t.copy_||t.base_}function Dt(t,e){if(q(t))return new Map(t);if(at(t))return new Set(t);if(Array.isArray(t))return Array.prototype.slice.call(t);let s=Ae(t);if(e===!0||e==="class_only"&&!s){let i=Object.getOwnPropertyDescriptors(t);delete i[N];let r=Reflect.ownKeys(i);for(let n=0;n<r.length;n++){let o=r[n],h=i[o];h.writable===!1&&(h.writable=!0,h.configurable=!0),(h.get||h.set)&&(i[o]={configurable:!0,writable:!0,enumerable:h.enumerable,value:t[o]})}return Object.create(Z(t),i)}else{let i=Z(t);if(i!==null&&s)return{...t};let r=Object.create(i);return Object.assign(r,t)}}function zt(t,e=!1){return pt(t)||W(t)||!D(t)||(V(t)>1&&Object.defineProperties(t,{set:_t,add:_t,clear:_t,delete:_t}),Object.freeze(t),e&&Object.values(t).forEach(s=>zt(s,!0))),t}function Cs(){B(2)}var _t={value:Cs};function pt(t){return t===null||typeof t!="object"?!0:Object.isFrozen(t)}var kt={};function H(t){let e=kt[t];return e||B(0,t),e}function xs(t,e){kt[t]||(kt[t]=e)}var ot;function Be(){return ot}function Is(t,e){return{drafts_:[],parent_:t,immer_:e,canAutoFreeze_:!0,unfinalizedDrafts_:0}}function ce(t,e){e&&(H("Patches"),t.patches_=[],t.inversePatches_=[],t.patchListener_=e)}function Gt(t){Ut(t),t.drafts_.forEach(Ns),t.drafts_=null}function Ut(t){t===ot&&(ot=t.parent_)}function de(t){return ot=Is(ot,t)}function Ns(t){let e=t[N];e.type_===0||e.type_===1?e.revoke_():e.revoked_=!0}function _e(t,e){e.unfinalizedDrafts_=e.drafts_.length;let s=e.drafts_[0];return t!==void 0&&t!==s?(s[N].modified_&&(Gt(e),B(4)),D(t)&&(t=Et(e,t),e.parent_||mt(e,t)),e.patches_&&H("Patches").generateReplacementPatches_(s[N].base_,t,e.patches_,e.inversePatches_)):t=Et(e,s,[]),Gt(e),e.patches_&&e.patchListener_(e.patches_,e.inversePatches_),t!==Yt?t:void 0}function Et(t,e,s){if(pt(e))return e;let i=t.immer_.shouldUseStrictIteration(),r=e[N];if(!r)return nt(e,(n,o)=>fe(t,r,e,n,o,s),i),e;if(r.scope_!==t)return e;if(!r.modified_)return mt(t,r.base_,!0),r.base_;if(!r.finalized_){r.finalized_=!0,r.scope_.unfinalizedDrafts_--;let n=r.copy_,o=n,h=!1;r.type_===3&&(o=new Set(n),n.clear(),h=!0),nt(o,(c,a)=>fe(t,r,n,c,a,s,h),i),mt(t,n,!1),s&&t.patches_&&H("Patches").generatePatches_(r,s,t.patches_,t.inversePatches_)}return r.copy_}function fe(t,e,s,i,r,n,o){if(r==null||typeof r!="object"&&!o)return;let h=pt(r);if(!(h&&!o)){if(W(r)){let c=n&&e&&e.type_!==3&&!rt(e.assigned_,i)?n.concat(i):void 0,a=Et(t,r,c);if(Re(s,i,a),W(a))t.canAutoFreeze_=!1;else return}else o&&s.add(r);if(D(r)&&!h){if(!t.immer_.autoFreeze_&&t.unfinalizedDrafts_<1||e&&e.base_&&e.base_[i]===r&&h)return;Et(t,r),(!e||!e.scope_.parent_)&&typeof i!="symbol"&&(q(s)?s.has(i):Object.prototype.propertyIsEnumerable.call(s,i))&&mt(t,r)}}}function mt(t,e,s=!1){!t.parent_&&t.immer_.autoFreeze_&&t.canAutoFreeze_&&zt(e,s)}function bs(t,e){let s=Array.isArray(t),i={type_:s?1:0,scope_:e?e.scope_:Be(),modified_:!1,finalized_:!1,assigned_:{},parent_:e,base_:t,draft_:null,copy_:null,revoke_:null,isManual_:!1},r=i,n=Kt;s&&(r=[i],n=lt);let{revoke:o,proxy:h}=Proxy.revocable(r,n);return i.draft_=h,i.revoke_=o,h}var Kt={get(t,e){if(e===N)return t;let s=U(t);if(!rt(s,e))return Ms(t,s,e);let i=s[e];return t.finalized_||!D(i)?i:i===Mt(t.base_,e)?(Lt(t),t.copy_[e]=Vt(i,t)):i},has(t,e){return e in U(t)},ownKeys(t){return Reflect.ownKeys(U(t))},set(t,e,s){let i=Se(U(t),e);if(i?.set)return i.set.call(t.draft_,s),!0;if(!t.modified_){let r=Mt(U(t),e),n=r?.[N];if(n&&n.base_===s)return t.copy_[e]=s,t.assigned_[e]=!1,!0;if(Ss(s,r)&&(s!==void 0||rt(t.base_,e)))return!0;Lt(t),Wt(t)}return t.copy_[e]===s&&(s!==void 0||e in t.copy_)||Number.isNaN(s)&&Number.isNaN(t.copy_[e])||(t.copy_[e]=s,t.assigned_[e]=!0),!0},deleteProperty(t,e){return Mt(t.base_,e)!==void 0||e in t.base_?(t.assigned_[e]=!1,Lt(t),Wt(t)):delete t.assigned_[e],t.copy_&&delete t.copy_[e],!0},getOwnPropertyDescriptor(t,e){let s=U(t),i=Reflect.getOwnPropertyDescriptor(s,e);return i&&{writable:!0,configurable:t.type_!==1||e!=="length",enumerable:i.enumerable,value:s[e]}},defineProperty(){B(11)},getPrototypeOf(t){return Z(t.base_)},setPrototypeOf(){B(12)}},lt={};nt(Kt,(t,e)=>{lt[t]=function(){return arguments[0]=arguments[0][0],e.apply(this,arguments)}});lt.deleteProperty=function(t,e){return lt.set.call(this,t,e,void 0)};lt.set=function(t,e,s){return Kt.set.call(this,t[0],e,s,t[0])};function Mt(t,e){let s=t[N];return(s?U(s):t)[e]}function Ms(t,e,s){let i=Se(e,s);return i?"value"in i?i.value:i.get?.call(t.draft_):void 0}function Se(t,e){if(!(e in t))return;let s=Z(t);for(;s;){let i=Object.getOwnPropertyDescriptor(s,e);if(i)return i;s=Z(s)}}function Wt(t){t.modified_||(t.modified_=!0,t.parent_&&Wt(t.parent_))}function Lt(t){t.copy_||(t.copy_=Dt(t.base_,t.scope_.immer_.useStrictShallowCopy_))}var Ls=class{constructor(t){this.autoFreeze_=!0,this.useStrictShallowCopy_=!1,this.useStrictIteration_=!0,this.produce=(e,s,i)=>{if(typeof e=="function"&&typeof s!="function"){let n=s;s=e;let o=this;return function(h=n,...c){return o.produce(h,a=>s.call(this,a,...c))}}typeof s!="function"&&B(6),i!==void 0&&typeof i!="function"&&B(7);let r;if(D(e)){let n=de(this),o=Vt(e,void 0),h=!0;try{r=s(o),h=!1}finally{h?Gt(n):Ut(n)}return ce(n,i),_e(r,n)}else if(!e||typeof e!="object"){if(r=s(e),r===void 0&&(r=e),r===Yt&&(r=void 0),this.autoFreeze_&&zt(r,!0),i){let n=[],o=[];H("Patches").generateReplacementPatches_(e,r,n,o),i(n,o)}return r}else B(1,e)},this.produceWithPatches=(e,s)=>{if(typeof e=="function")return(n,...o)=>this.produceWithPatches(n,h=>e(h,...o));let i,r;return[this.produce(e,s,(n,o)=>{i=n,r=o}),i,r]},typeof t?.autoFreeze=="boolean"&&this.setAutoFreeze(t.autoFreeze),typeof t?.useStrictShallowCopy=="boolean"&&this.setUseStrictShallowCopy(t.useStrictShallowCopy),typeof t?.useStrictIteration=="boolean"&&this.setUseStrictIteration(t.useStrictIteration)}createDraft(t){D(t)||B(8),W(t)&&(t=ws(t));let e=de(this),s=Vt(t,void 0);return s[N].isManual_=!0,Ut(e),s}finishDraft(t,e){let s=t&&t[N];(!s||!s.isManual_)&&B(9);let{scope_:i}=s;return ce(i,e),_e(void 0,i)}setAutoFreeze(t){this.autoFreeze_=t}setUseStrictShallowCopy(t){this.useStrictShallowCopy_=t}setUseStrictIteration(t){this.useStrictIteration_=t}shouldUseStrictIteration(){return this.useStrictIteration_}applyPatches(t,e){let s;for(s=e.length-1;s>=0;s--){let r=e[s];if(r.path.length===0&&r.op==="replace"){t=r.value;break}}s>-1&&(e=e.slice(s+1));let i=H("Patches").applyPatches_;return W(t)?i(t,e):this.produce(t,r=>i(r,e))}};function Vt(t,e){let s=q(t)?H("MapSet").proxyMap_(t,e):at(t)?H("MapSet").proxySet_(t,e):bs(t,e);return(e?e.scope_:Be()).drafts_.push(s),s}function ws(t){return W(t)||B(10,t),Ce(t)}function Ce(t){if(!D(t)||pt(t))return t;let e=t[N],s,i=!0;if(e){if(!e.modified_)return e.base_;e.finalized_=!0,s=Dt(t,e.scope_.immer_.useStrictShallowCopy_),i=e.scope_.immer_.shouldUseStrictIteration()}else s=Dt(t,!0);return nt(s,(r,n)=>{Re(s,r,Ce(n))},i),e&&(e.finalized_=!1),s}function Qt(){let t="replace",e="add",s="remove";function i(u,f,E,p){switch(u.type_){case 0:case 2:return n(u,f,E,p);case 1:return r(u,f,E,p);case 3:return o(u,f,E,p)}}function r(u,f,E,p){let{base_:O,assigned_:m}=u,g=u.copy_;g.length<O.length&&([O,g]=[g,O],[E,p]=[p,E]);for(let d=0;d<O.length;d++)if(m[d]&&g[d]!==O[d]){let y=f.concat([d]);E.push({op:t,path:y,value:l(g[d])}),p.push({op:t,path:y,value:l(O[d])})}for(let d=O.length;d<g.length;d++){let y=f.concat([d]);E.push({op:e,path:y,value:l(g[d])})}for(let d=g.length-1;O.length<=d;--d){let y=f.concat([d]);p.push({op:s,path:y})}}function n(u,f,E,p){let{base_:O,copy_:m}=u;nt(u.assigned_,(g,d)=>{let y=bt(O,g),I=bt(m,g),_=d?rt(O,g)?t:e:s;if(y===I&&_===t)return;let R=f.concat(g);E.push(_===s?{op:_,path:R}:{op:_,path:R,value:I}),p.push(_===e?{op:s,path:R}:_===s?{op:e,path:R,value:l(y)}:{op:t,path:R,value:l(y)})})}function o(u,f,E,p){let{base_:O,copy_:m}=u,g=0;O.forEach(d=>{if(!m.has(d)){let y=f.concat([g]);E.push({op:s,path:y,value:d}),p.unshift({op:e,path:y,value:d})}g++}),g=0,m.forEach(d=>{if(!O.has(d)){let y=f.concat([g]);E.push({op:e,path:y,value:d}),p.unshift({op:s,path:y,value:d})}g++})}function h(u,f,E,p){E.push({op:t,path:[],value:f===Yt?void 0:f}),p.push({op:t,path:[],value:u})}function c(u,f){return f.forEach(E=>{let{path:p,op:O}=E,m=u;for(let I=0;I<p.length-1;I++){let _=V(m),R=p[I];typeof R!="string"&&typeof R!="number"&&(R=""+R),(_===0||_===1)&&(R==="__proto__"||R==="constructor")&&B(19),typeof m=="function"&&R==="prototype"&&B(19),m=bt(m,R),typeof m!="object"&&B(18,p.join("/"))}let g=V(m),d=a(E.value),y=p[p.length-1];switch(O){case t:switch(g){case 2:return m.set(y,d);case 3:B(16);default:return m[y]=d}case e:switch(g){case 1:return y==="-"?m.push(d):m.splice(y,0,d);case 2:return m.set(y,d);case 3:return m.add(d);default:return m[y]=d}case s:switch(g){case 1:return m.splice(y,1);case 2:return m.delete(y);case 3:return m.delete(E.value);default:return delete m[y]}default:B(17,O)}}),u}function a(u){if(!D(u))return u;if(Array.isArray(u))return u.map(a);if(q(u))return new Map(Array.from(u.entries()).map(([E,p])=>[E,a(p)]));if(at(u))return new Set(Array.from(u).map(a));let f=Object.create(Z(u));for(let E in u)f[E]=a(u[E]);return rt(u,st)&&(f[st]=u[st]),f}function l(u){return W(u)?a(u):u}xs("Patches",{applyPatches_:c,generatePatches_:i,generateReplacementPatches_:h})}var Ht=new Ls,vn=Ht.produce,$t=Ht.produceWithPatches.bind(Ht),K=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})};Qt();var Ps=class{constructor(t){this.messageBus=t}getItems(t){return K(this,void 0,void 0,function*(){if(Array.isArray(t)){let{items:e}=yield this.messageBus.sendAsync("OBR_SCENE_ITEMS_GET_ITEMS",{ids:t});return e}else if(t){let{items:e}=yield this.messageBus.sendAsync("OBR_SCENE_ITEMS_GET_ALL_ITEMS",{});return e.filter(t)}else{let{items:e}=yield this.messageBus.sendAsync("OBR_SCENE_ITEMS_GET_ALL_ITEMS",{});return e}})}isItemArray(t){return Array.isArray(t)&&t.every(e=>typeof e!="string")}updateItems(t,e){return K(this,void 0,void 0,function*(){let s;this.isItemArray(t)?s=t:s=yield this.getItems(t);let[i,r]=$t(s,e),n=i.map(h=>({id:h.id,type:h.type}));for(let h of r){let[c,a]=h.path;typeof c=="number"&&typeof a=="string"&&(n[c][a]=i[c][a])}let o=n.filter(h=>Object.keys(h).length>2);o.length!==0&&(yield this.messageBus.sendAsync("OBR_SCENE_ITEMS_UPDATE_ITEMS",{updates:o}))})}addItems(t){return K(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_ITEMS_ADD_ITEMS",{items:t})})}deleteItems(t){return K(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_ITEMS_DELETE_ITEMS",{ids:t})})}getItemAttachments(t){return K(this,void 0,void 0,function*(){let{items:e}=yield this.messageBus.sendAsync("OBR_SCENE_ITEMS_GET_ITEM_ATTACHMENTS",{ids:t});return e})}getItemBounds(t){return K(this,void 0,void 0,function*(){let{bounds:e}=yield this.messageBus.sendAsync("OBR_SCENE_ITEMS_GET_ITEM_BOUNDS",{ids:t});return e})}onChange(t){let e=s=>{t(s.items)};return this.messageBus.send("OBR_SCENE_ITEMS_SUBSCRIBE",{}),this.messageBus.on("OBR_SCENE_ITEMS_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_SCENE_ITEMS_UNSUBSCRIBE",{}),this.messageBus.off("OBR_SCENE_ITEMS_EVENT_CHANGE",e)}}},Ds=Ps,Q=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})};Qt();var ks=class{constructor(t){this.messageBus=t}getItems(t){return Q(this,void 0,void 0,function*(){if(Array.isArray(t)){let{items:e}=yield this.messageBus.sendAsync("OBR_SCENE_LOCAL_GET_ITEMS",{ids:t});return e}else if(t){let{items:e}=yield this.messageBus.sendAsync("OBR_SCENE_LOCAL_GET_ALL_ITEMS",{});return e.filter(t)}else{let{items:e}=yield this.messageBus.sendAsync("OBR_SCENE_LOCAL_GET_ALL_ITEMS",{});return e}})}isItemArray(t){return Array.isArray(t)&&t.every(e=>typeof e!="string")}updateItems(t,e,s){return Q(this,void 0,void 0,function*(){let i;this.isItemArray(t)?i=t:i=yield this.getItems(t);let[r,n]=$t(i,e),o=r.map(c=>({id:c.id,type:c.type}));for(let c of n){let[a,l]=c.path;typeof a=="number"&&typeof l=="string"&&(o[a][l]=r[a][l])}let h=o.filter(c=>Object.keys(c).length>2);h.length!==0&&(yield this.messageBus.sendAsync("OBR_SCENE_LOCAL_UPDATE_ITEMS",{updates:h,fastUpdate:s}))})}addItems(t){return Q(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_LOCAL_ADD_ITEMS",{items:t})})}deleteItems(t){return Q(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_LOCAL_DELETE_ITEMS",{ids:t})})}getItemAttachments(t){return Q(this,void 0,void 0,function*(){let{items:e}=yield this.messageBus.sendAsync("OBR_SCENE_LOCAL_GET_ITEM_ATTACHMENTS",{ids:t});return e})}getItemBounds(t){return Q(this,void 0,void 0,function*(){let{bounds:e}=yield this.messageBus.sendAsync("OBR_SCENE_LOCAL_GET_ITEM_BOUNDS",{ids:t});return e})}onChange(t){let e=s=>{t(s.items)};return this.messageBus.send("OBR_SCENE_LOCAL_SUBSCRIBE",{}),this.messageBus.on("OBR_SCENE_LOCAL_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_SCENE_LOCAL_UNSUBSCRIBE",{}),this.messageBus.off("OBR_SCENE_LOCAL_EVENT_CHANGE",e)}}},Gs=ks,wt=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},Us=class{constructor(t){this.messageBus=t,this.grid=new vs(t),this.fog=new Os(t),this.history=new Rs(t),this.items=new Ds(t),this.local=new Gs(t)}isReady(){return wt(this,void 0,void 0,function*(){let{ready:t}=yield this.messageBus.sendAsync("OBR_SCENE_IS_READY",{});return t})}onReadyChange(t){let e=s=>{t(s.ready)};return this.messageBus.send("OBR_SCENE_READY_SUBSCRIBE",{}),this.messageBus.on("OBR_SCENE_EVENT_READY_CHANGE",e),()=>{this.messageBus.send("OBR_SCENE_READY_UNSUBSCRIBE",{}),this.messageBus.off("OBR_SCENE_EVENT_READY_CHANGE",e)}}getMetadata(){return wt(this,void 0,void 0,function*(){let{metadata:t}=yield this.messageBus.sendAsync("OBR_SCENE_GET_METADATA",{});return t})}setMetadata(t){return wt(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_SCENE_SET_METADATA",{update:t})})}onMetadataChange(t){let e=s=>{t(s.metadata)};return this.messageBus.send("OBR_SCENE_METADATA_SUBSCRIBE",{}),this.messageBus.on("OBR_SCENE_METADATA_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_SCENE_METADATA_UNSUBSCRIBE",{}),this.messageBus.off("OBR_SCENE_METADATA_EVENT_CHANGE",e)}}},Ws=Us;function xe(t){return t.startsWith("http")?t:`${window.location.origin}${t}`}function it(t){return t.map(e=>Object.assign(Object.assign({},e),{icon:xe(e.icon)}))}function Xt(t){return Object.assign(Object.assign({},t),{url:xe(t.url)})}var ye=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},Vs=class{constructor(t){this.contextMenus={},this.handleClick=e=>{var s;let i=this.contextMenus[e.id];i&&((s=i.onClick)===null||s===void 0||s.call(i,e.context,e.elementId))},this.messageBus=t,t.on("OBR_CONTEXT_MENU_EVENT_CLICK",this.handleClick)}create(t){return ye(this,void 0,void 0,function*(){this.messageBus.sendAsync("OBR_CONTEXT_MENU_CREATE",{id:t.id,shortcut:t.shortcut,icons:it(t.icons),embed:t.embed&&Xt(t.embed)}),this.contextMenus[t.id]=t})}remove(t){return ye(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_CONTEXT_MENU_REMOVE",{id:t}),delete this.contextMenus[t]})}},Hs=Vs,M=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},js=class{constructor(t){this.tools={},this.toolActions={},this.toolModes={},this.handleToolClick=e=>{let s=this.tools[e.id];if(s)if(s.onClick){let i=s.onClick(e.context,e.elementId);Promise.resolve(i).then(r=>{r&&this.messageBus.send("OBR_TOOL_ACTIVATE",{id:e.id})})}else this.messageBus.send("OBR_TOOL_ACTIVATE",{id:e.id})},this.handleToolActionClick=e=>{var s;let i=this.toolActions[e.id];i&&((s=i.onClick)===null||s===void 0||s.call(i,e.context,e.elementId))},this.handleToolModeClick=e=>{let s=this.toolModes[e.id];if(s)if(s.onClick){let i=s.onClick(e.context,e.elementId);Promise.resolve(i).then(r=>{r&&this.messageBus.send("OBR_TOOL_MODE_ACTIVATE",{toolId:e.context.activeTool,modeId:e.id})})}else this.messageBus.send("OBR_TOOL_MODE_ACTIVATE",{toolId:e.context.activeTool,modeId:e.id})},this.handleToolModeToolClick=e=>{let s=this.toolModes[e.id];if(s)if(s.onToolClick){let i=s.onToolClick(e.context,e.event);Promise.resolve(i).then(r=>{r&&e.event.target&&!e.event.target.locked&&this.messageBus.sendAsync("OBR_PLAYER_SELECT",{items:[e.event.target.id]})})}else e.event.target&&!e.event.target.locked&&this.messageBus.sendAsync("OBR_PLAYER_SELECT",{items:[e.event.target.id]})},this.handleToolModeToolDoubleClick=e=>{let s=this.toolModes[e.id];if(s)if(s.onToolDoubleClick){let i=s.onToolDoubleClick(e.context,e.event);Promise.resolve(i).then(r=>{r&&e.event.target&&this.messageBus.sendAsync("OBR_PLAYER_SELECT",{items:[e.event.target.id]})})}else e.event.target&&this.messageBus.sendAsync("OBR_PLAYER_SELECT",{items:[e.event.target.id]})},this.handleToolModeToolDown=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onToolDown)===null||s===void 0||s.call(i,e.context,e.event))},this.handleToolModeToolMove=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onToolMove)===null||s===void 0||s.call(i,e.context,e.event))},this.handleToolModeToolUp=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onToolUp)===null||s===void 0||s.call(i,e.context,e.event))},this.handleToolModeToolDragStart=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onToolDragStart)===null||s===void 0||s.call(i,e.context,e.event))},this.handleToolModeToolDragMove=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onToolDragMove)===null||s===void 0||s.call(i,e.context,e.event))},this.handleToolModeToolDragEnd=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onToolDragEnd)===null||s===void 0||s.call(i,e.context,e.event))},this.handleToolModeToolDragCancel=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onToolDragCancel)===null||s===void 0||s.call(i,e.context,e.event))},this.handleToolModeKeyDown=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onKeyDown)===null||s===void 0||s.call(i,e.context,e.event))},this.handleToolModeKeyUp=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onKeyUp)===null||s===void 0||s.call(i,e.context,e.event))},this.handleToolModeActivate=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onActivate)===null||s===void 0||s.call(i,e.context))},this.handleToolModeDeactivate=e=>{var s;let i=this.toolModes[e.id];i&&((s=i.onDeactivate)===null||s===void 0||s.call(i,e.context))},this.messageBus=t,t.on("OBR_TOOL_EVENT_CLICK",this.handleToolClick),t.on("OBR_TOOL_ACTION_EVENT_CLICK",this.handleToolActionClick),t.on("OBR_TOOL_MODE_EVENT_CLICK",this.handleToolModeClick),t.on("OBR_TOOL_MODE_EVENT_TOOL_CLICK",this.handleToolModeToolClick),t.on("OBR_TOOL_MODE_EVENT_TOOL_DOUBLE_CLICK",this.handleToolModeToolDoubleClick),t.on("OBR_TOOL_MODE_EVENT_TOOL_DOWN",this.handleToolModeToolDown),t.on("OBR_TOOL_MODE_EVENT_TOOL_MOVE",this.handleToolModeToolMove),t.on("OBR_TOOL_MODE_EVENT_TOOL_UP",this.handleToolModeToolUp),t.on("OBR_TOOL_MODE_EVENT_TOOL_DRAG_START",this.handleToolModeToolDragStart),t.on("OBR_TOOL_MODE_EVENT_TOOL_DRAG_MOVE",this.handleToolModeToolDragMove),t.on("OBR_TOOL_MODE_EVENT_TOOL_DRAG_END",this.handleToolModeToolDragEnd),t.on("OBR_TOOL_MODE_EVENT_TOOL_DRAG_CANCEL",this.handleToolModeToolDragCancel),t.on("OBR_TOOL_MODE_EVENT_KEY_DOWN",this.handleToolModeKeyDown),t.on("OBR_TOOL_MODE_EVENT_KEY_UP",this.handleToolModeKeyUp),t.on("OBR_TOOL_MODE_EVENT_ACTIVATE",this.handleToolModeActivate),t.on("OBR_TOOL_MODE_EVENT_DEACTIVATE",this.handleToolModeDeactivate)}create(t){return M(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_TOOL_CREATE",{id:t.id,shortcut:t.shortcut,defaultMode:t.defaultMode,defaultMetadata:t.defaultMetadata,icons:it(t.icons),disabled:t.disabled}),this.tools[t.id]=t})}remove(t){return M(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_TOOL_REMOVE",{id:t}),delete this.tools[t]})}activateTool(t){return M(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_TOOL_ACTIVATE",{id:t})})}getActiveTool(){return M(this,void 0,void 0,function*(){let{id:t}=yield this.messageBus.sendAsync("OBR_TOOL_GET_ACTIVE",{});return t})}onToolChange(t){let e=s=>{t(s.id)};return this.messageBus.send("OBR_TOOL_ACTIVE_SUBSCRIBE",{}),this.messageBus.on("OBR_TOOL_ACTIVE_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_TOOL_ACTIVE_UNSUBSCRIBE",{}),this.messageBus.off("OBR_TOOL_ACTIVE_EVENT_CHANGE",e)}}getMetadata(t){return M(this,void 0,void 0,function*(){let{metadata:e}=yield this.messageBus.sendAsync("OBR_TOOL_GET_METADATA",{id:t});return e})}setMetadata(t,e){return M(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_TOOL_SET_METADATA",{toolId:t,update:e})})}createAction(t){return M(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_TOOL_ACTION_CREATE",{id:t.id,shortcut:t.shortcut,icons:it(t.icons),disabled:t.disabled}),this.toolActions[t.id]=t})}removeAction(t){return M(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_TOOL_ACTION_REMOVE",{id:t}),delete this.tools[t]})}createMode(t){return M(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_TOOL_MODE_CREATE",{id:t.id,shortcut:t.shortcut,icons:it(t.icons),preventDrag:t.preventDrag,disabled:t.disabled,cursors:t.cursors}),this.toolModes[t.id]=t})}removeMode(t){return M(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_TOOL_MODE_REMOVE",{id:t}),delete this.tools[t]})}activateMode(t,e){return M(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_TOOL_MODE_ACTIVATE",{toolId:t,modeId:e})})}getActiveToolMode(){return M(this,void 0,void 0,function*(){let{id:t}=yield this.messageBus.sendAsync("OBR_TOOL_MODE_GET_ACTIVE",{});return t})}onToolModeChange(t){let e=s=>{t(s.id)};return this.messageBus.send("OBR_TOOL_MODE_ACTIVE_SUBSCRIBE",{}),this.messageBus.on("OBR_TOOL_MODE_ACTIVE_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_TOOL_MODE_ACTIVE_UNSUBSCRIBE",{}),this.messageBus.off("OBR_TOOL_MODE_ACTIVE_EVENT_CHANGE",e)}}},Fs=js,$=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},Ys=class{constructor(t){this.messageBus=t}open(t){return $(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_POPOVER_OPEN",Object.assign({},Xt(t)))})}close(t){return $(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_POPOVER_CLOSE",{id:t})})}getWidth(t){return $(this,void 0,void 0,function*(){let{width:e}=yield this.messageBus.sendAsync("OBR_POPOVER_GET_WIDTH",{id:t});return e})}setWidth(t,e){return $(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_POPOVER_SET_WIDTH",{id:t,width:e})})}getHeight(t){return $(this,void 0,void 0,function*(){let{height:e}=yield this.messageBus.sendAsync("OBR_POPOVER_GET_HEIGHT",{id:t});return e})}setHeight(t,e){return $(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_POPOVER_SET_HEIGHT",{id:t,height:e})})}},zs=Ys,Ee=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},Ks=class{constructor(t){this.messageBus=t}open(t){return Ee(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_MODAL_OPEN",Object.assign({},Xt(t)))})}close(t){return Ee(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_MODAL_CLOSE",{id:t})})}},Qs=Ks,C=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},$s=class{constructor(t){this.messageBus=t}getWidth(){return C(this,void 0,void 0,function*(){let{width:t}=yield this.messageBus.sendAsync("OBR_ACTION_GET_WIDTH",{});return t})}setWidth(t){return C(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ACTION_SET_WIDTH",{width:t})})}getHeight(){return C(this,void 0,void 0,function*(){let{height:t}=yield this.messageBus.sendAsync("OBR_ACTION_GET_HEIGHT",{});return t})}setHeight(t){return C(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ACTION_SET_HEIGHT",{height:t})})}getBadgeText(){return C(this,void 0,void 0,function*(){let{badgeText:t}=yield this.messageBus.sendAsync("OBR_ACTION_GET_BADGE_TEXT",{});return t})}setBadgeText(t){return C(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ACTION_SET_BADGE_TEXT",{badgeText:t})})}getBadgeBackgroundColor(){return C(this,void 0,void 0,function*(){let{badgeBackgroundColor:t}=yield this.messageBus.sendAsync("OBR_ACTION_GET_BADGE_BACKGROUND_COLOR",{});return t})}setBadgeBackgroundColor(t){return C(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ACTION_SET_BADGE_BACKGROUND_COLOR",{badgeBackgroundColor:t})})}getIcon(){return C(this,void 0,void 0,function*(){let{icon:t}=yield this.messageBus.sendAsync("OBR_ACTION_GET_ICON",{});return t})}setIcon(t){return C(this,void 0,void 0,function*(){let e=it([{icon:t}]);yield this.messageBus.sendAsync("OBR_ACTION_SET_ICON",{icon:e[0].icon})})}getTitle(){return C(this,void 0,void 0,function*(){let{title:t}=yield this.messageBus.sendAsync("OBR_ACTION_GET_TITLE",{});return t})}setTitle(t){return C(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ACTION_SET_TITLE",{title:t})})}isOpen(){return C(this,void 0,void 0,function*(){let{isOpen:t}=yield this.messageBus.sendAsync("OBR_ACTION_GET_IS_OPEN",{});return t})}open(){return C(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ACTION_OPEN",{})})}close(){return C(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ACTION_CLOSE",{})})}onOpenChange(t){let e=s=>{t(s.isOpen)};return this.messageBus.send("OBR_ACTION_IS_OPEN_SUBSCRIBE",{}),this.messageBus.on("OBR_ACTION_IS_OPEN_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_IS_OPEN_ACTION_UNSUBSCRIBE",{}),this.messageBus.off("OBR_ACTION_IS_OPEN_EVENT_CHANGE",e)}}},Xs=$s,Zs=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})};Qt();var qs=class{constructor(t){this.messageBus=t}startItemInteraction(t){return Zs(this,void 0,void 0,function*(){let{id:e}=yield this.messageBus.sendAsync("OBR_INTERACTION_START_ITEM_INTERACTION",{baseState:t}),s=t;return[i=>{let[r,n]=$t(s,i);return s=r,this.messageBus.send("OBR_INTERACTION_UPDATE_ITEM_INTERACTION",{id:e,patches:n}),r},()=>{this.messageBus.send("OBR_INTERACTION_STOP_ITEM_INTERACTION",{id:e})}]})}},Js=qs,ti=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},ei=class{constructor(t){this.messageBus=t}getPlayers(){return ti(this,void 0,void 0,function*(){let{players:t}=yield this.messageBus.sendAsync("OBR_PARTY_GET_PLAYERS",{});return t})}onChange(t){let e=s=>{t(s.players)};return this.messageBus.send("OBR_PARTY_SUBSCRIBE",{}),this.messageBus.on("OBR_PARTY_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_PARTY_UNSUBSCRIBE",{}),this.messageBus.off("OBR_PARTY_EVENT_CHANGE",e)}}},si=ei,Pt=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},ii=class{constructor(t){this.messageBus=t}get id(){return this.messageBus.roomId}getPermissions(){return Pt(this,void 0,void 0,function*(){let{permissions:t}=yield this.messageBus.sendAsync("OBR_ROOM_GET_PERMISSIONS",{});return t})}getMetadata(){return Pt(this,void 0,void 0,function*(){let{metadata:t}=yield this.messageBus.sendAsync("OBR_ROOM_GET_METADATA",{});return t})}setMetadata(t){return Pt(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ROOM_SET_METADATA",{update:t})})}onMetadataChange(t){let e=s=>{t(s.metadata)};return this.messageBus.send("OBR_ROOM_METADATA_SUBSCRIBE",{}),this.messageBus.on("OBR_ROOM_METADATA_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_METADATA_ROOM_UNSUBSCRIBE",{}),this.messageBus.off("OBR_ROOM_METADATA_EVENT_CHANGE",e)}}onPermissionsChange(t){let e=s=>{t(s.permissions)};return this.messageBus.send("OBR_ROOM_PERMISSIONS_SUBSCRIBE",{}),this.messageBus.on("OBR_ROOM_PERMISSIONS_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_PERMISSIONS_ROOM_UNSUBSCRIBE",{}),this.messageBus.off("OBR_ROOM_PERMISSIONS_EVENT_CHANGE",e)}}},ni=ii,ri=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},oi=class{constructor(t){this.messageBus=t}getTheme(){return ri(this,void 0,void 0,function*(){let{theme:t}=yield this.messageBus.sendAsync("OBR_THEME_GET_THEME",{});return t})}onChange(t){let e=s=>{t(s.theme)};return this.messageBus.send("OBR_THEME_SUBSCRIBE",{}),this.messageBus.on("OBR_THEME_EVENT_CHANGE",e),()=>{this.messageBus.send("OBR_THEME_UNSUBSCRIBE",{}),this.messageBus.off("OBR_THEME_EVENT_CHANGE",e)}}},li=oi,ft=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},ai=class{constructor(t){this.messageBus=t}uploadImages(t,e){return ft(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ASSETS_UPLOAD_IMAGES",{images:t,typeHint:e})})}uploadScenes(t,e){return ft(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_ASSETS_UPLOAD_SCENES",{scenes:t,disableShowScenes:e})})}downloadImages(t,e,s){return ft(this,void 0,void 0,function*(){let{images:i}=yield this.messageBus.sendAsync("OBR_ASSETS_DOWNLOAD_IMAGES",{multiple:t,defaultSearch:e,typeHint:s},-1);return i})}downloadScenes(t,e){return ft(this,void 0,void 0,function*(){let{scenes:s}=yield this.messageBus.sendAsync("OBR_ASSETS_DOWNLOAD_SCENES",{multiple:t,defaultSearch:e},-1);return s})}},ui=ai,hi=function(t,e,s,i){function r(n){return n instanceof s?n:new s(function(o){o(n)})}return new(s||(s=Promise))(function(n,o){function h(l){try{a(i.next(l))}catch(u){o(u)}}function c(l){try{a(i.throw(l))}catch(u){o(u)}}function a(l){l.done?n(l.value):r(l.value).then(h,c)}a((i=i.apply(t,e||[])).next())})},ci=class{constructor(t){this.messageBus=t}sendMessage(t,e,s){return hi(this,void 0,void 0,function*(){yield this.messageBus.sendAsync("OBR_BROADCAST_SEND_MESSAGE",{channel:t,data:e,options:s})})}onMessage(t,e){return this.messageBus.send("OBR_BROADCAST_SUBSCRIBE",{channel:t}),this.messageBus.on(`OBR_BROADCAST_MESSAGE_${t}`,e),()=>{this.messageBus.send("OBR_BROADCAST_UNSUBSCRIBE",{channel:t}),this.messageBus.off(`OBR_BROADCAST_MESSAGE_${t}`,e)}}},di=ci,b=class{constructor(t){this._item={createdUserId:t.id,id:ve(),name:"Item",zIndex:Date.now(),lastModified:new Date().toISOString(),lastModifiedUserId:t.id,locked:!1,metadata:{},position:{x:0,y:0},rotation:0,scale:{x:1,y:1},type:"ITEM",visible:!0,layer:"POPOVER"}}createdUserId(t){return this._item.createdUserId=t,this.self()}id(t){return this._item.id=t,this.self()}name(t){return this._item.name=t,this.self()}description(t){return this._item.description=t,this.self()}lastModified(t){return this._item.lastModified=t,this.self()}zIndex(t){return this._item.zIndex=t,this.self()}lastModifiedUserId(t){return this._item.lastModifiedUserId=t,this.self()}locked(t){return this._item.locked=t,this.self()}metadata(t){return this._item.metadata=t,this.self()}position(t){return this._item.position=t,this.self()}rotation(t){return this._item.rotation=t,this.self()}scale(t){return this._item.scale=t,this.self()}visible(t){return this._item.visible=t,this.self()}attachedTo(t){return this._item.attachedTo=t,this.self()}layer(t){return this._item.layer=t,this.self()}disableHit(t){return this._item.disableHit=t,this.self()}disableAutoZIndex(t){return this._item.disableAutoZIndex=t,this.self()}disableAttachmentBehavior(t){return this._item.disableAttachmentBehavior=t,this.self()}self(){return this}},_i=class extends b{constructor(t){super(t),this._points=[],this._style={fillColor:"black",fillOpacity:1,strokeColor:"white",strokeOpacity:1,strokeWidth:5,strokeDash:[],tension:.5},this._item.name="Curve",this._item.layer="DRAWING"}points(t){return this._points=t,this.self()}style(t){return this._style=t,this.self()}fillColor(t){return this._style.fillColor=t,this.self()}fillOpacity(t){return this._style.fillOpacity=t,this.self()}strokeColor(t){return this._style.strokeColor=t,this.self()}strokeOpacity(t){return this._style.strokeOpacity=t,this.self()}strokeWidth(t){return this._style.strokeWidth=t,this.self()}strokeDash(t){return this._style.strokeDash=t,this.self()}tension(t){return this._style.tension=t,this.self()}closed(t){return this._style.closed=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"CURVE",points:this._points,style:this._style})}},fi=class extends b{constructor(t,e,s){super(t),this._image=e,this._grid=s,this._item.name="Image",this._text={richText:[{type:"paragraph",children:[{text:""}]}],plainText:"",style:{padding:8,fontFamily:"Roboto",fontSize:24,fontWeight:400,textAlign:"CENTER",textAlignVertical:"BOTTOM",fillColor:"white",fillOpacity:1,strokeColor:"white",strokeOpacity:1,strokeWidth:0,lineHeight:1.5},type:"PLAIN",width:"AUTO",height:"AUTO"},this._textItemType="LABEL"}text(t){return this._text=t,this.self()}textItemType(t){return this._textItemType=t,this.self()}textWidth(t){return this._text.width=t,this.self()}textHeight(t){return this._text.height=t,this.self()}richText(t){return this._text.richText=t,this.self()}plainText(t){return this._text.plainText=t,this.self()}textType(t){return this._text.type=t,this.self()}textPadding(t){return this._text.style.padding=t,this.self()}fontFamily(t){return this._text.style.fontFamily=t,this.self()}fontSize(t){return this._text.style.fontSize=t,this.self()}fontWeight(t){return this._text.style.fontWeight=t,this.self()}textAlign(t){return this._text.style.textAlign=t,this.self()}textAlignVertical(t){return this._text.style.textAlignVertical=t,this.self()}textFillColor(t){return this._text.style.fillColor=t,this.self()}textFillOpacity(t){return this._text.style.fillOpacity=t,this.self()}textStrokeColor(t){return this._text.style.strokeColor=t,this.self()}textStrokeOpacity(t){return this._text.style.strokeOpacity=t,this.self()}textStrokeWidth(t){return this._text.style.strokeWidth=t,this.self()}textLineHeight(t){return this._text.style.lineHeight=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"IMAGE",image:this._image,grid:this._grid,text:this._text,textItemType:this._textItemType})}},yi=class extends b{constructor(t){super(t),this._text={richText:[{type:"paragraph",children:[{text:""}]}],plainText:"",style:{padding:8,fontFamily:"Roboto",fontSize:16,fontWeight:400,textAlign:"CENTER",textAlignVertical:"MIDDLE",fillColor:"white",fillOpacity:1,strokeColor:"white",strokeOpacity:1,strokeWidth:0,lineHeight:1.5},type:"PLAIN",width:"AUTO",height:"AUTO"},this._style={backgroundColor:"#3D4051",backgroundOpacity:1,cornerRadius:8,pointerDirection:"DOWN",pointerWidth:4,pointerHeight:4},this._item.layer="TEXT",this._item.name="Label"}text(t){return this._text=t,this.self()}width(t){return this._text.width=t,this.self()}height(t){return this._text.height=t,this.self()}plainText(t){return this._text.plainText=t,this.self()}padding(t){return this._text.style.padding=t,this.self()}fontFamily(t){return this._text.style.fontFamily=t,this.self()}fontSize(t){return this._text.style.fontSize=t,this.self()}fontWeight(t){return this._text.style.fontWeight=t,this.self()}textAlign(t){return this._text.style.textAlign=t,this.self()}textAlignVertical(t){return this._text.style.textAlignVertical=t,this.self()}fillColor(t){return this._text.style.fillColor=t,this.self()}fillOpacity(t){return this._text.style.fillOpacity=t,this.self()}strokeColor(t){return this._text.style.strokeColor=t,this.self()}strokeOpacity(t){return this._text.style.strokeOpacity=t,this.self()}strokeWidth(t){return this._text.style.strokeWidth=t,this.self()}lineHeight(t){return this._text.style.lineHeight=t,this.self()}style(t){return this._style=t,this.self()}backgroundColor(t){return this._style.backgroundColor=t,this.self()}backgroundOpacity(t){return this._style.backgroundOpacity=t,this.self()}cornerRadius(t){return this._style.cornerRadius=t,this.self()}pointerWidth(t){return this._style.pointerWidth=t,this.self()}pointerHeight(t){return this._style.pointerHeight=t,this.self()}pointerDirection(t){return this._style.pointerDirection=t,this.self()}maxViewScale(t){return this._style.maxViewScale=t,this.self()}minViewScale(t){return this._style.minViewScale=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"LABEL",text:this._text,style:this._style})}},Ei=class extends b{constructor(t){super(t),this._style={strokeColor:"black",strokeOpacity:1,strokeWidth:5,strokeDash:[]},this._startPosition={x:0,y:0},this._endPosition={x:0,y:0},this._item.layer="DRAWING",this._item.name="Line"}style(t){return this._style=t,this.self()}strokeColor(t){return this._style.strokeColor=t,this.self()}strokeOpacity(t){return this._style.strokeOpacity=t,this.self()}strokeWidth(t){return this._style.strokeWidth=t,this.self()}strokeDash(t){return this._style.strokeDash=t,this.self()}startPosition(t){return this._startPosition=t,this.self()}endPosition(t){return this._endPosition=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"LINE",startPosition:this._startPosition,endPosition:this._endPosition,style:this._style})}},mi=class extends b{constructor(t){super(t),this._color="black",this._radius=20,this._item.layer="POINTER",this._item.name="Pointer"}color(t){return this._color=t,this.self()}radius(t){return this._radius=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"POINTER",color:this._color,radius:this._radius})}},pi=class extends b{constructor(t){super(t),this._startPosition={x:0,y:0},this._endPosition={x:0,y:0},this._measurement="",this._item.layer="RULER",this._item.name="Ruler",this._style={variant:"FILLED"}}startPosition(t){return this._startPosition=t,this.self()}endPosition(t){return this._endPosition=t,this.self()}measurement(t){return this._measurement=t,this.self()}variant(t){return this._style.variant=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"RULER",startPosition:this._startPosition,endPosition:this._endPosition,measurement:this._measurement,style:this._style})}},gi=class extends b{constructor(t){super(t),this._width=0,this._height=0,this._shapeType="RECTANGLE",this._style={fillColor:"black",fillOpacity:1,strokeColor:"white",strokeOpacity:1,strokeWidth:5,strokeDash:[]},this._item.layer="DRAWING",this._item.name="Shape"}width(t){return this._width=t,this.self()}height(t){return this._height=t,this.self()}shapeType(t){return this._shapeType=t,this.self()}style(t){return this._style=t,this.self()}fillColor(t){return this._style.fillColor=t,this.self()}fillOpacity(t){return this._style.fillOpacity=t,this.self()}strokeColor(t){return this._style.strokeColor=t,this.self()}strokeOpacity(t){return this._style.strokeOpacity=t,this.self()}strokeWidth(t){return this._style.strokeWidth=t,this.self()}strokeDash(t){return this._style.strokeDash=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"SHAPE",width:this._width,height:this._height,shapeType:this._shapeType,style:this._style})}},Oi=class extends b{constructor(t){super(t),this._text={richText:[{type:"paragraph",children:[{text:""}]}],plainText:"",style:{padding:0,fontFamily:"Roboto",fontSize:16,fontWeight:400,textAlign:"LEFT",textAlignVertical:"TOP",fillColor:"white",fillOpacity:1,strokeColor:"white",strokeOpacity:1,strokeWidth:0,lineHeight:1.5},type:"RICH",width:"AUTO",height:"AUTO"},this._item.layer="TEXT",this._item.name="Text"}text(t){return this._text=t,this.self()}width(t){return this._text.width=t,this.self()}height(t){return this._text.height=t,this.self()}richText(t){return this._text.richText=t,this.self()}plainText(t){return this._text.plainText=t,this.self()}textType(t){return this._text.type=t,this.self()}padding(t){return this._text.style.padding=t,this.self()}fontFamily(t){return this._text.style.fontFamily=t,this.self()}fontSize(t){return this._text.style.fontSize=t,this.self()}fontWeight(t){return this._text.style.fontWeight=t,this.self()}textAlign(t){return this._text.style.textAlign=t,this.self()}textAlignVertical(t){return this._text.style.textAlignVertical=t,this.self()}fillColor(t){return this._text.style.fillColor=t,this.self()}fillOpacity(t){return this._text.style.fillOpacity=t,this.self()}strokeColor(t){return this._text.style.strokeColor=t,this.self()}strokeOpacity(t){return this._text.style.strokeOpacity=t,this.self()}strokeWidth(t){return this._text.style.strokeWidth=t,this.self()}lineHeight(t){return this._text.style.lineHeight=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"TEXT",text:this._text})}},Ti=class extends b{constructor(t){super(t),this._commands=[],this._fillRule="nonzero",this._style={fillColor:"black",fillOpacity:1,strokeColor:"white",strokeOpacity:1,strokeWidth:5,strokeDash:[]},this._item.name="Path",this._item.layer="DRAWING"}commands(t){return this._commands=t,this.self()}fillRule(t){return this._fillRule=t,this.self()}style(t){return this._style=t,this.self()}fillColor(t){return this._style.fillColor=t,this.self()}fillOpacity(t){return this._style.fillOpacity=t,this.self()}strokeColor(t){return this._style.strokeColor=t,this.self()}strokeOpacity(t){return this._style.strokeOpacity=t,this.self()}strokeWidth(t){return this._style.strokeWidth=t,this.self()}strokeDash(t){return this._style.strokeDash=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"PATH",commands:this._commands,fillRule:this._fillRule,style:this._style})}},vi=class{constructor(t){this._upload={file:t,grid:{dpi:150,offset:{x:0,y:0}},name:"",rotation:0,scale:{x:1,y:1},text:{richText:[{type:"paragraph",children:[{text:""}]}],plainText:"",style:{padding:8,fontFamily:"Roboto",fontSize:24,fontWeight:400,textAlign:"CENTER",textAlignVertical:"BOTTOM",fillColor:"white",fillOpacity:1,strokeColor:"white",strokeOpacity:1,strokeWidth:0,lineHeight:1.5},type:"PLAIN",width:"AUTO",height:"AUTO"},locked:!1,textItemType:"LABEL",visible:!0}}grid(t){return this._upload.grid=t,this}dpi(t){return this._upload.grid.dpi=t,this}offset(t){return this._upload.grid.offset=t,this}name(t){return this._upload.name=t,this}description(t){return this._upload.description=t,this}rotation(t){return this._upload.rotation=t,this}scale(t){return this._upload.scale=t,this}locked(t){return this._upload.locked=t,this}visible(t){return this._upload.visible=t,this}text(t){return this._upload.text=t,this}textItemType(t){return this._upload.textItemType=t,this}textWidth(t){return this._upload.text.width=t,this}textHeight(t){return this._upload.text.height=t,this}richText(t){return this._upload.text.richText=t,this}plainText(t){return this._upload.text.plainText=t,this}textType(t){return this._upload.text.type=t,this}textPadding(t){return this._upload.text.style.padding=t,this}fontFamily(t){return this._upload.text.style.fontFamily=t,this}fontSize(t){return this._upload.text.style.fontSize=t,this}fontWeight(t){return this._upload.text.style.fontWeight=t,this}textAlign(t){return this._upload.text.style.textAlign=t,this}textAlignVertical(t){return this._upload.text.style.textAlignVertical=t,this}textFillColor(t){return this._upload.text.style.fillColor=t,this}textFillOpacity(t){return this._upload.text.style.fillOpacity=t,this}textStrokeColor(t){return this._upload.text.style.strokeColor=t,this}textStrokeOpacity(t){return this._upload.text.style.strokeOpacity=t,this}textStrokeWidth(t){return this._upload.text.style.strokeWidth=t,this}textLineHeight(t){return this._upload.text.style.lineHeight=t,this}build(){return this._upload}},Ai=class{constructor(){this._upload={name:"New Scene",fog:{filled:!1,style:{color:"#222222",strokeWidth:5}},grid:{dpi:150,scale:"5ft",style:{lineColor:"LIGHT",lineOpacity:.4,lineType:"DASHED",lineWidth:2},measurement:"CHEBYSHEV",type:"SQUARE"},items:[]}}name(t){return this._upload.name=t,this}fogFilled(t){return this._upload.fog.filled=t,this}fogColor(t){return this._upload.fog.style.color=t,this}fogStrokeWidth(t){return this._upload.fog.style.strokeWidth=t,this}gridScale(t){return this._upload.grid.scale=t,this}gridColor(t){return this._upload.grid.style.lineColor=t,this}gridOpacity(t){return this._upload.grid.style.lineOpacity=t,this}gridLineType(t){return this._upload.grid.style.lineType=t,this}gridMeasurement(t){return this._upload.grid.measurement=t,this}gridType(t){return this._upload.grid.type=t,this}items(t){return this._upload.items=t,this}baseMap(t){return this._upload.baseMap=t,this}thumbnail(t){return this._upload.thumbnail=t,this}build(){return this._upload}},me=typeof TextDecoder=="function"?new TextDecoder("utf-8",{ignoreBOM:!0}):void 0,An=typeof TextEncoder=="function"?new TextEncoder:void 0,Ri="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",et=Array.prototype.slice.call(Ri),yt=(t=>{let e={};return t.forEach((s,i)=>e[s]=i),e})(et),Bi=/^(?:[A-Za-z\d+\/]{4})*?(?:[A-Za-z\d+\/]{2}(?:==)?|[A-Za-z\d+\/]{3}=?)?$/,P=String.fromCharCode.bind(String),Si=typeof Uint8Array.from=="function"?Uint8Array.from.bind(Uint8Array):t=>new Uint8Array(Array.prototype.slice.call(t,0)),Ie=t=>t.replace(/[^A-Za-z0-9\+\/]/g,""),Ci=t=>{let e,s,i,r,n="",o=t.length%3;for(let h=0;h<t.length;){if((s=t.charCodeAt(h++))>255||(i=t.charCodeAt(h++))>255||(r=t.charCodeAt(h++))>255)throw new TypeError("invalid character found");e=s<<16|i<<8|r,n+=et[e>>18&63]+et[e>>12&63]+et[e>>6&63]+et[e&63]}return o?n.slice(0,o-3)+"===".substring(o):n},xi=typeof btoa=="function"?t=>btoa(t):Ci,Rn=typeof Uint8Array.prototype.toBase64=="function"?t=>t.toBase64():t=>{let e=[];for(let s=0,i=t.length;s<i;s+=4096)e.push(P.apply(null,t.subarray(s,s+4096)));return xi(e.join(""))},Ii=/[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g,Ni=t=>{switch(t.length){case 4:var e=(7&t.charCodeAt(0))<<18|(63&t.charCodeAt(1))<<12|(63&t.charCodeAt(2))<<6|63&t.charCodeAt(3),s=e-65536;return P((s>>>10)+55296)+P((s&1023)+56320);case 3:return P((15&t.charCodeAt(0))<<12|(63&t.charCodeAt(1))<<6|63&t.charCodeAt(2));default:return P((31&t.charCodeAt(0))<<6|63&t.charCodeAt(1))}},bi=t=>t.replace(Ii,Ni),Mi=t=>{if(t=t.replace(/\s+/g,""),!Bi.test(t))throw new TypeError("malformed base64.");t+="==".slice(2-(t.length&3));let e,s,i,r=[];for(let n=0;n<t.length;)e=yt[t.charAt(n++)]<<18|yt[t.charAt(n++)]<<12|(s=yt[t.charAt(n++)])<<6|(i=yt[t.charAt(n++)]),s===64?r.push(P(e>>16&255)):i===64?r.push(P(e>>16&255,e>>8&255)):r.push(P(e>>16&255,e>>8&255,e&255));return r.join("")},Ne=typeof atob=="function"?t=>atob(Ie(t)):Mi,Li=typeof Uint8Array.fromBase64=="function"?t=>Uint8Array.fromBase64(t):t=>Si(Ne(t).split("").map(e=>e.charCodeAt(0))),wi=me?t=>me.decode(Li(t)):t=>bi(Ne(t)),Pi=t=>Ie(t.replace(/[-_]/g,e=>e=="-"?"+":"/")),Di=t=>wi(Pi(t));function ki(){let t=new URLSearchParams(window.location.search).get("obrref"),e="",s="";if(t){let i=Di(t).split(" ");i.length===2&&(e=i[0],s=i[1])}return{origin:e,roomId:s}}var Gi=class extends b{constructor(t,e,s){super(t),this._image=e,this._grid=s,this._item.name="Billboard",this._style={}}maxViewScale(t){return this._style.maxViewScale=t,this.self()}minViewScale(t){return this._style.minViewScale=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"BILLBOARD",image:this._image,grid:this._grid,style:this._style})}},Ui=class extends b{constructor(t){super(t),this._item.name="Effect",this._width=0,this._height=0,this._sksl="",this._effectType="VIEWPORT",this._uniforms=[],this._blendMode="SRC_OVER"}width(t){return this._width=t,this.self()}height(t){return this._height=t,this.self()}sksl(t){return this._sksl=t,this.self()}effectType(t){return this._effectType=t,this.self()}uniforms(t){return this._uniforms=t,this.self()}blendMode(t){return this._blendMode=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"EFFECT",width:this._width,height:this._height,sksl:this._sksl,effectType:this._effectType,uniforms:this._uniforms,blendMode:this._blendMode})}},Wi=class extends b{constructor(t){super(t),this._sourceRadius=50,this._attenuationRadius=1800,this._falloff=1,this._innerAngle=360,this._outerAngle=360,this._lightType="PRIMARY",this._item.name="Light",this._item.layer="FOG",this._item.zIndex=0,this._item.disableAutoZIndex=!0}sourceRadius(t){return this._sourceRadius=t,this.self()}attenuationRadius(t){return this._attenuationRadius=t,this.self()}falloff(t){return this._falloff=t,this.self()}innerAngle(t){return this._innerAngle=t,this.self()}outerAngle(t){return this._outerAngle=t,this.self()}lightType(t){return this._lightType=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"LIGHT",sourceRadius:this._sourceRadius,attenuationRadius:this._attenuationRadius,falloff:this._falloff,innerAngle:this._innerAngle,outerAngle:this._outerAngle,lightType:this._lightType})}},Vi=class extends b{constructor(t){super(t),this._points=[],this._doubleSided=!0,this._blocking=!0,this._item.name="Wall",this._item.layer="FOG",this._item.zIndex=0,this._item.disableAutoZIndex=!0}points(t){return this._points=t,this.self()}doubleSided(t){return this._doubleSided=t,this.self()}blocking(t){return this._blocking=t,this.self()}build(){return Object.assign(Object.assign({},this._item),{type:"WALL",points:this._points,doubleSided:this._doubleSided,blocking:this._blocking})}};function Bn(t){return t.type==="BILLBOARD"}function Sn(t){return t.type==="CURVE"}function Cn(t){return t.type==="EFFECT"}function xn(t){return t.type==="IMAGE"}function In(t){return t.type==="LABEL"}function Nn(t){return t.type==="LIGHT"}function bn(t){return t.type==="LINE"}var pe;(function(t){t[t.MOVE=0]="MOVE",t[t.LINE=1]="LINE",t[t.QUAD=2]="QUAD",t[t.CONIC=3]="CONIC",t[t.CUBIC=4]="CUBIC",t[t.CLOSE=5]="CLOSE"})(pe||(pe={}));function Mn(t){return t.type==="PATH"}function Ln(t){return t.type==="POINTER"}function wn(t){return t.type==="RULER"}function Pn(t){return t.type==="SHAPE"}function Dn(t){return t.type==="TEXT"}function kn(t){return"text"in t}function Gn(t){return"children"in t}function Un(t){return t.type==="WALL"}function ge(t,e){return Math.round(t/e)*e}function Oe(t,e){return Math.floor(t/e)*e}function jt(t){return t*(Math.PI/180)}function Hi(t){return t*(180/Math.PI)}function Te(t,e,s){return t*(1-s)+e*s}var Wn=class{static magnitudeSquared(t){return t.x*t.x+t.y*t.y}static magnitude(t){let e=Math.sqrt(this.magnitudeSquared(t));return isNaN(e)?0:e}static normalize(t){let e=this.magnitude(t);return e===0?{x:0,y:0}:this.divide(t,e)}static dot(t,e){return t.x*e.x+t.y*e.y}static subtract(t,e){return typeof e=="number"?{x:t.x-e,y:t.y-e}:{x:t.x-e.x,y:t.y-e.y}}static add(t,e){return typeof e=="number"?{x:t.x+e,y:t.y+e}:{x:t.x+e.x,y:t.y+e.y}}static multiply(t,e){return typeof e=="number"?{x:t.x*e,y:t.y*e}:{x:t.x*e.x,y:t.y*e.y}}static divide(t,e){return typeof e=="number"?{x:t.x/e,y:t.y/e}:{x:t.x/e.x,y:t.y/e.y}}static rotate(t,e,s){let i=Math.cos(jt(s)),r=Math.sin(jt(s)),n=this.subtract(t,e);return{x:e.x+i*n.x-r*n.y,y:e.y+r*n.x+i*n.y}}static min(t,e){return typeof e=="number"?{x:Math.min(t.x,e),y:Math.min(t.y,e)}:{x:Math.min(t.x,e.x),y:Math.min(t.y,e.y)}}static componentMin(t){return t.x<t.y?t.x:t.y}static max(t,e){return typeof e=="number"?{x:Math.max(t.x,e),y:Math.max(t.y,e)}:{x:Math.max(t.x,e.x),y:Math.max(t.y,e.y)}}static componentMax(t){return t.x>t.y?t.x:t.y}static roundTo(t,e){return{x:ge(t.x,e.x),y:ge(t.y,e.y)}}static floorTo(t,e){return{x:Oe(t.x,e.x),y:Oe(t.y,e.y)}}static sign(t){return{x:Math.sign(t.x),y:Math.sign(t.y)}}static abs(t){return{x:Math.abs(t.x),y:Math.abs(t.y)}}static pow(t,e){return typeof e=="number"?{x:Math.pow(t.x,e),y:Math.pow(t.y,e)}:{x:Math.pow(t.x,e.x),y:Math.pow(t.y,e.y)}}static clamp(t,e,s){return{x:Math.min(Math.max(t.x,e),s),y:Math.min(Math.max(t.y,e),s)}}static boundingBox(t){let e=Number.MAX_SAFE_INTEGER,s=Number.MIN_SAFE_INTEGER,i=Number.MAX_SAFE_INTEGER,r=Number.MIN_SAFE_INTEGER;for(let c of t)e=c.x<e?c.x:e,s=c.x>s?c.x:s,i=c.y<i?c.y:i,r=c.y>r?c.y:r;let n=s-e,o=r-i,h={x:(e+s)/2,y:(i+r)/2};return{min:{x:e,y:i},max:{x:s,y:r},width:n,height:o,center:h}}static pointInPolygon(t,e){let s=this.boundingBox(e);if(t.x<s.min.x||t.x>s.max.x||t.y<s.min.y||t.y>s.max.y)return!1;let i=!1;for(let r=0,n=e.length-1;r<e.length;n=r++){let o=e[r].y>t.y,h=e[n].y>t.y;o!==h&&t.x<(e[n].x-e[r].x)*(t.y-e[r].y)/(e[n].y-e[r].y)+e[r].x&&(i=!i)}return i}static compare(t,e,s){return this.magnitudeSquared(this.subtract(t,e))<s*s}static distance(t,e){return this.magnitude(this.subtract(t,e))}static lerp(t,e,s){return{x:Te(t.x,e.x,s),y:Te(t.y,e.y,s)}}static centroid(t){let e={x:0,y:0};for(let s of t)e.x+=s.x,e.y+=s.y;return t.length>0&&(e={x:e.x/t.length,y:e.y/t.length}),e}},Vn=class X{static inverse(e){let[s,i,r,n,o,h,c,a,l]=e,u=s*(o*l-a*h)-i*(n*l-h*c)+r*(n*a-o*c);if(Math.abs(u)<1e-14)return e;let f=1/u,E=(o*l-a*h)*f,p=(r*a-i*l)*f,O=(i*h-r*o)*f,m=(h*c-n*l)*f,g=(s*l-r*c)*f,d=(n*r-s*h)*f,y=(n*a-c*o)*f,I=(c*i-s*a)*f,_=(s*o-n*i)*f;return[E,p,O,m,g,d,y,I,_]}static multiply(e,s){return[e[0]*s[0]+e[1]*s[3]+e[2]*s[6],e[0]*s[1]+e[1]*s[4]+e[2]*s[7],e[0]*s[2]+e[1]*s[5]+e[2]*s[8],e[3]*s[0]+e[4]*s[3]+e[5]*s[6],e[3]*s[1]+e[4]*s[4]+e[5]*s[7],e[3]*s[2]+e[4]*s[5]+e[5]*s[8],e[6]*s[0]+e[7]*s[3]+e[8]*s[6],e[6]*s[1]+e[7]*s[4]+e[8]*s[7],e[6]*s[2]+e[7]*s[5]+e[8]*s[8]]}static fromPosition(e){return[1,0,e.x,0,1,e.y,0,0,1]}static fromRotation(e){let s=jt(e);return[Math.cos(s),-Math.sin(s),0,Math.sin(s),Math.cos(s),0,0,0,1]}static fromScale(e){return[e.x,0,0,0,e.y,0,0,0,1]}static fromItem(e){let s=X.fromPosition(e.position),i=X.fromScale(e.scale),r=X.fromRotation(e.rotation);return X.multiply(X.multiply(s,r),i)}static decompose(e){let[s,i,r,n,o,h]=e,c=s*o-n*i,a={position:{x:r,y:h},rotation:0,scale:{x:1,y:1}};if(s!=0||n!=0){var l=Math.sqrt(s*s+n*n);a.rotation=n>0?Math.acos(s/l):-Math.acos(s/l),a.scale={x:l,y:c/l}}else if(i!=0||o!=0){var u=Math.sqrt(i*i+o*o);a.rotation=Math.PI/2-(o>0?Math.acos(-i/u):-Math.acos(i/u)),a.scale={x:c/u,y:u}}return a.rotation=Hi(a.rotation),a}},Ft=ki(),T=new Es(Ft.origin,Ft.roomId),ji=new as(T),x=new os(T),Fi=new si(T),Yi=new ps(T),zi=new Ws(T),Ki=new Hs(T),Qi=new Fs(T),$i=new zs(T),Xi=new Qs(T),Zi=new Xs(T),qi=new Js(T),Ji=new ni(T),tn=new li(T),en=new ui(T),sn=new di(T),nn={onReady:t=>{T.ready?t():T.once("OBR_READY",()=>t())},get isReady(){return T.ready},viewport:ji,player:x,party:Fi,notification:Yi,scene:zi,contextMenu:Ki,tool:Qi,popover:$i,modal:Xi,action:Zi,interaction:qi,room:Ji,theme:tn,assets:en,broadcast:sn,isAvailable:!!Ft.origin};function Hn(t,e){return new Gi(x,t,e)}function jn(){return new _i(x)}function Fn(){return new Ui(x)}function Yn(t,e){return new fi(x,t,e)}function zn(){return new yi(x)}function Kn(){return new Wi(x)}function Qn(){return new Ei(x)}function $n(){return new mi(x)}function Xn(){return new pi(x)}function Zn(){return new gi(x)}function qn(){return new Oi(x)}function Jn(){return new Ti(x)}function tr(){return new Vi(x)}function er(t){return new vi(t)}function sr(){return new Ai}var ir=nn;

/* esm.sh 用 export{ ir as default } 导出 SDK 本体；上面已剥掉 export 语句，
 * 这里把同一个变量接成 OBR。换 SDK 后若变量名变了，dev/build-background.mjs 会直接报错。 */
var OBR = ir;

/* 具名导出：图形构建器（dev/build-background.mjs 从 SDK 的 export{} 里接过来） */
var buildCurve = jn;
var buildShape = Zn;
var buildText = qn;
var buildImage = Yn;
var buildLine = Qn;

if (!OBR || typeof OBR.onReady !== "function") {
  try {
    document.title = "4E 后台：SDK 未初始化";
    var st = document.getElementById("diag-state");
    if (st) { st.className = "bad"; st.textContent = "SDK 未初始化：没有拿到 OBR 对象"; }
  } catch (e) { /* 忽略 */ }
  return;
}

/* ==================== 2/2  插件逻辑（assets/background.core.js） ==================== */
/* 4eNEXT to owlbear · 后台逻辑（单文件「经典脚本」，没有 import / export）
 * ---------------------------------------------------------------------------
 * 本文件不直接被浏览器加载：dev/build-background.mjs 把它和 vendor/obr-sdk.js
 * （去掉末尾 export{}）拼成 assets/background.bundle.js，background.html 只加载那一个
 * <script src>。外层作用域已经提供了 OBR（SDK 的 default export）。
 *
 * 窗口（各自一个 popover id，可同时打开；尺寸都是常量，见 WINS / *_W / *_H）：
 *   /info 速览 · /panel 角色卡 · /initiative-window 先攻列表 · /initiative-strip 先攻条
 *   /dice-window 骰子 · /dice-history-window 记录 · /hp-edit 血条编辑 · /settings-window 设置
 * 入口：工具栏 ×3（角色卡 / 先攻 / 传送门）+ manifest action 骰子按钮、右下设置按钮、右键 IMAGE token（含速览）
 *   （绑定角色卡 / 加入 · 移出先攻 / 添加 · 移除血条组件 / 编辑血条）。
 *
 * 房间数据（键前缀 com.4enext-owlbear/，宿主硬上限 16 KB）：
 *   · 一律经 roomWriteGuarded() 写：先按预算（14 KB）算体积，超了**不写** + ERROR 通知；
 *   · 角色卡写不下就降级本机（localStorage["4enext/cards-local"]），写入前同样查单卡 2 KB；
 *   · 键：cards（精简卡）/ initiative（≤40 条）/ rolls（≤20 条）/ 其余都是小设置。
 *
 * 几条不能改的约定（改了会破真机）：
 *   · manifest 不加 action；只改 owlbear-plugin/ 下的文件，不自造构建步骤；
 *   · 先攻条只用 popover（hidePaper + disableClickAway）；modal + disablePointerEvents
 *     会把整条交互打穿，永远不要再走那条路；
 *   · 透明靠页面 inline !important + <meta name="darkreader-lock">（照抄 FullPeople/obr-suite，
 *     类名 / 样式表 !important 压不住后加载样式表与暗色扩展）；
 *   · 频道名 / 本机键名 / 数据键名不改（旧存档不丢），与 assets/common.js 逐字一致；
 *   · 写入失败一律看得见（ERROR / WARNING），成功不弹通知（v1.7.8 起的口径）。
 *
 * 版本史见 CHANGELOG.md；常数在哪调、怎么重建 bundle 见 docs/NOTES.md。
 * ------------------------------------------------------------------------- */

var NS = "com.4enext-owlbear";
var KEY_CARDS = NS + "/cards";
/* v1.8.0：卡片也可以存在**当前场景的隐藏 item** 里（房间数据 16 KB 装不下时的全桌共享兜底）。
 * 与 assets/cards-scene.js 的 CARD_ITEM_KEY 必须一字不差（dev/check.mjs 会对比）。
 * item.metadata[KEY_CARD_ITEM] = { v: 1, card: { id, name, level, char, importedAt, exportedAt, updatedAt } } */
var KEY_CARD_ITEM = NS + "/card";
var KEY_BIND = NS + "/cardId";
var ID_BUTTON = NS + "/button";
var ID_INFO = NS + "/info";
var ID_PANEL = NS + "/panel";
var ID_BIND = NS + "/bind";

var ID_INIT_WIN = NS + "/initiative-window";
var ID_DICE_WIN = NS + "/dice-window";

var ID_DICE_HIST = NS + "/dice-history-window";

var ID_HP_EDIT = NS + "/hp-edit";

var ID_SETTINGS_WIN = NS + "/settings-window";

var ID_STRIP = NS + "/initiative-strip";
var TOOL_ID = NS + "/panel-tool";
var TOOL_INIT_ID = NS + "/initiative-tool";
var TOOL_DICE_ID = NS + "/dice-tool";

var TOOL_GLANCE_ID = NS + "/glance-tool";
var TOOL_SETTINGS_ID = NS + "/settings-tool";
var CH_HELLO = NS + "/diag-hello";
var CH_PING = NS + "/diag-ping";
var CH_PONG = NS + "/diag-pong";
var PLUGIN_VERSION = "2.5.1";
var localStorageQuotaWarned = false;
function safeLocalSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (e) {
    try {
      if (!localStorageQuotaWarned) {
        localStorageQuotaWarned = true;
        notify("本机存储已满，已改用临时内存（刷新后可能丢失）", "WARNING");
      }
    } catch (e2) { /* 忽略 */ }
    console.error("[4enext] localStorage 写入失败", e);
    return false;
  }
}

var KEY_HP = NS + "/hp";

var KEY_HPBAR = NS + "/hp-bar/enabled";

var KEY_PLAYER_THRESHOLD = NS + "/settings.playerThreshold";

var ROOM_MAX_BYTES = 14 * 1024;
var ROOM_WRITE_LIMIT = 15500;
var ROOM_HARD_BYTES = 16 * 1024;
var ROOM_FULL_MESSAGE = "房间数据已满（16KB）：请减少导入的角色卡，或清理骰子历史";

var LS_CARDS = "4enext/cards-local";

/* ---- 0. 房间数据体积预算（超 14 KB 不写 → 降级本机 + ERROR） ---- */
function roomByteLen(str) {
  try {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(String(str)).length;
    return unescape(encodeURIComponent(String(str))).length;
  } catch (e) { return String(str).length; }
}
function roomAuditStats(meta, patch) {
  var box = {};
  try {
    if (meta && typeof meta === "object") for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) box[k] = meta[k];
    if (patch && typeof patch === "object") for (var k2 in patch) if (Object.prototype.hasOwnProperty.call(patch, k2)) box[k2] = patch[k2];
  } catch (e) { /* 忽略 */ }
  var total = roomByteLen(JSON.stringify(box));
  var ours = 0, other = 0, rows = [];
  for (var key in box) {
    if (!Object.prototype.hasOwnProperty.call(box, key)) continue;
    var n = roomByteLen(JSON.stringify(box[key]));
    if (key.indexOf(NS) === 0) ours += n; else other += n;
    rows.push({ key: key, bytes: n });
  }
  rows.sort(function (x, y) { return y.bytes - x.bytes; });
  var top = rows.slice(0, 5).map(function (r) { return r.key + ":" + r.bytes; }).join(",");
  return { total: total, ours: ours, other: other, top: top, rows: rows };
}
function roomAuditLog(meta, patch) {
  try {
    var st = roomAuditStats(meta || {}, patch || {});
    pageLog("info", "room meta total=" + (st.total / 1024).toFixed(1) + "KB ours=" + (st.ours / 1024).toFixed(1) +
      "KB other=" + (st.other / 1024).toFixed(1) + "KB top=" + st.top);
    return st;
  } catch (e) { return null; }
}
function roomBytesOf(meta, patch) {
  var box = {};
  try {
    if (meta && typeof meta === "object") for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) box[k] = meta[k];
    if (patch && typeof patch === "object") for (var k2 in patch) if (Object.prototype.hasOwnProperty.call(patch, k2)) box[k2] = patch[k2];
    return roomByteLen(JSON.stringify(box));
  } catch (e) { return 0; }
}

async function sceneMetaGet() {
  try { return (await OBR.scene.getMetadata()) || {}; } catch (e) { return {}; }
}
function roomQuotaError(e) {
  return /quota|too large|exceed.{0,30}(size|limit)|metadata.{0,30}(size|limit)|16\s*k/i.test(errText(e));
}
/** v2.5.1：整包字节超 15500 或房间 quota 报错 → 写场景 metadata；场景也失败 → 本机兜底（由调用方做）。 */
async function roomWriteGuarded(key, value) {
  var meta = {};
  try { meta = (await OBR.room.getMetadata()) || {}; } catch (e) { meta = {}; }
  var next = {};
  try {
    for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) next[k] = meta[k];
    next[key] = value;
  } catch (eNext) { next = {}; next[key] = value; }
  var bytes = 0;
  try { bytes = new TextEncoder().encode(JSON.stringify(next)).length; } catch (eEnc) { bytes = roomByteLen(JSON.stringify(next)); }
  var st = roomAuditStats(next, {});
  var store = "room";
  var res = { ok: false, reason: "", bytes: bytes, limit: ROOM_WRITE_LIMIT, ours: st.ours, other: st.other, top: st.top, store: "" };
  if (bytes <= ROOM_WRITE_LIMIT) {
    try {
      await OBR.room.setMetadata({ [key]: value });
      res.ok = true; res.store = "room";
      pageLog("info", "room bytes total=" + bytes + " key=" + key + " → room");
      return res;
    } catch (eRoom) {
      if (!roomQuotaError(eRoom)) {
        res.reason = "error"; res.error = eRoom;
        pageLog("err", "room bytes total=" + bytes + " key=" + key + " → room 写入失败：" + errText(eRoom));
        return res;
      }
      pageLog("info", "room bytes total=" + bytes + " key=" + key + " → room 超限，回退 scene");
    }
  } else {
    pageLog("info", "room bytes total=" + bytes + " key=" + key + " → scene（≥" + ROOM_WRITE_LIMIT + "）");
  }
  store = "scene";
  try {
    await OBR.scene.setMetadata({ [key]: value });
    res.ok = true; res.store = "scene"; res.reason = "";
    pageLog("info", "room bytes total=" + bytes + " key=" + key + " → scene");
    return res;
  } catch (eScene) {
    res.reason = "full"; res.error = eScene; res.store = "local";
    pageLog("err", "room bytes total=" + bytes + " key=" + key + " → local（scene 也失败：" + errText(eScene) + "）");
    return res;
  }
}

function localCardsFallback() {
  try {
    var raw = localStorage.getItem(LS_CARDS);
    if (!raw) return null;
    var box = JSON.parse(raw);
    if (box && Array.isArray(box.cards) && box.cards.length) {
      return { cards: box.cards, updatedAt: typeof box.updatedAt === "number" ? box.updatedAt : 0 };
    }
  } catch (e) {  }
  return null;
}

/* v1.8.0 真机几何：四防从 30s 缩到 22s、贴角内缩从 4s 加到 8s，
 * 让「盾/圆 + 描边」整枚都落在 token 包围盒内（旧值会探出 token 外）。 */
var SHIELD_DIAMETER = 22;
var DEF_CIRCLE_DIAMETER = 22;

var DEF_CIRCLE_SEGMENTS = 24;

var SHIELD_INSET = 8;

var DEF_GAP = 6;

var DEF_AC_FILL_OPACITY = 0.18;
var DEF_AC_STROKE_OPACITY = 0.85;
var DEF_FILL_OPACITY = 0.9;
var DEF_STROKE_OPACITY = 0.45;

/* v1.8.0：环厚 10s → 7s（旧值太厚像黑盘子）、底环不透明度 0.55 → 0.35。 */
var HP_RING_THICK = 7;
var HP_RING_INSET = 2;
var HP_RING_SEGMENTS = 48;
var HP_RING_BG_OPACITY = 0.35;
var PLAYER_THRESHOLD_DEFAULT = 25;


var COLOR_HP_FILL = "#a52424";
/* 4E「血怒（bloodied）」：HP ≤ 上限一半时血量环换成这个更暗的红（只改颜色语义，不动数据）。 */
var COLOR_HP_BLOODIED = "#7f1416";

var COLOR_RING_BG = "#0b0f14";
var DEF_KEYS = ["ac", "fort", "reflex", "will"];

var DEF_ROW = ["fort", "reflex", "will", "ac"];

var DEF_CORNER = {
  fort: "left-top",
  reflex: "right-top",
  will: "left-bottom",
  ac: "right-bottom"
};

var DEF_DROP = ["will", "reflex", "fort"];

var DEF_COLORS = { ac: "#ffffff", fort: "#e3b341", reflex: "#56d364", will: "#a371f7" };

var BAR_Z = {
  "ring-bg": 9500,
  "ring-fill": 9800,
  "bar-bg": 9500,
  "bar-fill": 9800,
  "def": 15000,
  "def-text": 16000,
  "ac-shield": 15000,
  "ac-text": 16000,
  "shield": 15000,
  "shield-text": 16000,
  "bar-text": 30000
};

/* v2.5（先攻 per-token 存储，照 Full Suite）：
 *   token.metadata[KEY_INIT] = { v:2, d20, bonus, init, tb, hidden, ownerId, updatedAt }  ← 一条先攻条目
 *   scene.metadata[KEY_COMBAT] = { v:1, phase, round, surprise, activeId, updatedAt, migratedAt? } ← 战斗态
 *   KEY_INITIATIVE = v1.3 ~ v2.4 的旧整份名单（房间或场景），只读迁移，迁完清空。
 *   KEY_IN_INIT = v1.7.3 的右键菜单镜像旗标；v2.5 起菜单直接按 token metadata 的 v:2 判断，**不再写**。 */
var KEY_INIT = NS + "/init";
var INIT_META_V = 2;
var KEY_COMBAT = NS + "/combat";
var COMBAT_META_V = 1;
var LS_INIT_BACKUP_PREFIX = "4enext/init-backup/";

var INIT_MENU_ADD = NS + "/init-add";
var INIT_MENU_ADD_HIDDEN = NS + "/init-add-hidden";
var INIT_MENU_REMOVE = NS + "/init-remove";
var KEY_INITIATIVE = NS + "/initiative";
var CH_INIT_REQUEST = NS + "/init-request";
/* v2.5.1：玩家右键「加入先攻」→ 请求 GM 代写（房间数据只有 GM 能写）。 */
var CH_INIT_JOIN = NS + "/init-join";
var CH_INIT_JOIN_ACK = NS + "/init-join-ack";
var initJoinLastAt = 0;
var initJoinTimer = null;

var BUTTON_SIZE = 64;
var RIGHT_OFFSET = 12;
var BOTTOM_OFFSET = 92;

/* v2.5.1：紧凑模式 400；右键「速览」的完整模式仍用老的 660，不能挤成一条。 */
var INFO_W_COMPACT = 460; /* v2.5.1：左右各放宽 30，保证所有行单行且左右对齐 */
var INFO_W_FULL = 660;
var INFO_W = 460; /* 兼容旧引用；完整模式用 INFO_W_FULL */
var INFO_H = 700;
var INFO_MIN_W = 360;

var INFO_TOKEN_GAP = 8;
var INFO_VIEW_MARGIN = 16;
var INFO_DRAG_IDLE_MS = 1500;
var INFO_POS_MAX = 40;
var INFO_POS_KEY = "4enext/info-pos";
var CH_INFO_DRAG = NS + "/info-drag";
var CH_INFO_SIZE = NS + "/info-size";
var CH_DICE_ROLL = NS + "/dice-roll";
var CH_DICE_CLEAR = NS + "/dice-clear";
var diceFxOpen = {}; /* rollId -> { id, timer } —— v2.5.1 照 Full Suite：不再排队/计数，每投直接开一个唯一 modal */
var diceFxSeen = {};
var DICE_ROLL_MIN_MS = 800;
var DICE_ROLL_MAX_BYTES = 6144;
var DICE_ROLL_MAX_DICE = 40;
var diceRollLastBy = {};
var DICE_MSG_TOO_FAST = "投掷太快了，请稍等片刻（每 0.8 秒只能投一次）";
var DICE_MSG_TOO_MANY = "骰子太多：一次最多 40 颗，请减少后再投";
var DICE_MSG_TOO_BIG = "本次投掷内容太大（超过 6KB），请减少骰子或缩短备注";
function diceRollRejectReason(d) {
  if (!d || typeof d !== "object") return "invalid";
  if (Array.isArray(d.dice) && d.dice.length > DICE_ROLL_MAX_DICE) return "too-many";
  try { if (JSON.stringify(d).length > DICE_ROLL_MAX_BYTES) return "too-big"; } catch (e) { return "invalid"; }
  if (typeof d.data === "string" && d.data.length > DICE_ROLL_MAX_BYTES) return "too-big";
  return "";
}
function diceRollSenderLocal(ev, d) {
  try {
    var my = OBR.player && typeof OBR.player.getId === "function" ? null : null;
    if (ev && ev.playerId && my) return ev.playerId === my;
    return false;
  } catch (e) { return false; }
}
async function isLocalRollSender(ev, d) {
  try {
    var my = await OBR.player.getId();
    if (ev && ev.playerId) return ev.playerId === my;
    return !!(d && d.rollerId && d.rollerId === my);
  } catch (e) { return false; }
}
function diceRollValid(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return false;
  if (typeof d.id !== "string" || !d.id || d.id.length > 120) return false;
  if (typeof d.rollerId !== "string" || d.rollerId.length > 120) return false;
  if (!Array.isArray(d.dice) || d.dice.length < 1 || d.dice.length > DICE_ROLL_MAX_DICE) return false;
  for (var i = 0; i < d.dice.length; i++) {
    var one = d.dice[i];
    if (!one || typeof one.type !== "string" || !/^d\d{1,4}$/i.test(one.type)) return false;
    if (typeof one.value !== "number" || !isFinite(one.value)) return false;
    var sides = parseInt(one.type.slice(1), 10);
    if (!(sides >= 2 && sides <= 1000)) return false;
    if (one.value < 1 || one.value > sides) return false;
  }
  if (typeof d.total !== "number" || !isFinite(d.total)) return false;
  if (d.modifier != null && (typeof d.modifier !== "number" || !isFinite(d.modifier))) return false;
  if (d.anchor != null && (typeof d.anchor !== "object" || !isFinite(d.anchor.x) || !isFinite(d.anchor.y))) return false;
  if (typeof d.data === "string" && d.data.length > DICE_ROLL_MAX_BYTES) return false;
  try { if (JSON.stringify(d).length > DICE_ROLL_MAX_BYTES) return false; } catch (e) { return false; }
  return true;
}

var WIN_MARGIN = 16;
var WIN_DRAG_IDLE_MS = 1500;
var WIN_POS_KEY = "4enext/win-pos";
var CH_WIN_DRAG = NS + "/win-drag";

var CH_DICE_HIST_CMD = NS + "/dice-hist-cmd";
var CH_DICE_HIST_STATE = NS + "/dice-hist-state";

var CH_HP_EDIT_TARGET = NS + "/hp-edit-target";
var CH_HP_EDIT_READY = NS + "/hp-edit-ready";
var CH_HP_EDIT_SAVED = NS + "/hp-edit-saved";
/* v2.5.1：页面切换/载入完成回 ack（单窗换目标确认；600ms 无 ack 兜底重开一次）。 */
var CH_HP_EDIT_ACK = NS + "/hp-edit-ack";
/* v2.5.1：血条编辑窗「重绘」按钮 → 后台强制重算这张 token 的血条环 / 四防盾 / 资源徽记。 */
var CH_HP_REPAINT = NS + "/hp-repaint";
var CH_HPEDIT_LOG = NS + "/hpedit-log";
/* v1.8.9：信息窗单次挂载 —— 目标租约（换 token 只广播 target，不重开 popover）+ ready 握手。 */
var CH_INFO_TARGET = NS + "/info-target";
var CH_INFO_READY = NS + "/info-ready";
/* v1.9.0：页面刷新成功 ack —— 700ms 没收到就兜底关闭重开一次（极端情况下内容也能换过去）。 */
var CH_INFO_ACK = NS + "/info-ack";

var HPE_W = 420;
var HPE_H = 126;

var STRIP_COLLAPSED_W = 120;
var STRIP_COLLAPSED_H = 40;
var STRIP_EXPANDED_W = 720;
var STRIP_MIN_EXPANDED_W = 410;

var STRIP_H_IDLE = 170;
var STRIP_H_PREPARING = 180;
var STRIP_H_COMBAT = 200;
var STRIP_TOP_OFFSET = 45;
var STRIP_SIDE_MARGIN = 16;
var STRIP_POS_KEY = "4enext/strip-pos";

var STRIP_AUTOSTART_KEY = "4enext/strip-autostart";
var STRIP_CLOSED_KEY = "4enext/strip-closed-this-session";
/* v1.9.2：骰子记录窗口默认进入房间自动打开（可在设置关掉；本次会话 ✕ 后不再自动开）。 */
var DICE_HIST_AUTOSTART_KEY = "4enext/dice-hist-autostart";
var DICE_HIST_CLOSED_KEY = "4enext/dice-hist-closed";
var DICE_AUTOSTART_KEY = "4enext/dice-autostart";
var DICE_CLOSED_KEY = "4enext/dice-closed-this-session";

var STRIP_COLLAPSED_KEY = "4enext/strip-collapsed";
var CH_STRIP_DRAG = NS + "/strip-drag";
var CH_STRIP_CMD = NS + "/strip-cmd";

var CH_WIN_CLOSE = NS + "/win-close";
var CH_WIN_RESIZE = NS + "/win-resize";
var WIN_SIZE_PREFIX = "4enext/win-size/";
/* v1.8.2：先攻条点卡片时页面先广播这个频道，后台 1.5s 内不自动弹速览（与 common.js 逐字一致）。 */
var CH_GLANCE_SUPPRESS = NS + "/glance-suppress";

var CH_ROLL = NS + "/roll";
var CH_ROLL_CLEAR = NS + "/roll-clear";
var CH_ROLL_SAVED = NS + "/roll-saved";
var KEY_ROLLS = NS + "/rolls";
var ROLL_MAX_ROWS = 100; /* v2.5.1：对齐 Full Suite DICE_HISTORY_LIMIT=100 */
var ROLL_MAX_DICE = 30;
var ROLL_LABEL_MAX = 40;
var ROLL_EXPR_MAX = 200;
var ROLL_ROOM_BYTES = 12000;
var ROLL_COLOR_DEFAULT = "#5dade2";

var BASE = (function () {
  try {
    var u = new URL("./", location.href);
    if (/^(https?:|file:)$/.test(u.protocol)) return u.href;
  } catch (e) {  }
  try { return new URL("./", document.baseURI).href; } catch (e) {  }
  return "https://yzzj66.github.io/4e-obr-cards/";
})();

function pageUrl(name) { return BASE + name; }

var ICON_URL = pageUrl("icon.svg");
var TOOL_DICE_ICON_URL = pageUrl("icon-tool-dice.svg");
var TOOL_ICON_URL = pageUrl("icon-tool.svg");

var TOOL_INIT_ICON_URL = pageUrl("icon-tool-initiative.svg");

var TOOL_GLANCE_ICON_URL = pageUrl("icon-tool-glance.svg");
var TOOL_SETTINGS_ICON_URL = pageUrl("icon-tool-settings.svg");
var URL_PANEL = pageUrl("panel.html");
var URL_INFO = pageUrl("info.html");

var URL_INITIATIVE = pageUrl("initiative.html");
var URL_DICE = pageUrl("dice.html");
var URL_EFFECT = pageUrl("effect.html");

var URL_DICE_HIST = pageUrl("dice-history.html");

var URL_HP_EDIT = pageUrl("hp-edit.html");

var URL_SETTINGS = pageUrl("settings.html");
var URL_BIND = pageUrl("bind.html");
var URL_BUTTON = pageUrl("button.html");

/* v2.5.1：传送门（核心）。 */
var KEY_PORTAL = NS + "/portal";
var TOOL_PORTAL_ID = NS + "/portal-tool";
var TOOL_PORTAL_MODE_ID = NS + "/portal-mode";
var TOOL_PORTAL_PAIR_MODE_ID = NS + "/portal-pair-mode";
var ID_PORTAL_EDIT = NS + "/portal-edit";
var ID_PORTAL_DEST = NS + "/portal-dest";
var CH_OPEN_SETTINGS = NS + "/open-settings";
var CH_PORTAL_SAVE = NS + "/portal-save";
var CH_PORTAL_EDIT_CLOSE = NS + "/portal-edit-close";
var CH_PORTAL_TELEPORT = NS + "/portal-teleport";
var URL_PORTAL_EDIT = pageUrl("portal-edit.html");
var URL_PORTAL_DEST = pageUrl("portal-dest.html");
var PORTAL_ICON_URL = pageUrl("assets/portal.png") + "?v=" + PLUGIN_VERSION;
var TOOL_PORTAL_ICON_URL = pageUrl("assets/portal.svg");
var PORTAL_MIN_RADIUS = 16;
var PORTAL_WALL_PADDING = 8;
var PORTAL_SUPPRESS_MS = 700;
var PORTAL_EDIT_W = 360;
var PORTAL_EDIT_H = 430;
var PORTAL_DEST_W = 360;
var PORTAL_DEST_H = 380;
var PORTAL_PREVIEW_TAG = NS + "/portal-preview";
var PORTAL_GHOST_TAG = NS + "/portal-ghost";
var PORTAL_PAIR_TAG = NS + "/portal-pair-preview";

/* ---- 1. 日志 / 通知 / 失败上报（成功不打扰，失败必可见） ---- */
function pageLog(kind, text) {
  var line = "[" + new Date().toISOString().slice(11, 19) + "] " + text;
  try {
    var box = document.getElementById("diag-log");
    if (box) {
      var li = document.createElement("li");
      li.className = "k-" + kind;
      li.textContent = line;
      box.appendChild(li);
    }
    var state = document.getElementById("diag-state");
    if (state) {
      if (kind === "err") {
        state.className = "bad";
        state.textContent = "最新错误：" + text;
      } else if (kind === "ok" && state.className !== "bad") {
        state.className = "good";
        state.textContent = "运行中：" + text;
      }
    }
  } catch (e) {  }
  try {
    if (kind === "err") console.error("[4enext]", line);
    else console.log("[4enext]", line);
  } catch (e) {  }
}

function diagNotifyEnabled() {
  try { return localStorage.getItem("4enext/diag") !== "0"; } catch (e) { return true; }
}

function notify(msg, variant) {
  if (variant !== "ERROR" && variant !== "WARNING") {
    pageLog("info", msg);
    return null;
  }
  try {
    return OBR.notification.show(msg, variant);
  } catch (e) {
    pageLog("err", "OBR.notification.show 失败：" + (e && e.message ? e.message : e));
    return null;
  }
}

function errText(e) {
  if (!e) return "未知错误";
  if (typeof e === "string") return e;
  if (e.message) return e.message;
  if (e.reason) return e.reason;
  try { return JSON.stringify(e); } catch (e2) { return String(e); }
}

var seenErrors = {};
function stepFail(where, e) {
  var msg = where + " —— " + errText(e);
  pageLog("err", msg);
  if (seenErrors[msg]) return;
  seenErrors[msg] = true;
  notify("4E插件出错：" + msg, "ERROR");
}

function stepOk(text) { pageLog("ok", text); }

function attempt(where, fn) {
  try {
    var r = fn();
    if (r && typeof r.then === "function") {
      return r.then(function () { stepOk(where + " ✓"); return true; }, function (e) { stepFail(where, e); return false; });
    }
    stepOk(where + " ✓");
    return Promise.resolve(true);
  } catch (e) {
    stepFail(where, e);
    return Promise.resolve(false);
  }
}

var WINS = {

  panel: { id: ID_PANEL, url: URL_PANEL, width: 960, height: 660 },

  initiative: { id: ID_INIT_WIN, url: URL_INITIATIVE + "?view=list", width: 880, height: 640 },

  dice: { id: ID_DICE_WIN, url: URL_DICE, width: 320, height: 620 },

  diceHistory: { id: ID_DICE_HIST, url: URL_DICE_HIST, width: 300, height: 240 },

  settings: { id: ID_SETTINGS_WIN, url: URL_SETTINGS, width: 860, height: 620 },

  hpEdit: { id: ID_HP_EDIT, url: URL_HP_EDIT, width: HPE_W, height: HPE_H },

  portalEdit: { id: ID_PORTAL_EDIT, url: URL_PORTAL_EDIT, width: PORTAL_EDIT_W, height: PORTAL_EDIT_H },

  portalDest: { id: ID_PORTAL_DEST, url: URL_PORTAL_DEST, width: PORTAL_DEST_W, height: PORTAL_DEST_H }
};

var winOpen = {};
var winOpenedAt = {};

var winDragWanted = {};
var winDragBusy = false;

/* ---- 2. 独立窗口：WINS 注册 / 尺寸夹紧 / 位置记忆 / 拖动 ---- */
function winDef(name) {
  return WINS[name] || null;
}

function winSize(def, vp) {
  var availW = (vp && vp.width > 0 ? vp.width : def.width) - WIN_MARGIN * 2;
  var availH = (vp && vp.height > 0 ? vp.height : def.height) - WIN_MARGIN * 2;
  return {
    width: Math.round(Math.min(def.width, Math.max(240, availW))),
    height: Math.round(Math.min(def.height, Math.max(220, availH)))
  };
}

function winDefaultPos(name, size, vp) {
  var vw = vp && vp.width > 0 ? vp.width : size.width + WIN_MARGIN * 2;
  var vh = vp && vp.height > 0 ? vp.height : size.height + WIN_MARGIN * 2;
  var base = clampInfoPos(
    (vw - size.width) / 2,
    Math.max(WIN_MARGIN, (vh - size.height) * 0.35),
    size, vp
  );
  if (name !== "diceHistory") return base;
  var st = winOpen["dice"];
  var g = st && st.geom ? st.geom : null;
  if (!g) return base;
  var gap = 12;
  var spots = [
    { left: g.left + g.width + gap, top: g.top },
    { left: g.left - size.width - gap, top: g.top },
    { left: g.left, top: g.top + g.height + gap },
    { left: g.left, top: g.top - size.height - gap }
  ];
  for (var i = 0; i < spots.length; i++) {
    var one = spots[i];
    if (one.left < WIN_MARGIN || one.top < WIN_MARGIN) continue;
    if (one.left + size.width > vw - WIN_MARGIN || one.top + size.height > vh - WIN_MARGIN) continue;
    return { left: Math.round(one.left), top: Math.round(one.top) };
  }
  return base;
}

function readWinPosMap() {
  try {
    var raw = localStorage.getItem(WIN_POS_KEY);
    if (!raw) return {};
    var box = JSON.parse(raw);
    if (!box || typeof box !== "object") return {};
    var src = box.pos && typeof box.pos === "object" ? box.pos : box;
    var out = {};
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var one = src[k];
      if (!one || typeof one !== "object") continue;
      if (typeof one.left !== "number" || typeof one.top !== "number") continue;
      if (!isFinite(one.left) || !isFinite(one.top)) continue;
      out[k] = { left: one.left, top: one.top };
    }
    return out;
  } catch (e) {
    return {};
  }
}

function readWinPos(name) {
  if (!name) return null;
  return readWinPosMap()[name] || null;
}

function writeWinPos(name, pos) {
  if (!name || !pos) return;
  try {
    var map = readWinPosMap();
    map[name] = { left: Math.round(pos.left), top: Math.round(pos.top) };
    safeLocalSet(WIN_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function clearWinPos(name) {
  if (!name) return;
  try {
    var map = readWinPosMap();
    delete map[name];
    if (!Object.keys(map).length) localStorage.removeItem(WIN_POS_KEY);
    else safeLocalSet(WIN_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function winPopoverOptions(def, pos, size, url) {
  return {
    id: def.id,
    url: url,
    width: size.width,
    height: size.height,
    anchorReference: "POSITION",
    anchorPosition: { left: pos.left, top: pos.top },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true
  };
}

/** v2.5.1：窗口页 HTML 自身也带缓存，打开 URL 统一补 ?v=<PLUGIN_VERSION>（已有 v= 不重复）。 */
function withWindowVersion(url) {
  var u = String(url || "");
  if (/[?&]v=[^&]*/.test(u)) return u;
  return u + (u.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(PLUGIN_VERSION);
}
function b64urlEncode(str) {
  try {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (e) { return ""; }
}
function diceFxUrl(payload) {
  var data = b64urlEncode(JSON.stringify(payload));
  return withWindowVersion(URL_EFFECT + "?data=" + encodeURIComponent(data));
}
async function openDiceFx(payload) {
  if (!payload || !payload.id) return false;
  if (diceFxSeen[payload.id]) return false;
  diceFxSeen[payload.id] = Date.now();
  setTimeout(function () { delete diceFxSeen[payload.id]; }, 5000);
  return runDiceFx(payload);
}
/* v2.5.1（照 Full Suite dice/index.ts）：**不排队、不计数**，每次投掷直接开唯一 id 的 modal，
 * 由 effect 页自己关；这里只保留 6s 兜底 close，避免页面异常时留下透明层。
 * 旧实现「队列上限 2 + 3200ms 定时器 + active 计数」在高频投掷时会让动画排队/丢失。 */
async function runDiceFx(payload) {
  var id = NS + "/dice-fx-" + payload.id;
  var url = diceFxUrl(payload);
  try {
    if (!OBR.modal || typeof OBR.modal.open !== "function") return false;
    await OBR.modal.open({ id: id, url: url, fullScreen: true, hideBackdrop: true, hidePaper: true, disablePointerEvents: true });
    diceFxOpen[payload.id] = { id: id, timer: setTimeout(function () {
      try { void OBR.modal.close(id); } catch (e) { /* 忽略 */ }
      delete diceFxOpen[payload.id];
    }, 6000) };
    pageLog("info", "dice fx open roll=" + payload.id + " total=" + payload.total);
    return true;
  } catch (e) {
    pageLog("err", "dice fx open 失败：" + errText(e));
    return false;
  }
}
function closeDiceFx(filter) {
  var f = filter || {};
  for (var rid in diceFxOpen) {
    if (!Object.prototype.hasOwnProperty.call(diceFxOpen, rid)) continue;
    if (f.rollId && rid !== f.rollId) continue;
    var rec = diceFxOpen[rid];
    if (rec.timer) clearTimeout(rec.timer);
    try { void OBR.modal.close(rec.id); } catch (e) { /* 忽略 */ }
    delete diceFxOpen[rid];
  }
}
function readWinSize(name) {
  try {
    var raw = localStorage.getItem(WIN_SIZE_PREFIX + name);
    if (!raw) return null;
    var o = JSON.parse(raw);
    var w = Math.round(Number(o && o.w)), h = Math.round(Number(o && o.h));
    if (w > 0 && h > 0) return { width: w, height: h };
  } catch (e) { /* 忽略 */ }
  return null;
}
function writeWinSize(name, w, h) {
  try { safeLocalSet(WIN_SIZE_PREFIX + name, JSON.stringify({ w: Math.round(w), h: Math.round(h) })); } catch (e) { /* 忽略 */ }
}
async function onWinResize(ev) {
  var d = ev && ev.data ? ev.data : ev;
  if (!d || d.name == null) return;
  var name = String(d.name);
  var st = winOpen[name];
  if (!st) return;
  var def = winDef(name);
  if (!def) return;
  var vp = await infoViewport();
  var minW = name === "diceHistory" ? 300 : 200;
  var minH = name === "diceHistory" ? 200 : 150;
  var maxW = Math.max(minW, Math.round(vp.width * 0.9));
  var maxH = Math.max(minH, Math.round(vp.height * 0.9));
  var w = Math.max(minW, Math.min(maxW, Math.round(Number(d.w) || def.width)));
  var h = Math.max(minH, Math.min(maxH, Math.round(Number(d.h) || def.height)));
  if (name === "hpEdit") {
    /* v2.5.1：血条编辑窗高度固定（内容只有 126px），拉高只会露出黑色空底。 */
    h = HPE_H;
    w = Math.max(400, Math.min(560, w));
  }
  var geom = st.geom || {};
  var left = geom.left != null ? geom.left : 12;
  var top = geom.top != null ? geom.top : 12;
  var pos = clampInfoPos(left, top, { width: w, height: h }, vp);
  try {
    await OBR.popover.open(winPopoverOptions(def, pos, { width: w, height: h }, geom.url || def.url));
  } catch (e) {
    pageLog("err", "win resize 重开失败：" + errText(e));
    return;
  }
  winOpen[name] = { geom: { left: pos.left, top: pos.top, width: w, height: h, url: geom.url || def.url, vp: { width: vp.width, height: vp.height } }, drag: null, timer: null };
  if (name !== "hpEdit") writeWinSize(name, w, h);
  pageLog("info", "win resize name=" + name + " w=" + w + " h=" + h);
}
async function openWin(name, urlOverride) {
  var def = winDef(name);
  if (!def) throw new Error("未知窗口：" + name);
  /* v2.5.1：内存状态可能过期（iframe 已关但 winOpen 还在）。先探测真实 popover。 */
  if (winOpen[name]) {
    var alive = true;
    if (OBR.popover && typeof OBR.popover.getWidth === "function") {
      try { var w = await OBR.popover.getWidth(def.id); alive = typeof w === "number" && w > 0; } catch (eProbe) { alive = false; }
    }
    if (!alive) {
      pageLog("info", "窗口状态过期，清理后重开：" + name);
      delete winOpen[name];
      try { await OBR.popover.close(def.id); } catch (eClr) { /* 忽略 */ }
    }
  }
  var url = withWindowVersion(typeof urlOverride === "string" && urlOverride ? urlOverride : def.url);
  pageLog("info", "openWin name=" + name + " fromWins=" + !!winOpen[name] + " url=" + url);
  var vp = await infoViewport();
  var size = winSize(def, vp);
  var mem = readWinSize(name);
  if (name === "hpEdit") {
    /* v2.5.1：血条窗高度固定，历史被拉高的尺寸不再沿用（否则一打开就是大片黑底）。 */
    mem = null;
    try { localStorage.removeItem("4enext/win-size/hpEdit"); } catch (eClr) { /* 忽略 */ }
  }
  if (mem) size = { width: Math.min(mem.width, Math.round(vp.width * 0.9)), height: Math.min(mem.height, Math.round(vp.height * 0.9)) };
  var saved = readWinPos(name);
  var pos = saved ? clampInfoPos(saved.left, saved.top, size, vp) : winDefaultPos(name, size, vp);
  if (!saved && name === "dice") pos = clampInfoPos(12, 96, size, vp);
  pageLog("info", "openWin pos=" + pos.left + "," + pos.top + " size=" + size.width + "x" + size.height + " vp=" + vp.width + "x" + vp.height);
  await OBR.popover.open(winPopoverOptions(def, pos, size, url));
  winOpenedAt[name] = Date.now();
  if (OBR.popover && typeof OBR.popover.getWidth === "function") {
    setTimeout(function () {
      try {
        var pw = OBR.popover.getWidth(def.id);
        if (pw && typeof pw.then === "function") pw.then(function (w) { pageLog("info", "openWin after name=" + name + " width=" + w); }).catch(function () { pageLog("info", "openWin after name=" + name + " width=err"); });
      } catch (eW) { pageLog("info", "openWin after name=" + name + " width=throw"); }
    }, 200);
  }
  winOpen[name] = {
    geom: {
      left: pos.left, top: pos.top, width: size.width, height: size.height,
      url: url, vp: { width: vp.width, height: vp.height }
    },
    drag: null,
    timer: null
  };
  return true;
}

async function closeWin(name) {
  pageLog("info", "closeWin name=" + name + " source=closeWin");
  var st = winOpen[name];
  if (st && st.timer) { clearTimeout(st.timer); st.timer = null; }
  delete winOpen[name];
  if (name === "portalDest") portalDestOpen = false;
  if (name === "portalEdit") portalEditItemId = "";
  var def = winDef(name);
  if (!def) return;
  try { await OBR.popover.close(def.id); } catch (e) {  }
}

async function closeWinById(name, source) {
  pageLog("info", "closeWinById name=" + name + " source=" + (source || "broadcast") + " winOpen=" + !!winOpen[name]);
  var def = name === "info" ? { id: ID_INFO } : winDef(name);
  if (!def) return false;
  if (name === "info") {
    /* v1.8.5：用户手动 ✕ 关掉速览 → 记住这枚 token，选中不变之前不再自动弹回（修「莫名其妙跳出来」）。 */
    if (infoItemId) infoAutoPopped[infoItemId] = true;
    infoOpen = false;
    infoItemId = null;
    infoCardId = null;
    infoGeom = null;
    /* v1.8.9：关窗清掉目标租约，下次打开重新分配 session。 */
    resetInfoTarget();
  } else {
    var st = winOpen[name];
    if (st && st.timer) { clearTimeout(st.timer); st.timer = null; }
    delete winOpen[name];
    /* v1.8.1：手动 ✕ 关掉血条编辑窗后，别再对同一个选中 token 自动弹（要再改就右键「编辑血条」）。 */
    if (name === "hpEdit" && hpEditTarget.itemId) hpAutoPopped[hpEditTarget.itemId] = true;
    /* v1.9.2：用户 ✕ 关掉骰子记录窗口 → 本次会话不再自动打开。 */
    if (name === "diceHistory") markDiceHistClosed(true);
    if (name === "dice") markDiceClosed(true);
  }
  try { await OBR.popover.close(def.id); } catch (e) {  }
  try { if (OBR.modal && typeof OBR.modal.close === "function") await OBR.modal.close(def.id); } catch (e2) {  }
  pageLog("info", "窗口 ✕（后台兜底）：" + name);
  return true;
}

function onWinClose(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || data.op !== "close-win" || typeof data.name !== "string") return;
  try {
    pageLog("info", "CH_WIN_CLOSE data=" + JSON.stringify(data) + " from=" +
      (ev && (ev.playerId || ev.connectionId || "?")) + " winOpen=" + Object.keys(winOpen).join(","));
  } catch (eLog) { /* 忽略 */ }
  /* v2.5.1：刚打开 1.5s 内忽略关闭广播（旧 iframe / launcher 收尾误发）；只有页面 ✕ 也在这之后才有效。 */
  var age = winOpenedAt[data.name] ? Date.now() - winOpenedAt[data.name] : Infinity;
  if (age < 1500) {
    pageLog("info", "win close ignore（刚打开）name=" + data.name + " age=" + age);
    return;
  }
  if (winOpenedAt[data.name] && typeof data.at === "number" && data.at < winOpenedAt[data.name]) {
    pageLog("info", "win close ignore（旧广播）name=" + data.name);
    return;
  }
  void closeWinById(data.name, "broadcast");
}

async function resetWin(name) {
  if (!winOpen[name] || !winOpen[name].geom) return;
  var def = winDef(name);
  var vp = await infoViewport();
  var size = winSize(def, vp);
  var mem = readWinSize(name);
  if (mem) size = { width: Math.min(mem.width, Math.round(vp.width * 0.9)), height: Math.min(mem.height, Math.round(vp.height * 0.9)) };
  var pos = winDefaultPos(name, size, vp);
  var url = winOpen[name].geom ? winOpen[name].geom.url : def.url;
  try {
    await OBR.popover.open(winPopoverOptions(def, pos, size, url));
    winOpen[name].geom = {
      left: pos.left, top: pos.top, width: size.width, height: size.height,
      url: url, vp: { width: vp.width, height: vp.height }
    };
    winOpen[name].drag = null;
    pageLog("info", "窗口 " + name + " 已回到默认位置");
  } catch (e) {
    stepFail("把窗口 " + name + " 移回默认位置", e);
  }
}

function queueWinDrag(name, pos) {
  var st = winOpen[name];
  if (!st || !st.geom) return;
  winDragWanted[name] = {
    pos: { left: pos.left, top: pos.top },
    size: { width: st.geom.width, height: st.geom.height },
    url: st.geom.url
  };
  void pumpWinDrag();
}

async function pumpWinDrag() {
  if (winDragBusy) return;
  winDragBusy = true;
  try {
    while (true) {
      var names = Object.keys(winDragWanted);
      if (!names.length) break;
      var name = names[0];
      var job = winDragWanted[name];
      delete winDragWanted[name];
      var def = winDef(name);
      var st = winOpen[name];
      if (!def || !st) continue;
      try {
        await OBR.popover.open(winPopoverOptions(def, job.pos, job.size, job.url));
        st.geom.left = job.pos.left;
        st.geom.top = job.pos.top;
      } catch (e) {
        pageLog("err", "拖动窗口 " + name + " 失败：" + errText(e));
      }
    }
  } finally {
    winDragBusy = false;
    if (Object.keys(winDragWanted).length) void pumpWinDrag();
  }
}

function touchWinDrag(name) {
  var st = winOpen[name];
  if (!st) return;
  if (st.timer) clearTimeout(st.timer);
  st.timer = setTimeout(function () {
    st.timer = null;
    if (!st.drag) return;
    if (st.drag.moved && st.geom) writeWinPos(name, st.geom);
    st.drag = null;
  }, WIN_DRAG_IDLE_MS);
}

function endWinDrag(name) {
  var st = winOpen[name];
  if (!st) return;
  if (st.timer) { clearTimeout(st.timer); st.timer = null; }
  st.drag = null;
}

/* v2.5.1：拖动改用「start 时最新视口 + 本轮 base/size」模型（照 Full Suite panelDrag/panelLayout）。
 * 旧实现用 st.geom.vp（打开窗口时的快照）clamp，视口变大后向下拖会卡在旧下限。 */
async function beginWinDrag(name, st) {
  var vp = await infoViewport();
  if (!(vp.width > 0 && vp.height > 0)) vp = st.geom.vp && st.geom.vp.width > 0 ? st.geom.vp : lastVp;
  var size = { width: st.geom.width, height: st.geom.height };
  var pos = clampInfoPos(st.geom.left, st.geom.top, size, vp);
  st.geom.vp = { width: vp.width, height: vp.height };
  if (pos.left !== st.geom.left || pos.top !== st.geom.top) {
    st.geom.left = pos.left;
    st.geom.top = pos.top;
    try {
      var def = winDef(name);
      if (def) await OBR.popover.open(winPopoverOptions(def, pos, size, st.geom.url));
    } catch (e) {  }
  }
  st.drag = {
    base: { left: st.geom.left, top: st.geom.top },
    vp: { width: vp.width, height: vp.height },
    size: size,
    moved: false
  };
}

async function onWinDrag(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.phase !== "string") return;
  var name = String(data.win == null ? "" : data.win);
  var st = winOpen[name];

  if (!st || !st.geom) return;

  if (data.phase === "reset") {
    clearWinPos(name);
    st.drag = null;
    st._dragReady = null;
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    void resetWin(name);
    return;
  }

  var dx = typeof data.dx === "number" && isFinite(data.dx) ? data.dx : 0;
  var dy = typeof data.dy === "number" && isFinite(data.dy) ? data.dy : 0;

  if (data.phase === "start" || !st.drag) {
    st.drag = null;
    /* start 时只 await 一次最新视口（move 帧不再 await，避免卡顿）。 */
    var ready = beginWinDrag(name, st);
    st._dragReady = ready;
    try { await ready; } catch (e0) { st._dragReady = null; }
    st._dragReady = null;
    touchWinDrag(name);
    if (data.phase === "start") return;
    if (!st.drag) return;
  }

  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) st.drag.moved = true;

  if (!st.drag.moved) {
    if (data.phase === "end") endWinDrag(name);
    return;
  }

  var target = clampInfoPos(st.drag.base.left + dx, st.drag.base.top + dy, st.drag.size, st.drag.vp);
  queueWinDrag(name, target);
  touchWinDrag(name);

  if (data.phase === "end") {
    writeWinPos(name, target);
    /* end 时刷新一次视口，供下次拖动 / 后续 clamp 使用。 */
    try {
      var vpEnd = await infoViewport();
      if (vpEnd.width > 0 && vpEnd.height > 0) st.geom.vp = { width: vpEnd.width, height: vpEnd.height };
    } catch (e1) {  }
    endWinDrag(name);
  }
}
async function reclampWins(vpArg) {
  var names = Object.keys(winOpen);
  if (!names.length) return;
  var vp = vpArg && vpArg.width > 0 && vpArg.height > 0 ? vpArg : await infoViewport();
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var def = winDef(name);
    var st = winOpen[name];
    if (!def || !st || !st.geom) continue;
    var size = winSize(def, vp);
    var pos = clampInfoPos(st.geom.left, st.geom.top, size, vp);
    if (pos.left === st.geom.left && pos.top === st.geom.top &&
      size.width === st.geom.width && size.height === st.geom.height) continue;
    try {
      await OBR.popover.open(winPopoverOptions(def, pos, size, st.geom.url));
      st.geom = {
        left: pos.left, top: pos.top, width: size.width, height: size.height,
        url: st.geom.url, vp: { width: vp.width, height: vp.height }
      };
    } catch (e) {  }
  }
}

async function openPanel(where) {
  try {
    await openWin("panel");
    stepOk((where || "面板") + "：已打开（独立窗口）");
    return true;
  } catch (e) {
    stepFail("打开角色卡面板（" + (where || "入口") + "）", e);
    try {
      await OBR.modal.open({ id: ID_PANEL, url: URL_PANEL, fullScreen: true });
      stepOk("面板窗口打不开，已改用全屏 modal");
      return true;
    } catch (e2) {
      stepFail("改用全屏 modal 也失败", e2);
      try {
        await OBR.action.open();
        stepOk("面板打开失败，已改用左上角 action 弹窗");
        return true;
      } catch (e3) {
        stepFail("改用 action 弹窗也失败", e3);
        return false;
      }
    }
  }
}

async function openWinOrNotify(name, where) {
  try {
    await openWin(name);
    stepOk((where || name) + "：已打开");
    return true;
  } catch (e) {
    stepFail("打开窗口（" + (where || name) + "）", e);
    return false;
  }
}

function diceHistoryIsOpen() {
  return !!winOpen["diceHistory"];
}

function markDiceHistoryAlive() {
  if (winOpen["diceHistory"]) return;
  winOpen["diceHistory"] = { geom: null, drag: null, timer: null, external: true };
}

async function diceHistoryAlive() {
  if (!diceHistoryIsOpen()) return false;
  var st = winOpen["diceHistory"];
  if (st && !st.geom) return true;
  try {
    if (OBR.popover && typeof OBR.popover.getWidth === "function") {
      await OBR.popover.getWidth(ID_DICE_HIST);
      return true;
    }
  } catch (e) {
    delete winOpen["diceHistory"];
    pageLog("info", "记录窗口已经不在（状态跟丢）→ 下次命令直接重开");
    return false;
  }
  return true;
}

function winWait(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

function rectOverlapRatio(a, b) {
  if (!a || !b) return 0;
  var x1 = Math.max(a.left, b.left);
  var y1 = Math.max(a.top, b.top);
  var x2 = Math.min(a.left + a.width, b.left + b.width);
  var y2 = Math.min(a.top + a.height, b.top + b.height);
  var iw = Math.max(0, x2 - x1);
  var ih = Math.max(0, y2 - y1);
  var area = Math.max(1, a.width * a.height);
  return (iw * ih) / area;
}

async function adoptDiceHistory(data) {
  var w = typeof data.width === "number" && data.width > 0 ? data.width : WINS.diceHistory.width;
  var h = typeof data.height === "number" && data.height > 0 ? data.height : WINS.diceHistory.height;
  var left = typeof data.left === "number" && isFinite(data.left) ? data.left : WIN_MARGIN;
  var top = typeof data.top === "number" && isFinite(data.top) ? data.top : WIN_MARGIN;
  var vp = await infoViewport();
  var size = { width: w, height: h };
  var rect = { left: left, top: top, width: w, height: h };
  /* v1.9.2：记录窗口「点了没反应」——如果和骰子窗口重叠超过 30%，挪到骰子窗口旁边再打开。 */
  var diceGeom = winOpen["dice"] && winOpen["dice"].geom ? winOpen["dice"].geom : null;
  var moved = false;
  if (diceGeom && rectOverlapRatio(rect, diceGeom) > 0.3) {
    var gap = 12;
    var candidates = [
      { left: diceGeom.left - w - gap, top: diceGeom.top },
      { left: diceGeom.left, top: diceGeom.top + diceGeom.height + gap },
      { left: diceGeom.left, top: diceGeom.top - h - gap },
      { left: WIN_MARGIN, top: WIN_MARGIN }
    ];
    for (var i = 0; i < candidates.length; i++) {
      var one = candidates[i];
      var clamped = clampInfoPos(one.left, one.top, size, vp);
      if (rectOverlapRatio({ left: clamped.left, top: clamped.top, width: w, height: h }, diceGeom) <= 0.3) {
        left = clamped.left;
        top = clamped.top;
        moved = true;
        break;
      }
      if (i === candidates.length - 1) {
        left = clamped.left;
        top = clamped.top;
        moved = true;
      }
    }
  }
  winOpen["diceHistory"] = {
    geom: {
      left: left, top: top, width: w, height: h,
      url: URL_DICE_HIST, vp: { width: vp.width, height: vp.height }
    },
    drag: null,
    timer: null,
    external: true
  };
  if (moved) {
    try {
      await OBR.popover.open(winPopoverOptions(WINS.diceHistory, { left: left, top: top }, size, URL_DICE_HIST));
    } catch (e) {
      pageLog("err", "记录窗口挪位后重开失败：" + errText(e));
    }
  }
  pageLog("info", "hist 直开 at " + Math.round(left) + "," + Math.round(top) + " " + w + "x" + h +
    (moved ? "（与骰子窗口重叠，已挪开）" : ""));
}

async function forceOpenDiceHistory() {
  pageLog("info", "记录窗口未能由骰子窗口打开 → 先关掉骰子窗口，再由后台开一次");
  if (winOpen["dice"]) {
    try {
      await closeWin("dice");
    } catch (e) {
      pageLog("err", "关掉骰子窗口失败：" + errText(e));
    }
  }
  await winWait(160);
  if (diceHistoryIsOpen()) return true;
  return openDiceHistory();
}

function broadcastDiceHistState() {
  var payload = { open: diceHistoryIsOpen(), at: Date.now() };
  try {
    var p1 = OBR.broadcast.sendMessage(CH_DICE_HIST_STATE, payload, { destination: "LOCAL" });
    if (p1 && typeof p1.catch === "function") p1.catch(function () {  });
  } catch (e) {  }
  try {
    var p2 = OBR.broadcast.sendMessage(CH_DICE_HIST_STATE, payload, { destination: "REMOTE" });
    if (p2 && typeof p2.catch === "function") p2.catch(function () {  });
  } catch (e2) {  }
}

async function openDiceHistory() {
  if (diceHistoryIsOpen()) return true;
  var lastErr = null;
  for (var tries = 0; tries < 2; tries++) {
    if (tries) await winWait(160);
    try {
      await openWin("diceHistory");
      stepOk("骰子记录窗口：已打开" + (tries ? "（重试成功）" : ""));
      return true;
    } catch (e) {
      lastErr = e;
    }
  }
  stepFail("打开骰子记录窗口（可以先关掉骰子窗口，再点一次「记录窗口」）", lastErr);
  return false;
}

async function closeDiceHistory() {
  if (!diceHistoryIsOpen()) return;
  try {
    await closeWin("diceHistory");
    stepOk("骰子记录窗口：已关闭");
  } catch (e) {
    stepFail("关闭骰子记录窗口", e);
  }
}

async function onDiceHistCmd(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var op = data && typeof data.op === "string" ? data.op : "toggle";
  try {
    if (op === "ready") {
      markDiceHistoryAlive();
      pageLog("ok", "骰子记录窗口：页面已就绪（握手）");
    } else if (op === "close") {
      await closeDiceHistory();
    } else if (op === "open") {
      await openDiceHistory();
    } else if (op === "adopt") {

      await adoptDiceHistory(data);
    } else if (op === "force-open") {

      await forceOpenDiceHistory();
    } else if (await diceHistoryAlive()) {
      await closeDiceHistory();
    } else {
      await openDiceHistory();
    }
  } catch (e) {
    pageLog("err", "骰子记录窗口命令失败：" + errText(e));
    stepFail("记录窗口命令（" + op + "）", e);
  }
  broadcastDiceHistState();
}

var hpEditSession = "";
var hpEditTarget = { session: "", version: 0, itemId: null, pending: false };

var hpAutoSel = null;
var hpAutoPopped = {};
/* v1.8.5：自动弹速览的「手动关过」记忆（与 hpAutoPopped 对称）。
 * 用户点 ✕ 关掉某 token 的速览后，选中不变之前任何 onChange 都不再自动弹回；
 * 选中变化（selId !== hpAutoSel）时清空，允许重新自动弹一次；工具栏 / 右键手动入口不受影响。 */
var infoAutoPopped = {};

function newHpEditSession() {
  try {
    if (typeof crypto !== "undefined" && crypto && typeof crypto.randomUUID === "function") {
      return String(crypto.randomUUID());
    }
  } catch (e) {  }
  return "hpe-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/* ---- 3. 血条编辑窗：target / ready / saved 三个频道 + 版本租约 ---- */
function publishHpEditTarget(itemId, pending) {
  var id = typeof itemId === "string" && itemId ? itemId : null;
  var pend = !!pending;
  if (hpEditTarget.itemId === id && hpEditTarget.pending === pend) return Promise.resolve();
  if (!hpEditSession) hpEditSession = newHpEditSession();
  hpEditTarget = {
    session: hpEditSession,
    version: hpEditTarget.version + 1,
    itemId: id,
    pending: pend
  };
  return sendHello(CH_HP_EDIT_TARGET, hpEditTarget);
}

/* v2.5.1：单窗常驻的 ack 等待（照 info 的 700ms 模式，这里 600ms）。
 * 页面收到 target → commit 未保存输入 → load → 回 CH_HP_EDIT_ACK {session,version,itemId}。 */
var hpEditAckWait = null;
function waitHpEditAck(session, version, itemId, ms) {
  return new Promise(function (resolve) {
    if (hpEditAckWait) {
      clearTimeout(hpEditAckWait.timer);
      var old = hpEditAckWait.resolve;
      hpEditAckWait = null;
      if (old) old(false);
    }
    var waiter = { session: session, version: version, itemId: itemId, timer: 0, resolve: resolve };
    waiter.timer = setTimeout(function () {
      if (hpEditAckWait !== waiter) return;
      hpEditAckWait = null;
      resolve(false);
    }, ms);
    hpEditAckWait = waiter;
  });
}
function onHpEditAck(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var waiter = hpEditAckWait;
  if (!waiter) return;
  if (!data || data.session !== waiter.session || data.itemId !== waiter.itemId) return;
  if (typeof data.version !== "number" || data.version < waiter.version) return;
  clearTimeout(waiter.timer);
  hpEditAckWait = null;
  waiter.resolve(true);
}

async function openHpEdit(itemId) {
  if (!itemId) {
    notify("没有读到要编辑的 token，右键请对着一个图片 token 再试", "WARNING");
    return false;
  }
  hpAutoPopped[itemId] = true;
  if (winOpen["hpEdit"] && hpEditTarget.itemId === itemId && !hpEditTarget.pending) return true;
  if (!hpEditSession) hpEditSession = newHpEditSession();
  /* v2.5.1：窗口已挂载 → 不重开 iframe；广播 target 换目标，等页面 ack；600ms 没 ack 兜底重开一次。 */
  if (winOpen["hpEdit"]) {
    var expectVersion = hpEditTarget.version + 1;
    var ackP = waitHpEditAck(hpEditSession, expectVersion, itemId, 600);
    await publishHpEditTarget(itemId, true);
    var acked = await ackP;
    if (acked) {
      await publishHpEditTarget(itemId, false);
      pageLog("info", "血条编辑窗：切换目标（单窗常驻，不重开）→ " + itemId);
      return true;
    }
    pageLog("warn", "血条编辑窗切换目标 600ms 无 ack → 兜底关闭重开一次");
    try { await closeWin("hpEdit"); } catch (e0) { pageLog("err", "血条编辑窗兜底关闭失败：" + errText(e0)); }
  }
  var url = URL_HP_EDIT + "?item=" + encodeURIComponent(itemId) +
    "&session=" + encodeURIComponent(hpEditSession);
  try {
    await publishHpEditTarget(itemId, true);
    await openWin("hpEdit", url);
    await publishHpEditTarget(itemId, false);
    stepOk("血条编辑窗已打开：" + itemId);
    return true;
  } catch (e) {

    stepFail("打开血条编辑窗", e);
    return false;
  }
}

function onHpEditReady(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var session = data && typeof data.session === "string" ? data.session : "";
  if (session && session !== hpEditSession) return;
  void sendHello(CH_HP_EDIT_TARGET, hpEditTarget);
}

function onHpEditSaved(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var itemId = data && typeof data.itemId === "string" ? data.itemId : "";
  if (!itemId) return;
  /* v1.8.1：保存完就不再对同一个选中 token 自动弹编辑窗（否则 items.onChange 会把窗关掉再弹一次）。 */
  hpAutoPopped[itemId] = true;
  scheduleBars();
  stepOk("血条编辑窗已保存：" + itemId);
}

/* v2.5.1：编辑窗「钉住」偏好（默认关）——钉住后选中变化 / 取消选中不自动关窗。 */
function hpEditPinned() {
  try { return localStorage.getItem("4enext/hp-edit/pinned") === "1"; } catch (e) { return false; }
}

/* v2.5.1：编辑窗「重绘」→ 丢掉这张 token 的血条缓存，下一次 scheduleBars 强制重建（环 / 盾 / 徽记）。 */
function onHpRepaint(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var itemId = data && typeof data.itemId === "string" ? data.itemId : "";
  if (!itemId) return;
  var entry = barEntries[itemId];
  if (entry) entry.force = true;
  scheduleBars();
  stepOk("血条已重绘：" + itemId);
}

var stripOpen = false;

var stripGeom = null;
var stripDragTimer = null;
var stripDragWanted = null;
var stripDragBusy = false;

/* ---- 4. 先攻条：三档高度 / 折叠药丸 / 拖动 / 命令频道 ---- */
function stripHeightFor(phase) {
  if (phase === "combat") return STRIP_H_COMBAT;
  if (phase === "preparing") return STRIP_H_PREPARING;
  return STRIP_H_IDLE;
}

function stripWidthFor(vp) {
  var avail = vp && vp.width > 0 ? vp.width - STRIP_SIDE_MARGIN * 2 : STRIP_EXPANDED_W;
  return Math.round(Math.max(STRIP_MIN_EXPANDED_W, Math.min(STRIP_EXPANDED_W, avail)));
}

var STRIP_H_ALLOWED = [STRIP_H_IDLE, STRIP_H_PREPARING, STRIP_H_COMBAT];
function snapStripSize(w, h) {
  if (w === STRIP_COLLAPSED_W && h === STRIP_COLLAPSED_H) {
    return { width: STRIP_COLLAPSED_W, height: STRIP_COLLAPSED_H };
  }
  var height = STRIP_H_ALLOWED.indexOf(h) >= 0 ? h : STRIP_H_IDLE;
  return { width: stripWidthFor(stripGeom ? stripGeom.vp : null), height: height };
}

function readStripOffset() {
  try {
    var raw = localStorage.getItem(STRIP_POS_KEY);
    if (!raw) return { dx: 0, dy: 0 };
    var box = JSON.parse(raw);
    if (!box || typeof box !== "object") return { dx: 0, dy: 0 };
    return {
      dx: typeof box.dx === "number" && isFinite(box.dx) ? box.dx : 0,
      dy: typeof box.dy === "number" && isFinite(box.dy) ? box.dy : 0
    };
  } catch (e) {
    return { dx: 0, dy: 0 };
  }
}

function writeStripOffset(dx, dy) {
  try {
    safeLocalSet(STRIP_POS_KEY, JSON.stringify({ v: 1, dx: Math.round(dx), dy: Math.round(dy) }));
  } catch (e) {  }
}

function clearStripOffset() {
  try { localStorage.removeItem(STRIP_POS_KEY); } catch (e) {  }
}

function stripPosFor(dx, dy, size, vp) {
  var vw = vp && vp.width > 0 ? vp.width : 0;
  var vh = vp && vp.height > 0 ? vp.height : 0;
  var cx = Math.round((vw > 0 ? vw : size.width + STRIP_SIDE_MARGIN * 2) / 2) + Math.round(dx);
  var top = STRIP_TOP_OFFSET + Math.round(dy);
  if (vw > 0) {
    var half = size.width / 2;
    cx = Math.min(Math.max(cx, Math.round(STRIP_SIDE_MARGIN + half)), Math.round(vw - STRIP_SIDE_MARGIN - half));
  }
  if (vh > 0) top = Math.min(Math.max(top, 0), Math.max(0, Math.round(vh - size.height - STRIP_SIDE_MARGIN)));
  return { left: cx, top: top };
}

function stripPopoverOptions(size, pos) {
  return {
    id: ID_STRIP,
    url: URL_INITIATIVE,
    width: size.width,
    height: size.height,
    anchorReference: "POSITION",

    anchorPosition: { left: pos.left, top: pos.top },
    anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
    transformOrigin: { horizontal: "CENTER", vertical: "TOP" },

    disableClickAway: true,

    hidePaper: true
  };
}

function stripCollapsedPref() {
  try { return localStorage.getItem(STRIP_COLLAPSED_KEY) === "1"; } catch (e) { return false; }
}

async function openStrip() {
  var vp = await infoViewport();

  var size = stripCollapsedPref()
    ? { width: STRIP_COLLAPSED_W, height: STRIP_COLLAPSED_H }
    : (stripOpen && stripGeom
      ? { width: stripGeom.width, height: stripGeom.height }
      : { width: stripWidthFor(vp), height: STRIP_H_IDLE });
  var offset = readStripOffset();
  var pos = stripPosFor(offset.dx, offset.dy, size, vp);

  stripGeom = {
    left: pos.left, top: pos.top, width: size.width, height: size.height,
    offset: { dx: pos.left - Math.round((vp.width || 0) / 2), dy: pos.top - STRIP_TOP_OFFSET },
    vp: { width: vp.width, height: vp.height }
  };
  try {
    await OBR.popover.open(stripPopoverOptions(size, pos));
  } catch (e) {
    stripGeom = null;
    throw e;
  }
  stripOpen = true;

  var pending = stripGeom && stripGeom.pendingSize ? stripGeom.pendingSize : null;
  if (stripGeom) stripGeom.pendingSize = null;
  if (pending && (pending.width !== size.width || pending.height !== size.height)) {
    void resizeStrip(pending.width, pending.height);
  }

  markStripClosed(false);
  return true;
}

async function openStripOrNotify(where) {
  try {
    await openStrip();
    stepOk((where || "先攻条") + "：已打开");
    return true;
  } catch (e) {
    stepFail("打开先攻条（" + (where || "入口") + "）", e);
    return false;
  }
}

async function closeStrip() {
  if (stripDragTimer) { clearTimeout(stripDragTimer); stripDragTimer = null; }
  stripDragWanted = null;
  stripOpen = false;
  stripGeom = null;
  try { await OBR.popover.close(ID_STRIP); } catch (e) {  }
}

function stripAutostartOn() {
  try { return localStorage.getItem(STRIP_AUTOSTART_KEY) !== "0"; } catch (e) { return true; }
}

function stripClosedThisSession() {
  try { return localStorage.getItem(STRIP_CLOSED_KEY) === "1"; } catch (e) { return false; }
}

function markStripClosed(on) {
  try {
    if (on) safeLocalSet(STRIP_CLOSED_KEY, "1");
    else localStorage.removeItem(STRIP_CLOSED_KEY);
  } catch (e) {  }
}

function diceAutostartOn() {
  try { return localStorage.getItem(DICE_AUTOSTART_KEY) !== "0"; } catch (e) { return true; }
}
function diceClosedThisSession() {
  try { return localStorage.getItem(DICE_CLOSED_KEY) === "1"; } catch (e) { return false; }
}
function markDiceClosed(on) {
  try {
    if (on) safeLocalSet(DICE_CLOSED_KEY, "1");
    else localStorage.removeItem(DICE_CLOSED_KEY);
  } catch (e) { /* 忽略 */ }
}
async function maybeAutoOpenDice(where) {
  if (winOpen["dice"]) return false;
  if (!diceAutostartOn()) { pageLog("info", "进入房间自动打开骰子：跳过（设置关）"); return false; }
  if (diceClosedThisSession()) { pageLog("info", "进入房间自动打开骰子：跳过（用户关闭过）"); return false; }
  if (!(await sceneReady())) return false;
  var ok = await openWinOrNotify("dice", where || "进入房间自动打开骰子");
  pageLog("info", "进入房间自动打开骰子：" + (ok ? "已打开" : "未打开"));
  return ok;
}

async function maybeAutoOpenStrip(where) {
  if (stripOpen) return false;
  if (!stripAutostartOn()) return false;
  if (stripClosedThisSession()) return false;
  if (!(await sceneReady())) return false;
  return openStripOrNotify(where || "进入房间自动打开先攻条");
}

/* v1.9.2：骰子记录窗口的自动打开（与先攻条同一套口径：偏好默认开、本次会话关过就不再开）。 */
function diceHistAutostartOn() {
  try { return localStorage.getItem(DICE_HIST_AUTOSTART_KEY) !== "0"; } catch (e) { return true; }
}
function diceHistClosedThisSession() {
  try { return localStorage.getItem(DICE_HIST_CLOSED_KEY) === "1"; } catch (e) { return false; }
}
function markDiceHistClosed(on) {
  try {
    if (on) safeLocalSet(DICE_HIST_CLOSED_KEY, "1");
    else localStorage.removeItem(DICE_HIST_CLOSED_KEY);
  } catch (e) {  }
}
async function maybeAutoOpenDiceHistory() {
  if (diceHistoryIsOpen()) return false;
  if (!diceHistAutostartOn()) return false;
  if (diceHistClosedThisSession()) return false;
  if (!(await sceneReady())) return false;
  var ok = await openDiceHistory();
  if (ok) pageLog("info", "进入房间自动打开骰子记录窗口");
  return ok;
}

async function resetStrip() {
  if (!stripOpen || !stripGeom) return;
  clearStripOffset();
  var vp = await infoViewport();
  var size = { width: stripGeom.width, height: stripGeom.height };
  var pos = stripPosFor(0, 0, size, vp);
  stripGeom.left = pos.left;
  stripGeom.top = pos.top;
  stripGeom.vp = { width: vp.width, height: vp.height };
  stripGeom.offset = { dx: 0, dy: 0 };
  try {
    await OBR.popover.open(stripPopoverOptions(size, pos));
  } catch (e) {
    stepFail("先攻条回到顶部中间", e);
  }
  pageLog("info", "先攻条已回到顶部中间");
}

function queueStripDrag(want) {
  stripDragWanted = want;
  void pumpStripDrag();
}

async function pumpStripDrag() {
  if (stripDragBusy) return;
  stripDragBusy = true;
  try {
    while (stripDragWanted) {
      var job = stripDragWanted;
      stripDragWanted = null;
      if (!stripOpen || !stripGeom) break;
      var vp = await infoViewport();
      var size = { width: stripGeom.width, height: stripGeom.height };
      var pos = stripPosFor(job.dx, job.dy, size, vp);

      stripGeom.left = pos.left;
      stripGeom.top = pos.top;
      stripGeom.vp = { width: vp.width, height: vp.height };
      stripGeom.offset = {
        dx: pos.left - Math.round((vp.width || 0) / 2),
        dy: pos.top - STRIP_TOP_OFFSET
      };
      try {
        await OBR.popover.open(stripPopoverOptions(size, pos));
      } catch (e) {

      }
    }
  } finally {
    stripDragBusy = false;
    if (stripDragWanted) void pumpStripDrag();
  }
}

function touchStripDrag() {
  if (stripDragTimer) clearTimeout(stripDragTimer);
  stripDragTimer = setTimeout(function () {
    stripDragTimer = null;
    if (stripGeom && stripGeom.offset) writeStripOffset(stripGeom.offset.dx, stripGeom.offset.dy);
  }, WIN_DRAG_IDLE_MS);
}

function onStripDrag(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.phase !== "string") return;
  if (!stripOpen || !stripGeom) return;
  if (data.phase === "reset") {
    if (stripDragTimer) { clearTimeout(stripDragTimer); stripDragTimer = null; }
    void resetStrip();
    return;
  }
  var dx = typeof data.dx === "number" && isFinite(data.dx) ? data.dx : 0;
  var dy = typeof data.dy === "number" && isFinite(data.dy) ? data.dy : 0;
  if (data.phase === "start") {
    stripGeom.base = stripGeom.offset || readStripOffset();
    touchStripDrag();
    return;
  }
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && data.phase !== "end") return;
  var base = stripGeom.base || stripGeom.offset || { dx: 0, dy: 0 };
  queueStripDrag({ dx: base.dx + dx, dy: base.dy + dy });
  touchStripDrag();
  if (data.phase === "end") {

    setTimeout(function () {
      if (!stripGeom || !stripGeom.offset) return;
      writeStripOffset(stripGeom.offset.dx, stripGeom.offset.dy);
      stripGeom.base = null;
      if (stripDragTimer) { clearTimeout(stripDragTimer); stripDragTimer = null; }
    }, 60);
  }
}

async function reclampStrip(vpArg) {
  if (!stripOpen || !stripGeom) return;
  var vp = vpArg && vpArg.width > 0 && vpArg.height > 0 ? vpArg : await infoViewport();
  var size = { width: stripGeom.width, height: stripGeom.height };
  var off = stripGeom.offset || readStripOffset();
  var pos = stripPosFor(off.dx, off.dy, size, vp);
  if (pos.left === stripGeom.left && pos.top === stripGeom.top) return;

  stripGeom.left = pos.left;
  stripGeom.top = pos.top;
  stripGeom.vp = { width: vp.width, height: vp.height };
  stripGeom.offset = {
    dx: pos.left - Math.round((vp.width || 0) / 2),
    dy: pos.top - STRIP_TOP_OFFSET
  };
  try {
    await OBR.popover.open(stripPopoverOptions(size, pos));
  } catch (e) {

  }
}

async function resizeStrip(width, height) {
  if (!stripOpen || !stripGeom) return;
  var vp = await infoViewport();
  var off = stripGeom.offset || { dx: 0, dy: 0 };
  var size = { width: width, height: height };
  var pos = stripPosFor(off.dx, off.dy, size, vp);
  stripGeom.width = width;
  stripGeom.height = height;
  stripGeom.left = pos.left;
  stripGeom.top = pos.top;
  stripGeom.vp = { width: vp.width, height: vp.height };
  stripGeom.offset = {
    dx: pos.left - Math.round((vp.width || 0) / 2),
    dy: pos.top - STRIP_TOP_OFFSET
  };
  try {
    await OBR.popover.open(stripPopoverOptions(size, pos));
  } catch (e) {
    stepFail("先攻条改尺寸", e);
  }
}

function onStripCmd(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.op !== "string") return;
  if (data.op === "list") {
    void openWinOrNotify("initiative", "先攻列表");
    return;
  }

  if (data.op === "close") { markStripClosed(true); void closeStrip(); return; }
  if (data.op === "size") {
    if (!stripGeom) return;
    var w = typeof data.width === "number" && isFinite(data.width) ? Math.round(data.width) : stripGeom.width;
    var h = typeof data.height === "number" && isFinite(data.height) ? Math.round(data.height) : stripGeom.height;

    var snapped = snapStripSize(w, h);
    if (snapped.width === stripGeom.width && snapped.height === stripGeom.height) return;
    if (!stripOpen) {

      stripGeom.pendingSize = snapped;
      return;
    }
    void resizeStrip(snapped.width, snapped.height);
  }
}

var buttonOpen = false;
async function openButton() {
  var w = 0, h = 0;
  if (!OBR.viewport || typeof OBR.viewport.getWidth !== "function") {
    throw new Error("SDK 没有 OBR.viewport.getWidth（SDK 版本不匹配？）");
  }
  w = await OBR.viewport.getWidth();
  h = await OBR.viewport.getHeight();
  await OBR.popover.open({
    id: ID_BUTTON,
    url: URL_BUTTON,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    anchorReference: "POSITION",
    anchorPosition: { left: w - RIGHT_OFFSET, top: h - BOTTOM_OFFSET },
    anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
    hidePaper: true,
    disableClickAway: true
  });
  buttonOpen = true;
}

async function closeButton() {
  try { await OBR.popover.close(ID_BUTTON); } catch (e) {  }
  buttonOpen = false;
}

/* v2.5.1：移植 Full Suite viewportAnchor —— OBR SDK **没有 viewport.onChange**，
 * 所以用后台 500ms 轮询 getWidth/getHeight；变化时回调（按钮重锚 + 窗口 reclamp）。
 * 只在有监听者时跑；读失败退避 2s；首读只记 baseline 不触发。 */
var vpAnchorTimer = null;
var vpAnchorListeners = [];
var vpAnchorVw = 0;
var vpAnchorVh = 0;
var vpAnchorBusy = false;
var vpAnchorFailUntil = 0;

async function readViewportSize() {
  if (!OBR.viewport || typeof OBR.viewport.getWidth !== "function" || typeof OBR.viewport.getHeight !== "function") return null;
  try {
    var arr = await Promise.allSettled([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    if (!arr[0] || arr[0].status !== "fulfilled" || !arr[1] || arr[1].status !== "fulfilled") return null;
    var w = arr[0].value, h = arr[1].value;
    if (!(typeof w === "number" && w > 0 && typeof h === "number" && h > 0)) return null;
    return { width: w, height: h };
  } catch (e) {
    return null;
  }
}

async function pollViewportAnchor() {
  if (typeof document !== "undefined" && document.hidden) return false; /* v2.5.1：后台标签页跳过 */
  if (vpAnchorBusy) return false;
  if (!vpAnchorListeners.length) {
    if (vpAnchorTimer) { clearInterval(vpAnchorTimer); vpAnchorTimer = null; }
    return false;
  }
  if (Date.now() < vpAnchorFailUntil) return false;
  vpAnchorBusy = true;
  try {
    var vp = await readViewportSize();
    if (!vp) { vpAnchorFailUntil = Date.now() + 2000; return false; }
    lastVp = { width: vp.width, height: vp.height };
    if (!(vpAnchorVw > 0 && vpAnchorVh > 0)) {
      vpAnchorVw = vp.width;
      vpAnchorVh = vp.height;
      return false;
    }
    if (vp.width === vpAnchorVw && vp.height === vpAnchorVh) return false;
    vpAnchorVw = vp.width;
    vpAnchorVh = vp.height;
    pageLog("info", "viewport " + vp.width + "×" + vp.height + " → 重锚按钮/窗口");
    for (var i = 0; i < vpAnchorListeners.length; i++) {
      try { await vpAnchorListeners[i](vp); } catch (e) { /* 单个监听者失败不影响其它 */ }
    }
    return true;
  } finally {
    vpAnchorBusy = false;
  }
}

function installViewportAnchor() {
  if (!vpAnchorTimer) {
    vpAnchorTimer = setInterval(function () { void pollViewportAnchor(); }, 500);
  }
  /* 后台 iframe 能拿到 window.resize / visualViewport.resize 的话再加一层即时触发（拿不到忽略）。 */
  try {
    if (typeof window !== "undefined" && typeof window.addEventListener === "function" && !window.__4eVpResizeBound) {
      window.__4eVpResizeBound = true;
      window.addEventListener("resize", function () { void pollViewportAnchor(); });
    }
    if (typeof window !== "undefined" && window.visualViewport && typeof window.visualViewport.addEventListener === "function" && !window.__4eVpVvBound) {
      window.__4eVpVvBound = true;
      window.visualViewport.addEventListener("resize", function () { void pollViewportAnchor(); });
    }
  } catch (e) { /* 忽略 */ }
}

function stopViewportAnchor() {
  if (vpAnchorTimer) { clearInterval(vpAnchorTimer); vpAnchorTimer = null; }
}

function addViewportAnchorListener(cb) {
  if (typeof cb !== "function") return function () {};
  vpAnchorListeners.push(cb);
  installViewportAnchor();
  return function () {
    var i = vpAnchorListeners.indexOf(cb);
    if (i >= 0) vpAnchorListeners.splice(i, 1);
    if (!vpAnchorListeners.length && vpAnchorTimer) {
      clearInterval(vpAnchorTimer);
      vpAnchorTimer = null;
    }
  };
}

/** 按给定视口把右下角 4E 浮动按钮重新 open 到右下角（同 id+同 url，OBR 原地更新）。 */
async function reanchorButton(vpArg) {
  if (!buttonOpen) return false;
  var w = vpArg && vpArg.width > 0 ? vpArg.width : 0;
  var h = vpArg && vpArg.height > 0 ? vpArg.height : 0;
  if (!(w > 0 && h > 0)) {
    var vp = await infoViewport();
    w = vp.width;
    h = vp.height;
  }
  if (!(w > 0 && h > 0)) return false;
  try {
    await OBR.popover.open({
      id: ID_BUTTON,
      url: URL_BUTTON,
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      anchorReference: "POSITION",
      anchorPosition: { left: w - RIGHT_OFFSET, top: h - BOTTOM_OFFSET },
      anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
      transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
      hidePaper: true,
      disableClickAway: true
    });
    pageLog("info", "按钮重定位 " + w + "×" + h + " → " + (w - RIGHT_OFFSET) + "," + (h - BOTTOM_OFFSET));
    return true;
  } catch (e) {
    pageLog("err", "按钮重定位失败：" + errText(e));
    return false;
  }
}

async function registerOneTool(def) {
  try {
    await OBR.tool.create(def);
  } catch (e) {

    await OBR.tool.remove(def.id);
    await OBR.tool.create(def);
  }
}

async function registerTools() {
  if (!OBR.tool || typeof OBR.tool.create !== "function") {
    throw new Error("SDK 没有 OBR.tool.create");
  }

  await registerOneTool({
    id: TOOL_ID,
    icons: [{ icon: TOOL_ICON_URL, label: "4eNEXT to owlbear：角色卡 / 导入面板" }],
    onClick: function () {
      void openPanel("工具栏「角色卡」");
      return false;
    }
  });

  await registerOneTool({
    id: TOOL_INIT_ID,
    icons: [{ icon: TOOL_INIT_ICON_URL, label: "4eNEXT to owlbear：先攻条" }],
    onClick: function () {
      void openStripOrNotify("工具栏「先攻」");
      return false;
    }
  });
  /* v2.5.1：传送门工具（GM 拖动画圆；玩家点工具给提示，不进入绘制模式）。 */
  await registerPortalTool();
  /* v2.5.1：骰子工具按钮 → 普通可拖动窗口（替代已删除的 manifest action / launcher）。 */
  await registerOneTool({
    id: TOOL_DICE_ID,
    icons: [{ icon: TOOL_DICE_ICON_URL, label: "4eNEXT to owlbear：骰子" }],
    onClick: async function () {
      await openWinOrNotify("dice", "骰子");
      return true;
    }
  });
}

async function createContextMenu(def) {
  try {
    await OBR.contextMenu.create(def);
  } catch (e) {

    await OBR.contextMenu.remove(def.id);
    await OBR.contextMenu.create(def);
  }
}

/* v2.5：右键菜单互斥不再靠 token 上的 in-init 镜像旗标 —— 直接按 token metadata[KEY_INIT] 判断：
 *   · 在名单里   = 有 v2 元数据（宿主 filter 支持嵌套 key 路径：["metadata", KEY_INIT, "v"] === 2）；
 *   · 不在名单   = 没有 v2 条目（旧版加值缓存是数字 / {bonus,cardId}，它的 v 不是 2 → 仍显示「加入先攻」）。
 * 这样加入 / 移出 / 清理 / 别端改完名单，菜单在宿主下一次求值时自动跟着变，不需要任何镜像写入。
 * KEY_IN_INIT 只保留常量做旧存档说明，运行代码**不再读写**（旧 true/false 残留不影响判断）。 */
var KEY_IN_INIT = NS + "/in-init";

/* ---- 5. 先攻菜单互斥（按 token metadata[KEY_INIT].v === 2）+ token 删除自动清理 ---- */
function initMenuFilter(mode, gmOnly) {
  var filter = { every: [{ key: "type", value: "IMAGE" }], max: 1 };
  if (gmOnly !== false) filter.roles = ["GM"];
  /* v2.5.1：用 2 段的 in-init 布尔镜像，避免依赖 OBR 对 3 段嵌套 key 的过滤支持。 */
  if (mode === "in") filter.every.push({ key: ["metadata", KEY_IN_INIT], value: true });
  else filter.every.push({ key: ["metadata", KEY_IN_INIT], operator: "!=", value: true });
  return filter;
}

async function registerInitMenus() {
  await createContextMenu({
    id: INIT_MENU_ADD,
    icons: [{ icon: ICON_URL, label: "加入先攻", filter: initMenuFilter("out", false) }],
    onClick: function (context) { return onInitMenuClick(context, false); }
  });
  await createContextMenu({
    id: INIT_MENU_ADD_HIDDEN,
    icons: [{ icon: ICON_URL, label: "隐形加入先攻", filter: initMenuFilter("out", true) }],
    onClick: function (context) { return onInitMenuClick(context, true); }
  });
  await createContextMenu({
    id: INIT_MENU_REMOVE,
    icons: [{ icon: ICON_URL, label: "移出先攻", filter: initMenuFilter("in", true) }],
    onClick: function (context) { return onInitRemoveClick(context); }
  });
}

async function writeHpBarFlag(context, on) {
  var src = context && context.items ? context.items : [];
  var ids = [];
  for (var i = 0; i < src.length; i++) {
    var it = src[i];
    if (!it || !it.id || it.type !== "IMAGE") continue;
    ids.push(it.id);
  }
  if (!ids.length) {
    notify("没有读到可用的 IMAGE token，右键请对着一个图片 token 再试", "WARNING");
    return [];
  }
  try {
    await OBR.scene.items.updateItems(ids, function (drafts) {
      for (var j = 0; j < drafts.length; j++) {
        var d = drafts[j];
        if (!d.metadata || typeof d.metadata !== "object") d.metadata = {};
        d.metadata[KEY_HPBAR] = !!on;
      }
    });
    scheduleBars();
    stepOk("血条组件：" + (on ? "已添加 " : "已移除 ") + ids.length + " 个 token");
    return ids;
  } catch (e) {
    notify("改不了血条组件开关：" + errText(e), "ERROR");
    return [];
  }
}

async function onHpBarAdd(context) {
  var ids = await writeHpBarFlag(context, true);
  if (!ids.length) return;
  if (ids.length > 1) {

    notify("一次只能编辑一枚 token，已为第一枚打开编辑窗", "WARNING");
  }
  await openHpEdit(ids[0]);
}

async function onHpBarEdit(context) {
  var item = context && context.items && context.items[0] ? context.items[0] : null;
  if (!item || !item.id) {
    notify("没有读到要编辑的 token，右键请对着一个图片 token 再试", "WARNING");
    return;
  }
  if (item.type !== "IMAGE") {
    notify("只有图片 token 能编辑血条", "WARNING");
    return;
  }
  await openHpEdit(item.id);
}

async function registerContextMenu() {
  if (!OBR.contextMenu || typeof OBR.contextMenu.create !== "function") {
    throw new Error("SDK 没有 OBR.contextMenu.create");
  }

  await createContextMenu({
    id: NS + "/bind-menu",
    icons: [{
      icon: ICON_URL,
      label: "绑定 4E NEXT 角色卡",
      filter: {
        roles: ["GM"],
        every: [{ key: "type", value: "IMAGE" }],
        max: 1
      }
    }],
    onClick: async function (context) {
      var id = context && context.items && context.items[0] ? context.items[0].id : "";
      if (!id) {
        notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
        return;
      }
      try {
        await OBR.modal.open({
          id: ID_BIND,
          url: URL_BIND + "?item=" + encodeURIComponent(id),
          width: 440,
          height: 600
        });
        stepOk("绑定弹窗已打开");
      } catch (e) {
        stepFail("打开绑定弹窗", e);
      }
    }
  });

  await registerInitMenus();

  await createContextMenu({
    id: NS + "/hpbar-add",
    icons: [{
      icon: ICON_URL,
      label: "添加血条组件",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [{ key: "type", value: "IMAGE" }],
        some: [{ key: ["metadata", KEY_HPBAR], operator: "!=", value: true }]
      }
    }],

    onClick: function (context) { return onHpBarAdd(context); }
  });
  await createContextMenu({
    id: NS + "/hpbar-remove",
    icons: [{
      icon: ICON_URL,
      label: "移除血条组件",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [{ key: "type", value: "IMAGE" }],
        some: [{ key: ["metadata", KEY_HPBAR], value: true }]
      }
    }],
    onClick: function (context) { return writeHpBarFlag(context, false); }
  });

  await createContextMenu({
    id: NS + "/hpbar-edit",
    icons: [{
      icon: ICON_URL,
      label: "编辑血条",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [{ key: "type", value: "IMAGE" }],
        some: [{ key: ["metadata", KEY_HPBAR], value: true }]
      }
    }],
    onClick: function (context) { return onHpBarEdit(context); }
  });

  /* v2.5.1：速览右键入口（GM / 玩家都可；单枚 IMAGE）。 */
  await createContextMenu({
    id: NS + "/glance-menu",
    icons: [{
      icon: TOOL_GLANCE_ICON_URL,
      label: "速览",
      filter: { max: 1, every: [{ key: "type", value: "IMAGE" }] }
    }],
    onClick: function () { void openGlance("右键「速览」"); }
  });

  /* v2.5.1：GM 右键 → 编辑传送门。filter 不能按 metadata 值相等（值对象，永远不匹配），
   * 只在 onClick 里检查 metadata[KEY_PORTAL]；正常路径还有「GM 选中单枚门自动弹编辑窗」。 */
  await createContextMenu({
    id: NS + "/portal-edit",
    icons: [{
      icon: PORTAL_ICON_URL,
      label: "编辑传送门",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [{ key: "type", value: "IMAGE" }]
      }
    }],
    onClick: function (context) {
      var it = context && context.items && context.items[0] ? context.items[0] : null;
      var isPortal = !!(it && it.metadata && it.metadata[KEY_PORTAL]);
      pageLog("info", "右键编辑 role=GM 是否门=" + (isPortal ? "是" : "否"));
      if (!isPortal) { notify("这枚不是传送门", "WARNING"); return; }
      return openPortalEdit(it.id);
    }
  });
}

var infoOpen = false;
var infoItemId = null;
var infoCardId = null;

/* v1.8.9：信息窗目标租约（照 hpEditTarget / Full Suite characterCards 的 sendInfoTarget）。
 * 窗口只挂载一次：换 token 时 version+1 广播 CH_INFO_TARGET，页面收到后换 itemId/cardId 重渲染，
 * 不 reload iframe。session 内的 version 必须严格递增；页面 READY 时后台重发当前 target（防丢首条）。 */
var infoSession = "";
var infoTarget = { session: "", version: 0, itemId: null, cardId: null };
var infoMode = "compact"; /* v2.5.1：compact=点token自动弹；full=右键/工具栏速览 */
var infoAckRetries = 0;
/* v1.9.0：target 广播后的 ack 兜底 —— 700ms 没收到页面 ack 就关闭重开一次（只记日志、不弹通知）。 */
var infoAckTimer = null;
var infoAckPending = null;

function newInfoSession() {
  try {
    if (typeof crypto !== "undefined" && crypto && typeof crypto.randomUUID === "function") {
      return String(crypto.randomUUID());
    }
  } catch (e) {  }
  return "info-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function clearInfoAckTimer() {
  if (infoAckTimer) { clearTimeout(infoAckTimer); infoAckTimer = null; }
  infoAckPending = null;
}

function publishInfoTarget(itemId, cardId, expectAck) {
  if (!infoSession) infoSession = newInfoSession();
  infoTarget = {
    session: infoSession,
    version: infoTarget.version + 1,
    itemId: typeof itemId === "string" ? itemId : (itemId || ""),
    cardId: typeof cardId === "string" ? cardId : (cardId || "")
  };
  var sent = sendHello(CH_INFO_TARGET, infoTarget);
  if (expectAck) {
    clearInfoAckTimer();
    infoAckPending = {
      session: infoSession,
      version: infoTarget.version,
      itemId: infoTarget.itemId,
      cardId: infoTarget.cardId
    };
    infoAckTimer = setTimeout(function () {
      infoAckTimer = null;
      var pend = infoAckPending;
      infoAckPending = null;
      if (!pend || !infoOpen) return;
      /* v2.5.1：最多兜底重开 2 次，避免页面加载失败时无限开关把宿主拖到卡死。 */
      if (infoAckRetries >= 2) {
        pageLog("err", "速览 target 连续 " + infoAckRetries + " 次无 ack，已停止兜底重开（页面可能加载失败）");
        return;
      }
      infoAckRetries++;
      /* 只记日志不弹通知：极端情况下页面没刷新，主动关掉重开一次保证内容换过去。 */
      pageLog("err", "速览 target v=" + pend.version + " 700ms 无 ack → 兜底关闭重开一次");
      void (async function () {
        try {
          await closeInfo();
          await new Promise(function (r) { setTimeout(r, 80); });
          await openInfo(pend.itemId, pend.cardId, pend.mode);
        } catch (e) {
          stepFail("兜底重开速览窗", e);
        }
      })();
    }, 700);
  }
  return sent;
}

function resetInfoTarget() {
  clearInfoAckTimer();
  infoSession = "";
  infoTarget = { session: "", version: 0, itemId: null, cardId: null };
}

var infoReadyTimer = null;
function clearInfoReadyWatchdog() {
  if (infoReadyTimer) { clearTimeout(infoReadyTimer); infoReadyTimer = null; }
}
function armInfoReadyWatchdog() {
  clearInfoReadyWatchdog();
  infoReadyTimer = setTimeout(function () {
    infoReadyTimer = null;
    if (!infoOpen) return;
    pageLog("err", "速览页 5s 未 ready（加载失败 / 脚本报错），关闭窗口");
    try { notify("速览页加载失败（超时），已关闭，请重试", "ERROR"); } catch (eN) { /* 忽略 */ }
    void closeInfo();
  }, 5000);
}
function onInfoReady(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var session = data && typeof data.session === "string" ? data.session : "";
  if (session && infoSession && session !== infoSession) return;
  if (!infoSession) return;
  clearInfoReadyWatchdog();
  /* 页面刚挂载 / 拖动重开后会发 READY：重发当前 target（第一条广播可能在 iframe 加载前丢了）。 */
  void sendHello(CH_INFO_TARGET, infoTarget);
}

function onInfoAck(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data !== "object") return;
  var session = typeof data.session === "string" ? data.session : "";
  if (!session || session !== infoSession) return;
  var version = typeof data.version === "number" ? data.version : 0;
  if (infoAckPending && version >= infoAckPending.version) clearInfoAckTimer();
}

var infoGeom = null;

var infoDrag = null;
var infoDragTimer = null;
var dragWanted = null;
var dragBusy = false;

async function getCards() {
  var box = null;
  try {
    var meta = await OBR.room.getMetadata();
    box = meta[KEY_CARDS];
  } catch (e) {
    pageLog("err", "读取房间数据失败：" + errText(e));
  }

  /* v1.8.0：房间名单（精简副本）与场景 item（完整数据）是同一批卡的两层副本，按 id 取并集，
   * 同 id 优先用场景里的完整卡。只认房间列表会漏掉「房间名单过期但新卡写进场景」的卡（F1）。 */
  var roomCards = box && Array.isArray(box.cards) ? box.cards : [];
  var scene = await sceneCardsFallback();
  var byId = {};
  var i;
  for (i = 0; i < scene.length; i++) {
    if (scene[i] && scene[i].id) byId[scene[i].id] = scene[i];
  }
  var out = [];
  var seen = {};
  for (i = 0; i < roomCards.length; i++) {
    var w = roomCards[i];
    if (!w || typeof w.id !== "string" || !w.id || seen[w.id]) continue;
    seen[w.id] = 1;
    out.push(byId[w.id] || w);
  }
  for (i = 0; i < scene.length; i++) {
    var sc = scene[i];
    if (!sc || typeof sc.id !== "string" || !sc.id || seen[sc.id]) continue;
    seen[sc.id] = 1;
    out.push(sc);
  }
  if (out.length) return out;

  var local = localCardsFallback();
  if (local) return local.cards;
  return [];
}

/** 当前场景里挂在隐藏 item 上的卡片（精简格式，只用得上 id / name），没有就 []。 */
async function sceneCardsFallback() {
  try {
    var items = await OBR.scene.items.getItems(function (i) {
      return !!(i && i.metadata && i.metadata[KEY_CARD_ITEM]);
    });
    var out = [];
    if (!items || !items.length) return out;
    for (var i = 0; i < items.length; i++) {
      var box = items[i].metadata[KEY_CARD_ITEM];
      var wire = box && box.card;
      if (!wire || typeof wire !== "object") continue;
      if (typeof wire.id !== "string" || !wire.id) continue;
      out.push(wire);
    }
    out.sort(function (a, b) { return (a.importedAt || 0) - (b.importedAt || 0); });
    return out;
  } catch (e) {
    return [];
  }
}

function findCard(cards, id) {
  if (!id) return null;
  for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i];
  return null;
}

async function anchorOf(itemId) {
  try {
    var bounds = await OBR.scene.items.getItemBounds([itemId]);
    var scale = await OBR.viewport.getScale();
    var p = await OBR.viewport.transformPoint(bounds.center);
    return { left: p.x, top: p.y - (bounds.height * scale) / 2 };
  } catch (e) {
    return null;
  }
}

/* v2.5.1：最近一次成功读到的视口尺寸（轮询 / infoViewport 都更新），供拖动 start / clamp 参考。 */
var lastVp = { width: 0, height: 0 };
async function infoViewport() {
  var vp = { width: 0, height: 0 };
  try { vp.width = await OBR.viewport.getWidth(); } catch (e) { vp.width = 0; }
  try { vp.height = await OBR.viewport.getHeight(); } catch (e) { vp.height = 0; }
  if (vp.width > 0 && vp.height > 0) {
    lastVp = { width: vp.width, height: vp.height };
  } else if (lastVp && lastVp.width > 0 && lastVp.height > 0) {
    vp = { width: lastVp.width, height: lastVp.height };
    pageLog("info", "viewport 读数为 0，使用上次视口 " + vp.width + "x" + vp.height);
  } else {
    vp = { width: 1280, height: 720 };
    pageLog("info", "viewport 读数为 0，使用兜底视口 1280x720");
  }
  return vp;
}

/* ---- 6. 速览弹窗 /info：尺寸 / 位置记忆 / 拖动 ---- */
function infoSize(vp, mode) {
  var wantW = mode === "full" ? INFO_W_FULL : INFO_W_COMPACT;
  /* v2.5.1：初始高度只给骨架大小（compact 200 / full 420），页面渲染后自己 setHeight 长高；
   * 以前一上来 700，页面若加载慢/失败就是一大片「加载中…」空窗。 */
  var initH = mode === "full" ? 420 : 200;
  var availH = (vp.height || 760) - 40;
  return {
    width: Math.max(INFO_MIN_W, Math.min(wantW, (vp.width || wantW + 40) - 32)),
    height: Math.max(160, Math.min(initH, availH, INFO_H))
  };
}

function clampInfoPos(left, top, size, vp) {
  var m = INFO_VIEW_MARGIN;
  var out = { left: Math.round(left), top: Math.round(top) };
  if (vp && vp.width > 0) out.left = Math.round(Math.min(Math.max(out.left, m), Math.max(m, vp.width - size.width - m)));
  if (vp && vp.height > 0) out.top = Math.round(Math.min(Math.max(out.top, m), Math.max(m, vp.height - size.height - m)));
  return out;
}

function readInfoPosMap() {
  try {
    var raw = localStorage.getItem(INFO_POS_KEY);
    if (!raw) return {};
    var box = JSON.parse(raw);
    if (!box || typeof box !== "object") return {};
    var src = box.pos && typeof box.pos === "object" ? box.pos : box;
    var out = {};
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var one = src[k];
      if (!one || typeof one !== "object") continue;
      if (typeof one.left !== "number" || typeof one.top !== "number") continue;
      if (!isFinite(one.left) || !isFinite(one.top)) continue;
      out[k] = { left: one.left, top: one.top };
    }
    return out;
  } catch (e) {
    return {};
  }
}

function readInfoPos(itemId) {
  if (!itemId) return null;
  return readInfoPosMap()[itemId] || null;
}

function writeInfoPos(itemId, pos) {
  if (!itemId || !pos) return;
  try {
    var map = readInfoPosMap();
    delete map[itemId];
    map[itemId] = { left: Math.round(pos.left), top: Math.round(pos.top) };
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length - INFO_POS_MAX; i++) delete map[keys[i]];
    safeLocalSet(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function clearInfoPos(itemId) {
  if (!itemId) return;
  try {
    var map = readInfoPosMap();
    delete map[itemId];
    if (!Object.keys(map).length) localStorage.removeItem(INFO_POS_KEY);
    else safeLocalSet(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) {  }
}

function infoPopoverOptions(pos, size, url) {
  return {
    id: ID_INFO,
    url: url,
    width: size.width,
    height: size.height,
    anchorReference: "POSITION",
    anchorPosition: { left: pos.left, top: pos.top },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true
  };
}

async function showInfoAt(pos, size, url, itemId, cardId, vp) {
  armInfoReadyWatchdog();
  await OBR.popover.open(infoPopoverOptions(pos, size, url));
  infoOpen = true;
  infoItemId = itemId;
  infoCardId = cardId;
  infoGeom = {
    left: pos.left,
    top: pos.top,
    width: size.width,
    height: size.height,
    url: url,
    vp: { width: vp.width, height: vp.height }
  };
}

async function infoAutoPos(itemId, size, vp) {
  var saved = readInfoPos(itemId);
  if (saved) return clampInfoPos(saved.left, saved.top, size, vp);
  var anchor = await anchorOf(itemId);
  if (anchor) {
    return clampInfoPos(anchor.left - size.width / 2, anchor.top - INFO_TOKEN_GAP - size.height, size, vp);
  }

  return clampInfoPos((vp.width || 0) / 2 - size.width / 2, INFO_VIEW_MARGIN, size, vp);
}

var INFO_MODE_AUTO = "compact";
/* v2.5.1：页面自动收高后同步给后台，拖动/重开用真实高度，否则会弹回 700 空窗。 */
function onInfoSize(ev) {
  var d = ev && ev.data !== undefined ? ev.data : ev;
  if (!d || !infoGeom) return;
  var h = Math.round(Number(d.height));
  if (isFinite(h) && h >= 200 && h <= 760) infoGeom.height = h;
  var w = Math.round(Number(d.width));
  if (isFinite(w) && w >= INFO_MIN_W && w <= 700) infoGeom.width = w;
}

async function openInfo(itemId, cardId, mode) {
  var wantMode = mode === "full" ? "full" : INFO_MODE_AUTO;
  /* v2.5.1 bugfix：复用单窗时必须确认**模式一致**。旧代码直接复用紧凑窗当完整窗用，
   * 右键「速览」会把完整界面挤进 400px；反过来完整窗开着时点 token 也不会回到紧凑。 */
  if (infoOpen && infoMode !== wantMode) {
    await closeInfo();
    await new Promise(function (r) { setTimeout(r, 80); });
  }
  infoMode = wantMode;
  /* v1.8.9：**单窗挂载** —— 窗口已经开着同一枚 token 换 target 即可，绝不重开 iframe
   * （每次都新建 iframe 要重新下载 / 解析 ~430KB 脚本，是「切换 token 黑屏」的根因）。 */
  if (infoOpen) {
    infoItemId = itemId;
    infoCardId = cardId;
    /* 复用路径要 ack 兜底：700ms 内页面没刷新（无 ack）就关闭重开一次。 */
    await publishInfoTarget(itemId, cardId, true);
    return;
  }
  var vp = await infoViewport();
  var size = infoSize(vp, infoMode);
  var pos = await infoAutoPos(itemId, size, vp);
  if (!infoSession) infoSession = newInfoSession();

  var url = URL_INFO + "?v=" + encodeURIComponent(PLUGIN_VERSION) +
    "&item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId) +
    "&session=" + encodeURIComponent(infoSession) +
    "&mode=" + encodeURIComponent(infoMode);
  infoAckRetries = 0;
  await showInfoAt(pos, size, url, itemId, cardId, vp);
  /* 首次挂载后广播 target：页面若在 iframe 加载完成前就 READY，onInfoReady 会补发。 */
  await publishInfoTarget(itemId, cardId);
}

async function closeInfo() {
  clearInfoReadyWatchdog();
  if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
  infoDrag = null;
  infoGeom = null;
  if (!infoOpen) return;
  try { await OBR.popover.close(ID_INFO); } catch (e) {  }
  infoOpen = false;
  infoItemId = null;
  infoCardId = null;
  resetInfoTarget();
}

function queueInfoDrag(pos) {
  if (!infoGeom) return;
  dragWanted = {
    pos: { left: pos.left, top: pos.top },
    size: { width: infoGeom.width, height: infoGeom.height },
    url: infoGeom.url
  };
  void pumpInfoDrag();
}

async function pumpInfoDrag() {
  if (dragBusy) return;
  dragBusy = true;
  try {
    while (dragWanted) {
      var job = dragWanted;
      dragWanted = null;
      try {
        await OBR.popover.open(infoPopoverOptions(job.pos, job.size, job.url));
        if (infoGeom) {
          infoGeom.left = job.pos.left;
          infoGeom.top = job.pos.top;
        }
      } catch (e) {
        pageLog("err", "拖动速览弹窗失败：" + errText(e));
        break;
      }
    }
  } finally {
    dragBusy = false;

    if (dragWanted) void pumpInfoDrag();
  }
}

function touchInfoDragTimer() {
  if (infoDragTimer) clearTimeout(infoDragTimer);
  infoDragTimer = setTimeout(function () {
    infoDragTimer = null;
    if (!infoDrag) return;
    if (infoDrag.moved && infoGeom) writeInfoPos(infoDrag.itemId, infoGeom);
    infoDrag = null;
    pageLog("info", "速览弹窗拖动超时，已按最后位置收尾");
  }, INFO_DRAG_IDLE_MS);
}

function onInfoDrag(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.phase !== "string") return;

  if (data.phase === "reset") {
    clearInfoPos(infoItemId);
    infoDrag = null;
    if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
    void resetInfoToToken();
    return;
  }
  if (!infoOpen || !infoGeom) return;

  var dx = typeof data.dx === "number" && isFinite(data.dx) ? data.dx : 0;
  var dy = typeof data.dy === "number" && isFinite(data.dy) ? data.dy : 0;

  if (data.phase === "start" || !infoDrag) {

    infoDrag = { base: { left: infoGeom.left, top: infoGeom.top }, itemId: infoItemId, moved: false };
    touchInfoDragTimer();
    if (data.phase === "start") return;
  }

  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) infoDrag.moved = true;

  if (!infoDrag.moved) {
    if (data.phase === "end") {
      if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
      infoDrag = null;
    }
    return;
  }

  var target = clampInfoPos(infoDrag.base.left + dx, infoDrag.base.top + dy, infoGeom, infoGeom.vp);
  queueInfoDrag(target);
  touchInfoDragTimer();

  if (data.phase === "end") {
    if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
    writeInfoPos(infoDrag.itemId, target);
    infoDrag = null;
  }
}

async function resetInfoToToken() {
  if (!infoOpen || !infoItemId) return;
  var itemId = infoItemId;
  var cardId = infoCardId;
  var vp = await infoViewport();
  /* v2.5.1 bugfix：重锚必须用**当前窗口真实尺寸**（紧凑 400 或完整 660、以及自动收高后的高度），
   * 旧代码用 infoSize(vp) 默认 compact+700，点了「回到 token 上方」会弹回大空窗。 */
  var size = infoGeom
    ? { width: infoGeom.width, height: infoGeom.height }
    : infoSize(vp, infoMode);
  var pos = await infoAutoPos(itemId, size, vp);
  var url = infoGeom ? infoGeom.url : URL_INFO + "?v=" + encodeURIComponent(PLUGIN_VERSION) +
    "&item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId || "") +
    "&session=" + encodeURIComponent(infoSession);

  if (!infoOpen || infoItemId !== itemId) return;
  try {
    await showInfoAt(pos, size, url, itemId, cardId, vp);
    /* v1.8.9：重锚后页面会重新 READY 要 target —— 这里也主动重发一次（两边兜底）。 */
    await publishInfoTarget(itemId, cardId);
    pageLog("info", "速览弹窗已回到 token 上方");
  } catch (e) {
    stepFail("把速览弹窗移回 token", e);
  }
}

async function selectedItem() {
  var sel = null;
  try { sel = await OBR.player.getSelection(); } catch (e) { return null; }
  if (!sel || sel.length !== 1) return null;
  try {
    var items = await OBR.scene.items.getItems([sel[0]]);
    return items && items[0] ? items[0] : null;
  } catch (e) {
    return null;
  }
}

/** 比名字用的归一化：去括号备注（token 名常带「（玩家）」）、去空白、忽略大小写。 */
function normCardName(s) {
  return String(s == null ? "" : s).replace(/[（(][^)）]*[)）]/g, "").replace(/\s+/g, "").toLowerCase();
}

/**
 * 按 token 名字找卡（v1.8.0 的名字兜底）。
 * 场景：城主删掉了卡又重新导入（卡片 id 变了），token 上还挂着旧 id。
 * 没有这层兜底时，这种 token 会被当成「没有卡」，选中时会误弹血条编辑窗（v1.7.15 的真 bug）。
 */
function findCardByName(cards, name) {
  var key = normCardName(name);
  if (!key) return null;
  var i;
  for (i = 0; i < cards.length; i++) {
    if (normCardName(cards[i] && cards[i].name) === key) return cards[i];
  }
  var loose = null;
  for (i = 0; i < cards.length; i++) {
    var cn = normCardName(cards[i] && cards[i].name);
    if (!cn) continue;
    if (cn.indexOf(key) >= 0 || key.indexOf(cn) >= 0) {
      if (!loose) loose = cards[i];
    }
  }
  return loose;
}

/**
 * 解析 token 的绑定：先按 id，再按名字（并顺手把新 id 写回去修复旧绑定）。
 * 返回 { cardId, via: "id"|"name", stale } 或 null。
 */
async function resolveBinding(item) {
  if (!item || !item.metadata) return null;
  var cards = await getCards();
  var bound = item.metadata[KEY_BIND];
  if (typeof bound === "string" && bound && findCard(cards, bound)) {
    return { cardId: bound, via: "id", stale: false, cards: cards };
  }
  var byName = findCardByName(cards, item.name);
  if (!byName) return null;
  return {
    cardId: byName.id,
    via: "name",
    stale: typeof bound === "string" && !!bound,
    cards: cards
  };
}

/** 名字兜底命中后，把正确的卡片 id 写回 token（只修不伤；失败只记日志）。 */
async function healBinding(itemId, cardId) {
  try {
    await OBR.scene.items.updateItems([itemId], function (items) {
      for (var i = 0; i < items.length; i++) {
        if (!items[i].metadata || typeof items[i].metadata !== "object") items[i].metadata = {};
        items[i].metadata[KEY_BIND] = cardId;
      }
    });
    pageLog("ok", "按名字修复了 token " + itemId + " 的卡片绑定 → " + cardId);
  } catch (e) {
    pageLog("info", "修复卡片绑定失败（" + itemId + "）：" + errText(e));
  }
}

async function boundCardId(item) {
  var hit = await resolveBinding(item);
  if (!hit) return null;
  if (hit.via === "name" && hit.stale) void healBinding(item.id, hit.cardId);
  return hit.cardId;
}

async function selectedBinding() {
  var item = await selectedItem();
  if (!item) return null;
  var hit = await resolveBinding(item);
  if (!hit) return null;
  if (hit.via === "name" && hit.stale) void healBinding(item.id, hit.cardId);
  return { itemId: item.id, cardId: hit.cardId };
}

async function openGlance(where) {
  var label = where || "工具栏「速览」";
  var bind = await selectedBinding();
  if (!bind) {
    notify("速览：" + label + " 打开的是「当前选中的 token」。先选中一枚已绑定角色卡的 token" +
      "（右键 token 可「绑定 4E NEXT 角色卡」），再点一次。", "WARNING");
    pageLog("info", label + "：当前选中的不是「已绑定角色卡的单个 token」，已提示用户先选一个");
    return false;
  }
  try {
    /* v2.5.1：已经是「完整模式 + 同一枚 token」→ 直接复用，不再关掉重开（省一次 iframe 加载）。 */
    if (infoOpen && infoMode === "full" && infoItemId === bind.itemId && infoCardId === bind.cardId) {
      stepOk(label + "：完整速览已打开（复用）");
      return true;
    }
    /* 右键「速览」= 以前的完整界面；点 token 自动弹的才是紧凑版。 */
    if (infoOpen) {
      await closeInfo();
      await new Promise(function (r) { setTimeout(r, 80); });
    }
    await openInfo(bind.itemId, bind.cardId, "full");
    stepOk(label + "：已打开完整速览（token " + bind.itemId + "）");
    return true;
  } catch (e) {
    stepFail("打开速览弹窗（" + label + "）", e);
    return false;
  }
}

var infoErrorShown = false;
/* v1.8.2：先攻条点卡片头像 → 页面先发 CH_GLANCE_SUPPRESS，1.5 秒内不自动弹速览
 * （token 仍会被选中 / 地图高亮，只是别弹窗；GM 战斗中点是设当前回合，不受影响）。 */
var suppressGlanceUntil = 0;

async function refreshInfo() {
  var item = await selectedItem();
  var selId = item && item.id ? item.id : null;
  if (selId !== hpAutoSel) {
    hpAutoSel = selId;
    hpAutoPopped = {};
    infoAutoPopped = {};
    /* v1.8.1 诊断：选中变化时才重置「自动弹过」记录。真机排查时看这行就知道是不是选择事件在抖。 */
    pageLog("info", "选中变化 → " + (selId || "无") + "（自动弹窗记录已重置）");
  }
  if (!item) {
    /* v2.5.1：点地图 / 取消选中 → 速览保持当前内容，不关窗；只关自动打开的血条编辑窗（钉住则保留）。 */
    if (winOpen["hpEdit"] && !hpEditPinned()) await closeWin("hpEdit");
    if (infoOpen) pageLog("info", "info keep（取消选中）");
    return;
  }
  /* v1.8.2：先攻条点卡片头像（页面先发 CH_GLANCE_SUPPRESS 再 select）→ 1.5 秒内不自动弹速览。
   * token 仍然被选中 / 地图高亮，只是不弹；不碰下面 hpAutoSel / hpAutoPopped / hasHpBarData 顺序。 */
  if (Date.now() < suppressGlanceUntil) return;

  var cardId = await boundCardId(item);
  if (cardId) {
    /* v2.5.1：选了绑定卡的 token → 速览接管；未钉住时关掉血条编辑窗（钉住则保持当前 token）。 */
    if (winOpen["hpEdit"] && !hpEditPinned() && hpEditTarget.itemId !== item.id) {
      await closeWin("hpEdit");
    }
    /* v1.8.5：用户手动 ✕ 关过这枚 token 的速览 → 选中不变之前不再自动弹回（先于「已开则返回」判断）。 */
    if (infoAutoPopped[item.id]) return;
    if (infoOpen && infoItemId === item.id && infoCardId === cardId) return;
    if (infoOpen) pageLog("info", "info switch target=" + item.id);
    /* v1.8.9：窗口已开、但不是这枚 token → 不关重开，交给 openInfo 只广播 target 换内容。 */
    /* 打开之前先置位：即使 openInfo 抛错也不在后续 onChange 里重试刷屏。 */
    infoAutoPopped[item.id] = true;
    try {
      await openInfo(item.id, cardId);
    } catch (e) {
      if (!infoErrorShown) {
        infoErrorShown = true;
        stepFail("打开速览弹窗", e);
      }
    }
    return;
  }

  /* v2.5.1：选中非绑卡 token / 多选 → 速览保持当前内容，不关闭。 */
  if (infoOpen) pageLog("info", "info keep（选中无卡）");
  /* v2.5.1：非 GM 不再自动弹血条编辑窗；locked/hide 对非 GM 一律不弹。 */
  var hpRole = "";
  var hpPid = "";
  try { hpRole = await OBR.player.getRole(); } catch (eRole) { hpRole = ""; }
  try { hpPid = await OBR.player.getId(); } catch (ePid) { hpPid = ""; }
  var hpMetaNow = item.metadata ? item.metadata[KEY_HP] : null;
  var hpLockedNow = !hpMetaNow || hpMetaNow.locked !== false;
  var hpHiddenNow = !!(hpMetaNow && hpMetaNow.hide === true);
  var isOwnerNow = !!(hpPid && item.createdUserId === hpPid);
  if (hpRole !== "GM" && (hpLockedNow || hpHiddenNow)) {
    if (winOpen["hpEdit"] && hpEditTarget.itemId === item.id) {
      try { await closeWin("hpEdit"); } catch (eClose) { /* 忽略 */ }
      try { notify("这枚 token 的血条已隐藏", "WARNING"); } catch (eNote) { /* 忽略 */ }
    }
    pageLog("info", "hpEdit skip（非GM/锁定/隐藏）token=" + item.id + " locked=" + hpLockedNow + " hide=" + hpHiddenNow);
    return;
  }
  if (hpRole !== "GM" && !isOwnerNow) {
    pageLog("info", "hpEdit skip（非GM/非owner）token=" + item.id);
    return;
  }
  /* v2.5.1：钉住时保持当前编辑的 token，不换 target。 */
  if (hpEditPinned() && winOpen["hpEdit"]) return;
  if (!hasHpBarData(item)) {
    if (winOpen["hpEdit"] && hpEditTarget.itemId !== item.id) await closeWin("hpEdit");
    return;
  }
  if (hpAutoPopped[item.id]) return;
  try {
    await openHpEdit(item.id);
  } catch (e) {
    stepFail("选中 token 打开血条编辑窗", e);
  }
}

var pendingRefresh = null;
function scheduleRefresh() {
  if (pendingRefresh) return;
  pendingRefresh = setTimeout(function () {
    pendingRefresh = null;
    void refreshInfo();
  }, 120);
}

async function sceneReady() {
  try { return await OBR.scene.isReady(); } catch (e) { return false; }
}

var BAR_TAG = NS + "/bar";

var barEntries = {};
var barTimer = null;
var barBusy = false;
var barAgain = false;
var barUnsupported = false;
var barSwept = false;
var cachedDpi = 0;

var barThreshold = -1;
async function sceneViewer() {
  var out = { role: "", id: "", threshold: PLAYER_THRESHOLD_DEFAULT };
  try { out.role = await OBR.player.getRole(); } catch (e1) {  }
  try { out.id = await OBR.player.getId(); } catch (e2) {  }
  if (barThreshold >= 0) { out.threshold = barThreshold; return out; }
  try {
    if (OBR.scene && typeof OBR.scene.getMetadata === "function") {
      var meta = await OBR.scene.getMetadata();
      var raw = meta ? meta[KEY_PLAYER_THRESHOLD] : null;
      if (typeof raw === "number" && isFinite(raw) && raw >= 0 && raw <= 100) out.threshold = Math.round(raw);
    }
  } catch (e3) {  }
  barThreshold = out.threshold;
  return out;
}

function barBuildersOk() {
  return typeof buildCurve === "function" && typeof buildText === "function";
}

function readIntOrNull(v) {
  return typeof v === "number" && isFinite(v) ? Math.round(v) : null;
}

function readDefenses(raw) {
  if (!raw || typeof raw !== "object") return null;
  var out = null;
  for (var i = 0; i < DEF_KEYS.length; i++) {
    var k = DEF_KEYS[i];
    var n = readIntOrNull(raw[k]);
    if (n === null) continue;
    if (!out) out = {};
    out[k] = Math.max(0, n);
  }
  return out;
}

function hpBarEnabled(item) {
  var flag = item && item.metadata ? item.metadata[KEY_HPBAR] : undefined;
  return flag !== false;
}

function hasHpBarData(item) {
  /* v1.8.4：用户显式「移除血条组件」后（enabled === false），即使 hp 数据还留着也不再算「有血条」，
     否则选中 token 又会自动弹编辑窗（真机 bug）。右键「编辑血条」仍走 onHpBarEdit，不经过这里。 */
  if (!hpBarEnabled(item)) return false;
  if (!item || !item.metadata) return false;
  if (item.metadata[KEY_HPBAR] === true) return true;
  var m = item.metadata[KEY_HP];
  if (!m || typeof m !== "object") return false;
  if (readIntOrNull(m.cur) !== null) return true;
  if (typeof m.max === "number" && isFinite(m.max) && m.max > 0) return true;
  if (readIntOrNull(m.temp) !== null) return true;
  if (readIntOrNull(m.surges) !== null) return true;
  if (m.defenses && typeof m.defenses === "object" && Object.keys(m.defenses).length) return true;
  return false;
}

function quantiseRatio(ratio, thresholdPercent) {
  if (!(thresholdPercent > 0)) return ratio;
  var step = thresholdPercent / 100;
  if (step >= 1) return ratio > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, Math.ceil(ratio / step) * step));
}

function readHpMeta(item) {
  var m = item && item.metadata ? item.metadata[KEY_HP] : null;
  if (!m || typeof m !== "object") return null;
  var cur = readIntOrNull(m.cur);
  var max = typeof m.max === "number" && isFinite(m.max) && m.max > 0 ? Math.round(m.max) : null;
  var temp = typeof m.temp === "number" && isFinite(m.temp) ? Math.max(0, Math.round(m.temp)) : 0;
  if (cur === null && max === null) return null;
  var surges = typeof m.surges === "number" && isFinite(m.surges) ? Math.max(0, Math.round(m.surges)) : null;
  var surgesMax = typeof m.surgesMax === "number" && isFinite(m.surgesMax) && m.surgesMax > 0
    ? Math.round(m.surgesMax) : null;
  return {
    cur: cur, max: max, temp: temp,
    surges: surges, surgesMax: surgesMax,
    defenses: readDefenses(m.defenses),

    locked: m.locked !== false,
    hide: m.hide === true,
    name: item && typeof item.name === "string" ? item.name.trim().slice(0, 120) : ""
  };
}

async function sceneDpi() {
  if (cachedDpi > 0) return cachedDpi;
  try {
    if (OBR.scene.grid && typeof OBR.scene.grid.getDpi === "function") cachedDpi = await OBR.scene.grid.getDpi();
  } catch (e) {
    cachedDpi = 0;
  }
  if (!(cachedDpi > 0)) cachedDpi = 150;
  return cachedDpi;
}

/* v2.5.1：用户样板布局 —— 底部比例横条 + 左侧三圆（强/反/意）+ 右下 AC 盾，不再用环形。
 * 坐标全部相对 token 包围盒（宽 64%、高 10% 短边），s = min(w,h)/dpi 沿用旧缩放。 */

/** 圆角矩形多边形（以中心为原点，24 段近似；血条 / 填充都用它）。 */
function roundedRectPoints(W, H, R, segments) {
  var w = Math.max(0, W), h = Math.max(0, H);
  var r = Math.max(0, Math.min(R, Math.min(w, h) / 2));
  var perArc = Math.max(2, Math.round((segments || 24) / 4));
  var x0 = -w / 2, y0 = -h / 2;
  var pts = [];
  function arc(cx, cy, a0, a1) {
    for (var i = 0; i <= perArc; i++) {
      var a = a0 + (a1 - a0) * (i / perArc);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  }
  arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
  arc(x0 + w - r, y0 + r, -Math.PI / 2, 0);
  arc(x0 + w - r, y0 + h - r, 0, Math.PI / 2);
  arc(x0 + r, y0 + h - r, Math.PI / 2, Math.PI);
  return pts;
}

/* 四防颜色（样板）：强韧粉 / 反射黄 / 意志蓝；AC 盾深灰蓝。 */
var BAR_DEF_COLORS = { fort: "#f0a5ab", reflex: "#f5e884", will: "#8e9dd6" };
var BAR_DEF_ORDER = ["fort", "reflex", "will"];

function shieldPoints(W, H, segments) {
  var seg = segments || 14;
  var pts = [];
  var cornerR = Math.min(W, H) * 0.18;
  var sideStraightBottom = H * 0.42;
  var i, t, a;
  for (i = 0; i <= seg; i++) {
    t = i / seg; a = -Math.PI + (Math.PI / 2) * t;
    pts.push({ x: cornerR + Math.cos(a) * cornerR, y: cornerR + Math.sin(a) * cornerR });
  }
  for (i = 0; i <= seg; i++) {
    t = i / seg; a = -Math.PI / 2 + (Math.PI / 2) * t;
    pts.push({ x: W - cornerR + Math.cos(a) * cornerR, y: cornerR + Math.sin(a) * cornerR });
  }
  pts.push({ x: W, y: sideStraightBottom });
  var segs2 = seg * 2;
  for (i = 1; i <= segs2; i++) {
    t = i / segs2;
    var u = 1 - t;
    pts.push({
      x: u * u * W + 2 * u * t * (W * 0.85) + t * t * (W / 2),
      y: u * u * sideStraightBottom + 2 * u * t * (H * 0.92) + t * t * H
    });
  }
  for (i = 1; i <= segs2; i++) {
    t = i / segs2;
    var v = 1 - t;
    pts.push({
      x: v * v * (W / 2) + 2 * v * t * (W * 0.15) + t * t * 0,
      y: v * v * H + 2 * v * t * (H * 0.92) + t * t * sideStraightBottom
    });
  }
  return pts;
}

function circlePoints(D, segments) {
  var n = Math.max(8, Math.round(segments || DEF_CIRCLE_SEGMENTS));
  var r = D / 2;
  var out = [];
  for (var i = 0; i < n; i++) {
    var a = -Math.PI / 2 + (Math.PI * 2) * (i / n);
    out.push({ x: r + Math.cos(a) * r, y: r + Math.sin(a) * r });
  }
  return out;
}

function quantiseBarRatio(cur, max) {
  var r = max > 0 ? Math.max(0, Math.min(1, cur / max)) : 0;
  if (r <= 0) return 0;
  return Math.min(1, Math.ceil(r / 0.25) * 0.25);
}
function barLayout(bounds, dpi, hp, viewer) {
  var max = hp.max > 0 ? hp.max : (hp.cur !== null ? Math.max(1, hp.cur) : 1);
  var cur = hp.cur === null ? max : hp.cur;
  var ratio = Math.max(0, Math.min(1, cur / max));
  var bloodied = max > 0 ? cur <= max / 2 : false;
  var s = Math.min(bounds.width, bounds.height) / dpi;
  if (!isFinite(s) || s <= 0) s = 1;
  s = Math.max(0.2, Math.min(6, s));

  var exact = !viewer || viewer.exact !== false;
  var threshold = viewer && typeof viewer.threshold === "number" ? viewer.threshold : PLAYER_THRESHOLD_DEFAULT;
  var shownRatio = exact ? ratio : quantiseRatio(ratio, threshold);
  var short = Math.min(bounds.width, bounds.height);

  /* 底部血条：宽 64% token 宽、高 10% 短边、底边距 4% 短边、圆角 = 高/2。 */
  var barW = Math.max(4 * s, bounds.width * 0.64);
  var barH = Math.max(2 * s, short * 0.10);
  var gap = short * 0.04;
  var barCx = bounds.center.x;
  var barCy = bounds.max.y - gap - barH / 2;
  var bar = {
    cx: barCx, cy: barCy, left: barCx - barW / 2, top: barCy - barH / 2,
    width: barW, height: barH, radius: Math.min(barH / 2, barW / 2),
    ratio: shownRatio, fillW: Math.max(0, barW * shownRatio),
    color: bloodied ? COLOR_HP_BLOODIED : "#b00000",
    track: "#3a1414", trackOpacity: 0.8
  };

  /* 条内文字：精确时 cur/max（+temp 后缀）；按条宽 / 条高自适应，装不下就隐藏。 */
  var hpText = exact ? (String(cur) + "/" + max + (hp.temp > 0 ? " +" + hp.temp : "")) : "";
  var hpFont = 0, hpTextW = 0, hpTextH = 0, hpTextFits = false;
  if (hpText) {
    var tryFont = Math.max(3 * s, Math.min(barH * 0.78, 14 * s));
    var fontFloor = 3 * s;
    for (var fitTry = 0; fitTry < 48; fitTry++) {
      var needW = Math.max(4 * s, hpText.length * tryFont * 0.62);
      var needH = Math.max(3 * s, tryFont * 1.2);
      if (needW <= barW * 0.92 && needH <= barH * 0.98) {
        hpFont = tryFont; hpTextW = needW; hpTextH = needH; hpTextFits = true;
        break;
      }
      if (!(tryFont > fontFloor)) break;
      tryFont = Math.max(fontFloor, tryFont * 0.9);
    }
  }
  if (!hpTextFits) { hpText = ""; hpFont = 0; hpTextW = 0; hpTextH = 0; }
  var barText = {
    text: hpText, font: hpFont, width: hpTextW, height: hpTextH,
    x: barCx - hpTextW / 2, y: barCy - hpTextH / 2,
    fits: hpTextFits, visible: exact && hpTextFits && !!hpText
  };

  /* 左侧竖排三圆：直径 16% 短边、左边距 6%、间距 4%，从血条上方往上排（上 → 下 = 强/反/意）。 */
  var dDef = short * 0.16;
  var defMargin = short * 0.06;
  var defGap = short * 0.04;
  var defX = bounds.min.x + defMargin + dDef / 2;
  var yBottom = barCy - barH / 2 - gap - dDef / 2;
  var defs = [];
  var present = [];
  if (hp.defenses) {
    for (var di = 0; di < BAR_DEF_ORDER.length; di++) {
      var dk = BAR_DEF_ORDER[di];
      if (typeof hp.defenses[dk] === "number") present.push(dk);
    }
  }
  for (var dj = present.length - 1; dj >= 0; dj--) {
    var key = present[dj];
    var val = hp.defenses[key];
    var txt = String(val);
    defs.unshift({
      key: key, value: val, text: txt, d: dDef, x: defX, y: yBottom,
      color: BAR_DEF_COLORS[key],
      fontSize: Math.max(8 * s, dDef * (txt.length > 2 ? 0.42 : 0.5))
    });
    yBottom -= dDef + defGap;
  }
  /* 玩家（非精确）沿用旧 viewer 逻辑：不画四防图形、不显示数字。 */
  var showDefenses = exact && defs.length > 0;

  /* 右下角 AC 盾：宽 20% 短边、高按盾形比例 1.08，右下内缩 4%，白描边。 */
  var shield = null;
  if (exact && hp.defenses && typeof hp.defenses.ac === "number") {
    var sw = short * 0.20;
    var sh = sw * 1.08;
    var inset = short * 0.04;
    var acTxt = String(hp.defenses.ac);
    shield = {
      key: "ac", value: hp.defenses.ac, text: acTxt, w: sw, h: sh,
      cx: bounds.max.x - inset - sw / 2,
      cy: bounds.max.y - inset - sh / 2,
      strokeWidth: Math.max(1, 1.5 * s),
      fontSize: Math.max(8 * s, sw * (acTxt.length > 2 ? 0.42 : 0.5))
    };
  }

  return {
    scale: s, exact: exact,
    ratio: shownRatio, rawRatio: ratio,
    bloodied: bloodied,
    bar: bar, barText: barText,
    textVisible: barText.visible,
    hpText: hpText, hpFont: hpFont, hpTextW: hpTextW, hpTextH: hpTextH,
    hpTextX: barText.x, hpTextY: barText.y, hpTextFits: hpTextFits,
    colorFill: bar.color,
    showDefenses: showDefenses, defs: showDefenses ? defs : [],
    shield: shield,
    d: dDef, dDef: dDef, gap: gap
  };
}

function barRolesKey(L) {
  var defs = L.defs && L.defs.length ? "D" + L.defs.map(function (x) { return x.key; }).join("") : "";
  return defs + (L.shield ? "A" : "") + (L.textVisible ? "T" : "");
}

function barSig(hp, L) {
  var d = hp.defenses;
  var b = L.bar || {};
  return [
    hp.cur, hp.max, hp.temp,
    d ? [d.ac, d.fort, d.reflex, d.will].join(",") : "",
    hp.locked ? 1 : 0, L.exact ? 1 : 0,
    Math.round(b.width * 10), Math.round(b.height * 10),
    Math.round(L.ratio * 1000),
    Math.round(L.scale * 1000),
    L.defs ? L.defs.length : 0,
    L.shield ? 1 : 0
  ].join("|");
}
function barMeta(tokenId, role, extra) {
  var box = {};
  var tag = { owner: tokenId, role: role };
  if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) tag[k] = extra[k];
  box[BAR_TAG] = tag;
  return box;
}
function findDef(L, key) {
  for (var i = 0; i < L.defs.length; i++) if (L.defs[i].key === key) return L.defs[i];
  return null;
}

function barCurveItem(tokenId, role, points, x, y, opt) {
  opt = opt || {};
  var b = barCommon(buildCurve(), tokenId, role, BAR_Z[role] || 10000)
    .fillColor(opt.fill || "#ffffff")
    .fillOpacity(typeof opt.fillOpacity === "number" ? opt.fillOpacity : 1)
    .strokeColor(opt.stroke || "#000000")
    .strokeOpacity(typeof opt.strokeOpacity === "number" ? opt.strokeOpacity : 0)
    .strokeWidth(typeof opt.strokeWidth === "number" ? opt.strokeWidth : 0)
    .tension(0)
    .closed(opt.closed !== false)
    .points(points)
    .position({ x: x, y: y })
    .visible(opt.visible !== false);
  if (opt.extra) b.metadata(barMeta(tokenId, role, opt.extra));
  return b.build();
}

function barTextItem(tokenId, role, text, font, color, x, y, w, h, opt) {
  opt = opt || {};
  var b = barCommon(buildText(), tokenId, role, BAR_Z[role] || 12400)
    .plainText(text).textType("PLAIN")
    .textAlign(opt.align || "CENTER").textAlignVertical("MIDDLE")
    .fontFamily("Roboto, sans-serif").fontSize(font)
    .fontWeight(opt.weight || 700)
    .fillColor(color || "#ffffff").fillOpacity(1)
    .strokeColor(opt.stroke || "#000000")
    .strokeOpacity(typeof opt.strokeOpacity === "number" ? opt.strokeOpacity : 0.7)
    .strokeWidth(Math.max(0.4, typeof opt.strokeWidth === "number" ? opt.strokeWidth : 0.5))
    .lineHeight(0.95).width(w).height(h)
    .position({ x: x, y: y })
    .visible(opt.visible !== false);

  if (opt.extra) b.metadata(barMeta(tokenId, role, opt.extra));
  return b.build();
}

function findShield(L, key) {
  for (var i = 0; i < L.shields.length; i++) if (L.shields[i].key === key) return L.shields[i];
  return null;
}

function barCommon(builder, tokenId, role, z) {
  return builder
    .position({ x: 0, y: 0 })
    .layer("ATTACHMENT")
    .attachedTo(tokenId)
    .locked(true)
    .disableHit(true)
    .visible(true)
    .disableAutoZIndex(true)
    .zIndex(z)
    .disableAttachmentBehavior(["SCALE", "ROTATION", "LOCKED", "COPY"])
    .metadata(barMeta(tokenId, role));
}

function buildBarItems(tokenId, L) {
  var items = [];
  var bar = L.bar;
  var i;

  /* v2.5.1 底部圆角横条：深红轨道 + 按 cur/max 比例的左→右填充。 */
  items.push(barCurveItem(tokenId, "bar-bg",
    roundedRectPoints(bar.width, bar.height, bar.radius, 24), bar.cx, bar.cy,
    { fill: bar.track, fillOpacity: bar.trackOpacity }));
  items.push(barCurveItem(tokenId, "bar-fill",
    roundedRectPoints(bar.fillW, bar.height, Math.min(bar.radius, bar.fillW / 2), 16),
    bar.left + bar.fillW / 2, bar.cy,
    { fill: L.colorFill, fillOpacity: 0.95, visible: bar.ratio > 0 }));
  items.push(barTextItem(tokenId, "bar-text", L.barText.text, L.barText.font, "#ffffff",
    L.barText.x, L.barText.y, L.barText.width, L.barText.height,
    { strokeWidth: Math.max(0.4, L.barText.font * 0.09), visible: L.textVisible }));

  /* 左侧三圆：强韧 / 反射 / 意志。 */
  for (i = 0; i < L.defs.length; i++) {
    var cd = L.defs[i];
    items.push(barCurveItem(tokenId, "def", circlePoints(cd.d, DEF_CIRCLE_SEGMENTS),
      cd.x - cd.d / 2, cd.y - cd.d / 2,
      {
        fill: cd.color, fillOpacity: 1, stroke: "#1c2330", strokeOpacity: 1,
        strokeWidth: Math.max(0.8, cd.d * 0.035), extra: { key: cd.key }
      }));
    items.push(barTextItem(tokenId, "def-text", cd.text, cd.fontSize, "#ffffff",
      cd.x - cd.d / 2, cd.y - cd.d / 2, cd.d, cd.d,
      { strokeWidth: Math.max(0.4, cd.d * 0.02), extra: { key: cd.key } }));
  }

  /* 右下角 AC 盾。 */
  if (L.shield) {
    var sh = L.shield;
    items.push(barCurveItem(tokenId, "ac-shield",
      shieldPoints(sh.w, sh.h, 14), sh.cx - sh.w / 2, sh.cy - sh.h / 2,
      {
        fill: "#393e50", fillOpacity: 1, stroke: "#ffffff", strokeOpacity: 1,
        strokeWidth: sh.strokeWidth, extra: { key: "ac" }
      }));
    items.push(barTextItem(tokenId, "ac-text", sh.text, sh.fontSize, "#ffffff",
      sh.cx - sh.w / 2, sh.cy - sh.h / 2, sh.w, sh.h,
      { strokeWidth: Math.max(0.4, sh.w * 0.02), extra: { key: "ac" } }));
  }

  return items;
}
async function addBar(tokenId, L) {
  var items = buildBarItems(tokenId, L);
  await OBR.scene.local.addItems(items);
  var ids = [];
  for (var i = 0; i < items.length; i++) ids.push(items[i].id);
  return ids;
}

async function patchBar(entry, L) {
  var bar = L.bar;
  await OBR.scene.local.updateItems(entry.ids, function (drafts) {
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i];
      var tag = d.metadata && d.metadata[BAR_TAG] ? d.metadata[BAR_TAG] : null;
      var role = tag && tag.role ? tag.role : "";
      switch (role) {
        case "bar-bg":
          d.position = { x: bar.cx, y: bar.cy };
          d.points = roundedRectPoints(bar.width, bar.height, bar.radius, 24);
          d.visible = true;
          break;
        case "bar-fill":
          d.position = { x: bar.left + bar.fillW / 2, y: bar.cy };
          d.points = roundedRectPoints(bar.fillW, bar.height, Math.min(bar.radius, bar.fillW / 2), 16);
          if (d.style) d.style.fillColor = L.colorFill;
          d.visible = bar.ratio > 0;
          break;
        case "bar-text":
          if (!d.text) break;
          d.text.plainText = L.barText.text;
          d.text.style.fontSize = L.barText.font;
          d.text.width = L.barText.width;
          d.text.height = L.barText.height;
          d.position = { x: L.barText.x, y: L.barText.y };
          d.visible = L.textVisible;
          break;
        case "def": {
          var cd = findDef(L, tag.key);
          if (!cd) { d.visible = false; break; }
          d.points = circlePoints(cd.d, DEF_CIRCLE_SEGMENTS);
          d.position = { x: cd.x - cd.d / 2, y: cd.y - cd.d / 2 };
          d.visible = true;
          break;
        }
        case "def-text": {
          var cdt = findDef(L, tag.key);
          if (!cdt || !d.text) { d.visible = false; break; }
          d.text.plainText = cdt.text;
          d.text.style.fontSize = cdt.fontSize;
          d.text.width = cdt.d;
          d.text.height = cdt.d;
          d.position = { x: cdt.x - cdt.d / 2, y: cdt.y - cdt.d / 2 };
          d.visible = true;
          break;
        }
        case "ac-shield": {
          var sh = L.shield;
          if (!sh) { d.visible = false; break; }
          d.points = shieldPoints(sh.w, sh.h, 14);
          d.position = { x: sh.cx - sh.w / 2, y: sh.cy - sh.h / 2 };
          d.visible = true;
          break;
        }
        case "ac-text": {
          var sht = L.shield;
          if (!sht || !d.text) { d.visible = false; break; }
          d.text.plainText = sht.text;
          d.text.style.fontSize = sht.fontSize;
          d.text.width = sht.w;
          d.text.height = sht.h;
          d.position = { x: sht.cx - sht.w / 2, y: sht.cy - sht.h / 2 };
          d.visible = true;
          break;
        }
        default:
          break;
      }
    }
  });
}
async function removeBar(tokenId) {
  var entry = barEntries[tokenId];
  if (!entry) return;
  delete barEntries[tokenId];
  try {
    await OBR.scene.local.deleteItems(entry.ids);
  } catch (e) {  }
}

async function clearBars() {
  var ids = Object.keys(barEntries);
  for (var i = 0; i < ids.length; i++) await removeBar(ids[i]);
}

function scheduleBars() {
  if (barTimer) return;
  barTimer = setTimeout(function () {
    barTimer = null;
    void syncBars();
  }, 90);
}

async function sweepStaleBars() {
  if (barSwept) return;
  barSwept = true;
  try {
    if (!OBR.scene.local || typeof OBR.scene.local.getItems !== "function") return;
    var items = await OBR.scene.local.getItems();
    var stale = [];
    for (var i = 0; i < items.length; i++) {
      var tag = items[i].metadata ? items[i].metadata[BAR_TAG] : null;
      if (tag && !barEntries[items[i].id]) stale.push(items[i].id);
    }
    if (stale.length) {
      await OBR.scene.local.deleteItems(stale);
      pageLog("info", "清理了 " + stale.length + " 个上一次会话残留的血条 item");
    }
  } catch (e) {  }
}

async function syncBars() {
  if (barUnsupported) return;
  if (barBusy) { barAgain = true; return; }
  barBusy = true;
  try {
    if (!(await sceneReady())) { await clearBars(); return; }
    if (!barBuildersOk() || !OBR.scene.local || typeof OBR.scene.local.addItems !== "function") {
      barUnsupported = true;
      pageLog("err", "SDK 里没有 buildCurve / scene.local：token 血条不可用（其它功能不受影响）");
      return;
    }
    await sweepStaleBars();
    var viewer = await sceneViewer();
    var items = await OBR.scene.items.getItems();
    var dpi = await sceneDpi();
    var want = {};
    var order = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.type !== "IMAGE") continue;
      if (it.visible === false) continue; /* v2.5.1：隐藏 token 不画血条 */

      if (!hpBarEnabled(it)) continue;
      var hp = readHpMeta(it);
      if (!hp) continue;
      want[it.id] = { hp: hp, item: it };
      order.push(it.id);
    }
    var known = Object.keys(barEntries);
    for (var j = 0; j < known.length; j++) {
      if (!want[known[j]]) await removeBar(known[j]);
    }
    for (var k = 0; k < order.length; k++) {
      var id = order[k];
      var rec = want[id];
      var bounds = null;
      try {
        bounds = await OBR.scene.items.getItemBounds([id]);
      } catch (e) {
        continue;
      }
      if (!bounds || !bounds.center) continue;

      var isOwner = !!(viewer.id && rec.item.createdUserId === viewer.id);
      var hiddenForViewer = rec.hp.hide && viewer.role !== "GM";
      if (hiddenForViewer) { if (barEntries[id]) await removeBar(id); continue; }
      var exact = viewer.role === "GM" || isOwner || !rec.hp.locked;
      /* silhouette：非 GM / 非 owner 且 locked → 只画条，数字掩码，比例量化。 */
      var sil = !exact;
      var hpView = sil ? Object.assign({}, rec.hp, { cur: quantiseBarRatio(rec.hp.cur, rec.hp.max) * rec.hp.max }) : rec.hp;
      var L = barLayout(bounds, dpi, hpView, { exact: exact, threshold: viewer.threshold });
      if (sil && L.text) L.text = "?/??";
      var sig = barSig(rec.hp, L);
      var rolesKey = barRolesKey(L);
      var entry = barEntries[id];
      if (entry && entry.sig === sig && entry.rolesKey === rolesKey && !entry.force) continue;
      if (entry && entry.rolesKey === rolesKey && !entry.force) {
        try {
          await patchBar(entry, L);
          entry.sig = sig;
          continue;
        } catch (e2) {
          await removeBar(id);
        }
      } else if (entry) {

        await removeBar(id);
      }
      try {
        barEntries[id] = { ids: await addBar(id, L), sig: sig, rolesKey: rolesKey };
      } catch (e3) {
        pageLog("err", "画血条失败（" + id + "）：" + errText(e3));
      }
    }
  } catch (e) {
    pageLog("err", "同步 token 血条失败：" + errText(e));
  } finally {
    barBusy = false;
    if (barAgain) { barAgain = false; scheduleBars(); }
  }
}

async function watchLocalBars() {
  if (!OBR.scene.local || typeof OBR.scene.local.onChange !== "function") return;
  await attempt("订阅 scene.local.onChange（血条自愈）", function () {
    OBR.scene.local.onChange(function (items) {
      if (barBusy) return;
      var seen = {};
      for (var i = 0; i < items.length; i++) seen[items[i].id] = true;
      var ids = Object.keys(barEntries);
      for (var j = 0; j < ids.length; j++) {
        var own = barEntries[ids[j]].ids;
        for (var k = 0; k < own.length; k++) {
          if (!seen[own[k]]) {
            barEntries[ids[j]].force = true;
            scheduleBars();
            return;
          }
        }
      }
    });
  });
}

var INIT_MAX_ENTRIES = 40;
var INIT_LS_FALLBACK = "4enext/state/initiative";

function initInt(v, d) {
  return typeof v === "number" && isFinite(v) ? Math.round(v) : d;
}
function initNum(v, d) {
  return typeof v === "number" && isFinite(v) ? v : d;
}
function initClamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function initPhase(v) {
  var s = String(v == null ? "" : v);
  return s === "preparing" || s === "combat" ? s : "idle";
}
function initTbOf(e) {
  return e && typeof e.tb === "number" && isFinite(e.tb) ? e.tb : 0.5;
}
/* ---- 8. 先攻数据层：normalize / 上限 40 / 写失败降级本机 ---- */
function initNorm(raw) {
  var out = { v: 1, updatedAt: 0, phase: "idle", round: 1, surprise: false, activeId: "", entries: [] };
  if (!raw || typeof raw !== "object") return out;
  out.updatedAt = initInt(raw.updatedAt, 0);
  out.phase = initPhase(raw.phase);
  out.round = Math.max(1, initInt(raw.round, 1));
  out.surprise = out.phase === "combat" ? !!raw.surprise : false;
  var src = Array.isArray(raw.entries) ? raw.entries.slice(0, INIT_MAX_ENTRIES) : [];
  var seen = {};
  for (var i = 0; i < src.length; i++) {
    var e = src[i];
    if (!e || typeof e !== "object") continue;
    var tokenId = String(e.tokenId == null ? "" : e.tokenId).trim();
    if (!tokenId || seen[tokenId]) continue;
    seen[tokenId] = true;
    var name = String(e.name == null ? "" : e.name).trim().slice(0, 40) || "未命名";
    var d20raw = initNum(e.d20, null);
    var tbraw = initNum(e.tb, null);
    out.entries.push({
      tokenId: tokenId,
      name: name,

      init: initClamp(initNum(e.init, 0), -99, 999),
      bonus: initClamp(initInt(e.bonus, 0), -99, 999),
      /* v2.5：d20 手填范围与页面 normalizeInitiative 一致（0~99；正常投骰仍是 1~20），
       * 否则后台读到玩家手填的 0 / 99 会被夹回 1 / 20，名单数字对不上。 */
      d20: d20raw === null ? null : initClamp(Math.round(d20raw), 0, 99),
      tb: tbraw === null ? null : initClamp(tbraw, 0.001, 0.999),
      hidden: !!e.hidden,
      ownerId: String(e.ownerId == null ? "" : e.ownerId),
      updatedAt: initInt(e.updatedAt, 0)
    });
  }
  var wanted = String(raw.activeId == null ? "" : raw.activeId);
  var hit = null;
  for (var j = 0; j < out.entries.length; j++) if (out.entries[j].tokenId === wanted) hit = out.entries[j];
  out.activeId = hit ? hit.tokenId : (out.entries[0] ? out.entries[0].tokenId : "");
  if (!out.entries.length) out.round = 1;
  return out;
}

function initSortEntries(list) {
  return list.slice().sort(function (a, b) {
    var d = initNum(b.init, 0) - initNum(a.init, 0);
    if (d) return d;
    var t = initTbOf(a) - initTbOf(b);
    if (t) return t;
    return String(a.name).localeCompare(String(b.name), "zh-CN") || (initInt(a.updatedAt, 0) - initInt(b.updatedAt, 0));
  });
}

function initTiebreak(bonus) {
  var m = typeof bonus === "number" && isFinite(bonus) ? bonus : 0;
  var base = 0.5 - m * 0.01 + Math.random() * 0.008;
  return Math.round(Math.max(0.001, Math.min(0.999, base)) * 1e6) / 1e6;
}

function initLocalFallback() {
  try {
    var raw = localStorage.getItem(INIT_LS_FALLBACK);
    if (!raw) return null;
    var box = JSON.parse(raw);
    var st = box && box.state ? box.state : box;
    if (!st || typeof st !== "object") return null;
    var out = initNorm(st);
    out.entries = initSortEntries(out.entries);
    return out.entries.length ? out : null;
  } catch (e) {
    return null;
  }
}

/* ---- 8b. v2.5 存储层：每 token 一条 init 元数据 + 场景 combat（与 assets/initiative.js 同口径） ----
 * token.metadata[KEY_INIT] = { v:2, d20, bonus, init, tb, hidden, ownerId, updatedAt }
 *   （init = 合计；拖拽排序的中点是小数，必须原样落盘，否则一刷新顺序回退）
 * scene.metadata[KEY_COMBAT] = { v:1, phase, round, surprise, activeId, updatedAt, migratedAt? }
 * 旧整份名单 KEY_INITIATIVE 只读回退；GM 启动迁移后清空（本机备份 4enext/init-backup/<roomId>）。 */

function initCombatNorm(raw) {
  var phase = initPhase(raw && raw.phase);
  return {
    v: COMBAT_META_V,
    phase: phase,
    round: Math.max(1, initInt(raw && raw.round, 1)),
    surprise: phase === "combat" ? !!(raw && raw.surprise) : false,
    activeId: String(raw && raw.activeId ? raw.activeId : ""),
    updatedAt: initInt(raw && raw.updatedAt, 0),
    migratedAt: initInt(raw && raw.migratedAt, 0)
  };
}

async function initReadCombat() {
  try {
    var scene = {};
    try { scene = (await OBR.scene.getMetadata()) || {}; } catch (eS) { scene = {}; }
    return initCombatNorm(scene ? scene[KEY_COMBAT] : null);
  } catch (e) {
    return initCombatNorm(null);
  }
}

/** 内部 entry → token 元数据（v2）。 */
function initMetaFromEntry(entry, updatedAt) {
  return {
    v: INIT_META_V,
    d20: entry.d20 === null || entry.d20 === undefined ? null : initClamp(initInt(entry.d20, 0), 0, 99),
    bonus: initClamp(initInt(entry.bonus, 0), -99, 999),
    init: initClamp(initNum(entry.init, 0), -99, 999),
    tb: entry.tb === null || entry.tb === undefined ? null : initClamp(initNum(entry.tb, 0.5), 0.001, 0.999),
    hidden: !!entry.hidden,
    ownerId: String(entry.ownerId == null ? "" : entry.ownerId),
    updatedAt: initInt(updatedAt, Date.now())
  };
}

function initEntryFromMeta(item, meta) {
  var bonus = initClamp(initInt(meta.bonus, 0), -99, 999);
  var d20raw = initNum(meta.d20, null);
  var d20 = d20raw === null ? null : initClamp(Math.round(d20raw), 0, 99);
  var initRaw = initNum(meta.init, null);
  var init = initRaw === null ? initClamp((d20 === null ? 0 : d20) + bonus, -99, 999) : initClamp(initRaw, -99, 999);
  var tbraw = initNum(meta.tb, null);
  return {
    tokenId: String(item && item.id ? item.id : ""),
    name: String((item && item.name) || "未命名").trim().slice(0, 40) || "未命名",
    init: init,
    bonus: bonus,
    d20: d20,
    tb: tbraw === null ? null : initClamp(tbraw, 0.001, 0.999),
    hidden: !!meta.hidden,
    ownerId: String((item && item.createdUserId) || meta.ownerId || ""),
    updatedAt: initInt(meta.updatedAt, 0)
  };
}

/** 场景 items → 条目数组（只认 IMAGE + v2 元数据），按 initSortEntries 排序、上限 40。 */
function initEntriesFromItems(items) {
  var out = [];
  var seen = {};
  for (var i = 0; i < (items || []).length; i++) {
    var it = items[i];
    if (!it || it.type !== "IMAGE" || !it.id) continue;
    if (seen[String(it.id)]) continue;
    var m = it.metadata ? it.metadata[KEY_INIT] : null;
    if (!m || typeof m !== "object" || m.v !== INIT_META_V) continue;
    seen[String(it.id)] = true;
    out.push(initEntryFromMeta(it, m));
  }
  out = initSortEntries(out);
  return out.slice(0, INIT_MAX_ENTRIES);
}

/** 迁移前过渡：旧「房间/场景整份名单」按 updatedAt 取新（没有 entries 视为没有）。 */
async function initReadLegacy() {
  var room = {};
  var scene = {};
  try { room = (await OBR.room.getMetadata()) || {}; } catch (eR) { room = {}; }
  try { scene = (await OBR.scene.getMetadata()) || {}; } catch (eS) { scene = {}; }
  var rawRoom = room ? room[KEY_INITIATIVE] : null;
  var rawScene = scene ? scene[KEY_INITIATIVE] : null;
  var atRoom = rawRoom && typeof rawRoom.updatedAt === "number" ? rawRoom.updatedAt : -1;
  var atScene = rawScene && typeof rawScene.updatedAt === "number" ? rawScene.updatedAt : -1;
  var raw = atScene > atRoom ? rawScene : rawRoom;
  if (!raw || !Array.isArray(raw.entries) || !raw.entries.length) return null;
  return { raw: raw, room: rawRoom, scene: rawScene, store: atScene > atRoom ? "scene" : "room" };
}

function initCombatHasData(c) {
  return !!(c && (c.migratedAt > 0 || c.updatedAt > 0 || c.activeId || c.phase !== "idle" || c.round > 1 || c.surprise));
}

/** token 元数据 + 场景战斗态 → 内部 state（activeId 失效回退第一张）。 */
function initStateFromStorage(entries, combat) {
  var st = initNorm({
    v: 1,
    updatedAt: combat.updatedAt,
    phase: combat.phase,
    round: combat.round,
    surprise: combat.surprise,
    activeId: combat.activeId,
    entries: entries
  });
  st.entries = initSortEntries(st.entries);
  return st;
}

/** 迁移前过渡：旧整份名单 + 场景战斗态（若写过）。 */
function initStateFromLegacy(raw, combat) {
  var merged = {};
  for (var k in raw) if (Object.prototype.hasOwnProperty.call(raw, k)) merged[k] = raw[k];
  if (initCombatHasData(combat)) {
    merged.phase = combat.phase;
    merged.round = combat.round;
    merged.surprise = combat.surprise;
    if (combat.activeId) merged.activeId = combat.activeId;
    if (initInt(combat.updatedAt, 0) > initInt(raw.updatedAt, 0)) merged.updatedAt = combat.updatedAt;
  }
  var st = initNorm(merged);
  st.entries = initSortEntries(st.entries);
  st.legacy = true;
  return st;
}

async function initRead() {
  try {
    var items = [];
    try { items = await OBR.scene.items.getItems(); } catch (eItems) { items = []; }
    var entries = initEntriesFromItems(items);
    var combat = await initReadCombat();
    if (!entries.length) {
      var legacy = await initReadLegacy();
      if (legacy) return initStateFromLegacy(legacy.raw, combat);
      return initLocalFallback() || initStateFromStorage([], combat);
    }
    return initStateFromStorage(entries, combat);
  } catch (e) {
    pageLog("err", "读取先攻失败：" + errText(e));
    return initLocalFallback() || initStateFromStorage([], initCombatNorm(null));
  }
}

function initMetaEqual(cur, want) {
  if (!cur || typeof cur !== "object" || cur.v !== INIT_META_V) return false;
  var d20same = (cur.d20 === null || cur.d20 === undefined) ? (want.d20 === null || want.d20 === undefined) : cur.d20 === want.d20;
  var tbsame = (cur.tb === null || cur.tb === undefined) ? (want.tb === null || want.tb === undefined) : cur.tb === want.tb;
  return d20same && tbsame &&
    initInt(cur.bonus, 0) === initInt(want.bonus, 0) &&
    initNum(cur.init, 0) === initNum(want.init, 0) &&
    !!cur.hidden === !!want.hidden &&
    String(cur.ownerId || "") === String(want.ownerId || "");
}

function initCombatEqual(cur, want) {
  return cur.phase === want.phase && initInt(cur.round, 1) === initInt(want.round, 1) &&
    !!cur.surprise === !!want.surprise && String(cur.activeId || "") === String(want.activeId || "");
}

/**
 * 一次差异写：只 update 真正变了的 token、删掉已移出名单的 token 元数据、combat 变了才写 scene。
 * 两名客户端同时改不同 token 时各写各的；同一 token 并发仍是后写覆盖（风险见 docs/NOTES.md）。
 */
async function initPersistOnce(next, items) {
  var byId = {};
  for (var i = 0; i < (items || []).length; i++) {
    var it = items[i];
    if (it && it.id && it.type === "IMAGE") byId[String(it.id)] = it;
  }
  var want = {};
  for (var j = 0; j < next.entries.length; j++) {
    var e = next.entries[j];
    if (!e || !e.tokenId || !byId[e.tokenId]) continue; /* token 不在当前场景：没法写 */
    want[e.tokenId] = initMetaFromEntry(e, next.updatedAt);
  }
  var upserts = [];
  for (var id in want) {
    if (!Object.prototype.hasOwnProperty.call(want, id)) continue;
    var cur = byId[id].metadata ? byId[id].metadata[KEY_INIT] : null;
    if (!initMetaEqual(cur, want[id])) upserts.push(id);
  }
  var deletes = [];
  for (var did in byId) {
    if (!Object.prototype.hasOwnProperty.call(byId, did)) continue;
    var cur2 = byId[did].metadata ? byId[did].metadata[KEY_INIT] : null;
    if (cur2 && typeof cur2 === "object" && cur2.v === INIT_META_V && !want[did]) deletes.push(did);
  }
  var entriesOk = true;
  var tokenError = null;
  var changed = upserts.concat(deletes);
  if (changed.length) {
    try {
      await OBR.scene.items.updateItems(changed, function (drafts) {
        for (var d = 0; d < drafts.length; d++) {
          var itd = drafts[d];
          if (!itd || !itd.id) continue;
          if (!itd.metadata || typeof itd.metadata !== "object") itd.metadata = {};
          if (want[itd.id]) itd.metadata[KEY_INIT] = want[itd.id];
          else delete itd.metadata[KEY_INIT];
        }
      });
    } catch (eTok) {
      entriesOk = false;
      tokenError = eTok;
    }
  }
  var curCombat = await initReadCombat();
  var nextCombat = {
    v: COMBAT_META_V,
    phase: next.phase,
    round: next.round,
    surprise: next.surprise,
    activeId: next.activeId,
    updatedAt: next.updatedAt,
    migratedAt: curCombat.migratedAt
  };
  var combatOk = true;
  var combatError = null;
  if (!initCombatEqual(curCombat, nextCombat)) {
    try {
      await OBR.scene.setMetadata({ [KEY_COMBAT]: nextCombat });
    } catch (eCombat) {
      combatOk = false;
      combatError = eCombat;
    }
  }
  return {
    entriesOk: entriesOk, combatOk: combatOk, tokenError: tokenError, combatError: combatError,
    wrote: changed.length, skipped: next.entries.length - Object.keys(want).length
  };
}

/**
 * 写先攻（v2.5：差异写 token metadata + 场景 combat）。
 * 成功 → 清本机降级副本；一条 token 元数据都写不进 → 暂存本机 + **ERROR**（不静默），返回状态带 .local = true。
 * 场景 combat 写不进但 token 写成功 → GM 弹 WARNING（名单已共享，回合指针读取端会回退第一张）。
 */
async function initWrite(state) {
  var next = initNorm(state);
  next.entries = initSortEntries(next.entries);
  next.updatedAt = Date.now();
  var role = "";
  try { role = await OBR.player.getRole(); } catch (eRole) { role = ""; }
  var items = null;
  try { items = await OBR.scene.items.getItems(); } catch (eItems) { items = null; }
  var res = items ? await initPersistOnce(next, items) : null;
  if (res && !res.entriesOk) {
    try { items = await OBR.scene.items.getItems(); } catch (eItems2) { items = null; }
    if (items) res = await initPersistOnce(next, items);
  }
  pageLog("info", "init write entries=" + next.entries.length + " changed=" + (res ? res.wrote : 0) +
    " skipped=" + (res ? res.skipped : 0) + " combatOk=" + (res ? res.combatOk : false));
  if (res && res.entriesOk) {
    next.store = "token";
    void syncInitFlagMirror(next);
    try { localStorage.removeItem(INIT_LS_FALLBACK); } catch (eClr) { /* 忽略 */ }
    if (!res.combatOk && role === "GM") {
      notify("先攻条目已保存，但战斗状态（场景数据）没写进去：" + errText(res.combatError) +
        "。回合指针可能不同步", "WARNING");
    }
    if (res.skipped > 0) {
      pageLog("warn", "先攻写入：有 " + res.skipped + " 条旧名单条目的 token 不在当前场景，没有落盘（迁移前过渡）");
    }
    return next;
  }
  var msg = res && res.tokenError ? errText(res.tokenError) : "场景 items 读不到";
  try {
    safeLocalSet(INIT_LS_FALLBACK, JSON.stringify({ v: 1, updatedAt: Date.now(), state: next }));
  } catch (e3) { /* 忽略 */ }
  notify("先攻没能写进 token / 场景数据（" + msg + "）：已暂存在本机。", "ERROR");
  pageLog("err", "先攻写入失败（" + msg + "）：已暂存到本机");
  next.local = true;
  return next;
}

/* v2.5.1：把「是否已在先攻」布尔镜像写回 token metadata（右键菜单互斥用，2 段 key 稳定）。
 * GM 可写全桌；玩家只写自己创建的 token（场景 item 权限所致）。 */
async function syncInitFlagMirror(state) {
  try {
    var role = "";
    try { role = await OBR.player.getRole(); } catch (eR) { role = ""; }
    var myId = "";
    if (role !== "GM") { try { myId = await OBR.player.getId(); } catch (eI) { myId = ""; } }
    var items = await OBR.scene.items.getItems();
    var want = {};
    for (var i = 0; i < state.entries.length; i++) want[String(state.entries[i].tokenId)] = true;
    var fix = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      if (!it || it.type !== "IMAGE" || !it.id) continue;
      if (role !== "GM" && (!myId || it.createdUserId !== myId)) continue;
      var has = !!(it.metadata && it.metadata[KEY_IN_INIT] === true);
      var should = !!want[String(it.id)];
      if (has !== should) fix.push(String(it.id));
    }
    if (!fix.length) return;
    await OBR.scene.items.updateItems(fix, function (drafts) {
      for (var d = 0; d < drafts.length; d++) {
        var itd = drafts[d];
        if (!itd || !itd.id) continue;
        if (!itd.metadata || typeof itd.metadata !== "object") itd.metadata = {};
        if (want[String(itd.id)]) itd.metadata[KEY_IN_INIT] = true;
        else delete itd.metadata[KEY_IN_INIT];
      }
    });
  } catch (eFlag) {
    pageLog("warn", "in-init 镜像同步失败（菜单互斥可能暂时不准）：" + errText(eFlag));
  }
}

/* ---- 8c. v2.5 迁移：旧整份名单 → token metadata + 场景 combat（GM 启动时做一次） ---- */
var initMigrateBusy = false;

function initRoomId() {
  try { if (OBR.room && typeof OBR.room.id === "string" && OBR.room.id) return OBR.room.id; } catch (e) { /* 忽略 */ }
  return "default";
}
function initBackupKey() { return LS_INIT_BACKUP_PREFIX + initRoomId(); }

function initBackupLegacyOnce(roomRaw, sceneRaw) {
  try {
    var key = initBackupKey();
    if (localStorage.getItem(key)) return true; /* 第一份最完整，别覆盖 */
    safeLocalSet(key, JSON.stringify({ v: 1, at: Date.now(), room: roomRaw || null, scene: sceneRaw || null }));
    return true;
  } catch (e) {
    pageLog("err", "备份旧先攻名单失败（不影响迁移）：" + errText(e));
    return false;
  }
}

function initEmptyLegacy() {
  return { v: 1, updatedAt: Date.now(), phase: "idle", round: 1, surprise: false, activeId: "", entries: [] };
}

/**
 * 迁移（只做一次）：旧 entries 逐条写进对应 token metadata + 写 combat scene metadata +
 * localStorage 备份旧数据（4enext/init-backup/<roomId>）后清空旧房间 / 场景键。
 * 失败保留旧数据并 NOTIFY WARNING（token 已写但 combat 没写成也不清旧键，下次启动重试）。
 */
async function migrateInitiativeFromLegacy() {
  if (initMigrateBusy) return { ok: false, skipped: true, reason: "busy" };
  initMigrateBusy = true;
  try {
    var role = "";
    try { role = await OBR.player.getRole(); } catch (eRole) { role = ""; }
    if (role !== "GM") return { ok: false, skipped: true, reason: "role" };
    /* 场景没就绪时 items 读不到 → 「token 都不在当前场景」的误报，等 scene.onReadyChange 再来。 */
    if (!(await sceneReady())) return { ok: false, skipped: true, reason: "scene" };
    var legacy = await initReadLegacy();
    if (!legacy) return { ok: false, skipped: true, reason: "empty" };
    var combat = await initReadCombat();
    if (combat.migratedAt) return { ok: false, skipped: true, reason: "migrated" };
    var state = initNorm(legacy.raw);
    if (!state.entries.length) return { ok: false, skipped: true, reason: "empty" };
    var items = [];
    try { items = await OBR.scene.items.getItems(); } catch (eItems) { items = []; }
    var byId = {};
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].type === "IMAGE" && items[i].id) byId[String(items[i].id)] = items[i];
    }
    initBackupLegacyOnce(legacy.room, legacy.scene);
    var want = {};
    var skipped = 0;
    var stamp = state.updatedAt > 0 ? state.updatedAt : Date.now();
    for (var j = 0; j < state.entries.length; j++) {
      var e = state.entries[j];
      if (!byId[e.tokenId]) { skipped++; continue; } /* 不在当前场景：留在本机备份里 */
      want[e.tokenId] = initMetaFromEntry(e, stamp);
    }
    var ids = Object.keys(want);
    if (!ids.length) {
      notify("先攻数据迁移：旧名单里的 token 都不在当前场景，已备份到本机（" + initBackupKey() + "），旧名单保留", "WARNING");
      return { ok: false, migrated: 0, skipped: skipped, reason: "no-token" };
    }
    try {
      await OBR.scene.items.updateItems(ids, function (drafts) {
        for (var d = 0; d < drafts.length; d++) {
          var itd = drafts[d];
          if (!itd || !itd.id) continue;
          var meta = want[itd.id];
          if (!meta) continue;
          if (!itd.metadata || typeof itd.metadata !== "object") itd.metadata = {};
          itd.metadata[KEY_INIT] = meta;
        }
      });
    } catch (eTok) {
      notify("先攻数据迁移失败（token 元数据写不进去，旧名单保留未动）：" + errText(eTok), "WARNING");
      pageLog("err", "先攻迁移：写 token 元数据失败 " + errText(eTok));
      return { ok: false, migrated: 0, skipped: skipped, reason: "token-write", error: eTok };
    }
    var migratedAt = Date.now();
    try {
      await OBR.scene.setMetadata({
        [KEY_COMBAT]: {
          v: COMBAT_META_V, phase: state.phase, round: state.round, surprise: state.surprise,
          activeId: state.activeId, updatedAt: migratedAt, migratedAt: migratedAt
        }
      });
    } catch (eCombat) {
      notify("先攻数据迁移失败（场景战斗状态写不进去，旧名单保留未动）：" + errText(eCombat), "WARNING");
      pageLog("err", "先攻迁移：写场景 combat 失败 " + errText(eCombat));
      return { ok: false, migrated: ids.length, skipped: skipped, reason: "combat-write", error: eCombat };
    }
    var cleared = true;
    try {
      await OBR.room.setMetadata({ [KEY_INITIATIVE]: initEmptyLegacy() });
    } catch (eClear) {
      cleared = false;
      pageLog("err", "清理旧房间先攻名单失败：" + errText(eClear));
    }
    if (legacy.scene) {
      try { await OBR.scene.setMetadata({ [KEY_INITIATIVE]: initEmptyLegacy() }); }
      catch (eClear2) { /* 场景里那份只是兜底副本，token 已是真源 */ }
    }
    if (!cleared) notify("先攻已迁移到 token metadata，但旧房间名单没清掉（下次启动会再试）", "WARNING");
    pageLog("info", "先攻迁移完成：token " + ids.length + " 条" +
      (skipped ? "，跳过 " + skipped + " 条（不在当前场景）" : "") +
      "；旧数据备份 localStorage[" + initBackupKey() + "]");
    return { ok: true, migrated: ids.length, skipped: skipped };
  } catch (eAll) {
    notify("先攻数据迁移失败：" + errText(eAll), "WARNING");
    pageLog("err", "先攻迁移异常：" + errText(eAll));
    return { ok: false, reason: "error", error: eAll };
  } finally {
    initMigrateBusy = false;
  }
}

function initRollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function initBonusOf(item) {
  var m = item && item.metadata ? item.metadata[KEY_INIT] : null;
  /* v2.5 兼容：v1.2 时代 token 上是**一个数字**（先攻加值），按加值读。 */
  if (typeof m === "number" && isFinite(m)) return initClamp(Math.round(m), -99, 999);
  if (m && typeof m === "object" && typeof m.bonus === "number" && isFinite(m.bonus)) {
    return initClamp(Math.round(m.bonus), -99, 999);
  }
  return 0;
}

/* v2.5.1：token 上「备团先攻预设」（血条编辑窗填写，合计值）；没有则 null。 */
var KEY_INIT_PRESET = NS + "/init-preset";
function initPresetOf(item) {
  try {
    var raw = item && item.metadata ? item.metadata[KEY_INIT_PRESET] : null;
    var n = Math.round(Number(raw && raw.v != null ? raw.v : raw));
    if (!isFinite(n) || n < 1 || n > 99) return null;
    return n;
  } catch (e) { return null; }
}

async function initAdd(item, hidden) {
  if (!item || !item.id) return null;
  var state = await initRead();
  var cards = await getCards();
  var cardId = item.metadata ? item.metadata[KEY_BIND] : null;
  var card = typeof cardId === "string" ? findCard(cards, cardId) : null;
  var name = String(item.name || (card && card.name) || "未命名").trim().slice(0, 40) || "未命名";
  var bonus = initBonusOf(item);
  var preset = initPresetOf(item); /* v2.5.1：血条窗里存的备团**先攻加值** */
  if (preset != null) bonus = preset;
  var ownerId = String(item.createdUserId || "");
  var idx = -1;
  for (var i = 0; i < state.entries.length; i++) {
    if (state.entries[i].tokenId === item.id) { idx = i; break; }
  }
  var entry = null;
  if (idx >= 0) {
    var old = state.entries[idx];
    entry = {
      tokenId: old.tokenId,
      name: name || old.name,
      init: old.d20 == null ? old.init : Math.round(Number(old.d20)) + bonus,
      bonus: bonus,
      d20: old.d20,
      tb: old.tb,
      hidden: !!(old.hidden || hidden),
      ownerId: ownerId || old.ownerId,
      updatedAt: Date.now()
    };
    state.entries[idx] = entry;
  } else {
    if (state.entries.length >= INIT_MAX_ENTRIES) {
      notify("先攻已经有 " + INIT_MAX_ENTRIES + " 条了（房间数据上限）：先清掉几个再加", "WARNING");
      return null;
    }

    var d20 = initRollD20();
    entry = {
      tokenId: item.id,
      name: name,
      init: d20 + bonus,
      bonus: bonus,
      d20: d20,
      tb: initTiebreak(bonus),
      hidden: !!hidden,
      ownerId: ownerId,
      updatedAt: Date.now()
    };
    state.entries.push(entry);
    state.entries = initSortEntries(state.entries);
  }
  if (!state.activeId && state.entries.length) state.activeId = state.entries[0].tokenId;
  var next = await initWrite(state);
  return { state: next, entry: entry, persisted: !next.local };
}

function initRemove(state, tokenId) {
  var out = initNorm(JSON.parse(JSON.stringify(state || {})));
  var id = String(tokenId == null ? "" : tokenId);
  var idx = -1;
  for (var i = 0; i < out.entries.length; i++) {
    if (out.entries[i].tokenId === id) { idx = i; break; }
  }
  if (idx < 0) return out;
  var wasActive = out.entries[idx].tokenId === out.activeId;
  out.entries.splice(idx, 1);
  if (!out.entries.length) {
    out.activeId = "";
    out.round = 1;
  } else if (wasActive) {
    out.activeId = out.entries[Math.min(idx, out.entries.length - 1)].tokenId;
  }
  out.updatedAt = Date.now();
  return out;
}

function initMissingIds(state, alive) {
  var has = {};
  if (Array.isArray(alive)) {
    for (var i = 0; i < alive.length; i++) has[String(alive[i])] = true;
  } else if (alive && typeof alive === "object") {
    for (var k in alive) if (Object.prototype.hasOwnProperty.call(alive, k) && alive[k]) has[String(k)] = true;
  }
  var out = [];
  var list = state && Array.isArray(state.entries) ? state.entries : [];
  for (var j = 0; j < list.length; j++) {
    if (list[j] && list[j].tokenId && !has[String(list[j].tokenId)]) out.push(String(list[j].tokenId));
  }
  return out;
}

function initPrune(state, alive) {
  var out = initNorm(JSON.parse(JSON.stringify(state || {})));
  var missing = initMissingIds(out, alive);
  for (var i = 0; i < missing.length; i++) out = initRemove(out, missing[i]);
  if (missing.length) out.updatedAt = Date.now();
  return out;
}

var initKnownTokens = {};
var initPruneBusy = false;
var initPruneTimer = null;
var initPruneMuteUntil = 0;

function initRememberItems(items) {
  var next = {};
  for (var i = 0; i < items.length; i++) {
    if (items[i] && items[i].id) next[String(items[i].id)] = true;
  }
  initKnownTokens = next;
  return next;
}

async function refreshInitKnownTokens() {
  initPruneMuteUntil = Date.now() + 1200;
  try {
    var items = await OBR.scene.items.getItems();
    initRememberItems(items || []);
  } catch (e) {  }
}

function scheduleInitPrune() {
  if (initPruneTimer) return;
  initPruneTimer = setTimeout(function () {
    initPruneTimer = null;
    void pruneMissingInitEntries();
  }, 400);
}

async function pruneMissingInitEntries() {
  if (initPruneBusy) return 0;
  if (Date.now() < initPruneMuteUntil) return 0;

  if (initBusy) return 0;
  initPruneBusy = true;
  try {
    var role = "";
    try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
    if (role !== "GM") return 0;
    /* v2.5：条目就存在 token 元数据上 —— token 被删 = 条目自然消失，不需要再清整份名单。
     * 这里只保留一件事：战斗态当前回合指针指向的 token 已失效时，写回第一张（游标顺移）。 */
    var state = await initRead();
    if (!state.entries.length) return 0;
    var items = [];
    try { items = await OBR.scene.items.getItems(); } catch (e2) { return 0; }
    var alive = {};
    for (var i = 0; i < items.length; i++) if (items[i] && items[i].id) alive[String(items[i].id)] = true;
    initKnownTokens = alive;
    if (state.phase !== "combat") return 0;
    var combat = await initReadCombat();
    var active = String(combat.activeId || "");
    if (active && alive[active]) return 0;
    var next = state;
    next.activeId = state.entries[0].tokenId;
    next.updatedAt = Date.now();
    await initWrite(next);
    stepOk("先攻当前回合清理：原 activeId 已失效 → 指向第一张");
    return 1;
  } finally {
    initPruneBusy = false;
  }
}

/* v2.5.1：GM 收到玩家的「加入先攻」请求 —— 校验 token 归属后代写。 */
async function onInitJoinRequest(ev) {
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") return;
    var d = ev && ev.data !== undefined ? ev.data : ev;
    var itemId = d && typeof d.itemId === "string" ? d.itemId : "";
    if (!itemId) return;
    var sender = ev && ev.playerId ? String(ev.playerId) : "";
    var item = null;
    try { item = (await OBR.scene.items.getItems([itemId]))[0] || null; } catch (eGet) { item = null; }
    if (!item) {
      sendInitJoinAck(sender, false, "这枚 token 已经不在了");
      return;
    }
    if (!sender || item.createdUserId !== sender) {
      sendInitJoinAck(sender, false, "只能加入自己创建的 token");
      return;
    }
    var state = await initRead();
    var exists = false;
    for (var i = 0; i < state.entries.length; i++) if (state.entries[i].tokenId === itemId) { exists = true; break; }
    if (exists) {
      sendInitJoinAck(sender, true, "已经在先攻里了");
      return;
    }
    var res = await initAdd(item, false);
    if (!res) {
      sendInitJoinAck(sender, false, "先攻已满或写入失败");
      return;
    }
    initKnownTokens[String(itemId)] = true;
    sendInitJoinAck(sender, true, "已加入先攻：" + res.entry.name);
  } catch (e) {
    pageLog("err", "玩家请求加入先攻失败：" + errText(e));
  }
}

function sendInitJoinAck(toPlayerId, ok, message) {
  try {
    OBR.broadcast.sendMessage(CH_INIT_JOIN_ACK, { to: toPlayerId, ok: !!ok, message: message || "", at: Date.now() }, { destination: "ALL" });
  } catch (e) { /* 忽略 */ }
}

async function onInitJoinAck(ev) {
  try {
    var d = ev && ev.data !== undefined ? ev.data : ev;
    if (!d || typeof d !== "object" || !d.to) return;
    var myId = "";
    try { myId = await OBR.player.getId(); } catch (e) { myId = ""; }
    if (!myId || String(d.to) !== myId) return;
    if (initJoinTimer) { clearTimeout(initJoinTimer); initJoinTimer = null; }
    if (d.ok) pageLog("info", String(d.message || "已加入先攻"));
    else notify(String(d.message || "加入先攻失败"), "WARNING");
  } catch (e2) { /* 忽略 */ }
}

async function onInitRemoveClick(context) {
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") {
      notify("移出先攻需要城主权限（先攻条目存在 token 元数据上，只有城主能改别人的 token）", "WARNING");
      return;
    }
    var picked = context && context.items && context.items[0] ? context.items[0] : null;
    if (!picked || !picked.id) {
      notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
      return;
    }
    var state = await initRead();
    var entry = null;
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].tokenId === picked.id) { entry = state.entries[i]; break; }
    }
    if (!entry) {

      notify("「" + (picked.name || picked.id) + "」已经不在先攻里了", "WARNING");
      return;
    }
    var next = initRemove(state, picked.id);
    await initWrite(next);
    stepOk("移出先攻：" + entry.name);
  } catch (e) {
    stepFail("移出先攻", e);
  }
}

async function onInitMenuClick(context, hidden) {
  try {
    var role = await OBR.player.getRole();
    var picked = context && context.items && context.items[0] ? context.items[0] : null;
    if (!picked) {
      notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
      return;
    }
    /* v2.5.1（照 Full Suite）：玩家也能右键「加入先攻」→ 广播给 GM 代写；
     * 只允许自己的 token（GM 端会按 createdUserId 再校验一次）。隐形加入仍 GM 专属。 */
    if (role !== "GM") {
      if (hidden) {
        notify("「隐形加入先攻」只有城主能操作", "WARNING");
        return;
      }
      var fresh0 = null;
      try { fresh0 = (await OBR.scene.items.getItems([picked.id]))[0] || null; } catch (e0) { fresh0 = null; }
      var myId0 = "";
      try { myId0 = await OBR.player.getId(); } catch (eId) { myId0 = ""; }
      if (!myId0 || !fresh0 || fresh0.createdUserId !== myId0) {
        notify("只能把自己创建的 token 加入先攻；别人的 token 请让城主加", "WARNING");
        return;
      }
      var nowJoin = Date.now();
      if (initJoinLastAt && nowJoin - initJoinLastAt < 3000) {
        pageLog("info", "玩家加入先攻请求节流（3s 内重复点击）");
        return;
      }
      initJoinLastAt = nowJoin;
      /* v2.5.1（对齐 Full Suite）：先**尝试玩家直接写**。v2.5 起先攻就存在 token 元数据里
       * （Full Suite 同款），OBR 允许玩家写自己的 token 就直接成功；不允许（权限）再退回「请求城主代写」。 */
      try {
        var freshP = null;
        try { freshP = (await OBR.scene.items.getItems([picked.id]))[0] || null; } catch (eFP) { freshP = null; }
        var resP = await initAdd(freshP || picked, false);
        if (resP && resP.persisted) {
          initKnownTokens[String(picked.id)] = true;
          pageLog("info", "玩家直接加入先攻成功 item=" + picked.id);
          return;
        }
      } catch (eDirect) {
        pageLog("err", "玩家直接加入先攻失败，回退请求城主：" + errText(eDirect));
      }
      try {
        OBR.broadcast.sendMessage(CH_INIT_JOIN, { itemId: picked.id, at: nowJoin }, { destination: "ALL" });
        pageLog("info", "已向城主请求加入先攻 item=" + picked.id);
      } catch (eJoin) {
        notify("加入先攻的请求发送失败：" + errText(eJoin), "ERROR");
        return;
      }
      /* v2.5.1：6 秒没收到 GM 回执 → 明确提示（GM 未更新插件 / 不在线 / 写入失败）。 */
      if (initJoinTimer) clearTimeout(initJoinTimer);
      initJoinTimer = setTimeout(function () {
        initJoinTimer = null;
        notify("加入先攻：城主没有响应（GM 可能不在线或插件未更新到 2.5.1）", "WARNING");
      }, 6000);
      return;
    }

    /* v2.5.1：GM 点「加入先攻」时，token 已经在先攻里就明确提示 ——
     * 旧代码会静默更新同一条（条上没变化），看起来就是「点了没反应」。 */
    try {
      var st0 = await initRead();
      for (var ei = 0; ei < st0.entries.length; ei++) {
        if (st0.entries[ei].tokenId === picked.id) {
          notify("「" + (st0.entries[ei].name || picked.name || "这枚 token") + "」已经在先攻里了", "WARNING");
          return;
        }
      }
    } catch (eCheck) { /* 检查失败则继续走添加 */ }

    var fresh = null;
    try { fresh = (await OBR.scene.items.getItems([picked.id]))[0] || null; } catch (e) { fresh = null; }
    var res = await initAdd(fresh || picked, hidden);
    if (!res) {
      /* initAdd 内部已弹过具体原因（格式 / 上限）；这里再兜底一次，避免「点了没反应」。 */
      notify("加入先攻失败：没有写入（详情看控制台 [4enext] 日志）", "WARNING");
      return;
    }
    stepOk("加入先攻：" + res.entry.name + (hidden ? "（隐形）" : "") +
      "（先攻 " + Math.round(res.entry.init) + "）");

    if (!res.persisted) {
      /* token 元数据没写成功：先攻只落本机，别人看不到 —— 必须明确告诉用户。 */
      notify("先攻只写到了本机（token 元数据写不进去，可能没有权限）：其他人看不到这次加入", "WARNING");
      return;
    }
    /* v2.5.1：写回后再核对一次，防止「函数返回成功但实际没进列表」的静默失败。 */
    try {
      var verify = await initRead();
      var inList = false;
      for (var vi = 0; vi < verify.entries.length; vi++) if (verify.entries[vi].tokenId === picked.id) { inList = true; break; }
      if (!inList) notify("加入先攻没有生效：请再点一次，仍不行把控制台 [4enext] 日志发给作者", "WARNING");
    } catch (eVerify) { /* 忽略 */ }
    initKnownTokens[String(picked.id)] = true;

    if (!stripOpen) void openStripOrNotify("右键加入先攻");
  } catch (e) {
    stepFail("加入先攻", e);
  }
}

function initAdvance(state, dir) {
  var out = initNorm(JSON.parse(JSON.stringify(state || {})));
  if (!out.entries.length) {
    out.activeId = "";
    out.round = 1;
    return out;
  }
  var step = dir < 0 ? -1 : 1;
  var idx = -1;
  for (var i = 0; i < out.entries.length; i++) {
    if (out.entries[i].tokenId === out.activeId) { idx = i; break; }
  }
  if (idx < 0) idx = 0;
  var next = idx + step;
  if (next >= out.entries.length) {
    next = 0;
    if (out.surprise) out.surprise = false;
    else out.round = Math.max(1, out.round + 1);
  } else if (next < 0) {
    next = out.entries.length - 1;
    if (out.round > 1) out.round -= 1;
  }
  out.activeId = out.entries[next].tokenId;
  out.updatedAt = Date.now();
  return out;
}

var initBusy = false;

async function onInitRequest(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || data.op !== "end-turn") return;
  if (initBusy) {
    pageLog("info", "正在推进回合，忽略重复的结束回合请求");
    return;
  }
  initBusy = true;
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") return;
    var state = await initRead();
    if (state.phase !== "combat") {
      notify("现在不在战斗回合里，结束回合请求已忽略", "WARNING");
      return;
    }
    var active = null;
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].tokenId === state.activeId) { active = state.entries[i]; break; }
    }
    if (!active) return;

    if (!data.activeId || data.activeId !== state.activeId) {
      notify("回合已经变了，结束回合请求已忽略", "WARNING");
      return;
    }

    var owner = active.ownerId;
    try {
      var items = await OBR.scene.items.getItems([active.tokenId]);
      var live = items && items[0] ? String(items[0].createdUserId || "") : "";
      if (live) owner = live;
    } catch (e2) {  }
    if (!data.playerId || owner !== data.playerId) {
      notify("只能结束自己的回合", "WARNING");
      return;
    }
    var next = initAdvance(state, 1);
    await initWrite(next);

  } catch (e) {
    pageLog("err", "处理结束回合请求失败：" + errText(e));
  } finally {

    initBusy = false;
  }
}

/* ---- 9. 骰子落库：归一化 / 幂等合并 / 上限 20 条 / 落到本机 ---- */
function rollSides(type) {
  var m = /^d(\d+)$/i.exec(String(type == null ? "" : type).trim());
  if (!m) return 0;
  var n = parseInt(m[1], 10);
  return n > 0 ? n : 0;
}
function rollInt(v, lo, hi, d) {
  var n = typeof v === "number" && isFinite(v) ? Math.round(v) : d;
  return Math.max(lo, Math.min(hi, n));
}
function rollColor(v) {
  var s = String(v == null ? "" : v).trim();
  return /^#[0-9a-f]{3,8}$/i.test(s) ? s : ROLL_COLOR_DEFAULT;
}
function rollText(v, n) {
  var s = v == null ? "" : String(v);
  return s.length > n ? s.slice(0, n) : s;
}
function rollTs(v) {
  var n = typeof v === "number" && isFinite(v) ? Math.round(v) : Date.now();
  return n > 0 ? n : Date.now();
}
function rollDieNorm(raw) {
  if (!raw || typeof raw !== "object") return null;
  var sides = rollSides(String(raw.type || "d20").toLowerCase());
  if (!sides) return null;
  var out = { type: "d" + sides, value: rollInt(raw.value, 1, sides, 1) };
  if (raw.loser) out.loser = true;
  if (raw.subtract) out.subtract = true;
  if (typeof raw.originalValue === "number" && isFinite(raw.originalValue)) out.originalValue = Math.round(raw.originalValue);
  if (typeof raw.burstParent === "number" && isFinite(raw.burstParent)) out.burstParent = Math.max(0, Math.round(raw.burstParent));
  return out;
}

function rollNorm(raw) {
  if (!raw || typeof raw !== "object") return null;
  var rollId = rollText(raw.rollId == null ? "" : String(raw.rollId).trim(), 80);
  if (!rollId) return null;
  var dice = [];
  if (Array.isArray(raw.dice) && raw.dice.length) {
    for (var i = 0; i < raw.dice.length; i++) {
      var d = rollDieNorm(raw.dice[i]);
      if (d) dice.push(d);
    }
  } else if (Array.isArray(raw.rolls)) {
    for (var j = 0; j < raw.rolls.length; j++) {
      var one = rollDieNorm({ type: "d20", value: raw.rolls[j] });
      if (one) dice.push(one);
    }
  } else if (typeof raw.value === "number") {
    var solo = rollDieNorm({ type: "d20", value: raw.value });
    if (solo) dice.push(solo);
  }
  var truncated = false;
  if (dice.length > ROLL_MAX_DICE) {
    dice = dice.slice(0, ROLL_MAX_DICE);
    truncated = true;
  }
  var rowStarts = [];
  if (Array.isArray(raw.rowStarts)) {
    for (var k = 0; k < raw.rowStarts.length && rowStarts.length < 20; k++) {
      var n = raw.rowStarts[k];
      if (typeof n === "number" && isFinite(n) && n >= 0) rowStarts.push(Math.round(n));
    }
  }

  var modifier = typeof raw.modifier === "number" && isFinite(raw.modifier) ? Math.round(raw.modifier) : 0;
  var base = 0;
  for (var q = 0; q < dice.length; q++) {
    if (dice[q].loser) continue;
    base += dice[q].subtract ? -Math.abs(dice[q].value) : dice[q].value;
  }

  var rows = rowStarts.length > 1 ? rowStarts.length : 1;
  var out = {
    v: 1,
    rollId: rollId,
    ts: rollTs(raw.ts),
    rollerId: rollText(raw.rollerId, 80),
    rollerName: rollText(raw.rollerName, 40) || "某人",
    rollerColor: rollColor(raw.rollerColor),
    label: rollText(raw.label, ROLL_LABEL_MAX),
    expression: rollText(raw.expression, ROLL_EXPR_MAX),
    mode: rollText(raw.mode || "free", 16),
    dice: dice,
    modifier: modifier,
    total: base + modifier * rows,
    crit: !!raw.crit
  };
  if (rowStarts.length > 1) out.rowStarts = rowStarts;
  if (truncated) out.truncated = true;
  if (raw.critDegraded) out.critDegraded = true;
  if (raw.itemId) out.itemId = rollText(raw.itemId, 80);
  return out;
}

function rollMerge(rows, incoming) {
  var list = Array.isArray(rows) ? rows.slice() : [];
  var row = rollNorm(incoming);
  if (!row) return list.slice(0, ROLL_MAX_ROWS);
  for (var i = 0; i < list.length; i++) {
    if (list[i] && list[i].rollId === row.rollId) return list.slice(0, ROLL_MAX_ROWS);
  }
  list.push(row);
  list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  return list.slice(0, ROLL_MAX_ROWS);
}
async function rollReadBox() {
  try {
    var meta = await OBR.room.getMetadata();
    return meta ? meta[KEY_ROLLS] || null : null;
  } catch (e) {
    return null;
  }
}
function rollRowsOf(box) {
  var src = Array.isArray(box) ? box : box && Array.isArray(box.rows) ? box.rows : [];
  var out = [];
  var seen = {};
  for (var i = 0; i < src.length && out.length < ROLL_MAX_ROWS; i++) {
    var row = rollNorm(src[i]);
    if (!row || seen[row.rollId]) continue;
    seen[row.rollId] = true;
    out.push(row);
  }
  out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
  return out.slice(0, ROLL_MAX_ROWS);
}

/* v1.9.2：骰子历史改**本机 + 广播**，不再写房间数据。后台只保留两件收尾：
 *   ① GM 首次启动把房间残留 KEY_ROLLS 迁进本机并清空房间键（只减不增，不需预算检查）；
 *   ② 清空请求时 GM 顺带清房间残留（本机记录由各端页面自己清）。
 * 本机键 = 4enext/dice-history/<roomId>，结构 { v:1, rows:[...] }，与 dice-history 页面共用。 */
var LS_DICE_HISTORY_PREFIX = "4enext/dice-history/";

function diceHistRoomId() {
  try {
    if (OBR.room && typeof OBR.room.id === "string" && OBR.room.id) return OBR.room.id;
  } catch (e) {  }
  return "default";
}
function diceHistKey() { return LS_DICE_HISTORY_PREFIX + diceHistRoomId(); }
function diceHistRead() {
  try {
    var raw = localStorage.getItem(diceHistKey());
    if (!raw) return [];
    var box = JSON.parse(raw);
    var src = Array.isArray(box) ? box : box && Array.isArray(box.rows) ? box.rows : [];
    var out = [];
    var seen = {};
    for (var i = 0; i < src.length; i++) {
      var row = rollNorm(src[i]);
      if (!row || seen[row.rollId]) continue;
      seen[row.rollId] = true;
      out.push(row);
    }
    out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return out.slice(0, ROLL_MAX_ROWS);
  } catch (e) { return []; }
}
function diceHistWrite(rows) {
  try { safeLocalSet(diceHistKey(), JSON.stringify({ v: 1, rows: (rows || []).slice(0, ROLL_MAX_ROWS) })); }
  catch (e) { /* 本机也存不下就算了 */ }
}

async function rollRole() {
  try { return await OBR.player.getRole(); } catch (e) { return ""; }
}

async function migrateRollsFromRoom() {
  try {
    if ((await rollRole()) !== "GM") return;
    var box = await rollReadBox();
    var oldRows = rollRowsOf(box);
    if (!oldRows.length) return;
    var merged = diceHistRead();
    for (var i = 0; i < oldRows.length; i++) merged = rollMerge(merged, oldRows[i]);
    diceHistWrite(merged);
    var seq = box && typeof box.seq === "number" && isFinite(box.seq) ? Math.round(box.seq) : 0;
    try {
      await OBR.room.setMetadata({ [KEY_ROLLS]: { v: 1, updatedAt: Date.now(), seq: seq + 1, rows: [] } });
    } catch (e) {
      pageLog("err", "清空房间骰子残留失败：" + errText(e));
    }
    pageLog("info", "骰子历史已迁移到本机：" + oldRows.length + " 条（房间数据已清空，不再占 16KB 预算）");
  } catch (e2) {
    pageLog("err", "迁移房间骰子历史失败：" + errText(e2));
  }
}

async function onRollClear() {
  if ((await rollRole()) !== "GM") return;
  try {
    var box = await rollReadBox();
    var oldRows = rollRowsOf(box);
    if (!oldRows.length) return;
    var seq = box && typeof box.seq === "number" && isFinite(box.seq) ? Math.round(box.seq) : 0;
    await OBR.room.setMetadata({ [KEY_ROLLS]: { v: 1, updatedAt: Date.now(), seq: seq + 1, rows: [] } });
    pageLog("info", "房间里的旧骰子记录已清空（本机记录由各端自己清）");
  } catch (e) {
    pageLog("err", "清空房间骰子残留失败：" + errText(e));
  }
}

/* =====================================================================
 * v2.5.1：传送门（核心）
 *   GM 拖动画圆建门 → 同 tag 互联；玩家拖动自己 token 进门 → 目的地选择 →
 *   六边形螺旋落点 + 原生 WALL 避让；传送后 700ms 抑制重复触发。
 * 数据：metadata com.4enext-owlbear/portal = { name, tag, radius, showName, visible, locked }
 * ===================================================================== */
function portalMeta(raw) {
  var m = raw && typeof raw === "object" ? raw : {};
  var radius = typeof m.radius === "number" && isFinite(m.radius) ? Math.round(m.radius) : 70;
  radius = Math.max(PORTAL_MIN_RADIUS, Math.min(4000, radius));
  var name = typeof m.name === "string" && m.name.trim() ? m.name.trim().slice(0, 40) : "传送门";
  var tag = typeof m.tag === "string" && m.tag.trim() ? m.tag.trim().slice(0, 40) : name;
  return {
    name: name,
    tag: tag,
    radius: radius,
    showName: m.showName !== false,
    visible: m.visible !== false,
    locked: m.locked !== false
  };
}
function portalOf(item) {
  if (!item || !item.metadata || !item.metadata[KEY_PORTAL]) return null;
  var p = portalMeta(item.metadata[KEY_PORTAL]);
  p.itemId = item.id;
  p.center = { x: item.position.x, y: item.position.y };
  return p;
}
function portalListOf(items) {
  var out = [];
  for (var i = 0; i < (items || []).length; i++) {
    var p = portalOf(items[i]);
    if (p) out.push(p);
  }
  return out;
}
function portalDestinations(portals, sourceId) {
  var src = null;
  for (var i = 0; i < portals.length; i++) if (portals[i].itemId === sourceId) src = portals[i];
  if (!src) return [];
  return portals.filter(function (p) { return p.itemId !== sourceId && p.tag === src.tag; });
}
function portalTokenRadius(item, sceneDpi) {
  var dpi = typeof sceneDpi === "number" && sceneDpi > 0 ? sceneDpi : 150;
  var w = item && typeof item.width === "number" && isFinite(item.width) && item.width > 0 ? item.width : 0;
  var h = item && typeof item.height === "number" && isFinite(item.height) && item.height > 0 ? item.height : 0;
  var sx = item && item.scale && typeof item.scale.x === "number" && isFinite(item.scale.x) ? Math.abs(item.scale.x) : 1;
  var sy = item && item.scale && typeof item.scale.y === "number" && isFinite(item.scale.y) ? Math.abs(item.scale.y) : 1;
  var r = (w > 0 || h > 0) ? Math.max(w * sx, h * sy) / 2 : dpi / 2; /* 1 格半径兜底 */
  /* clamp 到 [0.5 格, 5 格] */
  return Math.max(dpi / 2, Math.min(dpi * 5, r || dpi / 2));
}
function portalXfPoint(item, p) {
  var sx = item.scale && typeof item.scale.x === "number" ? item.scale.x : 1;
  var sy = item.scale && typeof item.scale.y === "number" ? item.scale.y : 1;
  var rot = typeof item.rotation === "number" ? item.rotation : 0;
  var x = p.x * sx, y = p.y * sy;
  var c = Math.cos(rot), sn = Math.sin(rot);
  return { x: (item.position ? item.position.x : 0) + x * c - y * sn, y: (item.position ? item.position.y : 0) + x * sn + y * c };
}
function portalWallSegments(items) {
  var segs = [];
  for (var i = 0; i < (items || []).length; i++) {
    var it = items[i];
    if (!it || it.type !== "WALL") continue;
    var pts = Array.isArray(it.points) ? it.points : null;
    if (pts && pts.length >= 2) {
      for (var j = 0; j < pts.length - 1; j++) segs.push({ a: portalXfPoint(it, pts[j]), b: portalXfPoint(it, pts[j + 1]) });
      if (it.closed && pts.length > 2) segs.push({ a: portalXfPoint(it, pts[pts.length - 1]), b: portalXfPoint(it, pts[0]) });
    } else if (it.startPosition && it.endPosition) {
      segs.push({ a: portalXfPoint(it, it.startPosition), b: portalXfPoint(it, it.endPosition) });
    }
  }
  return segs;
}
function portalPointSegDist(p, a, b) {
  var vx = b.x - a.x, vy = b.y - a.y;
  var wx = p.x - a.x, wy = p.y - a.y;
  var len2 = vx * vx + vy * vy;
  var t = len2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2)) : 0;
  var dx = p.x - (a.x + vx * t), dy = p.y - (a.y + vy * t);
  return Math.sqrt(dx * dx + dy * dy);
}
function portalPointSafe(p, radius, walls) {
  for (var i = 0; i < walls.length; i++) {
    if (portalPointSegDist(p, walls[i].a, walls[i].b) < radius + PORTAL_WALL_PADDING) return false;
  }
  return true;
}
function portalSegIntersect(p1, p2, p3, p4) {
  var d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  var d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  var den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return false;
  var t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  var u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  /* 忽略门中心恰在墙上的起点相交（t≈0），否则门贴墙时永远找不到落点。 */
  return t > 1e-6 && t <= 1 && u >= 0 && u <= 1;
}
/** 从门中心到落点的路径不得穿墙（token 半径 + padding 容差由点安全负责，这里检测实际相交）。 */
function portalPathSafe(center, p, walls) {
  for (var i = 0; i < walls.length; i++) {
    if (portalSegIntersect(center, p, walls[i].a, walls[i].b)) return false;
  }
  return true;
}
/** 六边形螺旋（轴向坐标）：相邻落点距离 = spacing，保证多选 token 不重叠。 */
function portalHexSpiral(count, spacing) {
  var n = Math.max(0, Math.round(count));
  var sp = Math.max(1, spacing);
  if (!n) return [];
  var out = [];
  var maxRing = Math.ceil(Math.sqrt(n)) + 3;
  for (var ring = 0; ring <= maxRing && out.length < n; ring++) {
    for (var q = -ring; q <= ring && out.length < n; q++) {
      for (var r = Math.max(-ring, -q - ring); r <= Math.min(ring, -q + ring) && out.length < n; r++) {
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) !== ring) continue;
        out.push({ x: sp * (q + r / 2), y: sp * (r * Math.sqrt(3) / 2) });
      }
    }
  }
  return out.slice(0, n);
}
/**
 * 为多枚 token 在目的地中心附近找落点：六边形螺旋 + 墙避让（距离 ≥ token 半径 + 8）。
 * 返回 positions 数组（与 radii 同序）；找不到安全点返回 null。
 */
function portalPlanTeleport(center, radii, walls) {
  var list = Array.isArray(radii) && radii.length ? radii : [5];
  var maxR = 0;
  for (var i = 0; i < list.length; i++) maxR = Math.max(maxR, list[i]);
  var spacing = 2 * maxR + PORTAL_WALL_PADDING;
  var candidates = portalHexSpiral(Math.max(24, list.length * 12), spacing).slice();
  /* 先内圈后外圈（螺旋本身由近到远，这里再显式按距离排序兜底）。 */
  candidates.sort(function (a, b) { return (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y); });
  var positions = [];
  var used = {};
  var candLog = 0;
  for (var k = 0; k < list.length; k++) {
    var found = null;
    for (var c = 0; c < candidates.length; c++) {
      if (used[c]) continue;
      var p = { x: center.x + candidates[c].x, y: center.y + candidates[c].y };
      var reject = "";
      if (!portalPointSafe(p, list[k], walls)) reject = "wall-hit";
      else if (!portalPathSafe(center, p, walls)) reject = "wall-cross";
      if (candLog < 12) {
        pageLog("info", "portal cand i=" + candLog + " reject=" + (reject || "ok"));
        candLog++;
      }
      if (reject) continue;
      used[c] = true;
      found = p;
      candLog = 12; /* 首个合法点后不再刷候选日志 */
      break;
    }
    if (!found) return null;
    positions.push(found);
  }
  return positions;
}
function portalSuppressed(now, until) { return until > now; }

var portalPreviewId = null;
var portalDragStart = null;
var portalGestureSeq = 0;
var portalGestureId = 0;
var portalFinishedGesture = 0;
var portalDetectTimer = null;
var portalBaseline = {};
var portalBaselineReady = false;
var portalSuppressUntil = 0;
var portalDestOpen = false;
var portalDestOpening = false;
var portalDestLastKey = "";
var portalDestLastAt = 0;
var portalOldDestId = NS + "/portal-dest-pop";
var portalKnown = {};
var portalLifecycleReady = false;
var portalRadiusInflight = {};
var portalTeleportLanded = {};
var portalWritingIds = {};
var portalSkipLogAt = 0;
/** v2.5.1：GM 拖缩放手柄 → 把 item.scale 反算回 metadata.radius（只 GM 写，inflight 防自触发循环）。 */
async function portalScaleRadiusSync(all) {
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (role !== "GM") return 0;
  var dpi = await portalSceneDpi();
  var wrote = 0;
  for (var i = 0; i < (all || []).length; i++) {
    var it = all[i];
    if (!it || !it.metadata || !it.metadata[KEY_PORTAL]) continue;
    var meta = portalMeta(it.metadata[KEY_PORTAL]);
    var expected = portalScaleFor(meta.radius, dpi);
    var sx = it.scale && typeof it.scale.x === "number" ? Math.abs(it.scale.x) : expected;
    var sy = it.scale && typeof it.scale.y === "number" ? Math.abs(it.scale.y) : sx;
    var denom = expected > 0 ? expected : 1;
    if (Math.abs(sx - expected) / denom <= 0.01 && Math.abs(sy - expected) / denom <= 0.01) continue;
    var newR = portalRadiusFromScale({ x: sx, y: sy }, dpi);
    if (newR === meta.radius) continue;
    if (portalRadiusInflight[it.id] === newR) continue;
    portalRadiusInflight[it.id] = newR;
    try {
      await OBR.scene.items.updateItems([it.id], function (drafts) {
        for (var d = 0; d < drafts.length; d++) {
          if (!drafts[d].metadata || typeof drafts[d].metadata !== "object") drafts[d].metadata = {};
          drafts[d].metadata[KEY_PORTAL] = portalMeta(Object.assign({}, meta, { radius: newR }));
        }
      });
      wrote++;
      pageLog("info", "portal radius sync scale=" + sx.toFixed(4) + "," + sy.toFixed(4) + " → r=" + newR + " dpi=" + dpi);
    } catch (e) {
      pageLog("err", "portal radius sync 失败：" + errText(e));
    } finally {
      setTimeout(function () { delete portalRadiusInflight[it.id]; }, 500);
    }
  }
  return wrote;
}

/** v2.5.1 诊断：对比已知传送门 id 集合，打印 added / removed / hidden，区分「被删」还是「没画出来」。 */
function portalLifecycleSync(all) {
  var current = {};
  var count = 0;
  for (var i = 0; i < (all || []).length; i++) {
    var it = all[i];
    if (!it || !it.metadata || !it.metadata[KEY_PORTAL]) continue;
    current[it.id] = { visible: it.visible !== false, name: it.metadata[KEY_PORTAL].name || "" };
    count++;
  }
  if (!portalLifecycleReady) {
    portalLifecycleReady = true;
    portalKnown = current;
    pageLog("info", "portal lifecycle seed n=" + count);
    return;
  }
  for (var id in current) {
    if (!Object.prototype.hasOwnProperty.call(current, id)) continue;
    if (!portalKnown[id]) pageLog("info", "portal added id=" + id + " name=" + current[id].name);
    else if (portalKnown[id].visible && !current[id].visible) pageLog("info", "portal hidden id=" + id);
    else if (!portalKnown[id].visible && current[id].visible) pageLog("info", "portal shown id=" + id);
  }
  for (var oldId in portalKnown) {
    if (!Object.prototype.hasOwnProperty.call(portalKnown, oldId)) continue;
    if (!current[oldId]) pageLog("info", "portal removed id=" + oldId + " name=" + portalKnown[oldId].name);
  }
  portalKnown = current;
}

var portalDpiCache = 0;
async function portalSceneDpi() {
  if (portalDpiCache > 0) return portalDpiCache;
  var dpi = 150;
  try {
    if (OBR.scene && OBR.scene.grid && typeof OBR.scene.grid.getDpi === "function") {
      var got = await OBR.scene.grid.getDpi();
      if (typeof got === "number" && got > 0) dpi = got;
    }
  } catch (e) { dpi = 150; }
  portalDpiCache = dpi;
  return dpi;
}
/** 渲染直径 D = width × (sceneDpi / image.dpi) × scale；width=image.dpi=256 ⇒ scale = 2r / sceneDpi。 */
function portalScaleFor(radius, dpi) {
  var d = typeof dpi === "number" && dpi > 0 ? dpi : 150;
  return (2 * Math.max(PORTAL_MIN_RADIUS, radius)) / d;
}
/** 反向换算：sceneDpi × scale / 2；x/y 不一致时取 **min**（避免非等比缩放把触发范围放大），clamp 16..4000。 */
function portalRadiusFromScale(scale, dpi) {
  var d = typeof dpi === "number" && dpi > 0 ? dpi : 150;
  var sx = scale && typeof scale.x === "number" && isFinite(scale.x) ? Math.abs(scale.x) : 0;
  var sy = scale && typeof scale.y === "number" && isFinite(scale.y) ? Math.abs(scale.y) : sx;
  var sMin = sx > 0 && sy > 0 ? Math.min(sx, sy) : Math.max(sx, sy);
  if (!(sMin > 0)) return PORTAL_MIN_RADIUS;
  return Math.max(PORTAL_MIN_RADIUS, Math.min(4000, Math.round(d * sMin / 2)));
}
async function portalImageItem(center, radius, meta, isPreview) {
  var dpi = await portalSceneDpi();
  var cx = Number(center && center.x);
  var cy = Number(center && center.y);
  if (!isFinite(cx)) cx = 0;
  if (!isFinite(cy)) cy = 0;
  var scale = portalScaleFor(radius, dpi);
  var item = buildImage(
    { width: 150, height: 150, url: PORTAL_ICON_URL, mime: "image/png" },
    { dpi: 150, offset: { x: 75, y: 75 } }
  )
    .position({ x: cx, y: cy })
    .scale({ x: scale, y: scale })
    .layer("PROP")
    .name("传送门")
    .locked(true)
    .visible(meta ? meta.visible !== false : true)
    .metadata(isPreview ? { [PORTAL_PREVIEW_TAG]: true } : { [KEY_PORTAL]: portalMeta(meta) })
    .build();
  pageLog("info", "portal item dpi=" + dpi + " r=" + Math.round(radius) + " scale=" + scale.toFixed(4) + " center=" + cx + "," + cy);
  return item;
}
async function portalClearPreviewResidue(reason) {
  try {
    if (!OBR.scene || !OBR.scene.local || typeof OBR.scene.local.getItems !== "function") return 0;
    var items = await OBR.scene.local.getItems();
    var ids = [];
    for (var i = 0; i < (items || []).length; i++) {
      var it = items[i];
      if (it && it.metadata && it.metadata[PORTAL_PREVIEW_TAG]) ids.push(it.id);
    }
    if (!ids.length) return 0;
    await OBR.scene.local.deleteItems(ids);
    portalPreviewId = null;
    pageLog("info", "preview 残留清理 " + ids.length + " 项" + (reason ? "（" + reason + "）" : ""));
    return ids.length;
  } catch (e) {
    pageLog("err", "preview 残留清理失败：" + errText(e));
    return 0;
  }
}
async function portalPreviewStart(center) {
  center = { x: Number(center && center.x) || 0, y: Number(center && center.y) || 0 };
  try {
    if (!OBR.scene || !OBR.scene.local || typeof buildImage !== "function") return;
    await portalClearPreviewResidue("start");
    await portalPreviewClear();
    var item = await portalImageItem(center, PORTAL_MIN_RADIUS, { visible: true }, true);
    item.metadata = { [PORTAL_PREVIEW_TAG]: true };
    item.visible = true;
    await OBR.scene.local.addItems([item]);
    portalPreviewId = item.id;
    pageLog("info", "preview add ok");
  } catch (e) { pageLog("err", "preview add fail：" + errText(e)); }
}
async function portalPreviewUpdate(center, radius) {
  if (!portalPreviewId) return;
  center = { x: Number(center && center.x) || 0, y: Number(center && center.y) || 0 };
  try {
    var dpi = await portalSceneDpi();
    var scale = portalScaleFor(radius, dpi);
    await OBR.scene.local.updateItems([portalPreviewId], function (drafts) {
      for (var i = 0; i < drafts.length; i++) {
        drafts[i].position = { x: center.x, y: center.y };
        drafts[i].scale = { x: scale, y: scale };
      }
    });
    var now = Date.now();
    if (now - portalPreviewLogAt > 250) {
      portalPreviewLogAt = now;
      pageLog("info", "preview update ok r=" + Math.round(radius));
    }
  } catch (e) { pageLog("err", "preview update fail：" + errText(e)); }
}
async function portalPreviewClear() {
  if (!portalPreviewId) return;
  var id = portalPreviewId;
  portalPreviewId = null;
  try { await OBR.scene.local.deleteItems([id]); pageLog("info", "preview remove ok"); }
  catch (e) { pageLog("err", "preview remove fail：" + errText(e)); }
  await portalClearPreviewResidue("clear");
}
async function portalCreate(center, radius, opts) {
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (role !== "GM") { notify("只有城主能创建传送门", "WARNING"); return null; }
  var rr = Number(radius);
  if (!isFinite(rr) || rr < PORTAL_MIN_RADIUS) return null;
  var o = opts && typeof opts === "object" ? opts : {};
  var meta = portalMeta({
    name: o.name || "传送门", tag: o.tag || o.name || "传送门", radius: Math.round(rr),
    showName: true, visible: true, locked: false
  });
  var item = await portalImageItem(center, meta.radius, meta, false);
  try {
    await OBR.scene.items.addItems([item]);
    pageLog("info", "传送门已创建：" + item.id + " r=" + meta.radius);
    try {
      var now = await OBR.scene.items.getItems([item.id]);
      var got = now && now[0] ? now[0] : null;
      pageLog("info", "portal verify id=" + item.id + " exists=" + !!got +
        " visible=" + (got && got.visible) + " layer=" + (got && got.layer) +
        " scale=" + (got && got.scale ? JSON.stringify(got.scale) : "?") +
        " pos=" + (got && got.position ? (got.position.x + "," + got.position.y) : "?"));
    } catch (eVerify) {
      pageLog("err", "portal verify 失败：" + errText(eVerify));
    }
    return item;
  } catch (e) {
    stepFail("创建传送门", e);
    return null;
  }
}
var portalDragMoveLogAt = 0;
var portalPreviewLogAt = 0;

async function logPortalActiveState(where) {
  try {
    var t = typeof OBR.tool.getActiveTool === "function" ? await OBR.tool.getActiveTool() : "?";
    var m = typeof OBR.tool.getActiveToolMode === "function" ? await OBR.tool.getActiveToolMode() : "?";
    pageLog("info", "传送门 " + where + " getActiveTool=" + t + " getActiveToolMode=" + m);
  } catch (e) {
    pageLog("err", "传送门 " + where + " 读取 active 状态失败：" + errText(e));
  }
}

async function portalDragBegin(event) {
  var target = event && event.target;
  if (target && target.metadata && target.metadata[KEY_PORTAL]) { portalDragStart = null; return; }
  var p = event && event.pointerPosition;
  pageLog("info", "传送门 dragStart p=" + (p ? p.x + "," + p.y : "无") + " target=" + (target ? "有" : "无"));
  if (!p) return;
  portalGestureId = ++portalGestureSeq;
  portalDragStart = { x: p.x, y: p.y, gesture: portalGestureId };
  pageLog("info", "传送门 gesture=" + portalGestureId + " begin");
  await portalPreviewStart(portalDragStart);
}
async function portalDragUpdate(event) {
  if (!portalDragStart) return;
  var p = event && event.pointerPosition;
  if (!p) return;
  var r = Math.hypot(p.x - portalDragStart.x, p.y - portalDragStart.y);
  var now = Date.now();
  if (now - portalDragMoveLogAt > 250) {
    portalDragMoveLogAt = now;
    pageLog("info", "传送门 dragMove r=" + Math.round(r));
  }
  await portalPreviewUpdate(portalDragStart, r);
}
async function portalDragFinish(event) {
  if (!portalDragStart) { pageLog("info", "preview skip（已处理）"); return; }
  var gesture = portalDragStart.gesture || portalGestureId;
  if (gesture === portalFinishedGesture) { pageLog("info", "preview skip（已处理）"); return; }
  portalFinishedGesture = gesture;
  var center = { x: portalDragStart.x, y: portalDragStart.y };
  portalDragStart = null;
  var p = event && event.pointerPosition;
  await portalPreviewClear();
  if (!p) { pageLog("info", "传送门 dragEnd p=无 → 忽略"); return; }
  var radius = Math.hypot(p.x - center.x, p.y - center.y);
  if (radius < PORTAL_MIN_RADIUS) {
    pageLog("info", "传送门 dragEnd r=" + Math.round(radius) + " → 太小忽略（<" + PORTAL_MIN_RADIUS + "）");
    return;
  }
  pageLog("info", "传送门 dragEnd r=" + Math.round(radius) + " → create");
  var created = await portalCreate(center, radius);
  if (created) pageLog("info", "portal create gesture=" + gesture + " id=" + created.id);
  await portalClearPreviewResidue("create");
}
async function portalDragCancel() {
  portalDragStart = null;
  await portalPreviewClear();
}

async function registerPortalTool() {
  if (!OBR.tool || typeof OBR.tool.create !== "function") return;
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  /* Full Suite 同款：tool / mode **只在 GM 时注册**；玩家只走拖动进门 + 目的地选择。 */
  if (role !== "GM") {
    pageLog("info", "传送门工具不注册：role=" + role + "（仅 GM）");
    return;
  }

  var portalMode = {
    id: TOOL_PORTAL_MODE_ID,
    icons: [{ icon: TOOL_PORTAL_ICON_URL, label: "画传送门（拖动定半径，松手创建）", filter: { activeTools: [TOOL_PORTAL_ID] } }],
    cursors: [{ cursor: "crosshair" }],
    onActivate: function () { pageLog("info", "传送门 mode 已激活"); },
    onToolDragStart: async function (_ctx, event) { await portalDragBegin(event); },
    onToolDragMove: async function (_ctx, event) { await portalDragUpdate(event); },
    onToolDragEnd: async function (_ctx, event) { await portalDragFinish(event); },
    onToolDragCancel: async function () { await portalDragCancel(); },
    onDeactivate: async function () { await portalDragCancel(); },
    /* 兜底：若宿主的 drag 事件不触发，用 down/move/up 走同一套（凭 portalDragStart 去重）。 */
    onToolDown: async function (_ctx, event) {
      pageLog("info", "传送门 toolDown");
      if (portalDragStart) return;
      await portalDragBegin(event);
    },
    onToolMove: async function (_ctx, event) {
      if (!portalDragStart) return;
      await portalDragUpdate(event);
    },
    onToolUp: async function (_ctx, event) {
      pageLog("info", "传送门 toolUp");
      await portalDragFinish(event);
    }
  };

  /* 顺序：先 tool（defaultMode 必须已存在才允许建 mode），再 mode。 */
  await registerOneTool({
    id: TOOL_PORTAL_ID,
    icons: [{ icon: TOOL_PORTAL_ICON_URL, label: "4eNEXT to owlbear：传送门（GM 拖动画圆）", filter: { roles: ["GM"] } }],
    defaultMode: TOOL_PORTAL_MODE_ID,
    onClick: async function () {
      pageLog("info", "传送门工具点击 role=GM → activateTool");
      try { await OBR.tool.activateTool(TOOL_PORTAL_ID); } catch (e) { pageLog("err", "传送门 activateTool 失败：" + errText(e)); }
      setTimeout(function () {
        try {
          var ret = OBR.tool.activateMode(TOOL_PORTAL_ID, TOOL_PORTAL_MODE_ID);
          if (ret && typeof ret.catch === "function") ret.catch(function (e2) { pageLog("err", "传送门 mode 激活失败：" + errText(e2)); });
          pageLog("info", "传送门 mode 激活 → " + TOOL_PORTAL_MODE_ID);
        } catch (e) { pageLog("err", "传送门 mode 激活失败：" + errText(e)); }
        setTimeout(function () { void logPortalActiveState("点击后"); }, 250);
      }, 80);
      return false;
    }
  });
  pageLog("info", "传送门 tool 创建 ✓");

  if (typeof OBR.tool.createMode !== "function") return;
  try {
    await OBR.tool.createMode(portalMode);
    pageLog("info", "传送门 mode 创建 ✓");
  } catch (e) {
    pageLog("err", "传送门 mode 创建失败：" + errText(e));
    try { await OBR.tool.removeMode(TOOL_PORTAL_MODE_ID); } catch (e2) {  }
    try { await OBR.tool.createMode(portalMode); pageLog("info", "传送门 mode 创建 ✓（重试）"); }
    catch (e3) { pageLog("err", "传送门 mode 创建失败（重试后）：" + errText(e3)); return; }
  }

  /* v2.5.1：成对创建 mode（tool 下第二个 mode）。 */
  try {
    await OBR.tool.createMode({
      id: TOOL_PORTAL_PAIR_MODE_ID,
      icons: [{ icon: TOOL_PORTAL_ICON_URL, label: "成对创建传送门（点两处）", filter: { activeTools: [TOOL_PORTAL_ID] } }],
      cursors: [{ cursor: "crosshair" }],
      onToolClick: async function (_ctx, event) {
        var p = event && event.pointerPosition;
        if (!p) return false;
        if (!portalPairFirst) {
          portalPairFirst = { x: p.x, y: p.y };
          pageLog("info", "portal pair first=" + p.x + "," + p.y);
          await portalPairPreview(portalPairFirst, portalPairFirst);
          return false;
        }
        var first = { x: portalPairFirst.x, y: portalPairFirst.y };
        portalPairFirst = null;
        await portalPairCreate(first, { x: p.x, y: p.y });
        return false;
      },
      onToolMove: async function (_ctx, event) {
        if (!portalPairFirst) return;
        var p = event && event.pointerPosition;
        if (p) await portalPairPreview(portalPairFirst, p);
      },
      onToolDragCancel: async function () { await portalPairClear(); },
      onDeactivate: async function () { await portalPairClear(); },
      onKeyDown: async function (_ctx, event) { if (event && event.key === "Escape") await portalPairClear(); }
    });
    pageLog("info", "传送门 pair mode 创建 ✓");
  } catch (ePair) {
    pageLog("err", "传送门 pair mode 创建失败：" + errText(ePair));
  }

  /* 已激活的 tool 可能还没切 mode：显式切一次并打印当前 active 状态。 */
  try {
    var active = typeof OBR.tool.getActiveTool === "function" ? await OBR.tool.getActiveTool() : "";
    if (active === TOOL_PORTAL_ID && typeof OBR.tool.activateMode === "function") {
      await OBR.tool.activateMode(TOOL_PORTAL_ID, TOOL_PORTAL_MODE_ID);
      pageLog("info", "传送门 mode 激活 → " + TOOL_PORTAL_MODE_ID);
    }
    void logPortalActiveState("注册后");
  } catch (e4) {
    pageLog("err", "传送门 mode 激活失败：" + errText(e4));
  }
}
var portalEditItemId = "";
async function syncPortalEditFromSelection() {
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (role !== "GM") return;
  var sel = [];
  try { sel = (await OBR.player.getSelection()) || []; } catch (e2) { sel = []; }

  /* v2.5.1 修复：打开 popover 后选区会变成「无」（焦点变化），不能当成取消选中去关窗，
   * 否则用户看到一闪。空选中 / 多选 / 选中非门 → 都保持现有编辑窗。 */
  if (sel.length === 0) {
    if (portalEditItemId) pageLog("info", "传送门 编辑窗保持（选中 0 项）");
    return;
  }
  if (sel.length > 1) {
    if (portalEditItemId) pageLog("info", "传送门 编辑窗保持（多选 " + sel.length + " 项）");
    return;
  }
  var id = sel[0];
  if (portalEditItemId === id) return; /* 同一枚已开 */
  var it = null;
  try {
    var items = await OBR.scene.items.getItems([id]);
    it = items && items[0] ? items[0] : null;
  } catch (e4) { it = null; }
  if (!it || !it.metadata || !it.metadata[KEY_PORTAL]) {
    if (portalEditItemId) pageLog("info", "传送门 编辑窗保持（选中不是门）");
    return;
  }
  var old = portalEditItemId;
  portalEditItemId = id;
  if (old) {
    pageLog("info", "传送门 编辑窗切换 " + old + "→" + id);
    try { await OBR.popover.close(ID_PORTAL_EDIT); } catch (e5) {  }
  } else {
    pageLog("info", "传送门 选中 → 打开编辑 " + id);
  }
  await openPortalEdit(id);
}

/** 编辑窗自己关闭（取消 / ✕ / 保存）→ 清记录，允许下次再点同一门重开。 */
async function onPortalEditClosed(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || data.closedByUser !== true) return;
  portalEditItemId = "";
  pageLog("info", "传送门 编辑窗关闭（用户关闭）");
  try { await OBR.popover.close(ID_PORTAL_EDIT); } catch (e) {  }
}

async function openPortalEdit(itemId) {
  if (!itemId) return false;
  try {
    /* v2.5.1：编辑窗接进通用窗口框架（可拖动 / 位置记忆 / 视口 reclamp）。
     * URL 带 ?item=<id>；同一 popover id 重复打开会原地更新，不会重开。 */
    await openWin("portalEdit", URL_PORTAL_EDIT + "?item=" + encodeURIComponent(itemId));
    return true;
  } catch (e) {
    stepFail("打开传送门编辑窗", e);
    return false;
  }
}
async function onPortalSave(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var itemId = data && typeof data.itemId === "string" ? data.itemId : "";
  if (!itemId) return;
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (role !== "GM") { notify("只有城主能编辑传送门", "WARNING"); return; }
  var meta = portalMeta(data.portal || data);
  try {
    var saveDpi = await portalSceneDpi();
    await OBR.scene.items.updateItems([itemId], function (drafts) {
      for (var i = 0; i < drafts.length; i++) {
        if (!drafts[i].metadata || typeof drafts[i].metadata !== "object") drafts[i].metadata = {};
        var oldMeta = drafts[i].metadata[KEY_PORTAL] ? portalMeta(drafts[i].metadata[KEY_PORTAL]) : null;
        /* v2.5.1：半径不再由表单决定 —— 以当前 item.scale 反算（scale 缺失才退回旧 metadata.radius）。 */
        var r = drafts[i].scale
          ? portalRadiusFromScale(drafts[i].scale, saveDpi)
          : (oldMeta ? oldMeta.radius : meta.radius);
        var finalMeta = portalMeta(Object.assign({}, meta, { radius: r }));
        drafts[i].metadata[KEY_PORTAL] = finalMeta;
        drafts[i].visible = finalMeta.visible !== false;
        drafts[i].scale = { x: portalScaleFor(r, saveDpi), y: portalScaleFor(r, saveDpi) };
      }
    });
    pageLog("info", "传送门已保存：" + itemId);
    portalEditItemId = "";
    try { await OBR.popover.close(ID_PORTAL_EDIT); } catch (e2) {  }
  } catch (e3) {
    notify("保存传送门失败：" + errText(e3), "ERROR");
  }
}
/** v2.5.1：传送时临时绕过 Dynamic Fog / Smoke 等插件的穿墙校验：
 * 快照并剥离 token 上的雾效 metadata、隐藏 token 与其 attachment，写位置后逐字恢复。失败不阻塞传送。 */
function portalFogMetaKey(key, val) {
  var k = String(key || "").toLowerCase();
  if (k.indexOf("smoke") >= 0 || k.indexOf("spectre") >= 0 || k.indexOf("specter") >= 0 ||
    k.indexOf("battle-system") >= 0 || k.indexOf("dynamic-fog") >= 0 || k.indexOf("dynamicfog") >= 0) return true;
  if (val && typeof val === "object" && !Array.isArray(val)) {
    if ("attenuationRadius" in val || "sourceRadius" in val || "visionRange" in val ||
      "lightRadius" in val || "wallBlocks" in val) return true;
  }
  return false;
}
async function moveTokensWithFogBypass(tokens, byId) {
  var ids = (tokens || []).map(function (t) { return t.id; }).filter(Boolean);
  if (!ids.length) return { ext: 0, att: 0, hidTokens: 0 };
  var snapMeta = {}; /* tokenId -> {key:value} */
  var ext = 0;
  for (var i = 0; i < tokens.length; i++) {
    var tk = tokens[i];
    var removed = {};
    var md = tk.metadata && typeof tk.metadata === "object" ? tk.metadata : {};
    for (var key in md) {
      if (!Object.prototype.hasOwnProperty.call(md, key)) continue;
      if (portalFogMetaKey(key, md[key])) { removed[key] = md[key]; ext++; }
    }
    if (Object.keys(removed).length) snapMeta[tk.id] = removed;
  }
  var attSnap = []; /* {api,id,visible} */
  var attCount = 0;
  var apis = [];
  try { if (OBR.scene && OBR.scene.items && typeof OBR.scene.items.getItemAttachments === "function") apis.push(OBR.scene.items); } catch (eA) {  }
  try { if (OBR.scene && OBR.scene.local && typeof OBR.scene.local.getItemAttachments === "function") apis.push(OBR.scene.local); } catch (eB) {  }
  for (var ai = 0; ai < apis.length; ai++) {
    try {
      var atts = await apis[ai].getItemAttachments(ids);
      for (var aj = 0; aj < (atts || []).length; aj++) {
        var at = atts[aj];
        if (!at || !at.id) continue;
        attSnap.push({ api: apis[ai], id: at.id, visible: at.visible !== false });
        attCount++;
      }
    } catch (eAtt) { pageLog("info", "portal bypass warn attachment read：" + errText(eAtt)); }
  }
  var tokenVisible = {};
  for (var tv = 0; tv < tokens.length; tv++) tokenVisible[tokens[tv].id] = tokens[tv].visible !== false;

  if (!ext && !attCount) {
    /* 没有雾效插件痕迹：不隐藏任何东西，只写位置。 */
    await OBR.scene.items.updateItems(ids, function (drafts) {
      for (var d0 = 0; d0 < drafts.length; d0++) {
        var p0 = byId[drafts[d0].id];
        if (p0) drafts[d0].position = { x: p0.x, y: p0.y };
      }
    });
    pageLog("info", "portal bypass ext=0 att=0 hidTokens=0");
    return { ext: 0, att: 0, hidTokens: 0 };
  }

  try {
    /* 1) 删除雾效 metadata */
    if (ext) {
      await OBR.scene.items.updateItems(Object.keys(snapMeta), function (drafts) {
        for (var d1 = 0; d1 < drafts.length; d1++) {
          var rem = snapMeta[drafts[d1].id];
          if (!rem || !drafts[d1].metadata) continue;
          for (var rk in rem) if (Object.prototype.hasOwnProperty.call(rem, rk)) delete drafts[d1].metadata[rk];
        }
      });
    }
    /* 2) 隐藏 attachment */
    for (var ah = 0; ah < attSnap.length; ah++) {
      try {
        await attSnap[ah].api.updateItems([attSnap[ah].id], function (drafts) {
          for (var d2 = 0; d2 < drafts.length; d2++) drafts[d2].visible = false;
        });
      } catch (eHideAtt) { pageLog("info", "portal bypass warn attachment hide"); }
    }
    /* 3) 隐藏 token 自身 + 4) 写位置 */
    await OBR.scene.items.updateItems(ids, function (drafts) {
      for (var d3 = 0; d3 < drafts.length; d3++) {
        drafts[d3].visible = false;
        var p3 = byId[drafts[d3].id];
        if (p3) drafts[d3].position = { x: p3.x, y: p3.y };
      }
    });
  } catch (eMove) {
    pageLog("info", "portal bypass warn move：" + errText(eMove));
  } finally {
    /* 5) 恢复：token visible → attachment visible → metadata 原值 */
    try {
      await OBR.scene.items.updateItems(ids, function (drafts) {
        for (var d4 = 0; d4 < drafts.length; d4++) {
          if (Object.prototype.hasOwnProperty.call(tokenVisible, drafts[d4].id)) drafts[d4].visible = tokenVisible[drafts[d4].id];
        }
      });
    } catch (eRestoreT) { pageLog("info", "portal bypass warn restore token"); }
    for (var ar = 0; ar < attSnap.length; ar++) {
      try {
        var visVal = attSnap[ar].visible;
        await attSnap[ar].api.updateItems([attSnap[ar].id], function (drafts) {
          for (var d5 = 0; d5 < drafts.length; d5++) drafts[d5].visible = visVal;
        });
      } catch (eRestoreA) { pageLog("info", "portal bypass warn restore attachment"); }
    }
    try {
      await OBR.scene.items.updateItems(Object.keys(snapMeta), function (drafts) {
        for (var d6 = 0; d6 < drafts.length; d6++) {
          var back = snapMeta[drafts[d6].id];
          if (!back) continue;
          if (!drafts[d6].metadata || typeof drafts[d6].metadata !== "object") drafts[d6].metadata = {};
          for (var bk in back) if (Object.prototype.hasOwnProperty.call(back, bk)) drafts[d6].metadata[bk] = back[bk];
        }
      });
    } catch (eRestoreM) { pageLog("info", "portal bypass warn restore metadata"); }
  }
  pageLog("info", "portal bypass ext=" + ext + " att=" + attCount + " hidTokens=" + ids.length);
  return { ext: ext, att: attCount, hidTokens: ids.length };
}

async function onPortalTeleport(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var destId = data && typeof data.destinationId === "string" ? data.destinationId : "";
  var tokenIds = data && Array.isArray(data.tokenIds) ? data.tokenIds : [];
  if (!destId || !tokenIds.length) return;
  var now = Date.now();
  if (portalSuppressed(now, portalSuppressUntil)) return;
  try {
    var all = await OBR.scene.items.getItems();
    var dest = null;
    for (var i = 0; i < all.length; i++) if (all[i].id === destId) dest = portalOf(all[i]);
    if (!dest) return;
    var tokens = all.filter(function (it) { return tokenIds.indexOf(it.id) >= 0; });
    if (!tokens.length) return;
    /* v2.5.1：传送显式授权 —— 仅 GM 或所有目标 token 的创建者。 */
    var teleRole = "";
    var telePid = "";
    try { teleRole = await OBR.player.getRole(); } catch (eRole) { teleRole = ""; }
    try { telePid = await OBR.player.getId(); } catch (ePid) { telePid = ""; }
    var authorized = teleRole === "GM";
    if (!authorized) {
      authorized = tokens.every(function (it) { return !!(telePid && it.createdUserId === telePid); });
    }
    if (!authorized) {
      pageLog("info", "portal teleport denied role=" + teleRole + " pid=" + telePid + " tokens=" + tokens.length);
      return;
    }
    var dpiTele = await portalSceneDpi();
    var radii = tokens.map(function (it) { return portalTokenRadius(it, dpiTele); });
    var walls = portalWallSegments(all);
    var positions = portalPlanTeleport(dest.center, radii, walls);
    if (!positions) {
      pageLog("info", "portal plan fail tokens=" + tokens.length + " radius=" + radii.join(",") + " walls=" + walls.length);
      notify("传送失败：目的地附近没有能避开墙的位置，请城主把目的地挪开一点", "WARNING");
      return;
    }
    pageLog("info", "portal plan n=" + positions.length + " walls=" + walls.length +
      " dest=" + Math.round(dest.center.x) + "," + Math.round(dest.center.y) +
      " pos=" + positions.map(function (p) { return Math.round(p.x) + "," + Math.round(p.y); }).join(";"));
    if (!walls.length) pageLog("info", "portal plan warn：未检测到原生 WALL（可能是其它插件的墙/手绘线）");
    if (walls.length) pageLog("info", "portal plan walls[0] a=" + Math.round(walls[0].a.x) + "," + Math.round(walls[0].a.y) + " b=" + Math.round(walls[0].b.x) + "," + Math.round(walls[0].b.y));
    var byId = {};
    var allPortals = portalListOf(all);
    for (var t = 0; t < tokens.length; t++) {
      byId[tokens[t].id] = positions[t];
      portalWritingIds[tokens[t].id] = true;
      portalTeleportLanded[tokens[t].id] = { x: positions[t].x, y: positions[t].y };
    }
    /* 先关目的地窗（不挡 UI），再临时绕过雾效插件写位置。 */
    try { await closeWin("portalDest"); } catch (e2) {  }
    try {
      await moveTokensWithFogBypass(tokens, byId);
    } catch (eBypass) {
      pageLog("info", "portal bypass warn：" + errText(eBypass));
      try {
        await OBR.scene.items.updateItems(Object.keys(byId), function (drafts) {
          for (var d = 0; d < drafts.length; d++) {
            var pos = byId[drafts[d].id];
            if (pos) drafts[d].position = { x: pos.x, y: pos.y };
          }
        });
      } catch (eFallback) { stepFail("执行传送", eFallback); }
    }
    portalSuppressUntil = Date.now() + PORTAL_SUPPRESS_MS;
    portalDestOpen = false;
    setTimeout(function () {
      for (var w = 0; w < tokens.length; w++) delete portalWritingIds[tokens[w].id];
    }, 500);
    pageLog("info", "传送完成：" + tokens.length + " 枚 token → " + dest.name);
  } catch (e) {
    stepFail("执行传送", e);
  }
}
async function onPortalItemsChange() {
  if (portalDetectTimer) clearTimeout(portalDetectTimer);
  portalDetectTimer = setTimeout(function () {
    portalDetectTimer = null;
    void portalDetectDragEnd();
  }, 200);
}
/** v2.5.1：目的地选择窗接进通用窗口框架（可拖动 / 位置记忆 / reclamp）。 */
/* ---------- v2.5.1：隐形门 GM ghost ---------- */
var portalGhostSig = "";
async function portalGhostSync(all) {
  var role = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  if (!OBR.scene || !OBR.scene.local) return;
  var invisible = [];
  for (var i = 0; i < (all || []).length; i++) {
    var it = all[i];
    if (!it || !it.metadata || !it.metadata[KEY_PORTAL]) continue;
    var meta = portalMeta(it.metadata[KEY_PORTAL]);
    if (meta.visible === false) invisible.push({ item: it, meta: meta });
  }
  var sigParts = [];
  for (var g = 0; g < invisible.length; g++) {
    var ii = invisible[g].item, mm = invisible[g].meta;
    sigParts.push([ii.id, ii.position.x, ii.position.y, ii.scale && ii.scale.x, mm.radius, mm.name].join(":"));
  }
  var sig = (role === "GM" ? "GM|" : "PLAYER|") + sigParts.join("|");
  if (sig === portalGhostSig) return 0;
  portalGhostSig = sig;
  try {
    var locals = await OBR.scene.local.getItems();
    var old = [];
    for (var l = 0; l < (locals || []).length; l++) {
      if (locals[l] && locals[l].metadata && locals[l].metadata[PORTAL_GHOST_TAG]) old.push(locals[l].id);
    }
    if (old.length) await OBR.scene.local.deleteItems(old);
  } catch (e0) {  }
  if (role !== "GM" || !invisible.length) return 0;
  var dpi = await portalSceneDpi();
  var ghosts = [];
  for (var k = 0; k < invisible.length; k++) {
    var itG = invisible[k].item, metaG = invisible[k].meta;
    var scale = portalScaleFor(metaG.radius, dpi);
    var ghost = buildImage(
      { width: 150, height: 150, url: PORTAL_ICON_URL, mime: "image/png" },
      { dpi: 150, offset: { x: 75, y: 75 } }
    )
      .position({ x: Number(itG.position.x) || 0, y: Number(itG.position.y) || 0 })
      .scale({ x: scale, y: scale })
      .layer("ATTACHMENT")
      .locked(true)
      .disableHit(true)
      .visible(true)
      .opacity(0.45)
      .metadata({ [PORTAL_GHOST_TAG]: itG.id, "名称": "隐藏门" })
      .build();
    ghosts.push(ghost);
  }
  try {
    if (ghosts.length) await OBR.scene.local.addItems(ghosts);
  } catch (e1) { pageLog("err", "portal ghost 创建失败：" + errText(e1)); }
  pageLog("info", "portal ghost 重建 n=" + ghosts.length);
  return ghosts.length;
}

/* ---------- v2.5.1：成对创建（第二个 mode） ---------- */
var portalPairFirst = null;
var portalPairPreviewId = null;
var portalPairLineId = null;
async function portalPairClear() {
  portalPairFirst = null;
  if (portalPairPreviewId) {
    var pid = portalPairPreviewId; portalPairPreviewId = null;
    try { await OBR.scene.local.deleteItems([pid]); } catch (e) {  }
  }
  if (portalPairLineId) {
    var lid = portalPairLineId; portalPairLineId = null;
    try { await OBR.scene.local.deleteItems([lid]); } catch (e2) {  }
  }
}
async function portalPairPreview(center, to) {
  try {
    var dpi = await portalSceneDpi();
    var scale = portalScaleFor(70, dpi);
    var item = buildImage(
      { width: 150, height: 150, url: PORTAL_ICON_URL, mime: "image/png" },
      { dpi: 150, offset: { x: 75, y: 75 } }
    ).position({ x: Number(center.x) || 0, y: Number(center.y) || 0 }).scale({ x: scale, y: scale })
      .layer("ATTACHMENT").locked(true).disableHit(true).visible(true).opacity(0.6)
      .metadata({ [PORTAL_PAIR_TAG]: true }).build();
    if (!portalPairPreviewId) {
      await OBR.scene.local.addItems([item]);
      portalPairPreviewId = item.id;
    } else {
      await OBR.scene.local.updateItems([portalPairPreviewId], function (drafts) {
        for (var i = 0; i < drafts.length; i++) drafts[i].position = { x: center.x, y: center.y };
      });
    }
    if (to && typeof buildLine === "function") {
      if (!portalPairLineId) {
        var line = buildLine().position({ x: 0, y: 0 }).startPosition(center).endPosition(to)
          .strokeColor("#58c7ff").strokeOpacity(0.9).strokeWidth(4).strokeDash([18, 12])
          .layer("CONTROL").locked(true).disableHit(true).visible(true)
          .metadata({ [PORTAL_PAIR_TAG]: true }).build();
        await OBR.scene.local.addItems([line]);
        portalPairLineId = line.id;
      } else {
        await OBR.scene.local.updateItems([portalPairLineId], function (drafts) {
          for (var j = 0; j < drafts.length; j++) {
            drafts[j].startPosition = { x: center.x, y: center.y };
            drafts[j].endPosition = { x: to.x, y: to.y };
          }
        });
      }
    }
  } catch (e3) { pageLog("err", "portal pair preview 失败：" + errText(e3)); }
}
async function portalPairCreate(first, second) {
  var tag = "P-" + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, "0");
  pageLog("info", "portal pair create tag=" + tag + " at=" + first.x + "," + first.y + " / " + second.x + "," + second.y);
  var a = await portalCreate(first, 70, { name: "传送门 A", tag: tag });
  var b = await portalCreate(second, 70, { name: "传送门 B", tag: tag });
  await portalPairClear();
  return [a, b];
}

async function openDestinationPopover(portalId, tokenIds) {
  if (portalDestOpening || portalDestOpen) {
    pageLog("info", "portal dest skip（已开/并发）");
    return false;
  }
  portalDestOpening = true;
  try {
    /* 打开前先清同 id（以及历史旧 id）残留，避免新旧两个目的地窗叠在一起。 */
    try { await OBR.popover.close(ID_PORTAL_DEST); } catch (e0) {  }
    try { await OBR.popover.close(portalOldDestId); } catch (e0b) {  }
    await openWin("portalDest", URL_PORTAL_DEST + "?portal=" + encodeURIComponent(portalId) +
      "&tokens=" + encodeURIComponent((tokenIds || []).join(",")));
    portalDestOpen = true;
    pageLog("info", "portal dest open（锁）");
    setTimeout(function () { portalDestOpen = false; }, 10000);
    return true;
  } catch (e) {
    pageLog("err", "打开传送目的地选择失败：" + errText(e));
    return false;
  } finally {
    portalDestOpening = false;
  }
}
async function portalDetectDragEnd() {
  var role = "";
  var myId = "";
  try { role = await OBR.player.getRole(); } catch (e) { role = ""; }
  try { myId = await OBR.player.getId(); } catch (e2) { myId = ""; }
  var all = [];
  try { all = await OBR.scene.items.getItems(); } catch (e3) { return; }
  try { portalLifecycleSync(all); } catch (eLife) { /* 诊断失败不影响侦测 */ }
  try { await portalScaleRadiusSync(all); } catch (eScale) { /* 缩放同步失败不影响拖动侦测 */ }
  var allPortals = portalListOf(all);
  var portals = allPortals.filter(function (p) { return p.visible !== false; });
  try { await portalGhostSync(all); } catch (eGhost) { /* ghost 失败不影响检测 */ }
  if (!portals.length) return;
  var sel = [];
  try { sel = (await OBR.player.getSelection()) || []; } catch (e4) { sel = []; }
  var tokenMap = {};
  for (var i = 0; i < all.length; i++) {
    var it = all[i];
    if (!it || (it.type !== "IMAGE" && it.type !== "MOUNT")) continue;
    if (it.metadata && it.metadata[KEY_PORTAL]) continue;
    tokenMap[it.id] = it;
  }
  var moved = [];
  for (var id in tokenMap) {
    if (!Object.prototype.hasOwnProperty.call(tokenMap, id)) continue;
    var tok = tokenMap[id];
    var pos = { x: tok.position.x, y: tok.position.y };
    var prev = portalBaseline[id];
    if (prev && Math.hypot(pos.x - prev.x, pos.y - prev.y) > 1) moved.push(tok);
    portalBaseline[id] = pos;
  }
  portalBaselineReady = true;
  var suppress = Date.now() < portalSuppressUntil;
  var candidates = [];
  for (var m = 0; m < moved.length; m++) {
    var tokM = moved[m];
    var owns = role === "GM" || (myId && tokM.createdUserId === myId) || (myId && tokM.lastModifiedUserId === myId) || sel.indexOf(tokM.id) >= 0;
    if (!owns) continue;
    if (portalWritingIds[tokM.id]) { pageLog("info", "portal skip（自己写入）token=" + tokM.id); continue; }
    var landed = portalTeleportLanded[tokM.id];
    if (landed) {
      if (Math.hypot(tokM.position.x - landed.x, tokM.position.y - landed.y) <= 1) {
        pageLog("info", "portal skip（传送落点未再变化）token=" + tokM.id);
        continue;
      }
      delete portalTeleportLanded[tokM.id]; /* 用户又拖动了 → 恢复手动触发 */
    }
    if (suppress) { pageLog("info", "portal skip（冷却）token=" + tokM.id); continue; }
    if (portalDestOpen) { pageLog("info", "portal skip（目的地窗已开）token=" + tokM.id); continue; }
    for (var p2 = 0; p2 < portals.length; p2++) {
      var pp = portals[p2];
      if (Math.hypot(tokM.position.x - pp.center.x, tokM.position.y - pp.center.y) <= pp.radius) {
        candidates.push({ id: tokM.id, portal: pp });
        break;
      }
    }
  }
  if (suppress || portalDestOpen || !candidates.length) return;
  var origin = candidates[0];
  var dests = portalDestinations(allPortals, origin.portal.itemId);
  if (!dests.length) return;
  var tokenIds = [];
  for (var s2 = 0; s2 < sel.length; s2++) if (tokenMap[sel[s2]]) tokenIds.push(sel[s2]);
  for (var c2 = 0; c2 < candidates.length; c2++) if (tokenIds.indexOf(candidates[c2].id) < 0) tokenIds.push(candidates[c2].id);
  var triggerKey = origin.portal.itemId + "|" + tokenIds.slice().sort().join(",");
  var triggerNow = Date.now();
  if (triggerKey === portalDestLastKey && triggerNow - portalDestLastAt < 500) {
    pageLog("info", "portal dest skip（500ms 内重复触发）");
    return;
  }
  portalDestLastKey = triggerKey;
  portalDestLastAt = triggerNow;
  try {
    await openDestinationPopover(origin.portal.itemId, tokenIds);
  } catch (e5) {
    portalDestOpen = false;
    pageLog("err", "打开传送目的地选择失败：" + errText(e5));
  }
}

function resetPortalDestOpen() { portalDestOpen = false; }

var booted = false;
var bootStatus = { tool: false, menu: false, button: false, scene: false };

async function syncSceneButton() {
  if (!booted) return false;
  if (await sceneReady()) {
    bootStatus.scene = true;
    try {
      await openButton();
      return true;
    } catch (e) {
      if (!bootStatus.button) stepFail("打开右下角浮动按钮", e);
      return false;
    }
  }
  await closeButton();
  await closeInfo();
  return false;
}

async function sendHello(channel, payload) {
  try {
    await OBR.broadcast.sendMessage(channel, payload, { destination: "LOCAL" });
  } catch (e) {
    pageLog("err", "broadcast 失败：" + errText(e));
  }
}

/* ---- 10. 启动：工具栏 ×4 / 右键 / 浮动按钮 / 各频道订阅 ---- */
async function boot() {
  if (booted) return;
  booted = true;
  var t0 = Date.now();

  pageLog("info", "OBR.onReady 触发；插件 v" + PLUGIN_VERSION + "；BASE=" + BASE);
  try { roomAuditLog(await OBR.room.getMetadata(), {}); } catch (eAudit) { /* 忽略 */ }
  pageLog("info", "OBR.isAvailable=" + String(OBR.isAvailable) + "；isReady=" + String(OBR.isReady));

  bootStatus.tool = await attempt("注册工具栏按钮 (OBR.tool.create ×4)", registerTools);

  bootStatus.menu = await attempt("注册右键菜单 (OBR.contextMenu.create)", registerContextMenu);

  bootStatus.scene = await sceneReady();
  bootStatus.button = await syncSceneButton();
  if (bootStatus.button) stepOk("打开右下角浮动按钮 ✓");
  else if (!bootStatus.scene) stepOk("场景还没就绪，浮动按钮等进入地图后再开");

  markStripClosed(false);
  markDiceHistClosed(false);
  markDiceClosed(false);
  await refreshInitKnownTokens();

  /* v2.5：GM 启动时把旧「房间/场景整份先攻名单」迁到 token metadata + 场景 combat（只做一次）。 */
  await attempt("迁移旧先攻名单到 token metadata（GM）", migrateInitiativeFromLegacy);
  /* v1.9.2：延迟 800ms 自动开骰子记录窗口（别和 1.5s 的静态资源预热抢）。 */
  setTimeout(function () { void maybeAutoOpenDiceHistory(); }, 800);
  setTimeout(function () { void maybeAutoOpenDice(); }, 900);

  await attempt("订阅 scene.onReadyChange", function () {
    OBR.scene.onReadyChange(function (ready) {
      void syncSceneButton();
      scheduleBars();

      void refreshInitKnownTokens();
      if (ready !== false) {
        void migrateInitiativeFromLegacy();
        void maybeAutoOpenStrip("进入房间自动显示先攻条");
        setTimeout(function () { void maybeAutoOpenDiceHistory(); }, 800);
        setTimeout(function () { void maybeAutoOpenDice("进入房间自动打开骰子（换场景）"); }, 900);
      }
    });
  });
  await attempt("订阅 player.onChange", function () {
    OBR.player.onChange(scheduleRefresh);
  });
  await attempt("订阅 scene.items.onChange", function () {
    OBR.scene.items.onChange(function () {
      scheduleRefresh();
      scheduleBars();

      scheduleInitPrune();
    });
  });
  await attempt("订阅 scene.grid.onChange（血条尺寸）", function () {
    if (!OBR.scene.grid || typeof OBR.scene.grid.onChange !== "function") return;
    OBR.scene.grid.onChange(function () {
      cachedDpi = 0;
      scheduleBars();
    });
  });
  await attempt("订阅 room.onMetadataChange", function () {
    OBR.room.onMetadataChange(function (meta) {
      void meta;
      scheduleRefresh();
    });
  });
  await attempt("订阅 scene.onMetadataChange（场景兜底存储）", function () {
    if (!OBR.scene || typeof OBR.scene.onMetadataChange !== "function") return;
    OBR.scene.onMetadataChange(function (meta) {
      void meta;
      scheduleRefresh();
      scheduleBars();
    });
  });
  await attempt("订阅 " + CH_INFO_SIZE + "（速览窗自动高度）", function () {
    OBR.broadcast.onMessage(CH_INFO_SIZE, onInfoSize);
  });
  await attempt("订阅 " + CH_INFO_DRAG + "（速览弹窗拖动）", function () {
    OBR.broadcast.onMessage(CH_INFO_DRAG, onInfoDrag);
  });
  await attempt("订阅 " + CH_DICE_ROLL + "（所有客户端后台直接开全屏动画）", function () {
    OBR.broadcast.onMessage(CH_DICE_ROLL, async function (ev) {
      var d = ev && ev.data ? ev.data : null;
      var reason = diceRollRejectReason(d);
      if (!reason && !diceRollValid(d)) reason = "invalid";
      if (reason) {
        pageLog("info", "dice roll rejected reason=" + reason);
        if (await isLocalRollSender(ev, d)) notify(reason === "too-many" ? DICE_MSG_TOO_MANY : reason === "too-big" ? DICE_MSG_TOO_BIG : "本次投掷内容无效，已忽略", "WARNING");
        return;
      }
      var client = String((ev && (ev.connectionId || ev.playerId)) || d.rollerId || "?");
      var now = Date.now();
      if (diceRollLastBy[client] && now - diceRollLastBy[client] < DICE_ROLL_MIN_MS) {
        pageLog("info", "dice roll throttled client=" + client);
        if (await isLocalRollSender(ev, d)) notify(DICE_MSG_TOO_FAST, "WARNING");
        return;
      }
      diceRollLastBy[client] = now;
      void openDiceFx(d);
    });
  });
  await attempt("订阅 " + CH_DICE_CLEAR + "（清场关闭动画）", function () {
    OBR.broadcast.onMessage(CH_DICE_CLEAR, function (ev) {
      var d = ev && ev.data ? ev.data : {};
      closeDiceFx(d);
      pageLog("info", "dice fx clear roll=" + (d.rollId || "all"));
    });
  });
  await attempt("订阅 " + CH_INIT_JOIN + "（玩家请求加入先攻）", function () {
    OBR.broadcast.onMessage(CH_INIT_JOIN, onInitJoinRequest);
  });
  await attempt("订阅 " + CH_INIT_JOIN_ACK + "（加入先攻结果）", function () {
    OBR.broadcast.onMessage(CH_INIT_JOIN_ACK, onInitJoinAck);
  });
  await attempt("订阅 " + CH_INIT_REQUEST + "（玩家结束回合）", function () {
    OBR.broadcast.onMessage(CH_INIT_REQUEST, onInitRequest);
  });
  await attempt("订阅 " + CH_WIN_DRAG + "（独立窗口拖动）", function () {
    OBR.broadcast.onMessage(CH_WIN_DRAG, onWinDrag);
  });
  await attempt("订阅 " + CH_STRIP_DRAG + "（先攻条拖动）", function () {
    OBR.broadcast.onMessage(CH_STRIP_DRAG, onStripDrag);
  });
  await attempt("订阅 " + CH_STRIP_CMD + "（先攻条命令：列表 / 尺寸）", function () {
    OBR.broadcast.onMessage(CH_STRIP_CMD, onStripCmd);
  });

  await attempt("订阅 " + CH_WIN_RESIZE + "（窗口调整大小）", function () {
    OBR.broadcast.onMessage(CH_WIN_RESIZE, onWinResize);
  });
  await attempt("订阅 " + CH_WIN_CLOSE + "（窗口 ✕ 兜底）", function () {
    OBR.broadcast.onMessage(CH_WIN_CLOSE, onWinClose);
  });
  /* v1.8.2：先攻条点卡片头像时，页面先发这条 → 后台 1.5s 内不自动弹速览（token 仍会选中高亮）。 */
  await attempt("订阅 " + CH_GLANCE_SUPPRESS + "（先攻条点卡片：暂不弹速览）", function () {
    OBR.broadcast.onMessage(CH_GLANCE_SUPPRESS, function () {
      suppressGlanceUntil = Date.now() + 1500;
    });
  });
  /* v1.9.2：骰子历史不再落房间数据；GM 启动时把旧 KEY_ROLLS 迁移到本机并清空房间残留。 */
  await attempt("迁移房间旧骰子历史到本机（GM）", function () {
    return migrateRollsFromRoom();
  });
  await attempt("订阅 " + CH_ROLL_CLEAR + "（清空骰子记录）", function () {
    OBR.broadcast.onMessage(CH_ROLL_CLEAR, onRollClear);
  });
  await attempt("订阅 " + CH_DICE_HIST_CMD + "（记录窗口开关）", function () {
    OBR.broadcast.onMessage(CH_DICE_HIST_CMD, onDiceHistCmd);
  });
  await attempt("订阅 " + CH_HP_EDIT_READY + "（血条编辑窗握手）", function () {
    OBR.broadcast.onMessage(CH_HP_EDIT_READY, onHpEditReady);
  });
  await attempt("订阅 " + CH_HP_EDIT_SAVED + "（血条编辑窗保存）", function () {
    OBR.broadcast.onMessage(CH_HP_EDIT_SAVED, onHpEditSaved);
  });
  await attempt("订阅 " + CH_HPEDIT_LOG + "（血条编辑窗日志）", function () {
    OBR.broadcast.onMessage(CH_HPEDIT_LOG, function (ev) {
      var d = ev && ev.data !== undefined ? ev.data : ev;
      if (!d || typeof d.msg !== "string") return;
      try { console.log("[4enext][hpEdit] " + d.msg); } catch (e) { /* 忽略 */ }
    });
  });
  await attempt("订阅 " + CH_HP_REPAINT + "（血条编辑窗重绘）", function () {
    OBR.broadcast.onMessage(CH_HP_REPAINT, onHpRepaint);
  });
  await attempt("订阅 " + CH_HP_EDIT_ACK + "（血条编辑窗切换 ack）", function () {
    OBR.broadcast.onMessage(CH_HP_EDIT_ACK, onHpEditAck);
  });
  /* v1.8.9：信息窗页面 ready → 重发当前 target（防第一条 target 在 iframe 加载前丢掉）。 */
  await attempt("订阅 " + CH_INFO_READY + "（速览页 ready 握手）", function () {
    OBR.broadcast.onMessage(CH_INFO_READY, onInfoReady);
  });
  /* v1.9.0：页面刷新成功的 ack（同一 session + version ≥ pending 才清兜底计时器）。 */
  await attempt("订阅 " + CH_INFO_ACK + "（速览页刷新 ack）", function () {
    OBR.broadcast.onMessage(CH_INFO_ACK, onInfoAck);
  });
  /* v2.5.1：OBR SDK 没有 viewport.onChange → 安装 500ms 轮询重锚。
   * 视口变化时：按钮重新 open 到右下角（同 id+url），各窗口 / 先攻条用新 vp reclamp。 */
  await attempt("重建传送门 ghost（启动）", async function () {
    try {
      if (await sceneReady()) {
        var allGhost = await OBR.scene.items.getItems();
        await portalGhostSync(allGhost);
      }
    } catch (eGhostBoot) { /* 场景没准备好就等 onChange 重建 */ }
    return true;
  });
  await attempt("清理旧传送门窗口残留（boot）", function () {
    try { void OBR.popover.close(ID_PORTAL_DEST); } catch (e1) {  }
    try { void OBR.popover.close(ID_PORTAL_EDIT); } catch (e2) {  }
    try { void OBR.popover.close(portalOldDestId); } catch (e3) {  }
    pageLog("info", "portal dest 清理残留");
    return true;
  });
  await attempt("安装视口轮询重锚（500ms）", function () {
    addViewportAnchorListener(function (vp) {
      return (async function () {
        await reanchorButton(vp);
        await reclampWins(vp);
        await reclampStrip(vp);
      })();
    });
    return true;
  });

  /* v2.5.1：传送门频道 + 拖动进门侦测。 */
  await attempt("订阅 " + CH_OPEN_SETTINGS + "（浮动按钮 → 设置）", function () {
    OBR.broadcast.onMessage(CH_OPEN_SETTINGS, function () { void openWinOrNotify("settings", "右下角设置按钮"); });
  });
  await attempt("订阅 " + CH_PORTAL_SAVE + "（传送门编辑保存）", function () {
    OBR.broadcast.onMessage(CH_PORTAL_SAVE, onPortalSave);
  });
  await attempt("订阅 " + CH_PORTAL_TELEPORT + "（传送门传送）", function () {
    OBR.broadcast.onMessage(CH_PORTAL_TELEPORT, onPortalTeleport);
  });
  await attempt("订阅 scene.items.onChange（传送门拖动侦测）", function () {
    OBR.scene.items.onChange(function () { void onPortalItemsChange(); });
  });
  await attempt("清理传送门预览残留（启动）", function () {
    void portalClearPreviewResidue("boot");
    return true;
  });
  await attempt("订阅 player.onChange（GM 选中传送门自动编辑）", function () {
    OBR.player.onChange(function () { void syncPortalEditFromSelection(); });
  });
  await attempt("订阅 " + CH_PORTAL_EDIT_CLOSE + "（编辑窗用户关闭）", function () {
    OBR.broadcast.onMessage(CH_PORTAL_EDIT_CLOSE, onPortalEditClosed);
  });

  void maybeAutoOpenStrip();

  await refreshInfo().catch(function (e) { stepFail("初始化速览", e); });

  await watchLocalBars();
  scheduleBars();

  /* v1.8.9：串行预热速览（info）会用到的静态资源，让首次 / 后续打开 iframe 直接命中 HTTP 缓存。
   * 启动 1500ms 后开始、不 await、失败静默（离线 / 网络慢不影响启动）；URL 带与页面一致的 ?v=。 */
  setTimeout(function () {
    var v = "?v=" + encodeURIComponent(PLUGIN_VERSION);
    var list = [
      pageUrl("info.html"),
      pageUrl("assets/ui.css") + v,
      pageUrl("assets/glance.css") + v,
      pageUrl("assets/info.js") + v,
      pageUrl("assets/common.js"),
      pageUrl("assets/window.js"),
      pageUrl("assets/glance.js") + v,
      pageUrl("assets/track.js") + v,
      pageUrl("vendor/obr-sdk.js"),
      pageUrl("data/rules.js"),
      pageUrl("data/card-index.js") + v
    ];
    var i = 0;
    function next() {
      if (i >= list.length) return;
      var url = list[i++];
      try {
        var p = fetch(url, { cache: "force-cache" });
        if (p && typeof p.then === "function") p.then(next, next);
        else next();
      } catch (e) { next(); }
    }
    try { next(); } catch (e) { /* 静默 */ }
  }, 1500);

  var mark = function (v) { return v ? "✓" : "✗"; };
  var okLine = "4eNEXT to owlbear v" + PLUGIN_VERSION + " 已加载：工具栏×4 " + mark(bootStatus.tool) +
    " · 右键" + mark(bootStatus.menu) +
    " · 浮动按钮" + (bootStatus.scene ? mark(bootStatus.button) : "（等进地图）");
  var allOk = bootStatus.tool && bootStatus.menu;
  pageLog(allOk ? "ok" : "err", okLine + "；耗时 " + (Date.now() - t0) + "ms");

  if (diagNotifyEnabled() && !allOk) notify(okLine, "WARNING");

  await sendHello(CH_HELLO, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
  try {
    OBR.broadcast.onMessage(CH_PING, function () {
      void sendHello(CH_PONG, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
    });
  } catch (e) {
    pageLog("err", "订阅 " + CH_PING + " 失败：" + errText(e));
  }
}

try {
  window.addEventListener("error", function (ev) {
    var msg = ev && ev.message ? ev.message : "脚本错误";
    pageLog("err", "未捕获错误：" + msg);
    if (booted) notify("4E插件出错（脚本异常）：" + msg, "ERROR");
  });
  window.addEventListener("unhandledrejection", function (ev) {
    var msg = errText(ev && ev.reason);
    pageLog("err", "未处理的 Promise 拒绝：" + msg);
    if (booted) notify("4E插件出错（异步异常）：" + msg, "ERROR");
  });
} catch (e) {  }

if (typeof OBR === "undefined" || !OBR || typeof OBR.onReady !== "function") {

  pageLog("err", "没有拿到 OBR 对象：vendor/obr-sdk.js 没拼进 bundle，或 SDK 加载失败");
  try {
    var stEl = document.getElementById("diag-state");
    if (stEl) { stEl.className = "bad"; stEl.textContent = "没有拿到 OBR 对象：右键菜单 / 先攻都不会工作"; }
  } catch (e2) {  }
  if (diagNotifyEnabled()) notify("4E 后台：没有拿到 OBR 对象，右键菜单 / 先攻都不会工作", "ERROR");
} else {

  try {
    OBR.onReady(boot);
  } catch (e3) {
    pageLog("err", "注册 OBR.onReady 失败：" + errText(e3));
    if (diagNotifyEnabled()) notify("4E 后台：注册 OBR.onReady 失败：" + errText(e3), "ERROR");
  }
}

/* ---- 只读调试钩子（v1.8.0）：
 * 暴露血条几何的纯函数与常数，供 dev/test-geometry.mjs 在 Node 里对**真实源码**做离线断言。
 * 只读：页面运行时没有任何代码会写这个对象；挂在 window 上也只是多一个引用。 */
if (typeof window !== "undefined") {
  window.__4eBar = {
    version: PLUGIN_VERSION,
    barLayout: barLayout,
    barSig: barSig,
    barRolesKey: barRolesKey,
    roundedRectPoints: roundedRectPoints,
    shieldPoints: shieldPoints,
    circlePoints: circlePoints,
    quantiseRatio: quantiseRatio,
    CONSTANTS: {
      SHIELD_DIAMETER: SHIELD_DIAMETER,
      DEF_CIRCLE_DIAMETER: DEF_CIRCLE_DIAMETER,
      DEF_CIRCLE_SEGMENTS: DEF_CIRCLE_SEGMENTS,
      SHIELD_INSET: SHIELD_INSET,
      DEF_GAP: DEF_GAP,
      HP_RING_THICK: HP_RING_THICK,
      HP_RING_INSET: HP_RING_INSET,
      HP_RING_SEGMENTS: HP_RING_SEGMENTS,
      HP_RING_BG_OPACITY: HP_RING_BG_OPACITY,
      COLOR_HP_FILL: COLOR_HP_FILL,
      COLOR_HP_BLOODIED: COLOR_HP_BLOODIED,
      COLOR_RING_BG: COLOR_RING_BG,
      DEF_CORNER: DEF_CORNER,
      DEF_COLORS: DEF_COLORS,
      DEF_ROW: DEF_ROW,
      DEF_DROP: DEF_DROP,
      BAR_Z: BAR_Z
    }
  };
  window.__4ePortal = {
    version: PLUGIN_VERSION,
    portalMeta: portalMeta,
    portalDestinations: portalDestinations,
    portalHexSpiral: portalHexSpiral,
    portalPlanTeleport: portalPlanTeleport,
    portalWallSegments: portalWallSegments,
    portalPointSafe: portalPointSafe,
    portalPathSafe: portalPathSafe,
    portalSegIntersect: portalSegIntersect,
    portalTokenRadius: portalTokenRadius,
    portalSuppressed: portalSuppressed,
    onPortalTeleport: onPortalTeleport,
    syncPortalEditFromSelection: syncPortalEditFromSelection,
    withWindowVersion: withWindowVersion,
    onPortalEditClosed: onPortalEditClosed,
    portalClearPreviewResidue: portalClearPreviewResidue,
    portalLifecycleSync: portalLifecycleSync,
    portalDragBegin: portalDragBegin,
    portalDragFinish: portalDragFinish,
    portalScaleFor: portalScaleFor,
    portalImageItem: portalImageItem,
    portalGhostSync: portalGhostSync,
    portalPairCreate: portalPairCreate,
    moveTokensWithFogBypass: moveTokensWithFogBypass,
    portalFogMetaKey: portalFogMetaKey,
    portalRadiusFromScale: portalRadiusFromScale,
    portalScaleRadiusSync: portalScaleRadiusSync,
    portalDetectDragEnd: portalDetectDragEnd,
    openDestinationPopover: openDestinationPopover,
    portalTeleportLanded: function () { return portalTeleportLanded; },
    onPortalSave: onPortalSave,
    portalSceneDpi: portalSceneDpi,
    registerPortalTool: registerPortalTool,
    CONSTANTS: {
      KEY_PORTAL: KEY_PORTAL,
      PORTAL_MIN_RADIUS: PORTAL_MIN_RADIUS,
      PORTAL_WALL_PADDING: PORTAL_WALL_PADDING,
      PORTAL_SUPPRESS_MS: PORTAL_SUPPRESS_MS,
      TOOL_PORTAL_ID: TOOL_PORTAL_ID,
      TOOL_PORTAL_MODE_ID: TOOL_PORTAL_MODE_ID,
      TOOL_PORTAL_PAIR_MODE_ID: TOOL_PORTAL_PAIR_MODE_ID,
      PORTAL_PREVIEW_TAG: PORTAL_PREVIEW_TAG
    }
  };
}

})();
