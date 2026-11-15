/*! 4eNEXT to owlbear · background.bundle.js  (v1.7.0)
 * ---------------------------------------------------------------------------
 * 这是后台页唯一加载的脚本：纯「经典脚本」，没有 type="module"，没有 import/export，
 * 不依赖任何 CDN。内容是：
 *   1) vendor/obr-sdk.js —— @owlbear-rodeo/sdk 3.1.0（esm.sh 打包），去掉末尾的 export{}
 *   2) assets/background.core.js —— 右键菜单 / 工具栏 / 浮动按钮 / token 血条 / 自诊断
 *
 * 不要手改本文件。改逻辑请改 assets/background.core.js，然后：
 *     node dev/build-background.mjs
 * 生成时间：2026-11-15T12:06:15.644Z
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

if (!OBR || typeof OBR.onReady !== "function") {
  try {
    document.title = "4E 后台：SDK 未初始化";
    var st = document.getElementById("diag-state");
    if (st) { st.className = "bad"; st.textContent = "SDK 未初始化：没有拿到 OBR 对象"; }
  } catch (e) { /* 忽略 */ }
  return;
}

/* ==================== 2/2  插件逻辑（assets/background.core.js） ==================== */
/* 4eNEXT to owlbear · 后台逻辑（单文件「经典脚本」，没有任何 import / export）
 * ---------------------------------------------------------------------------
 * 这个文件不直接给浏览器加载：dev/build-background.mjs 会把它和
 * vendor/obr-sdk.js（去掉末尾 export{}）拼成 assets/background.bundle.js，
 * background.html 只加载那一个 <script src>（不带 type="module"）。
 *
 * 约定：外层作用域已经提供了 OBR（@owlbear-rodeo/sdk 的 default export）。
 *
 * v1.3.1：功能拆成**各自独立的窗口**（不再是一个面板的三个 tab），每个窗口有自己的 popover id：
 *   · 速览       /info        选中绑定的 token 自动弹（页面 info.html，按 token 记位置）
 *   · 角色卡面板 /panel       导入 / 列表 / 预览（页面 panel.html，按窗口名记位置）
 *   · 先攻       /initiative-window  独立窗口（页面 initiative.html）
 *   · 骰子       /dice-window        独立窗口（页面 dice.html，内容 v1.5.0 实现）
 * v1.3.2：把工具栏补齐成「一排入口」，并新增设置窗口：
 *   · 速览也有了工具栏入口（没选中时给出「先选 token」的提示，不再静默）；
 *   · 设置/关于 /settings-window（页面 settings.html，左侧分栏 + 右侧内容，同样可拖动 / 视口夹紧）。
 * v1.4.0：先攻条（按 docs/spec-initiative.md 实现）
 *   · 工具栏「先攻」不再打开 880×640 的大窗口，而是打开**屏幕顶部的先攻条**：
 *     popover id /initiative-strip、CENTER/TOP 锚点、top 45、默认 720×129（展开）、120×40（折叠）；
 *     宽度 **v1.6.2 起固定 720**（只有视口太窄时才缩，下限 410；不再按控制行测量），高度按 phase 三档 129 / 139 / 159；
 *     位置只记「相对屏幕中线的偏移」（localStorage["4enext/strip-pos"]），整条可拖动、双击拖动柄回中。
 *   · 原来的列表窗口还留着（?view=list，id 仍是 /initiative-window），先攻条上的「≡」打开它：
 *     重掷全部 / 同步加值 / 上下移 / 删除 / 清空这些管理动作在那里。
 *   · 房间数据新增 phase / surprise / d20 / tb（只加字段、不改键名），条目上限 200 → 60；
 *     normalize 截断不抛错，写失败降级本机 localStorage["4enext/state/initiative"] 并通知。
 *   · 玩家「结束我的回合」仍然是广播请求，GM 侧按规格 §5 做四道校验（含「正在推进中」）。
 * v1.6.0：血条扩展 + Boss（按 docs/spec-hpbar-boss.md 的 P0–P3，选方案 A：token 附带）
 *   · HP 红条 + 临时生命 +N 仍在上（20s），新增**蓝色回复力条**在下（12s，间距 3s，共用 left/w）；
 *   · **四防四角盾**（AC / 强韧 / 反射 / 意志，直径 30s）：SDK 3.1.0 没有 RING / 盾牌图元，
 *     全部用 buildCurve().points() 手绘（盾形多边形 / 环形扇区 / 名牌 / 锁）；
 *   · 右键菜单新增「添加 / 移除血条组件」（独立键 hp-bar/enabled，关闭写 false 不 delete）
 *     与「显示为 Boss / 隐藏 Boss」（hp.boss，布尔或对象都读，写回一律对象）；
 *   · Boss 样式（方案 A）：环形血条（48 段）+ 名牌 + 分段线 + 锁，**压制 HP 普通条**
 *     （回复力条与四防保留）；玩家端 locked 时按 25% 阶梯向上取整、不画数字与四防。
 * v1.6.1：四防从「四角」改「一排」（用户截图对照 Full Suite 图 2，真机 v1.6.0 已跑通）
 *   · 顺序固定 **强韧 → 反射 → 意志 → AC**（AC 永远最右，半透明白色图标：fill 白 @0.18 + 白描边 @0.85），
 *     整排在 HP 红条上方 gap 处，同一行（y 相同）、x 递增；圆心间距 = 盾直径 + DEF_GAP(6s)；
 *   · 窄 token 退化（写死规则）：宽度放不下四枚时**优先保留 AC**，再依次丢意志 / 反射 / 强韧；
 *     一枚都放不下、或这一排会顶出 token 上沿 → 整排不画（四防仍可在速览面板里看）；
 *   · 只动四防的摆位与样式：HP 文本 / 蓝条 / 环 / Boss 环 / 锁的数值与位置一律不变。
 * v1.7.0：骰子记录搬成独立窗口 + 投骰动画（按 docs/spec-dice.md §4 的公式，参考 FullPeople/obr-suite）
 *   · 骰子记录从骰子窗口右栏搬出来，变成**第二个独立 popover** /dice-history-window
 *     （页面 dice-history.html，注册进 WINS.diceHistory，沿用 window.js 的拖动 / 位置记忆 / 视口夹紧）；
 *     骰子窗口随之变窄（760×620 → 520×620，只留骰子 / 表达式 / 本次结果 / 预设 / 组合）；
 *   · 两个窗口独立开关：骰子窗口的「记录窗口」按钮发 CH_DICE_HIST_CMD，本文件开 / 关并回
 *     CH_DICE_HIST_STATE（页面据此显示开 / 关）；
 *   · 投骰动画页 effect.html 由**骰子窗口**在算完结果后用 OBR.modal.open 打开
 *     （全屏 + 透明 + disablePointerEvents，不挡地图）；公式在 assets/dice-core.js（纯函数，node 可测）。
 *   · 落库规则不变：仍然「新的在前 + 超过 40 条删最旧」。
 * v1.6.2：两处收尾修复
 *   ① 速览弹窗删掉 HP 绿条下面那条「彩色四防箭头条」（assets/glance.js 的 .gl4-def-row）——
 *      四防数值仍由下面的四张数值卡（.gl4-defs）显示；token 上的四防一排（v1.6.1）一个字没动；
 *   ② 先攻条**宽高改成常量**：折叠 120×40 / 展开 720（仅视口太窄时缩）×(129|139|159)。
 *      v1.6.1 的页面量的是控制行 scrollWidth → 投骰后点数 / 名字一变整条就变窄（用户报的 bug）。
 *      现在页面只算常量，本文件的 snapStripSize() 再把页面报上来的尺寸兜回常量；
 *      卡片区 .strip-items 内部横向滚动，条右侧空列表区域保持深色（不透明）。
 * v1.5.0：骰子（按 docs/spec-dice.md 的 P0–P3，用户拍板覆盖 D1–D3）
 *   · 骰子窗口从 660×560 加宽到 760×620（仍按视口夹紧），两栏：组公式 / 结果 + 团队历史；
 *   · 规则全在 assets/dice-core.js（纯函数），4E 预设在 assets/dice-4e.js；本文件只负责**城主落库**：
 *     收 CH_ROLL → 校验归一化（同 dice-core 的 rollNorm）→ 幂等合并（同 rollId 不重复插）→
 *     写房间数据 com.4enext-owlbear/rolls（rows 上限 40）→ 广播 CH_ROLL_SAVED；
 *   · 不做命中判定 / 豁免判定 / 优势劣势 / 暗骰（用户拍板）：载荷里没有 target / hit。
 * 入口：
 *   1) manifest.action   → 房间左上角的扩展图标（角色卡面板，由 manifest 提供、不依赖本文件）
 *   2) OBR.tool.create×5 → 左侧工具栏：速览 / 角色卡 / 先攻 / 骰子 / 设置（各开各的窗口）
 *   3) OBR.popover.open  → 右下角浮动 4E 按钮（角色卡面板，与参考实现 character-cards 相同写法）
 *   4) 右键 IMAGE token   → 绑定角色卡 / 加入先攻 / 隐形加入先攻（仅 GM）
 * 外加玩家「结束我的回合」请求（只由 GM 客户端落笔）。
 * 参考实现 FullPeople/obr-suite 也是「一个功能一个 popover」：inINIT 与 dice 各自有
 * POPOVER_ID + registerPanelBbox，面板之间靠 id 区分、可同时打开。
 *
 * 自诊断：每一步失败都 OBR.notification.show(..., "ERROR")，成功则在启动后汇总一条
 *        INFO 通知（可用 localStorage["4enext/diag"]="0" 关掉）。
 *        另外 background.html 里有一块页面内日志，直接打开 background.html 也能看到。
 * ------------------------------------------------------------------------- */

var NS = "com.4enext-owlbear";
var KEY_CARDS = NS + "/cards";
var KEY_BIND = NS + "/cardId";
var ID_BUTTON = NS + "/button";
var ID_INFO = NS + "/info";
var ID_PANEL = NS + "/panel";
var ID_BIND = NS + "/bind";
/* v1.3.1：先攻 / 骰子各自独立的 popover id（与 assets/common.js 的 ID_INIT_WIN / ID_DICE_WIN 必须一致）。 */
var ID_INIT_WIN = NS + "/initiative-window";
var ID_DICE_WIN = NS + "/dice-window";
/* v1.7.0：骰子记录是**另一个 popover**（与 assets/common.js 的 ID_DICE_HIST 必须一致）。
 * id 与骰子窗口不同 → 记录窗口和骰子窗口可以同时打开、各自关闭。 */
var ID_DICE_HIST = NS + "/dice-history-window";
/* v1.3.2：设置 / 关于窗口（与 assets/common.js 的 ID_SETTINGS_WIN 必须一致）。 */
var ID_SETTINGS_WIN = NS + "/settings-window";
/* v1.4.0：先攻条是**另一个 popover**（屏幕顶部居中的条），
 * id 与列表窗口 /initiative-window 不同 → 两个可以同时开着（与 assets/common.js 的 ID_STRIP 一致）。 */
var ID_STRIP = NS + "/initiative-strip";
var TOOL_ID = NS + "/panel-tool";      /* 旧 id 不变：工具栏里「角色卡」图标的位置不会跳 */
var TOOL_INIT_ID = NS + "/initiative-tool";
var TOOL_DICE_ID = NS + "/dice-tool";
/* v1.3.2：工具栏补的两个入口（速览 / 设置）。旧 id 一个都没动，老用户看到的图标顺序不会跳。 */
var TOOL_GLANCE_ID = NS + "/glance-tool";
var TOOL_SETTINGS_ID = NS + "/settings-tool";
var CH_HELLO = NS + "/diag-hello"; /* background → 各页面：我起来了 */
var CH_PING = NS + "/diag-ping";   /* 页面 → background：在吗 */
var CH_PONG = NS + "/diag-pong";   /* background → 页面：在，状态如下 */
var PLUGIN_VERSION = "1.7.0";
/* token 上的血量（与 assets/track.js 的 KEY_HP 必须一字不差）。 */
var KEY_HP = NS + "/hp";
/* v1.6.0：血条组件开关。**独立键**，不塞进 hp（hp 是数值容器，写开关会误触发判空）；
 * 语义照参考实现 hpBar：flag === false 才不画，undefined 视为画 → 老 token 升级后血条不消失。
 * 与 assets/common.js / assets/track.js 的同名常量必须一字不差。 */
var KEY_HPBAR = NS + "/hp-bar/enabled";
/* v1.6.0：玩家端量化阈值（场景元数据；全桌同一份，缺省 25%）。 */
var KEY_PLAYER_THRESHOLD = NS + "/settings.playerThreshold";

/* ---------------------------------------------------------------------------
 * v1.6.0 / v1.6.1 像素常数集中区（s = 1 时的数值；真机微调只改这里 + barLayout()）
 * ---------------------------------------------------------------------------
 * 说明见 docs/hpbar-boss-v16.md §3「像素常数集中表」。所有几何都由 s 缩放，
 * s = min(token 渲染宽, 高) / 网格 dpi，并夹在 0.2~6（上界防止 4×4 巨图把条画到屏外）。
 *   · HP 条 20 高、回复力条 12 高、两行间距 3（规格 §6.4 A）
 *   · 四防盾直径 30、离 token 内边 4；**v1.6.1 起是一排**（强韧 / 反射 / 意志 + AC 最右），
 *     盾与盾之间的水平间距 6（DEF_GAP），整排在 HP 条上方 3（gap）处（规格 §6.4 B 的四角已被 v1.6.1 取代）
 *   · Boss 环厚 10、内缩 2、48 段；名牌 26 高、离 token 顶 6（规格 §6.4 C/D）
 * zIndex 全部固定并 disableAutoZIndex：盾 15000 / 填充 20000 / 数值 30000，向下加密到 9500~31050。
 * ------------------------------------------------------------------------- */
var BAR_HP_H = 20;
var BAR_SURGE_H = 12;
var BAR_GAP = 3;
var BAR_PAD = 2;
var SHIELD_DIAMETER = 30;
var SHIELD_INSET = 4;
/* v1.6.1：四防改「一排」——相邻两枚盾之间空出的水平间隙（圆心间距 = 盾直径 + 这一段）。 */
var DEF_GAP = 6;
/* v1.6.1：AC 用半透明白色图标（强韧 / 反射 / 意志 仍是各自的实色）。 */
var DEF_AC_FILL_OPACITY = 0.18;
var DEF_AC_STROKE_OPACITY = 0.85;
var DEF_FILL_OPACITY = 0.9;
var DEF_STROKE_OPACITY = 0.45;
var BOSS_RING_THICK = 10;
var BOSS_RING_INSET = 2;
var BOSS_RING_SEGMENTS = 48;
var BOSS_PLATE_H = 26;
var BOSS_PLATE_GAP = 6;
var BOSS_MAX_SEGMENTS = 5;
var PLAYER_THRESHOLD_DEFAULT = 25;

/* 颜色一律取 assets/ui.css 的 :root（--blue / --green / --red / --orange / --line / --bg），
 * 不引入第二套色板（规格 §6.4 E 的结论）。 */
var COLOR_HP_BG = "#A4A4A4";
var COLOR_HP_FILL = "#a52424";
var COLOR_SURGE_BG = "#1a222c";
var COLOR_SURGE_FILL = "#58a6ff";
var COLOR_BOSS_BG = "#0b0f14";
var COLOR_PLATE_STROKE = "#253040";
var COLOR_PLATE_TEXT = "#e6edf3";
var COLOR_PHASE_TEXT = "#e3b341";
var COLOR_LOCK_ON = "#f85149";
var COLOR_LOCK_OFF = "#93a1b0";
var COLOR_DIVIDER = "#281719";
var DEF_KEYS = ["ac", "fort", "reflex", "will"];
/* v1.6.1：摆位顺序（从左到右）——**AC 永远在最右边**。DEF_KEYS 是读取 / 签名顺序，不要混用。 */
var DEF_ROW = ["fort", "reflex", "will", "ac"];
/* v1.6.1：窄 token 放不下时的**丢弃顺序**（先丢意志 → 再丢反射 → 再丢强韧；AC 不在这张表里 = 最后才丢）。 */
var DEF_DROP = ["will", "reflex", "fort"];
/* v1.6.1：AC 改成「半透明白」（fill 白 + 白描边），三防沿用 v1.6.0 的橙 / 绿 / 紫。 */
var DEF_COLORS = { ac: "#ffffff", fort: "#e3b341", reflex: "#56d364", will: "#a371f7" };
/* role → zIndex（规格 §6.3） */
var BAR_Z = {
  "ring-bg": 9500,
  "ring-fill": 9800,
  "bar-bg": 10000,
  "surge-bg": 10500,
  "plate": 12000,
  "plate-text": 12400,
  "plate-phase": 12450,
  "shield": 15000,
  "shield-text": 16000,
  "bar-fill": 20000,
  "surge-fill": 20500,
  "divider": 22000,
  "bar-text": 30000,
  "surge-text": 30500,
  "lock-body": 31000,
  "lock-shackle": 31050
};
/* v1.3.0：token 上的先攻加值 / 房间数据里的先攻状态 / 玩家结束回合请求频道
 * （与 assets/common.js、assets/initiative.js 里的同名常量必须一字不差）。 */
var KEY_INIT = NS + "/init";
var KEY_INITIATIVE = NS + "/initiative";
var CH_INIT_REQUEST = NS + "/init-request";

var BUTTON_SIZE = 64;
var RIGHT_OFFSET = 12;
var BOTTOM_OFFSET = 92;
/* v1.2.1：速览弹窗整体加宽（400 宽时 HP 行 / 数值行 / 属性三列都挤），并保证小屏不超出视口。 */
var INFO_W = 660;
var INFO_H = 700;
var INFO_MIN_W = 360;

/* v1.2.2：速览弹窗「可自由拖动」。手感 / 边界都在这几个常量里（说明：docs/popover-drag.md）。
 *   INFO_TOKEN_GAP     自动定位时，弹窗底边与 token 顶边的间距
 *   INFO_VIEW_MARGIN   拖动 / 夹取时离视口边缘的最小距离（取 16：与 MUI Popover 的默认
 *                      marginThreshold 对齐，避免贴边时 OBR 又替我们挪 8px、拖动跟着跳）
 *   INFO_DRAG_IDLE_MS  拖动中这么久没收到消息就当结束（兜住丢失的 pointerup）
 *   INFO_POS_MAX       最多记住多少枚 token 的弹窗位置
 * INFO_POS_KEY / CH_INFO_DRAG 与 assets/common.js 里的同名常量必须一字不差
 * （后台是经典脚本，不能 import）。
 */
var INFO_TOKEN_GAP = 8;
var INFO_VIEW_MARGIN = 16;
var INFO_DRAG_IDLE_MS = 1500;
var INFO_POS_MAX = 40;
var INFO_POS_KEY = "4enext/info-pos";
var CH_INFO_DRAG = NS + "/info-drag";

/* v1.3.1：先攻 / 骰子 / 角色卡面板三个「独立窗口」的拖动与位置记忆
 * （与 assets/common.js 的 WIN_POS_KEY / CH_WIN_DRAG / WIN_DRAG_THROTTLE_MS 必须一字不差）。
 * 与速览弹窗的区别：速览按 token 记位置，这三个窗口各按**窗口名**记一份。 */
var WIN_MARGIN = 16;
var WIN_DRAG_IDLE_MS = 1500;
var WIN_POS_KEY = "4enext/win-pos";
var CH_WIN_DRAG = NS + "/win-drag";
/* v1.7.0：骰子记录窗口的开关命令 / 状态回执（与 assets/common.js 必须一字不差）。
 * CH_DICE_HIST_CMD   骰子窗口 → 后台：{ op: "toggle" | "open" | "close" }
 * CH_DICE_HIST_STATE 后台 → 所有页面：{ open: bool }（骰子窗口的按钮据此显示开 / 关） */
var CH_DICE_HIST_CMD = NS + "/dice-hist-cmd";
var CH_DICE_HIST_STATE = NS + "/dice-hist-state";

/* v1.4.0：先攻条（规格 §3.1 / §3.2）。
 * 与 assets/initiative.js 里的 STRIP_* 必须一字不差（dev/check.mjs 会对比两边的数字）。
 *   · 折叠 120×40；展开 720×(129 idle / 139 preparing / 159 combat)，最小 410，按视口 −32 夹紧
 *     **v1.6.2：宽高是常量，不按内容测量**（v1.6.1 按 .strip-ctl 的 scrollWidth 算宽度，
 *     投骰后点数 / 名字一变整条就跟着变窄 —— 现在页面报上来的尺寸还会被 snapStripSize() 兜一道，
 *     内容再长由 .strip-items 内部横向滚动）
 *   · 始终贴在视口顶部的 TOP_OFFSET（45），以屏幕中线为锚点左右伸缩（CENTER/TOP）
 *   · 位置记忆只存「相对中线的偏移」{ v:1, dx, dy }，换屏幕 / 缩放后仍然贴顶居中 */
var STRIP_COLLAPSED_W = 120;
var STRIP_COLLAPSED_H = 40;
var STRIP_EXPANDED_W = 720;
var STRIP_MIN_EXPANDED_W = 410;
var STRIP_H_IDLE = 129;
var STRIP_H_PREPARING = 139;
var STRIP_H_COMBAT = 159;
var STRIP_TOP_OFFSET = 45;
var STRIP_SIDE_MARGIN = 16;
var STRIP_POS_KEY = "4enext/strip-pos";
var CH_STRIP_DRAG = NS + "/strip-drag";
var CH_STRIP_CMD = NS + "/strip-cmd";

/* v1.5.0：骰子（团队共享）。
 * 与 assets/common.js 的 CH_ROLL / CH_ROLL_CLEAR / CH_ROLL_SAVED / KEY_ROLLS / ROLL_MAX_ROWS
 * 必须一字不差（后台是经典脚本，不能 import；dev/check.mjs 会逐项对比）。
 *   · 投掷由**页面**广播，本文件只做城主侧的校验 / 合并 / 落库；
 *   · 房间数据上限仍按 16 KB 预算：rows 封顶 40（规格 §1.6），label 40 字、expression 200 字、
 *     单条最多 30 颗骰子（超出截断并标 truncated）。 */
var CH_ROLL = NS + "/roll";
var CH_ROLL_CLEAR = NS + "/roll-clear";
var CH_ROLL_SAVED = NS + "/roll-saved";
var KEY_ROLLS = NS + "/rolls";
var ROLL_MAX_ROWS = 40;
var ROLL_MAX_DICE = 30;
var ROLL_LABEL_MAX = 40;
var ROLL_EXPR_MAX = 200;
var ROLL_ROOM_BYTES = 12000;
var ROLL_COLOR_DEFAULT = "#5dade2";

/* ---------------------------------------------------------------------------
 * 0) 站点根地址
 *    参考实现（character-cards/src/background.ts 第 7~11 行）把 panel/info/bind
 *    的网址写成了绝对地址，而不是从 import.meta.url 推算。这里同样不依赖
 *    import.meta.url（它在 OBR 的 iframe 里未必是页面地址），改用背景页自己的
 *    location —— background.html 永远在插件根目录。
 * ------------------------------------------------------------------------- */
var BASE = (function () {
  try {
    var u = new URL("./", location.href);
    if (/^(https?:|file:)$/.test(u.protocol)) return u.href;
  } catch (e) { /* 忽略 */ }
  try { return new URL("./", document.baseURI).href; } catch (e) { /* 忽略 */ }
  return "https://yzzj66.github.io/4e-obr-cards/";
})();

function pageUrl(name) { return BASE + name; }

var ICON_URL = pageUrl("icon.svg");
var TOOL_ICON_URL = pageUrl("icon-tool.svg");
/* 入口图标风格统一（同一套 24×24 线性图标），用文件上的小徽标区分：列表 / 旗 / 骰子 */
var TOOL_INIT_ICON_URL = pageUrl("icon-tool-initiative.svg");
var TOOL_DICE_ICON_URL = pageUrl("icon-tool-dice.svg");
/* v1.3.2：速览（眼睛）/ 设置（滑杆）两个图标，仍是同一套 24×24 细线圆角风格。 */
var TOOL_GLANCE_ICON_URL = pageUrl("icon-tool-glance.svg");
var TOOL_SETTINGS_ICON_URL = pageUrl("icon-tool-settings.svg");
var URL_PANEL = pageUrl("panel.html");
var URL_INFO = pageUrl("info.html");
/* v1.3.1：先攻 / 骰子各自独立的窗口页。 */
var URL_INITIATIVE = pageUrl("initiative.html");
var URL_DICE = pageUrl("dice.html");
/* v1.7.0：骰子记录窗口（独立 popover）。
 * 投骰动画页（effect.html）由**骰子窗口**自己 OBR.modal.open，后台不参与 ——
 * 它不是可拖动的窗口，所以不注册进 WINS，也没有 URL 常量（地址在 assets/common.js 的 URL_EFFECT）。 */
var URL_DICE_HIST = pageUrl("dice-history.html");
/* v1.3.2：设置 / 关于窗口页。 */
var URL_SETTINGS = pageUrl("settings.html");
var URL_BIND = pageUrl("bind.html");
var URL_BUTTON = pageUrl("button.html");

/* ---------------------------------------------------------------------------
 * 1) 自诊断小工具
 * ------------------------------------------------------------------------- */
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
  } catch (e) { /* 没有诊断 DOM 就算了 */ }
  try {
    if (kind === "err") console.error("[4enext]", line);
    else console.log("[4enext]", line);
  } catch (e) { /* 忽略 */ }
}

function diagNotifyEnabled() {
  try { return localStorage.getItem("4enext/diag") !== "0"; } catch (e) { return true; }
}

function notify(msg, variant) {
  try {
    return OBR.notification.show(msg, variant || "DEFAULT");
  } catch (e) {
    pageLog("err", "OBR.notification.show 失败：" + (e && e.message ? e.message : e));
    return null;
  }
}

function errText(e) {
  if (!e) return "未知错误";
  return e.message || e.reason || String(e);
}

/** 记录失败：页面日志 + ERROR 通知（不会重复弹同一条）。 */
var seenErrors = {};
function stepFail(where, e) {
  var msg = where + " —— " + errText(e);
  pageLog("err", msg);
  if (seenErrors[msg]) return;
  seenErrors[msg] = true;
  notify("4E插件出错：" + msg, "ERROR");
}

function stepOk(text) { pageLog("ok", text); }

/** 包一层 try/catch：同步版。返回 true/false。 */
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

/* ---------------------------------------------------------------------------
 * 2) 独立窗口（v1.3.1：先攻 / 骰子 / 角色卡面板都是各自一个 popover）
 * ---------------------------------------------------------------------------
 * 为什么要重写这一段：
 *   · v1.3.0 用一个大面板装三个 tab，用户明确不要（每个功能应该是独立的块/窗口）；
 *   · 面板常常**超出视口**（底部被切掉）—— 所以打开前必须用
 *     OBR.viewport.getWidth()/getHeight() 夹紧：宽 ≤ 视口宽 − 2×margin，
 *     高 ≤ 视口高 − 2×margin（margin = WIN_MARGIN = 16）；
 *   · 每个窗口各记各的位置（localStorage["4enext/win-pos"]，按窗口名），
 *     拖动沿用 v1.2.2 速览弹窗那一套：页面只发「起点 + 累计位移」，这里换算 / 夹取 / 落盘。
 * 参考实现 FullPeople/obr-suite 的做法一致：每个模块有自己的 POPOVER_ID，
 * 打开时 registerPanelBbox 记几何、BC_PANEL_DRAG_END 记拖动后的位置。
 * ------------------------------------------------------------------------- */
var WINS = {
  /* 角色卡 / 导入面板：比速览大一点，但同样按视口夹紧；内部列表与预览各自滚动。 */
  panel: { id: ID_PANEL, url: URL_PANEL, width: 960, height: 660 },
  /* v1.4.0：先攻的大窗口变成「列表窗口」（先攻条上的 ≡ 打开它），地址带 ?view=list。 */
  initiative: { id: ID_INIT_WIN, url: URL_INITIATIVE + "?view=list", width: 880, height: 640 },
  /* v1.7.0：骰子窗口**变窄**（760×620 → 520×620）——记录搬去独立的记录窗口，
   * 这里只放骰子 / 表达式 / 本次结果 / 4E 预设 / 组合（单列）。
   * 仍然走 winSize() 夹紧：小屏（如 1366×768）下实际尺寸 ≤ 视口 − 2×WIN_MARGIN。 */
  dice: { id: ID_DICE_WIN, url: URL_DICE, width: 520, height: 620 },
  /* v1.7.0：独立记录窗口（默认只显示最近 4 条，可展开全部；位置按窗口名单独记住）。 */
  diceHistory: { id: ID_DICE_HIST, url: URL_DICE_HIST, width: 380, height: 380 },
  /* v1.3.2：设置 / 关于。左侧分栏 + 右侧内容，860×620 在 1366×768 上也放得下。 */
  settings: { id: ID_SETTINGS_WIN, url: URL_SETTINGS, width: 860, height: 620 }
};
/* name -> { geom: {left,top,width,height,url,vp}, drag, timer } */
var winOpen = {};
/* 拖动中待应用的位置（按窗口名合并，上一帧还没 open 完就只留最后一个） */
var winDragWanted = {};
var winDragBusy = false;

function winDef(name) {
  return WINS[name] || null;
}

/** 窗口尺寸：取「默认值」与「视口 − 2×margin」的较小者，绝不超出视口。 */
function winSize(def, vp) {
  var availW = (vp && vp.width > 0 ? vp.width : def.width) - WIN_MARGIN * 2;
  var availH = (vp && vp.height > 0 ? vp.height : def.height) - WIN_MARGIN * 2;
  return {
    width: Math.round(Math.min(def.width, Math.max(240, availW))),
    height: Math.round(Math.min(def.height, Math.max(220, availH)))
  };
}

/** 没有记住过位置时的默认点：水平居中、稍微偏上（不挡住 token 区）。 */
function winDefaultPos(size, vp) {
  var vw = vp && vp.width > 0 ? vp.width : size.width + WIN_MARGIN * 2;
  var vh = vp && vp.height > 0 ? vp.height : size.height + WIN_MARGIN * 2;
  return clampInfoPos(
    (vw - size.width) / 2,
    Math.max(WIN_MARGIN, (vh - size.height) * 0.35),
    size, vp
  );
}

/* ---- 位置记忆：localStorage["4enext/win-pos"] = { v:1, pos: { <name>: {left,top} } } ---- */
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
    localStorage.setItem(WIN_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) { /* 隐私模式 / 空间满：记不住位置不影响用 */ }
}

function clearWinPos(name) {
  if (!name) return;
  try {
    var map = readWinPosMap();
    delete map[name];
    if (!Object.keys(map).length) localStorage.removeItem(WIN_POS_KEY);
    else localStorage.setItem(WIN_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) { /* 忽略 */ }
}

/** popover 参数：一律按「左上角」定位（与速览弹窗同一套字段写法）。 */
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

/** 打开（或按记住的位置重开）一个独立窗口。 */
async function openWin(name) {
  var def = winDef(name);
  if (!def) throw new Error("未知窗口：" + name);
  var vp = await infoViewport();
  var size = winSize(def, vp);
  var saved = readWinPos(name);
  var pos = saved ? clampInfoPos(saved.left, saved.top, size, vp) : winDefaultPos(size, vp);
  await OBR.popover.open(winPopoverOptions(def, pos, size, def.url));
  winOpen[name] = {
    geom: {
      left: pos.left, top: pos.top, width: size.width, height: size.height,
      url: def.url, vp: { width: vp.width, height: vp.height }
    },
    drag: null,
    timer: null
  };
  return true;
}

async function closeWin(name) {
  var st = winOpen[name];
  if (st && st.timer) { clearTimeout(st.timer); st.timer = null; }
  delete winOpen[name];
  var def = winDef(name);
  if (!def) return;
  try { await OBR.popover.close(def.id); } catch (e) { /* 已经关了 */ }
}

/** 「回到默认位置」：清掉记住的位置，重新居中摆一次。 */
async function resetWin(name) {
  if (!winOpen[name]) return;
  var def = winDef(name);
  var vp = await infoViewport();
  var size = winSize(def, vp);
  var pos = winDefaultPos(size, vp);
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

/* ---- 拖动：页面（assets/window.js）只发「起点 + 累计位移」 ---- */
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

/** 拖动中这么久没消息就当结束：兜住指针跑出 iframe、页面被重载导致的丢 pointerup。 */
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

/** 频道：com.4enext-owlbear/win-drag，payload = { win, phase: start/move/end/reset, dx, dy }。 */
function onWinDrag(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.phase !== "string") return;
  var name = String(data.win == null ? "" : data.win);
  var st = winOpen[name];
  /* 不是我们自己开的窗口（比如左上角 action 弹窗里的同一个页面）→ 忽略，
     免得「在 action 弹窗里拖」把另一个 popover 挪走。 */
  if (!st || !st.geom) return;

  if (data.phase === "reset") {
    clearWinPos(name);
    st.drag = null;
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    void resetWin(name);
    return;
  }

  var dx = typeof data.dx === "number" && isFinite(data.dx) ? data.dx : 0;
  var dy = typeof data.dy === "number" && isFinite(data.dy) ? data.dy : 0;

  if (data.phase === "start" || !st.drag) {
    /* 起点 = 窗口现在的位置；move 一律按「起点 + 累计位移」算，不会越拖越偏。 */
    st.drag = { base: { left: st.geom.left, top: st.geom.top }, moved: false };
    touchWinDrag(name);
    if (data.phase === "start") return;
  }

  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) st.drag.moved = true;

  if (!st.drag.moved) {
    if (data.phase === "end") endWinDrag(name);
    return;
  }

  var target = clampInfoPos(st.drag.base.left + dx, st.drag.base.top + dy, st.geom, st.geom.vp);
  queueWinDrag(name, target);
  touchWinDrag(name);

  if (data.phase === "end") {
    writeWinPos(name, target);
    endWinDrag(name);
  }
}

/** 视口变小 / 换屏幕方向后，把开着的窗口重新夹回视口内。 */
async function reclampWins() {
  var names = Object.keys(winOpen);
  if (!names.length) return;
  var vp = await infoViewport();
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
    } catch (e) { /* 窗口已经关了，忽略 */ }
  }
}

/**
 * 打开角色卡面板：先按独立窗口开（可拖动 / 记位置 / 夹紧视口），
 * 不行再退回全屏 modal，最后退回 manifest action 弹窗。
 * 三层兜底是因为「打不开」对用户来说就是「点了没反应」。
 */
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

/** 打开先攻 / 骰子窗口：失败就让用户看见（通知里带原因），不静默。 */
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

/* ---------------------------------------------------------------------------
 * 2.4) 骰子记录窗口（v1.7.0）：独立 popover，与骰子窗口各自开关
 * ---------------------------------------------------------------------------
 * 为什么不让骰子窗口自己 OBR.popover.open：
 *   · 位置记忆 / 视口夹紧 / 拖动全在 WINS + winOpen 这一套里，页面自己开就对不上；
 *   · 记录窗口要能被「骰子窗口的按钮」和「它自己的 ✕」两边关，开 / 关状态只有后台知道。
 * 页面（assets/dice-page.js）只发 CH_DICE_HIST_CMD { op: "toggle"|"open"|"close" }，
 * 这里执行完广播 CH_DICE_HIST_STATE { open }（骰子窗口的按钮据此显示「记录窗口 · 开 / 关」）。
 * ------------------------------------------------------------------------- */
function diceHistoryIsOpen() {
  var st = winOpen["diceHistory"];
  return !!(st && st.geom);
}

function broadcastDiceHistState() {
  var payload = { open: diceHistoryIsOpen(), at: Date.now() };
  try {
    var p1 = OBR.broadcast.sendMessage(CH_DICE_HIST_STATE, payload, { destination: "LOCAL" });
    if (p1 && typeof p1.catch === "function") p1.catch(function () { /* 忽略 */ });
  } catch (e) { /* 忽略 */ }
  try {
    var p2 = OBR.broadcast.sendMessage(CH_DICE_HIST_STATE, payload, { destination: "REMOTE" });
    if (p2 && typeof p2.catch === "function") p2.catch(function () { /* 忽略 */ });
  } catch (e2) { /* 忽略 */ }
}

async function openDiceHistory() {
  if (diceHistoryIsOpen()) return true;
  try {
    await openWin("diceHistory");
    stepOk("骰子记录窗口：已打开");
    return true;
  } catch (e) {
    stepFail("打开骰子记录窗口", e);
    return false;
  }
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

/** 频道：com.4enext-owlbear/dice-hist-cmd，payload = { op }。 */
async function onDiceHistCmd(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var op = data && typeof data.op === "string" ? data.op : "toggle";
  try {
    if (op === "close") await closeDiceHistory();
    else if (op === "open") await openDiceHistory();
    else if (diceHistoryIsOpen()) await closeDiceHistory();
    else await openDiceHistory();
  } catch (e) {
    pageLog("err", "骰子记录窗口命令失败：" + errText(e));
  }
  broadcastDiceHistState();
}

/* ---------------------------------------------------------------------------
 * 2.5) 先攻条（v1.4.0）：贴在屏幕顶部的条
 * ---------------------------------------------------------------------------
 * 为什么不复用 openWin：
 *   · 锚点是 CENTER/TOP：展开宽度会在运行中被面板自己改（720 ↔ 410 ↔ 折叠 120），
 *     用 LEFT 锚点会「左边缘不动、整条向右长」；CENTER 则始终以屏幕中线对称伸缩（规格 §3.2）；
 *   · top 固定 45，不参与「居中偏上」的默认位置计算；
 *   · 位置记忆只存偏移 { dx, dy }（相对屏幕中线 / 相对 TOP_OFFSET），不存绝对 left，
 *     换屏幕宽度 / 缩放后仍然贴顶居中（规格 §P1 第 4 条：localStorage["4enext/strip-pos"]）。
 * 参考：obr-suite src/modules/initiative/index.ts:233-258（popover 参数）、
 *       panel-page.tsx:44-58（三档高度）/ 449-466（宽度自适应）。
 * ------------------------------------------------------------------------- */
var stripOpen = false;
/* { left, top, width, height, offset:{dx,dy}, vp:{width,height} } —— left 是「中线 x」，不是左边缘 */
var stripGeom = null;
var stripDragTimer = null;
var stripDragWanted = null;
var stripDragBusy = false;

/** 三档高度（规格 §3.1）：idle 129 / preparing 139 / combat 159。 */
function stripHeightFor(phase) {
  if (phase === "combat") return STRIP_H_COMBAT;
  if (phase === "preparing") return STRIP_H_PREPARING;
  return STRIP_H_IDLE;
}

/** 展开宽度（v1.6.2：常量 720，只有视口太窄时才缩；**不读任何 DOM 尺寸**）。
 *  = max(410, min(720, 视口宽 − 2×16))，规格 §3.3 / §3.6。 */
function stripWidthFor(vp) {
  var avail = vp && vp.width > 0 ? vp.width - STRIP_SIDE_MARGIN * 2 : STRIP_EXPANDED_W;
  return Math.round(Math.max(STRIP_MIN_EXPANDED_W, Math.min(STRIP_EXPANDED_W, avail)));
}

/** v1.6.2：页面报上来的尺寸只允许落在「折叠 120×40」或「展开 stripWidthFor(视口) × 三档高」上。
 * 为什么要兜一道：v1.6.1 的页面把控制行的 scrollWidth 当宽度传上来（投骰后点数 / 名字一变就变），
 * 场景就是「先攻条随投骰内容缩短」。这里把任何测量值丢掉，只认常量。 */
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
    localStorage.setItem(STRIP_POS_KEY, JSON.stringify({ v: 1, dx: Math.round(dx), dy: Math.round(dy) }));
  } catch (e) { /* 隐私模式 / 空间满：记不住位置不影响用 */ }
}

function clearStripOffset() {
  try { localStorage.removeItem(STRIP_POS_KEY); } catch (e) { /* 忽略 */ }
}

/** 由偏移算出 anchorPosition（CENTER/TOP 锚点：left 是中线 x）。整条必须留在视口内。 */
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

/** popover 参数：POSITION + CENTER/TOP + top 45（规格 §3.2）。 */
function stripPopoverOptions(pos, size) {
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

/** 打开先攻条；已经开着就只按记住的偏移重新摆一次（页面不会重载）。 */
async function openStrip() {
  var vp = await infoViewport();
  var size = { width: stripWidthFor(vp), height: STRIP_H_IDLE };
  var offset = readStripOffset();
  var pos = stripPosFor(offset.dx, offset.dy, size, vp);
  await OBR.popover.open(stripPopoverOptions(pos, size));
  stripOpen = true;
  stripGeom = {
    left: pos.left, top: pos.top, width: size.width, height: size.height,
    offset: { dx: pos.left - Math.round((vp.width || 0) / 2), dy: pos.top - STRIP_TOP_OFFSET },
    vp: { width: vp.width, height: vp.height }
  };
  return true;
}

/** 打开先攻条：失败要让用户看见（不静默）。 */
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
  try { await OBR.popover.close(ID_STRIP); } catch (e) { /* 已经关了 */ }
}

/** 「回到顶部中间」：清掉偏移再摆一次。 */
async function resetStrip() {
  if (!stripOpen) return;
  clearStripOffset();
  var vp = await infoViewport();
  var size = stripGeom
    ? { width: stripGeom.width, height: stripGeom.height }
    : { width: stripWidthFor(vp), height: STRIP_H_IDLE };
  var pos = stripPosFor(0, 0, size, vp);
  try {
    await OBR.popover.open(stripPopoverOptions(pos, size));
    stripGeom = {
      left: pos.left, top: pos.top, width: size.width, height: size.height,
      offset: { dx: 0, dy: 0 },
      vp: { width: vp.width, height: vp.height }
    };
    pageLog("info", "先攻条已回到顶部中间");
  } catch (e) {
    stepFail("把先攻条移回顶部中间", e);
  }
}

/** 拖动：页面只发累计位移；这里换算 / 夹紧 / 落盘（只存偏移）。 */
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
      try {
        await OBR.popover.open(stripPopoverOptions(pos, size));
        stripGeom.left = pos.left;
        stripGeom.top = pos.top;
        stripGeom.vp = { width: vp.width, height: vp.height };
        stripGeom.offset = {
          dx: pos.left - Math.round((vp.width || 0) / 2),
          dy: pos.top - STRIP_TOP_OFFSET
        };
      } catch (e) {
        pageLog("err", "拖动先攻条失败：" + errText(e));
        break;
      }
    }
  } finally {
    stripDragBusy = false;
    if (stripDragWanted) void pumpStripDrag();
  }
}

/** 拖动中 1.5 秒没消息就当结束：兜住指针跑出 iframe、页面被重载导致的丢 pointerup。 */
function touchStripDrag() {
  if (stripDragTimer) clearTimeout(stripDragTimer);
  stripDragTimer = setTimeout(function () {
    stripDragTimer = null;
    if (stripGeom && stripGeom.offset) writeStripOffset(stripGeom.offset.dx, stripGeom.offset.dy);
  }, WIN_DRAG_IDLE_MS);
}

/** 频道：com.4enext-owlbear/strip-drag，payload = { phase: start/move/end/reset, dx, dy }。 */
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
    /* 等最后一帧落定再写位置（pump 里已经更新过 stripGeom.offset）。 */
    setTimeout(function () {
      if (!stripGeom || !stripGeom.offset) return;
      writeStripOffset(stripGeom.offset.dx, stripGeom.offset.dy);
      stripGeom.base = null;
      if (stripDragTimer) { clearTimeout(stripDragTimer); stripDragTimer = null; }
    }, 60);
  }
}

/** 视口变了（窗口缩放 / 换屏幕）：按当前偏移重新夹紧先攻条。 */
async function reclampStrip() {
  if (!stripOpen || !stripGeom) return;
  var vp = await infoViewport();
  var size = { width: stripGeom.width, height: stripGeom.height };
  var off = stripGeom.offset || readStripOffset();
  var pos = stripPosFor(off.dx, off.dy, size, vp);
  if (pos.left === stripGeom.left && pos.top === stripGeom.top) return;
  try {
    await OBR.popover.open(stripPopoverOptions(pos, size));
    stripGeom.left = pos.left;
    stripGeom.top = pos.top;
    stripGeom.vp = { width: vp.width, height: vp.height };
    stripGeom.offset = {
      dx: pos.left - Math.round((vp.width || 0) / 2),
      dy: pos.top - STRIP_TOP_OFFSET
    };
  } catch (e) { /* 先攻条已经关了，忽略 */ }
}

/** 频道：com.4enext-owlbear/strip-cmd —— list / size / close。 */
function onStripCmd(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data.op !== "string") return;
  if (data.op === "list") {
    void openWinOrNotify("initiative", "先攻列表");
    return;
  }
  if (data.op === "close") { void closeStrip(); return; }
  if (data.op === "size") {
    if (!stripGeom) return;
    var w = typeof data.width === "number" && isFinite(data.width) ? Math.round(data.width) : stripGeom.width;
    var h = typeof data.height === "number" && isFinite(data.height) ? Math.round(data.height) : stripGeom.height;
    /* v1.6.2：只收常量尺寸（页面若还按内容测量，数字在这里被丢掉）。 */
    var snapped = snapStripSize(w, h);
    stripGeom.width = snapped.width;
    stripGeom.height = snapped.height;
  }
}

/* ---------------------------------------------------------------------------
 * 3) 入口 A：右下角浮动按钮（照抄 character-cards 的 openPopover）
 * ------------------------------------------------------------------------- */
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
  try { await OBR.popover.close(ID_BUTTON); } catch (e) { /* 没开就算了 */ }
  buttonOpen = false;
}

/* ---------------------------------------------------------------------------
 * 4) 入口 B：左侧工具栏（OBR.tool.create ×5）
 * ---------------------------------------------------------------------------
 * v1.3.1：三个功能各有自己的图标，点哪个开哪个窗口 —— 这就是用户要的
 * 「FullPeople 那种分块」：不是一个大面板里的 tab，而是工具栏上并列的入口。
 * v1.3.2：补齐成「一排入口」：速览 / 角色卡 / 先攻 / 骰子 / 设置，
 * 参考实现（obr-suite/src/background.ts）也是把每个模块的入口分开注册，
 * 各自 open 自己的 popover；顺序只影响图标排列。
 * 图标统一用 24×24 线性风格，靠文件上的小徽标区分（列表 / 旗 / 骰子 / 眼睛 / 滑杆）。
 * ------------------------------------------------------------------------- */
async function registerOneTool(def) {
  try {
    await OBR.tool.create(def);
  } catch (e) {
    // 后台被重新加载过（同 id 还在）时先删再建，避免把"重复注册"误报成错误
    await OBR.tool.remove(def.id);
    await OBR.tool.create(def);
  }
}

async function registerTools() {
  if (!OBR.tool || typeof OBR.tool.create !== "function") {
    throw new Error("SDK 没有 OBR.tool.create");
  }
  /* 返回 false = 不切换成激活状态，只执行我们的回调 */
  await registerOneTool({
    id: TOOL_ID,
    icons: [{ icon: TOOL_ICON_URL, label: "4eNEXT to owlbear：角色卡 / 导入面板" }],
    onClick: function () {
      void openPanel("工具栏「角色卡」");
      return false;
    }
  });
  /* v1.4.0：工具栏「先攻」打开**先攻条**（屏幕顶部），不再是 880×640 的大窗口。
     大窗口降级成「列表窗口」，从先攻条上的「≡」打开 —— 两个 popover 可以同时开着。 */
  await registerOneTool({
    id: TOOL_INIT_ID,
    icons: [{ icon: TOOL_INIT_ICON_URL, label: "4eNEXT to owlbear：先攻条" }],
    onClick: function () {
      void openStripOrNotify("工具栏「先攻」");
      return false;
    }
  });
  await registerOneTool({
    id: TOOL_DICE_ID,
    icons: [{ icon: TOOL_DICE_ICON_URL, label: "4eNEXT to owlbear：骰子窗口" }],
    onClick: function () {
      void openWinOrNotify("dice", "工具栏「骰子」");
      return false;
    }
  });
  /* v1.3.2：速览也上工具栏。它打开的是 v1.2.2 那个按 token 记位置的 /info 小窗
     （与「选中即弹」同一个 popover），所以没选中 token 时要明确告诉用户先选一个，
     而不是点了没反应。 */
  await registerOneTool({
    id: TOOL_GLANCE_ID,
    icons: [{ icon: TOOL_GLANCE_ICON_URL, label: "4eNEXT to owlbear：速览（当前选中的 token）" }],
    onClick: function () {
      void openGlance("工具栏「速览」");
      return false;
    }
  });
  /* v1.3.2：设置 / 关于。和先攻 / 骰子一样走 openWin（可拖动 / 视口夹紧 / 记位置）。 */
  await registerOneTool({
    id: TOOL_SETTINGS_ID,
    icons: [{ icon: TOOL_SETTINGS_ICON_URL, label: "4eNEXT to owlbear：设置 / 关于" }],
    onClick: function () {
      void openWinOrNotify("settings", "工具栏「设置」");
      return false;
    }
  });
}

/* ---------------------------------------------------------------------------
 * 5) 右键菜单：GM + 单个 IMAGE token（与参考实现 background.ts 第 231~258 行一致）
 * ------------------------------------------------------------------------- */
async function createContextMenu(def) {
  try {
    await OBR.contextMenu.create(def);
  } catch (e) {
    // 后台重载后同 id 可能还在，先删再建
    await OBR.contextMenu.remove(def.id);
    await OBR.contextMenu.create(def);
  }
}

/** v1.6.0：写血条组件开关。**关掉写 false，绝不 delete** ——
 *  自动开启 / 兼容逻辑用 undefined 判断「老 token」，delete 会让血条下次刷新又冒出来。 */
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
    return;
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
  } catch (e) {
    notify("改不了血条组件开关：" + errText(e), "ERROR");
  }
}

/** v1.6.0：「显示为 Boss / 隐藏 Boss」。写 hp.boss 对象（保留 segments / phase / exact），
 *  首次开启用时间戳当 order，保证新 Boss 排在已有之后；之后不再动。 */
async function writeBossFlag(context, on) {
  var item = context && context.items && context.items[0] ? context.items[0] : null;
  if (!item) {
    notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
    return;
  }
  var hp = readHpMeta(item);
  if (on && (!hp || !(hp.max > 0))) {
    notify("这枚 token 还没有生命上限：先在速览弹窗里加减过血量，再「显示为 Boss」", "WARNING");
    return;
  }
  try {
    await OBR.scene.items.updateItems([item.id], function (drafts) {
      for (var i = 0; i < drafts.length; i++) {
        var d = drafts[i];
        if (!d.metadata || typeof d.metadata !== "object") d.metadata = {};
        var raw = d.metadata[KEY_HP];
        if (!raw || typeof raw !== "object") raw = {};
        var conf = readBoss(raw.boss);
        raw.boss = {
          enabled: !!on,
          segments: conf.segments,
          phase: conf.phase,
          exact: conf.exact,
          order: conf.order || (on ? Date.now() : 0)
        };
        raw.updatedAt = Date.now();
        d.metadata[KEY_HP] = raw;
      }
    });
    scheduleBars();
    stepOk("Boss 样式：" + (on ? "已开启 " : "已关闭 ") + (item.name || item.id));
  } catch (e) {
    notify("改不了 Boss 开关：" + errText(e), "ERROR");
  }
}

async function registerContextMenu() {
  if (!OBR.contextMenu || typeof OBR.contextMenu.create !== "function") {
    throw new Error("SDK 没有 OBR.contextMenu.create");
  }

  /* 1) 绑定角色卡（v1.1.0 起就有，id 不变） */
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

  /* 2) 加入先攻 / 隐形加入先攻（v1.3.0，Full Suite 同款命名）
   * 分开注册而不是塞进同一个 icons 数组：filter 不同（隐形只给 GM），
   * 回调也不用去猜 elementId 是第几个图标。 */
  await createContextMenu({
    id: NS + "/init-add",
    icons: [{
      icon: ICON_URL,
      label: "加入先攻",
      filter: {
        roles: ["GM"],
        every: [{ key: "type", value: "IMAGE" }],
        max: 1
      }
    }],
    onClick: function (context) { return onInitMenuClick(context, false); }
  });
  await createContextMenu({
    id: NS + "/init-add-hidden",
    icons: [{
      icon: ICON_URL,
      label: "隐形加入先攻",
      filter: {
        roles: ["GM"],
        every: [{ key: "type", value: "IMAGE" }],
        max: 1
      }
    }],
    onClick: function (context) { return onInitMenuClick(context, true); }
  });

  /* 3) v1.6.0：血条组件（Full Suite 同款两项）+ Boss 两项。
   *    每一项单独 create（现有风格）：filter 不同、回调不用猜 elementId。
   *    「添加」用 operator:"!=" 同时覆盖 undefined 与 false；「移除」写 false 抑制自动重开。 */
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
    onClick: function (context) { return writeHpBarFlag(context, true); }
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
    id: NS + "/boss-show",
    icons: [{
      icon: ICON_URL,
      label: "显示为 Boss",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [
          { key: "type", value: "IMAGE" },
          { key: "layer", value: "CHARACTER" },
          { key: ["metadata", KEY_HP, "boss"], operator: "!=", value: true },
          { key: ["metadata", KEY_HP, "boss", "enabled"], operator: "!=", value: true }
        ]
      }
    }],
    onClick: function (context) { return writeBossFlag(context, true); }
  });
  await createContextMenu({
    id: NS + "/boss-hide",
    icons: [{
      icon: ICON_URL,
      label: "隐藏 Boss 血条",
      filter: {
        roles: ["GM"],
        max: 1,
        every: [
          { key: "type", value: "IMAGE" },
          { key: "layer", value: "CHARACTER" }
        ],
        some: [
          { key: ["metadata", KEY_HP, "boss"], value: true },
          { key: ["metadata", KEY_HP, "boss", "enabled"], value: true }
        ]
      }
    }],
    onClick: function (context) { return writeBossFlag(context, false); }
  });
}

/* ---------------------------------------------------------------------------
 * 6) 速览弹窗（选中绑定的 token 就弹）
 * ---------------------------------------------------------------------------
 * v1.2.2：弹窗可自由拖动
 *   · OBR 的 popover 没有拖动能力，但可以在同一个 id 上重新 open —— 只改
 *     anchorPosition，弹窗页面不会重载（与 v1.1.0 浮动按钮同一套字段写法）。
 *   · 拖动时统一按「左上角」定位：anchorOrigin / transformOrigin 都是 LEFT/TOP，
 *     anchorPosition 就是弹窗左上角在 Owlbear 视口里的坐标。这样后台只记一个点：
 *     拖动 = 起点 + 指针位移，不用反推 OBR 的锚点 / 变换规则。
 *   · 指针事件在 info.js（弹窗页）里收，经 broadcast 发到这里；这里负责节流合并、
 *     视口边界夹取、localStorage 位置记忆（按 token id 各记一份）。
 * ------------------------------------------------------------------------- */
var infoOpen = false;
var infoItemId = null;
var infoCardId = null;
/* 弹窗当前几何：{ left, top, width, height, url, vp: { width, height } } */
var infoGeom = null;
/* 拖动状态：infoDrag = { base:{left,top}, itemId, moved }；dragWanted 是待应用的最后位置。 */
var infoDrag = null;
var infoDragTimer = null;
var dragWanted = null;
var dragBusy = false;

async function getCards() {
  try {
    var meta = await OBR.room.getMetadata();
    var box = meta[KEY_CARDS];
    if (box && Array.isArray(box.cards)) return box.cards;
  } catch (e) {
    pageLog("err", "读取房间数据失败：" + errText(e));
  }
  return [];
}

function findCard(cards, id) {
  if (!id) return null;
  for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i];
  return null;
}

/** 选中 token 在屏幕上的「上边中点」（Owlbear 视口坐标）。 */
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

async function infoViewport() {
  var vp = { width: 0, height: 0 };
  try { vp.width = await OBR.viewport.getWidth(); } catch (e) { vp.width = 0; }
  try { vp.height = await OBR.viewport.getHeight(); } catch (e) { vp.height = 0; }
  return vp;
}

/* 小屏（13 寸笔记本 1920×1080 / 缩窄的窗口）不能超出视口：宽高都按视口留边再夹一次。 */
function infoSize(vp) {
  return {
    width: Math.max(INFO_MIN_W, Math.min(INFO_W, (vp.width || INFO_W + 40) - 32)),
    height: Math.min(INFO_H, Math.max(260, (vp.height || INFO_H + 40) - 40))
  };
}

/** 把弹窗左上角夹进视口（视口未知时不夹）。 */
function clampInfoPos(left, top, size, vp) {
  var m = INFO_VIEW_MARGIN;
  var out = { left: Math.round(left), top: Math.round(top) };
  if (vp && vp.width > 0) out.left = Math.round(Math.min(Math.max(out.left, m), Math.max(m, vp.width - size.width - m)));
  if (vp && vp.height > 0) out.top = Math.round(Math.min(Math.max(out.top, m), Math.max(m, vp.height - size.height - m)));
  return out;
}

/* ---- 位置记忆 ------------------------------------------------------------
 * localStorage["4enext/info-pos"] = { v: 1, pos: { "<tokenId>": { left, top } } }
 * 按 token 记：同一枚 token 下次打开回到原处，换一枚 token 不会串位置。
 * 读的时候容忍旧格式 / 脏数据：坏了就整份忽略，退回「token 上方」。
 * ------------------------------------------------------------------------- */
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
    delete map[itemId]; /* 先删再插 → 这枚 token 变成「最近使用」，裁剪时最后才轮到它 */
    map[itemId] = { left: Math.round(pos.left), top: Math.round(pos.top) };
    var keys = Object.keys(map);
    for (var i = 0; i < keys.length - INFO_POS_MAX; i++) delete map[keys[i]];
    localStorage.setItem(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) { /* 隐私模式 / 空间满：记不住位置不影响用 */ }
}

/** 只清这一枚 token 的位置（不会误清别人的）。 */
function clearInfoPos(itemId) {
  if (!itemId) return;
  try {
    var map = readInfoPosMap();
    delete map[itemId];
    if (!Object.keys(map).length) localStorage.removeItem(INFO_POS_KEY);
    else localStorage.setItem(INFO_POS_KEY, JSON.stringify({ v: 1, pos: map }));
  } catch (e) { /* 忽略 */ }
}

/** 弹窗参数：位置一律按「左上角」解释，拖动时只换 anchorPosition。 */
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

/** 打开 / 移动速览弹窗。url 不变时 OBR 只更新位置，不会重载弹窗页面。 */
async function showInfoAt(pos, size, url, itemId, cardId, vp) {
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

/** 自动定位点：优先用这枚 token 记住的位置，否则摆在 token 正上方。 */
async function infoAutoPos(itemId, size, vp) {
  var saved = readInfoPos(itemId);
  if (saved) return clampInfoPos(saved.left, saved.top, size, vp);
  var anchor = await anchorOf(itemId);
  if (anchor) {
    return clampInfoPos(anchor.left - size.width / 2, anchor.top - INFO_TOKEN_GAP - size.height, size, vp);
  }
  /* 拿不到 token 包围盒（极少见）：落在视口左上角，至少还能拖走 */
  return clampInfoPos((vp.width || 0) / 2 - size.width / 2, INFO_VIEW_MARGIN, size, vp);
}

async function openInfo(itemId, cardId) {
  var vp = await infoViewport();
  var size = infoSize(vp);
  var pos = await infoAutoPos(itemId, size, vp);
  var url = URL_INFO + "?item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId);
  await showInfoAt(pos, size, url, itemId, cardId, vp);
}

async function closeInfo() {
  if (infoDragTimer) { clearTimeout(infoDragTimer); infoDragTimer = null; }
  infoDrag = null;
  infoGeom = null;
  if (!infoOpen) return;
  try { await OBR.popover.close(ID_INFO); } catch (e) { /* 已关闭 */ }
  infoOpen = false;
  infoItemId = null;
  infoCardId = null;
}

/* ---- 拖动：info.js 只发「起点 + 累计位移」，位置换算 / 夹取 / 记忆都在这里 ---- */

/** 把最新目标位置排进队列；上一帧还没 open 完就只留最后一个（节流合并）。 */
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
    /* 上一次 open 失败时可能刚好又排进一个新位置：补跑一次，别把最后一帧丢了。 */
    if (dragWanted) void pumpInfoDrag();
  }
}

/** 拖动中 1.5 秒没消息就当结束：兜住指针跑出 iframe、页面被重载导致的丢 pointerup。 */
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

/** 频道：com.4enext-owlbear/info-drag，phase = start / move / end / reset。 */
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
    /* 起点 = 弹窗现在的位置；move 一律按「起点 + 累计位移」算，不会越拖越偏。 */
    infoDrag = { base: { left: infoGeom.left, top: infoGeom.top }, itemId: infoItemId, moved: false };
    touchInfoDragTimer();
    if (data.phase === "start") return;
  }

  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) infoDrag.moved = true;

  /* 只是点了一下标题栏（没真的移动）就什么也不做：避免多余的重开。 */
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

/** 「回到 token」：清掉这枚 token 记住的位置，重新按 token 正上方摆。 */
async function resetInfoToToken() {
  if (!infoOpen || !infoItemId) return;
  var itemId = infoItemId;
  var cardId = infoCardId;
  var vp = await infoViewport();
  var size = infoSize(vp);
  var pos = await infoAutoPos(itemId, size, vp);
  var url = infoGeom ? infoGeom.url : URL_INFO + "?item=" + encodeURIComponent(itemId) + "&card=" + encodeURIComponent(cardId || "");
  /* 算位置期间可能已经换了选中 token / 关了弹窗：别把过期的弹窗又开回来。 */
  if (!infoOpen || infoItemId !== itemId) return;
  try {
    await showInfoAt(pos, size, url, itemId, cardId, vp);
    pageLog("info", "速览弹窗已回到 token 上方");
  } catch (e) {
    stepFail("把速览弹窗移回 token", e);
  }
}

/**
 * 当前选中的**唯一** token 的绑定：{ itemId, cardId } 或 null。
 * 「选中即弹」与工具栏「速览」共用这一份判定，免得两边对「算不算绑定」看法不一致。
 */
async function selectedBinding() {
  var sel = null;
  try { sel = await OBR.player.getSelection(); } catch (e) { return null; }
  if (!sel || sel.length !== 1) return null;
  var item = null;
  try {
    var items = await OBR.scene.items.getItems([sel[0]]);
    item = items[0] || null;
  } catch (e) {
    return null;
  }
  if (!item || !item.metadata) return null;
  var cardId = item.metadata[KEY_BIND];
  if (typeof cardId !== "string" || !cardId) return null;
  var cards = await getCards();
  if (!findCard(cards, cardId)) return null;
  return { itemId: item.id, cardId: cardId };
}

/**
 * 工具栏「速览」：给**当前选中**的 token 打开速览弹窗。
 * 它复用 v1.2.2 的 /info 小窗（内层是 infoOpen / infoGeom 那一套，位置按 token 记），
 * 所以**不**注册进 WINS —— 两套状态混在一起会互相打架（选中变化会把窗口关掉再重开）。
 * 与「选中即弹」的唯一区别是这里**一定有反馈**：没选中 / 没绑定都明确告诉用户。
 */
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
    await openInfo(bind.itemId, bind.cardId);
    stepOk(label + "：已打开速览（token " + bind.itemId + "）");
    return true;
  } catch (e) {
    stepFail("打开速览弹窗（" + label + "）", e);
    return false;
  }
}

var infoErrorShown = false;
async function refreshInfo() {
  var bind = await selectedBinding();
  if (!bind) return closeInfo();
  if (infoOpen && infoItemId === bind.itemId && infoCardId === bind.cardId) return;
  if (infoOpen) await closeInfo();
  try {
    await openInfo(bind.itemId, bind.cardId);
  } catch (e) {
    if (!infoErrorShown) {
      infoErrorShown = true;
      stepFail("打开速览弹窗", e);
    }
  }
}

/* 拖 token / 改选择会连续触发事件，合并成一次刷新。 */
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

/* ---------------------------------------------------------------------------
 * 7) token 血条（画在 token 上的图形层）
 * ---------------------------------------------------------------------------
 * 做法照抄参考实现 FullPeople/obr-suite 的 src/modules/bubbles/index.ts：
 *   · 不是「改 token 让 OBR 原生长血条」（OBR 没有这个能力），而是给 token 挂
 *     **本地图形子 item**。v1.5.0 是三件（Curve 底条 + Curve 填充 + Text 数字）；
 *     v1.6.0 扩成 role 表：HP 两行条 + 四防盾 + Boss 环 / 名牌 / 分段 / 锁（最多 23 件），
 *     v1.6.1 把四防从四角改成**一排**（盾的 role / zIndex / 件数都没变，只改摆位与 AC 样式），
 *     attachedTo = token id、layer = "ATTACHMENT"、disableHit、locked、固定 zIndex。
 *   · 用 OBR.scene.local.* 而不是 OBR.scene.items.* ：本地图形只在自己这台机器上画，
 *     不需要场景写权限 —— 玩家也能看到血条（场景写权限只有 GM 有）。
 *   · 尺寸/坐标全部按「已渲染」尺寸烘焙成世界坐标（参考实现 2026-05-10 的回退方案），
 *     并 disableAttachmentBehavior(["SCALE","ROTATION","LOCKED","COPY"])，
 *     避免 token 缩放时被二次放大；位移仍然跟着 token 走。
 *   · token 被删除时 OBR 会自动删掉挂在它上面的子 item；血条数据没了（解绑 / 手删）
 *     我们就主动清理自己的本地 item；本地 item 被外部删掉时会自动重建。
 * 数值来源：token 元数据 com.4enext-owlbear/hp = { cur, max, temp, surges, surgesMax,
 * defenses, boss, locked, updatedAt }，与速览弹窗是同一份数据，所以弹窗里加减血 → 血条立刻跟着变。
 * 显式开关是独立键 com.4enext-owlbear/hp-bar/enabled（false 不画，undefined 照旧画）。
 * v1.6.0 的 role 表 / 几何公式 / 像素常数集中表见 docs/hpbar-boss-v16.md。
 * ------------------------------------------------------------------------- */
/* 本地图形 item 的元数据：{ owner: tokenId, role: "<见 v1.6 role 表>", key?, index? }
 * v1.6.0 的 role 从 3 种扩到 16 种（环 / 条 / 牌 / 盾 / 分段 / 锁 / 数值），全部打同一个 tag，
 * sweepStaleBars 与自愈逻辑不用改（它们只认 owner/role 是否存在）。 */
var BAR_TAG = NS + "/bar";

var barEntries = {};     /* tokenId -> { ids: [], sig: "", rolesKey: "", force?: true } */
var barTimer = null;
var barBusy = false;
var barAgain = false;
var barUnsupported = false;
var barSwept = false;
var cachedDpi = 0;

/* v1.6.0：本机视角（角色 / 玩家 id / 玩家端量化阈值）。
 * 只用于「这台机器画什么」——绝不写进 metadata、绝不广播（规格 §4.7 的同一条纪律）。
 * 角色 / id 每次 syncBars 现读（切角色 / 换玩家要立刻生效）；阈值放场景元数据，缓存一次。 */
var barThreshold = -1;
async function sceneViewer() {
  var out = { role: "", id: "", threshold: PLAYER_THRESHOLD_DEFAULT };
  try { out.role = await OBR.player.getRole(); } catch (e1) { /* 忽略 */ }
  try { out.id = await OBR.player.getId(); } catch (e2) { /* 忽略 */ }
  if (barThreshold >= 0) { out.threshold = barThreshold; return out; }
  try {
    if (OBR.scene && typeof OBR.scene.getMetadata === "function") {
      var meta = await OBR.scene.getMetadata();
      var raw = meta ? meta[KEY_PLAYER_THRESHOLD] : null;
      if (typeof raw === "number" && isFinite(raw) && raw >= 0 && raw <= 100) out.threshold = Math.round(raw);
    }
  } catch (e3) { /* 读不到就用 25 */ }
  barThreshold = out.threshold;
  return out;
}

/* 这些构建器由 dev/build-background.mjs 从 SDK 的具名导出接到本作用域（buildCurve 等）。 */
function barBuildersOk() {
  return typeof buildCurve === "function" && typeof buildText === "function";
}

function readIntOrNull(v) {
  return typeof v === "number" && isFinite(v) ? Math.round(v) : null;
}

/** 四防：只收 ac / fort / reflex / will 四个数字；一个都没有就返回 null（= 不画盾）。
 *  ⚠ 卡里的键叫 ref，token 上一律叫 reflex —— 换算只在写盘 helper（track.js）里做一处，
 *  渲染层只认 reflex（规格 §6.2 / 风险 R11）。 */
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

/** Boss 开关：布尔（roadmap 里写的 boss:true）与对象两种都读，统一归一化成对象。
 *  这样以后加 segments / phase 不用二次迁移。 */
function readBoss(raw) {
  var out = { enabled: false, segments: 1, phase: "", exact: false, order: 0 };
  if (typeof raw === "boolean") { out.enabled = raw; return out; }
  if (!raw || typeof raw !== "object") return out;
  out.enabled = raw.enabled === true;
  out.segments = typeof raw.segments === "number" && isFinite(raw.segments)
    ? Math.max(1, Math.min(BOSS_MAX_SEGMENTS, Math.round(raw.segments))) : 1;
  out.phase = typeof raw.phase === "string" ? raw.phase.slice(0, 48) : "";
  out.exact = raw.exact === true;
  out.order = typeof raw.order === "number" && isFinite(raw.order) ? raw.order : 0;
  return out;
}

/** 血条组件开关：只有显式 false 才不画（undefined / true 都画）。 */
function hpBarEnabled(item) {
  var flag = item && item.metadata ? item.metadata[KEY_HPBAR] : undefined;
  return flag !== false;
}

/** 玩家端比例量化：锁定时按 25% 阶梯**向上**取整（与参考实现 display-policy 同一套）。
 *  注意：token metadata 对全桌可读，这里只是「本地不画精确数字」，不是加密（风险 R12）。 */
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
    boss: readBoss(m.boss),
    locked: m.locked !== false,
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

/** 环形扇区多边形（v1.6.0 Boss 环）。
 *  SDK 3.1.0 的 ShapeType 只有 RECTANGLE / CIRCLE / TRIANGLE / HEXAGON —— **没有 RING**，
 *  所以环必须用 Curve 的 points() 手绘：外弧 t=0→1 + 内弧 t=1→0，closed=true、tension=0。
 *  坐标以 token 中心为原点（item.position 放中心），这样 token 移动时位置平移、形状不变。
 *  规格 §6.4 C：a0 = -90°（12 点方向），sweep = ratio × 360°，N = 48 段（不要 128：脏矩形重绘翻倍）。 */
function ringSectorPoints(radiusOuter, radiusInner, ratio, segments) {
  var n = Math.max(8, Math.round(segments || BOSS_RING_SEGMENTS));
  var sweep = Math.max(0.0001, Math.min(1, ratio)) * Math.PI * 2;
  var a0 = -Math.PI / 2;
  var pts = [];
  var i;
  for (i = 0; i <= n; i++) {
    var a = a0 + sweep * (i / n);
    pts.push({ x: Math.cos(a) * radiusOuter, y: Math.sin(a) * radiusOuter });
  }
  for (i = n; i >= 0; i--) {
    var b = a0 + sweep * (i / n);
    pts.push({ x: Math.cos(b) * radiusInner, y: Math.sin(b) * radiusInner });
  }
  return pts;
}

/** 圆弧折线（锁梁用；closed=false、只描边）。 */
function arcPoints(cx, cy, r, from, to, seg) {
  var out = [];
  var n = Math.max(2, seg || 16);
  for (var i = 0; i <= n; i++) {
    var a = from + (to - from) * (i / n);
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

/** 盾形多边形（照抄参考实现 bubbles/index.ts 的 shieldPoints，完整公式在规格 §5.4）。
 *  左上 / 右上圆角 → 右侧直边 → 右半下摆二次贝塞尔到 (W/2,H) → 左半镜像回 (0,sb)。 */
function shieldPoints(W, H, segments) {
  var seg = segments || 14;
  var pts = [];
  var cornerR = Math.min(W, H) * 0.18;
  var sideStraightBottom = H * 0.42;
  var i, t, a;
  /* 左上圆角：角度 -π → -π/2 */
  for (i = 0; i <= seg; i++) {
    t = i / seg; a = -Math.PI + (Math.PI / 2) * t;
    pts.push({ x: cornerR + Math.cos(a) * cornerR, y: cornerR + Math.sin(a) * cornerR });
  }
  /* 右上圆角：角度 -π/2 → 0 */
  for (i = 0; i <= seg; i++) {
    t = i / seg; a = -Math.PI / 2 + (Math.PI / 2) * t;
    pts.push({ x: W - cornerR + Math.cos(a) * cornerR, y: cornerR + Math.sin(a) * cornerR });
  }
  pts.push({ x: W, y: sideStraightBottom });
  /* 右半下摆：(W, sb) → (0.85W, 0.92H) → (W/2, H) */
  var segs2 = seg * 2;
  for (i = 1; i <= segs2; i++) {
    t = i / segs2;
    var u = 1 - t;
    pts.push({
      x: u * u * W + 2 * u * t * (W * 0.85) + t * t * (W / 2),
      y: u * u * sideStraightBottom + 2 * u * t * (H * 0.92) + t * t * H
    });
  }
  /* 左半下摆镜像：(W/2, H) → (0.15W, 0.92H) → (0, sb) */
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

/** 圆角矩形（锚点在左上角、y 向下，与参考实现的 roundedRectanglePoints 同构）。 */
function roundRectPoints(w, h, r, fill) {
  if (r * 2 > h) r = h / 2;
  if (r * 2 > w) r = w / 2;
  var seg = 6;
  function arc(cx, cy, from, to) {
    var out = [];
    if (r <= 0) {
      for (var k = 0; k <= seg; k++) out.push({ x: cx, y: cy });
      return out;
    }
    for (var i = 0; i <= seg; i++) {
      var t = i / seg;
      var a = from + (to - from) * t;
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }
  var f = typeof fill === "number" ? Math.max(0.0001, Math.min(1, fill)) : 1;
  var filled = Math.max(0, Math.min(w, f * w));
  if (f >= 1) {
    return [].concat(
      arc(r, r, -Math.PI, -Math.PI / 2),
      arc(w - r, r, -Math.PI / 2, 0),
      arc(w - r, h - r, 0, Math.PI / 2),
      arc(r, h - r, Math.PI / 2, Math.PI)
    );
  }
  if (filled <= r) {
    return [].concat(
      arc(r, r, -Math.PI, -Math.PI / 2),
      [{ x: r, y: 0 }, { x: r, y: h }],
      arc(r, h - r, Math.PI / 2, Math.PI)
    );
  }
  return [].concat(
    arc(r, r, -Math.PI, -Math.PI / 2),
    [{ x: filled - r, y: 0 }],
    arc(filled - r, r, -Math.PI / 2, 0),
    arc(filled - r, h - r, 0, Math.PI / 2),
    [{ x: filled - r, y: h }],
    arc(r, h - r, Math.PI / 2, Math.PI)
  );
}

/** 由 token 的世界包围盒推出「一组几何」：HP 行 / 回复力行 / 四防一排 / Boss 环+名牌。
 *  v1.6.0 只是**加字段**，syncBars 的调用方式不变（规格 §6.4 / 附录 B 第 2 条）；
 *  v1.6.1 只改四防的摆位与 AC 样式（HP 行 / 回复力行 / Boss 几何一个字没动）。
 *  viewer = { exact, threshold }：exact=false 时（其他玩家 + locked）比例按阶梯量化、不画数字与四防。 */
function barLayout(bounds, dpi, hp, viewer) {
  var max = hp.max > 0 ? hp.max : (hp.cur !== null ? Math.max(1, hp.cur) : 1);
  var cur = hp.cur === null ? max : hp.cur;
  var ratio = Math.max(0, Math.min(1, cur / max));
  var s = Math.min(bounds.width, bounds.height) / dpi;
  if (!isFinite(s) || s <= 0) s = 1;
  s = Math.max(0.2, Math.min(6, s));

  var exact = !viewer || viewer.exact !== false;
  var threshold = viewer && typeof viewer.threshold === "number" ? viewer.threshold : PLAYER_THRESHOLD_DEFAULT;
  var shownRatio = exact ? ratio : quantiseRatio(ratio, threshold);

  var hHp = BAR_HP_H * s;
  var hSurge = BAR_SURGE_H * s;
  var gap = BAR_GAP * s;
  var pad = BAR_PAD * s;
  var w = Math.max(hHp * 2, bounds.width - pad * 2);
  var left = bounds.center.x - w / 2;

  /* A. 两行条：底边内侧先放蓝条，蓝条上方 gap 再放红条（规格 §6.4 A）。
   *    没有回复力数据时 HP 条仍贴底边内侧 —— 老 token 升级后血条位置不变。 */
  var showSurge = hp.surges !== null;
  var surgeTop = bounds.max.y - pad - hSurge;
  var hpTop = showSurge ? surgeTop - gap - hHp : bounds.max.y - pad - hHp;

  var hpText = exact ? (String(cur) + "/" + max + (hp.temp > 0 ? " +" + hp.temp : "")) : "";
  var hpFont = Math.min(hHp * 1.05, (w / Math.max(4, hpText.length || 4)) * 1.5);
  hpFont = Math.max(6 * s, hpFont);

  var surgeMax = hp.surgesMax !== null ? hp.surgesMax : (hp.surges !== null ? Math.max(hp.surges, 1) : 1);
  var surgeValue = hp.surges === null ? 0 : hp.surges;
  /* 老 token 没有 surgesMax：分母回落 max(surges,1) 并把条画满、只显示一个数字（规格 §6.1） */
  var surgeRatio = hp.surgesMax !== null ? Math.max(0, Math.min(1, surgeValue / surgeMax)) : 1;
  var surgeText = exact && hp.surges !== null
    ? (String(surgeValue) + (hp.surgesMax !== null ? "/" + hp.surgesMax : "")) : "";
  var surgeFont = Math.max(5 * s, Math.min(hSurge * 0.95, (w / Math.max(3, surgeText.length || 3)) * 1.4));

  /* B. v1.6.1：四防**一排**（原来四角的那套已删）
   *    顺序固定 强韧 → 反射 → 意志 → AC（AC 永远最右、半透明白色图标）；
   *    整排贴在 HP 红条上方 gap 处（同一行，y 相同），圆心间距 = d + DEF_GAP，按 s 缩放；
   *    整排以 token 中线居中，右缘不会越过条的右缘（可用宽度就是条的宽 w 减两侧 inset）。
   *    退化（写死规则，选「丢盾」而不是「整体缩小」）：
   *      宽度只放得下 n 枚时，**AC 优先保留**，其余按 DEF_DROP 丢（先丢意志 → 再丢反射 → 再丢强韧）；
   *      位置按剩下的枚数重新居中，不留空档；一枚都放不下、或这一排会顶出 token 上沿（矮 token）
   *      → 整排不画，四防仍能在速览面板里看。 */
  var d = SHIELD_DIAMETER * s;
  var inset = SHIELD_INSET * s;
  var defGap = DEF_GAP * s;
  var rowCY = hpTop - gap - d / 2;
  var availW = w - inset * 2;
  var fit = Math.floor((availW + defGap) / (d + defGap));
  var showDefenses = !!hp.defenses && exact && fit >= 1 && rowCY - d / 2 >= bounds.min.y + inset;
  var shields = [];
  if (showDefenses) {
    /* 先把「真的有数字」的那几项按 DEF_ROW 的顺序摆上，再按 DEF_DROP 丢掉放不下的：
     * 先丢意志 → 再丢反射 → 再丢强韧（AC 不在 DEF_DROP 里 = **最后才丢 / 优先保留**）。 */
    var rowKeys = [];
    var i;
    for (i = 0; i < DEF_ROW.length; i++) {
      if (typeof hp.defenses[DEF_ROW[i]] === "number") rowKeys.push(DEF_ROW[i]);
    }
    while (rowKeys.length > Math.max(1, fit)) {
      var dropped = false;
      for (i = 0; i < DEF_DROP.length; i++) {
        var at = rowKeys.indexOf(DEF_DROP[i]);
        if (at < 0) continue;
        rowKeys.splice(at, 1);
        dropped = true;
        break;
      }
      if (!dropped) break;   /* 只剩 AC 了：AC 最后才丢（fit < 1 时上面已经整排不画） */
    }
    var rowW = rowKeys.length * d + Math.max(0, rowKeys.length - 1) * defGap;
    var xFirst = bounds.center.x - rowW / 2 + d / 2;
    for (i = 0; i < rowKeys.length; i++) {
      var k = rowKeys[i];
      var val = hp.defenses[k];
      var txt = String(val);
      /* AC = 半透明白色图标（fill 白 @0.18 + 白描边 @0.85）；三防 = 实色 @0.9 + 淡白描边 */
      var ghost = k === "ac";
      shields.push({
        key: k, value: val, text: txt, x: xFirst + i * (d + defGap), y: rowCY, d: d,
        color: DEF_COLORS[k], ghost: ghost,
        fillOpacity: ghost ? DEF_AC_FILL_OPACITY : DEF_FILL_OPACITY,
        strokeOpacity: ghost ? DEF_AC_STROKE_OPACITY : DEF_STROKE_OPACITY,
        fontSize: Math.max(8 * s, txt.length > 2 ? d - 15 * s : d - 8 * s)
      });
    }
  }

  /* C/D. Boss（方案 A）：环 + 名牌 + 分段线 + 锁 */
  var boss = hp.boss || readBoss(null);
  var bossOn = boss.enabled === true;
  var bossL = {
    enabled: bossOn, segments: boss.segments, phase: boss.phase, exact: boss.exact,
    locked: hp.locked, cx: bounds.center.x, cy: bounds.center.y,
    Ro: 0, Ri: 0, T: 0, ringRatio: shownRatio,
    name: hp.name || "", plateX: 0, plateY: 0, plateW: 0, plateH: 0,
    nameFont: 14 * s, phaseFont: 10 * s, phaseW: 0,
    lockX: 0, lockY: 0, lockBodyW: 10 * s, lockBodyH: 8 * s, lockR: 3.2 * s,
    lockColor: hp.locked ? COLOR_LOCK_ON : COLOR_LOCK_OFF,
    dividerCount: 0
  };
  if (bossOn) {
    bossL.Ro = Math.max(4 * s, Math.min(bounds.width, bounds.height) / 2 - BOSS_RING_INSET * s);
    bossL.T = Math.max(6 * s, Math.min(BOSS_RING_THICK * s, bossL.Ro * 0.30));
    bossL.Ri = Math.max(1 * s, bossL.Ro - bossL.T);
    bossL.plateH = BOSS_PLATE_H * s;
    bossL.plateY = bounds.min.y - BOSS_PLATE_GAP * s - bossL.plateH;
    bossL.plateW = Math.min(w, Math.max(140 * s, 0.62 * bossL.nameFont * Math.max(1, bossL.name.length)));
    bossL.plateX = bounds.center.x - bossL.plateW / 2;
    bossL.phaseW = (bossL.phase && bossL.plateW >= 120 * s) ? Math.min(90 * s, bossL.plateW * 0.32) : 0;
    bossL.lockX = bossL.plateX + bossL.plateW - 13 * s;
    bossL.lockY = bossL.plateY + bossL.plateH / 2;
    bossL.dividerCount = boss.segments > 1 ? boss.segments - 1 : 0;
  }

  return {
    scale: s, exact: exact, w: w, left: left, pad: pad, gap: gap,
    hHp: hHp, hSurge: hSurge, hpTop: hpTop, surgeTop: surgeTop,
    hpRadius: hHp / 2, surgeRadius: hSurge / 2,
    ratio: shownRatio, rawRatio: ratio,
    hpText: hpText, hpFont: hpFont,
    showSurge: showSurge, surgeRatio: surgeRatio, surgeText: surgeText, surgeFont: surgeFont,
    showDefenses: showDefenses, shields: shields, d: d,
    boss: bossL,
    /* Boss 模式压制普通 HP 条（bg / fill / text 三件保留但隐藏 → 关掉 Boss 时不用重建） */
    hpVisible: !bossOn,
    textVisible: exact
  };
}

/** 角色集合指纹：一变就整体重建（Boss 开关 / 分段数 / 有无蓝条 / 画了哪几枚盾 / 是否画数字）。
 *  v1.6.1：盾要带上 **key 列表**而不只是数量 —— 窄 token 退化会改数量，换一组四防也可能「数量不变、key 变了」，
 *  只比数量会让 patchBar 找不到对应的盾（数字就停在旧位置）。 */
function barRolesKey(L) {
  return [
    L.boss.enabled ? "B" + L.boss.segments + (L.boss.phaseW > 0 ? "p" : "") : "",
    L.showSurge ? "S" : "",
    L.shields.length ? "D" + L.shields.map(function (x) { return x.key; }).join("") : "",
    L.textVisible ? "T" : ""
  ].join("");
}

/** 状态签名：只在真正影响画面时写盘。**不放 bounds 的全部字段**
 *  （旋转 / 位移每帧都变，放进来会导致每条血条每帧重写）；几何只取几个整数（规格 §6.5）。 */
function barSig(hp, L) {
  var d = hp.defenses;
  return [
    hp.cur, hp.max, hp.temp, hp.surges, hp.surgesMax, hp.name,
    d ? [d.ac, d.fort, d.reflex, d.will].join(",") : "",
    L.boss.enabled ? 1 : 0, L.boss.segments, L.boss.phase, hp.locked ? 1 : 0,
    L.exact ? 1 : 0,
    Math.round(L.w), Math.round(L.left), Math.round(L.hpTop), Math.round(L.surgeTop),
    Math.round(L.boss.plateY), Math.round(L.boss.plateW), Math.round(L.scale * 1000),
    L.shields.length ? Math.round(L.shields[0].d) : 0
  ].join("|");
}

function barMeta(tokenId, role, extra) {
  var box = {};
  var tag = { owner: tokenId, role: role };
  if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) tag[k] = extra[k];
  box[BAR_TAG] = tag;
  return box;
}

/** 一个 Curve item 的公共尾巴：位置 + 样式（fill / stroke 都是可选项）。 */
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
  /* 盾牌数字要带 key（patchBar 靠它找对应盾）；没有 extra 的 text 保持只有 owner/role */
  if (opt.extra) b.metadata(barMeta(tokenId, role, opt.extra));
  return b.build();
}

/** 环上的分段线：沿环厚画一小段径向四边形（N 段只做视觉，不改血量）。 */
function ringDividerPoints(bossL, i) {
  var seg = Math.max(1, bossL.segments);
  var a = -Math.PI / 2 + (Math.PI * 2) * (i / seg);
  var rMid = (bossL.Ri + bossL.Ro) / 2;
  var half = (bossL.T * 0.18) / Math.max(1, rMid);
  var a1 = a - half;
  var a2 = a + half;
  return [
    { x: Math.cos(a1) * bossL.Ri, y: Math.sin(a1) * bossL.Ri },
    { x: Math.cos(a1) * bossL.Ro, y: Math.sin(a1) * bossL.Ro },
    { x: Math.cos(a2) * bossL.Ro, y: Math.sin(a2) * bossL.Ro },
    { x: Math.cos(a2) * bossL.Ri, y: Math.sin(a2) * bossL.Ri }
  ];
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

/** 构建一个 token 的全部本地图形 item（role 表见规格 §6.3）。
 *  只在有数据时创建：没有 surges 不建蓝条、没有 defenses 不建盾、不是 Boss 不建环/牌/锁。
 *  角色集合一变（例如刚打开 Boss）由 syncBars 整体重建；只是数值变化走 patchBar。 */
function buildBarItems(tokenId, L) {
  var items = [];
  var B = L.boss;
  var i;

  /* 1) Boss 环（zIndex 9500 / 9800） */
  if (B.enabled) {
    items.push(barCurveItem(tokenId, "ring-bg",
      ringSectorPoints(B.Ro, B.Ri, 1, BOSS_RING_SEGMENTS), B.cx, B.cy,
      { fill: COLOR_BOSS_BG, fillOpacity: 0.55 }));
    items.push(barCurveItem(tokenId, "ring-fill",
      ringSectorPoints(B.Ro, B.Ri, B.ringRatio, BOSS_RING_SEGMENTS), B.cx, B.cy,
      { fill: COLOR_HP_FILL, fillOpacity: 0.9, visible: B.ringRatio > 0 }));
  }

  /* 2) HP 胶囊底 / 填充（Boss 模式下隐藏，但保留 item → 关掉 Boss 不用重建） */
  items.push(barCurveItem(tokenId, "bar-bg", roundRectPoints(L.w, L.hHp, L.hpRadius, 1), L.left, L.hpTop,
    { fill: COLOR_HP_BG, fillOpacity: 0.6, visible: L.hpVisible }));
  items.push(barCurveItem(tokenId, "bar-fill", roundRectPoints(L.w, L.hHp, L.hpRadius, L.ratio), L.left, L.hpTop,
    { fill: COLOR_HP_FILL, fillOpacity: 0.85, visible: L.hpVisible && L.ratio > 0 }));

  /* 3) 回复力蓝条（zIndex 10500 / 20500 / 30500） */
  if (L.showSurge) {
    items.push(barCurveItem(tokenId, "surge-bg", roundRectPoints(L.w, L.hSurge, L.surgeRadius, 1), L.left, L.surgeTop,
      { fill: COLOR_SURGE_BG, fillOpacity: 0.85 }));
    items.push(barCurveItem(tokenId, "surge-fill", roundRectPoints(L.w, L.hSurge, L.surgeRadius, L.surgeRatio), L.left, L.surgeTop,
      { fill: COLOR_SURGE_FILL, fillOpacity: 0.9, visible: L.surgeRatio > 0 }));
  }

  /* 4) Boss 名牌（zIndex 12000 / 12400 / 12450） */
  if (B.enabled) {
    items.push(barCurveItem(tokenId, "plate",
      roundRectPoints(B.plateW, B.plateH, 4 * L.scale, 1), B.plateX, B.plateY,
      { fill: COLOR_BOSS_BG, fillOpacity: 0.78, stroke: COLOR_PLATE_STROKE, strokeOpacity: 0.9, strokeWidth: Math.max(0.5, 1 * L.scale) }));
    items.push(barTextItem(tokenId, "plate-text", B.name, B.nameFont, COLOR_PLATE_TEXT,
      B.plateX + 4 * L.scale, B.plateY,
      Math.max(24 * L.scale, B.plateW - 26 * L.scale - B.phaseW), B.plateH,
      { align: "CENTER", strokeWidth: Math.max(0.4, 0.9 * L.scale) }));
    if (B.phaseW > 0) {
      items.push(barTextItem(tokenId, "plate-phase", B.phase, B.phaseFont, COLOR_PHASE_TEXT,
        B.plateX + B.plateW - 28 * L.scale - B.phaseW, B.plateY, B.phaseW, B.plateH,
        { align: "RIGHT", weight: 600, strokeWidth: Math.max(0.3, 0.6 * L.scale) }));
    }
  }

  /* 5) 四防一排（v1.6.1）+ 数字（zIndex 15000 / 16000）
   *    一排四枚：强韧 / 反射 / 意志 实色，AC 最右且**半透明白色图标**（fill 白 @0.18 + 白描边 @0.85）。 */
  for (i = 0; i < L.shields.length; i++) {
    var sh = L.shields[i];
    items.push(barCurveItem(tokenId, "shield", shieldPoints(sh.d, sh.d), sh.x - sh.d / 2, sh.y - sh.d / 2,
      {
        fill: sh.color, fillOpacity: sh.fillOpacity, stroke: "#ffffff", strokeOpacity: sh.strokeOpacity,
        strokeWidth: Math.max(0.6, sh.d * 0.04), extra: { key: sh.key }
      }));
    items.push(barTextItem(tokenId, "shield-text", sh.text, sh.fontSize, "#ffffff",
      sh.x - sh.d / 2, sh.y - sh.d / 2, sh.d, sh.d,
      { strokeWidth: Math.max(0.4, sh.d * 0.02), strokeOpacity: sh.ghost ? 0.85 : 0.7, extra: { key: sh.key } }));
  }

  /* 6) Boss 分段线（zIndex 22000；只做视觉，不改血量） */
  if (B.enabled && B.dividerCount > 0) {
    for (i = 1; i <= B.dividerCount; i++) {
      items.push(barCurveItem(tokenId, "divider", ringDividerPoints(B, i), B.cx, B.cy,
        { fill: COLOR_DIVIDER, fillOpacity: 0.85, extra: { index: i } }));
    }
  }

  /* 7) 数值（zIndex 30000 / 30500） */
  if (typeof buildText === "function") {
    items.push(barTextItem(tokenId, "bar-text", L.hpText, L.hpFont, "#ffffff", L.left, L.hpTop, L.w, L.hHp,
      { strokeWidth: Math.max(0.4, L.hHp * 0.075), visible: L.hpVisible && L.textVisible }));
    if (L.showSurge) {
      items.push(barTextItem(tokenId, "surge-text", L.surgeText, L.surgeFont, "#ffffff", L.left, L.surgeTop, L.w, L.hSurge,
        { strokeWidth: Math.max(0.3, L.hSurge * 0.06), visible: L.textVisible }));
    }
  }

  /* 8) 锁（zIndex 31000 / 31050；body + shackle 两件） */
  if (B.enabled) {
    items.push(barCurveItem(tokenId, "lock-body",
      roundRectPoints(B.lockBodyW, B.lockBodyH, 2 * L.scale, 1),
      B.lockX - B.lockBodyW / 2, B.lockY - B.lockBodyH / 2,
      { fill: B.lockColor, fillOpacity: 0.9, stroke: "#ffffff", strokeOpacity: 0.45, strokeWidth: Math.max(0.5, 0.8 * L.scale) }));
    items.push(barCurveItem(tokenId, "lock-shackle",
      arcPoints(0, 0, B.lockR, Math.PI, Math.PI * 2, 16),
      B.lockX, B.lockY - B.lockBodyH / 2,
      { fillOpacity: 0, closed: false, stroke: B.lockColor, strokeOpacity: 0.9, strokeWidth: Math.max(0.8, 1.6 * L.scale) }));
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

/** 就地刷新：按 role 分发（switch，不写一条长 if 链；未知 role 直接跳过 → 老 item 兼容）。
 *  v1.6.0 的 role 表见规格 §6.3：环 2 + 条 4 + 牌 3 + 盾 8 + 分段 ≤4 + 锁 2 = 最多 23 件。 */
async function patchBar(entry, L) {
  var B = L.boss;
  await OBR.scene.local.updateItems(entry.ids, function (drafts) {
    for (var i = 0; i < drafts.length; i++) {
      var d = drafts[i];
      var tag = d.metadata && d.metadata[BAR_TAG] ? d.metadata[BAR_TAG] : null;
      var role = tag && tag.role ? tag.role : "";
      switch (role) {
        case "ring-bg":
          d.position = { x: B.cx, y: B.cy };
          d.points = ringSectorPoints(B.Ro, B.Ri, 1, BOSS_RING_SEGMENTS);
          d.visible = B.enabled;
          break;
        case "ring-fill":
          d.position = { x: B.cx, y: B.cy };
          d.points = ringSectorPoints(B.Ro, B.Ri, B.ringRatio, BOSS_RING_SEGMENTS);
          d.visible = B.enabled && B.ringRatio > 0;
          break;
        case "bar-bg":
          d.position = { x: L.left, y: L.hpTop };
          d.points = roundRectPoints(L.w, L.hHp, L.hpRadius, 1);
          d.visible = L.hpVisible;
          break;
        case "bar-fill":
          d.position = { x: L.left, y: L.hpTop };
          d.points = roundRectPoints(L.w, L.hHp, L.hpRadius, L.ratio);
          d.visible = L.hpVisible && L.ratio > 0;
          break;
        case "surge-bg":
          d.position = { x: L.left, y: L.surgeTop };
          d.points = roundRectPoints(L.w, L.hSurge, L.surgeRadius, 1);
          d.visible = L.showSurge;
          break;
        case "surge-fill":
          d.position = { x: L.left, y: L.surgeTop };
          d.points = roundRectPoints(L.w, L.hSurge, L.surgeRadius, L.surgeRatio);
          d.visible = L.showSurge && L.surgeRatio > 0;
          break;
        case "plate":
          d.position = { x: B.plateX, y: B.plateY };
          d.points = roundRectPoints(B.plateW, B.plateH, 4 * L.scale, 1);
          d.visible = B.enabled;
          break;
        case "plate-text":
          if (!d.text) break;
          d.text.plainText = B.name;
          d.text.style.fontSize = B.nameFont;
          d.text.width = Math.max(24 * L.scale, B.plateW - 26 * L.scale - B.phaseW);
          d.text.height = B.plateH;
          d.position = { x: B.plateX + 4 * L.scale, y: B.plateY };
          d.visible = B.enabled;
          break;
        case "plate-phase":
          if (!d.text) break;
          d.text.plainText = B.phase;
          d.text.style.fontSize = B.phaseFont;
          d.text.width = B.phaseW;
          d.text.height = B.plateH;
          d.position = { x: B.plateX + B.plateW - 28 * L.scale - B.phaseW, y: B.plateY };
          d.visible = B.enabled && B.phaseW > 0;
          break;
        case "shield": {
          var sh = findShield(L, tag.key);
          if (!sh) { d.visible = false; break; }
          d.points = shieldPoints(sh.d, sh.d);
          d.position = { x: sh.x - sh.d / 2, y: sh.y - sh.d / 2 };
          d.visible = true;
          break;
        }
        case "shield-text": {
          var shx = findShield(L, tag.key);
          if (!shx || !d.text) { d.visible = false; break; }
          d.text.plainText = shx.text;
          d.text.style.fontSize = shx.fontSize;
          d.text.width = shx.d;
          d.text.height = shx.d;
          d.position = { x: shx.x - shx.d / 2, y: shx.y - shx.d / 2 };
          d.visible = true;
          break;
        }
        case "divider": {
          var idx = typeof tag.index === "number" ? tag.index : 1;
          if (!B.enabled || idx < 1 || idx > B.dividerCount) { d.visible = false; break; }
          d.points = ringDividerPoints(B, idx);
          d.position = { x: B.cx, y: B.cy };
          d.visible = true;
          break;
        }
        case "bar-text":
          if (!d.text) break;
          d.text.plainText = L.hpText;
          d.text.style.fontSize = L.hpFont;
          d.text.width = L.w;
          d.text.height = L.hHp;
          d.position = { x: L.left, y: L.hpTop };
          d.visible = L.hpVisible && L.textVisible;
          break;
        case "surge-text":
          if (!d.text) break;
          d.text.plainText = L.surgeText;
          d.text.style.fontSize = L.surgeFont;
          d.text.width = L.w;
          d.text.height = L.hSurge;
          d.position = { x: L.left, y: L.surgeTop };
          d.visible = L.showSurge && L.textVisible;
          break;
        case "lock-body":
          d.position = { x: B.lockX - B.lockBodyW / 2, y: B.lockY - B.lockBodyH / 2 };
          d.fillColor = B.lockColor;
          d.visible = B.enabled;
          break;
        case "lock-shackle":
          d.position = { x: B.lockX, y: B.lockY - B.lockBodyH / 2 };
          d.strokeColor = B.lockColor;
          d.visible = B.enabled;
          break;
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
  } catch (e) { /* 已经没了就算了 */ }
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

/**
 * 启动时清扫上一次后台实例留下的血条 item。
 * 本地图形 item 会一直留到整页刷新，而扩展关掉再打开只会重载 iframe ——
 * 不清的话会出现「两层一模一样的血条」（视觉上看不出来，但会一直叠着）。
 * 只做一次，且在建立任何 barEntries 之前，所以不会误删自己刚画的。
 */
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
  } catch (e) { /* 拿不到本地 item 就算了 */ }
}

/** 把「场景里所有带 hp 元数据的 token」与本地血条 item 对齐。 */
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
      /* v1.6.0：显式关掉血条组件（flag === false）就不画；undefined 仍画 → 老 token 不消失。 */
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
      /* 玩家端可见性（规格 §6.8）：城主 / token 创建者 / 未锁 → 精确数字与四防；
       * 其他玩家 + locked（默认）→ 只画阶梯比例，不写文字、不画盾（metadata 仍对全桌可读）。 */
      var exact = viewer.role === "GM" || !!(viewer.id && rec.item.createdUserId === viewer.id) || !rec.hp.locked;
      var L = barLayout(bounds, dpi, rec.hp, { exact: exact, threshold: viewer.threshold });
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
        /* 角色集合变了，或本地图形被外部删掉了：删掉残留记录，下面按新几何重画 */
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

/** 本地血条被别的插件 / 手滑删掉时自动补回来。 */
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

/* ---------------------------------------------------------------------------
 * 7.5) 先攻（v1.3.0；v1.4.0 扩数据层）
 * ---------------------------------------------------------------------------
 * 右键「加入先攻 / 隐形加入先攻」直接写房间数据：
 *   room.metadata["com.4enext-owlbear/initiative"] =
 *     { v:1, updatedAt, phase, round, surprise, activeId,
 *       entries:[{tokenId,name,bonus,d20,init,tb,hidden,ownerId,updatedAt}] }
 * v1.4.0 只**新增**字段（phase / surprise / d20 / tb），键名一个都没改 → 旧数据照旧能读。
 * 先攻加值取 token 上的 com.4enext-owlbear/init（绑定角色卡时由 common.js 写入），
 * 后台是经典脚本，不能 import glance.js 的推导函数 —— 所以这里只读元数据，不重算。
 *
 * 条目上限 60（规格 §9.3）：normalize 里截断、不抛错；写失败降级本机 + 通知，绝不静默。
 * 先攻条 / 列表窗口里的 GM 操作由页面自己写房间数据（同一套 initiative.js 逻辑）。
 * 玩家点「结束我的回合」时不能写房间数据，改成 broadcast 请求；只有 GM 客户端
 * 收到后按规格 §5 做四道校验才推进。
 * ------------------------------------------------------------------------- */
var INIT_MAX_ENTRIES = 60;
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
    var name = String(e.name == null ? "" : e.name).trim().slice(0, 80) || "未命名";
    var d20raw = initNum(e.d20, null);
    var tbraw = initNum(e.tb, null);
    out.entries.push({
      tokenId: tokenId,
      name: name,
      /* init 允许小数：拖拽排序写的是两卡中点，显示时才 Math.round（规格 §4） */
      init: initClamp(initNum(e.init, 0), -99, 999),
      bonus: initClamp(initInt(e.bonus, 0), -99, 999),
      d20: d20raw === null ? null : initClamp(Math.round(d20raw), 1, 20),
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
/** 排序（规格 §7.2，只有两级）：合计 DESC → tiebreak ASC。与 initiative.js 的 sortEntries 一致。 */
function initSortEntries(list) {
  return list.slice().sort(function (a, b) {
    var d = initNum(b.init, 0) - initNum(a.init, 0);
    if (d) return d;
    var t = initTbOf(a) - initTbOf(b);
    if (t) return t;
    return String(a.name).localeCompare(String(b.name), "zh-CN") || (initInt(a.updatedAt, 0) - initInt(b.updatedAt, 0));
  });
}
/** tiebreak（规格 §7.1）：0.5 − bonus×0.01 + 抖动(<0.01)，夹在 (0.001, 0.999)。 */
function initTiebreak(bonus) {
  var m = typeof bonus === "number" && isFinite(bonus) ? bonus : 0;
  var base = 0.5 - m * 0.01 + Math.random() * 0.008;
  return Math.round(Math.max(0.001, Math.min(0.999, base)) * 1e6) / 1e6;
}

/** 本机降级副本（上次写失败留下的）。 */
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

async function initRead() {
  try {
    var meta = await OBR.room.getMetadata();
    var raw = meta ? meta[KEY_INITIATIVE] : null;
    if (raw) {
      var st = initNorm(raw);
      st.entries = initSortEntries(st.entries);
      return st;
    }
    return initLocalFallback() || initNorm(null);
  } catch (e) {
    pageLog("err", "读取先攻失败：" + errText(e));
    return initLocalFallback() || initNorm(null);
  }
}

/** 写房间数据；失败 → 本机暂存 + WARNING（不抛错，界面上不会「点了没反应」）。 */
async function initWrite(state) {
  var next = initNorm(state);
  next.entries = initSortEntries(next.entries);
  next.updatedAt = Date.now();
  try {
    await OBR.room.setMetadata({ [KEY_INITIATIVE]: next });
    try { localStorage.removeItem(INIT_LS_FALLBACK); } catch (e2) { /* 忽略 */ }
    return next;
  } catch (e) {
    var msg = errText(e);
    try {
      localStorage.setItem(INIT_LS_FALLBACK, JSON.stringify({ v: 1, updatedAt: Date.now(), state: next }));
    } catch (e3) { /* 本机也存不下 */ }
    notify("先攻没能写进房间数据（" + msg + "）：已暂存在本机。先攻最多 " + INIT_MAX_ENTRIES + " 条。", "WARNING");
    next.local = true;
    return next;
  }
}
function initRollD20() {
  return Math.floor(Math.random() * 20) + 1;
}
/** 只读 token 元数据里的加值；缺失时 +0（面板打开先攻 tab 会补写）。 */
function initBonusOf(item) {
  var m = item && item.metadata ? item.metadata[KEY_INIT] : null;
  if (m && typeof m === "object" && typeof m.bonus === "number" && isFinite(m.bonus)) {
    return initClamp(Math.round(m.bonus), -99, 999);
  }
  return 0;
}
/** 加进先攻（已在列表里就只更新名字 / 加值 / 隐形标记，不重掷）。 */
async function initAdd(item, hidden) {
  if (!item || !item.id) return null;
  var state = await initRead();
  var cards = await getCards();
  var cardId = item.metadata ? item.metadata[KEY_BIND] : null;
  var card = typeof cardId === "string" ? findCard(cards, cardId) : null;
  var name = String(item.name || (card && card.name) || "未命名").trim().slice(0, 80) || "未命名";
  var bonus = initBonusOf(item);
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
      init: old.init,
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
    /* 加入时一次算好 d20 + 加值，并给一个 tiebreak（规格 §8：存的是合计，不显示时才加）。 */
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
  return { state: next, entry: entry };
}

async function onInitMenuClick(context, hidden) {
  try {
    var role = await OBR.player.getRole();
    if (role !== "GM") {
      notify("加入先攻需要城主权限（房间数据只有城主能写）", "WARNING");
      return;
    }
    var picked = context && context.items && context.items[0] ? context.items[0] : null;
    if (!picked) {
      notify("没有读到选中的 token，右键请对着一个图片 token 再试", "WARNING");
      return;
    }
    /* context 里的 item 可能是右键那一刻的快照：重新取一次，保证 init 元数据是最新的。 */
    var fresh = null;
    try { fresh = (await OBR.scene.items.getItems([picked.id]))[0] || null; } catch (e) { fresh = null; }
    var res = await initAdd(fresh || picked, hidden);
    if (!res) return;
    stepOk("加入先攻：" + res.entry.name + (hidden ? "（隐形）" : ""));
    notify("「" + res.entry.name + "」" + (hidden ? "已隐形加入先攻" : "已加入先攻") +
      "（先攻 " + Math.round(res.entry.init) + "）", "SUCCESS");
    /* v1.4.0：先攻条没开着就顺手打开 —— 右键加入后立刻能看到条（规格 §P2）。 */
    if (!stripOpen) void openStripOrNotify("右键加入先攻");
  } catch (e) {
    stepFail("加入先攻", e);
  }
}

/**
 * 推进 / 后退一回合（规格 §6，与 initiative.js 的 advanceInitiative 同一套公式）：
 * nextIndex = (cur + 1 + len) % len；绕回第一张 → 轮数 +1（突袭轮绕回则进入正常第 1 轮）；
 * 从第一张往回 → 轮数 −1，最小 1。
 */
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

/**
 * 玩家「结束我的回合」：广播到所有客户端，只有 GM 客户端会真正写入。
 * 规格 §5 的四道校验（缺一不可）：
 *   1) 请求里必须带 activeId，且与当前一致（缺失 / 过期都拒绝 —— 老版本写反过，会连推两格）；
 *   2) 当前条目必须是这个玩家的 token（优先 token.createdUserId 这个活值，其次存下来的 ownerId）；
 *   3) 只有 GM 客户端处理（非 GM 直接返回，不写数据）；
 *   4) 正在推进中（上一个请求还没写完）时忽略重复请求。
 * 另外：不在 combat 阶段时不推进（准备阶段点「结束」没有意义）。
 */
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
    /* 第 1 道：缺失 / 过期都拒绝。 */
    if (!data.activeId || data.activeId !== state.activeId) {
      notify("回合已经变了，结束回合请求已忽略", "WARNING");
      return;
    }
    /* 第 2 道：owner 以 token 上的活值为准（GM 用「Give Ownership」改过归属时，旧 ownerId 会失效）。 */
    var owner = active.ownerId;
    try {
      var items = await OBR.scene.items.getItems([active.tokenId]);
      var live = items && items[0] ? String(items[0].createdUserId || "") : "";
      if (live) owner = live;
    } catch (e2) { /* 拿不到就退回存下来的 ownerId */ }
    if (!data.playerId || owner !== data.playerId) {
      notify("只能结束自己的回合", "WARNING");
      return;
    }
    var next = initAdvance(state, 1);
    await initWrite(next);
    notify("「" + active.name + "」结束回合 → " +
      (next.surprise ? "突袭轮" : "第 " + next.round + " 轮"), "INFO");
  } catch (e) {
    pageLog("err", "处理结束回合请求失败：" + errText(e));
  } finally {
    /* 第 4 道：等写入落定再解锁（避免广播里的重复请求再推一格）。 */
    initBusy = false;
  }
}

/* ---------------------------------------------------------------------------
 * 7.5) 骰子落库（v1.5.0）
 * ---------------------------------------------------------------------------
 * 数据流（规格 §4/§5）：
 *   任何人的骰子窗口 → CH_ROLL（LOCAL + REMOTE）
 *     → **只有城主客户端**的这里处理：校验 + 归一化 + 幂等合并
 *     → OBR.room.setMetadata({ [KEY_ROLLS]: { v, updatedAt, seq, rows } })
 *     → 广播 CH_ROLL_SAVED { seq, rollId }（页面据此清掉「未落库」计时器）
 *   玩家永远不写房间数据（Owlbear 也不允许）；城主不在线时页面自己暂存本机 + 黄条提示。
 *
 * 校验边界（规格 §5 的安全边界）：假设同桌可信，**不校验骰值真伪**，只校验形状与范围：
 *   type 必须是 ^d\d+$、value 夹在 1..sides（用 sidesOf 的同一规则，d600 不会被夹成 20）、
 *   total 用同一公式重算（三端一致）、label / expression 截断、rollId 必填。
 *   不合法的单条**丢弃并记日志**，绝不整批失败。
 *
 * 这一段的 rollNorm / rollMerge 是 assets/dice-core.js 里 normalizeRoll / mergeRollRows 的
 * **同位实现**（经典脚本不能 import）；两边的上限与公式由 dev/check.mjs + dev/test-dice.mjs 钉住。
 * ------------------------------------------------------------------------- */
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
/** 归一化一条投掷（与 dice-core.js 的 normalizeRoll 同结果）。没有 rollId 就直接丢弃。 */
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
  /* 加值只取整、不夹上下限：与 dice-core.js 的 normalizeRoll 必须算出一模一样的 total */
  var modifier = typeof raw.modifier === "number" && isFinite(raw.modifier) ? Math.round(raw.modifier) : 0;
  var base = 0;
  for (var q = 0; q < dice.length; q++) {
    if (dice[q].loser) continue;
    base += dice[q].subtract ? -Math.abs(dice[q].value) : dice[q].value;
  }
  /* 总和公式与 dice-core.js 的 computeTotal 一致：kept 求和 + modifier × 行数（repeat 每行各算一次） */
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
/** 幂等合并：同 rollId 不重复插 → 按 ts 倒序 → 封顶 40。
 *  **超过 40 条时删掉最旧的那条**：倒序后 slice(0, 40) 砍掉的正是 ts 最小的尾巴，
 *  与 dice-core.js 的 mergeRollRows 是同一行为（dev/test-dice.mjs 第 13 条钉死）。 */
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
/** 写房间数据；超 12 KB 就先砍一半旧行（16 KB 的 75%，规格 §9.2 的风险对策）。 */
async function rollWrite(rows, seq) {
  var box = {
    v: 1,
    updatedAt: Date.now(),
    seq: Math.max(0, rollInt(seq, 0, 999999, 0)),
    rows: (rows || []).slice(0, ROLL_MAX_ROWS)
  };
  while (JSON.stringify(box).length > ROLL_ROOM_BYTES && box.rows.length > 1) {
    box.rows = box.rows.slice(0, Math.ceil(box.rows.length / 2));
  }
  try {
    await OBR.room.setMetadata({ [KEY_ROLLS]: box });
    return true;
  } catch (e) {
    notify("骰子记录没能写进房间数据（" + errText(e) + "）：最多保留 " + ROLL_MAX_ROWS + " 条，旧行会自动裁掉。", "WARNING");
    return false;
  }
}
function rollBroadcastSaved(payload) {
  try {
    var p1 = OBR.broadcast.sendMessage(CH_ROLL_SAVED, payload, { destination: "LOCAL" });
    if (p1 && typeof p1.catch === "function") p1.catch(function () { /* 忽略 */ });
  } catch (e) { /* 忽略 */ }
  try {
    var p2 = OBR.broadcast.sendMessage(CH_ROLL_SAVED, payload, { destination: "REMOTE" });
    if (p2 && typeof p2.catch === "function") p2.catch(function () { /* 忽略 */ });
  } catch (e2) { /* 忽略 */ }
}
/* 收到投掷就排队：**串行**写入，避免两次 setMetadata 互相覆盖（丢一条历史比慢 10ms 糟得多）。 */
var rollQueue = [];
var rollBusy = false;

async function rollRole() {
  try { return await OBR.player.getRole(); } catch (e) { return ""; }
}

async function rollApply(job) {
  if (job && job.clear) {
    var box0 = await rollReadBox();
    var seq0 = box0 && typeof box0.seq === "number" && isFinite(box0.seq) ? Math.round(box0.seq) : 0;
    var okClear = await rollWrite([], seq0 + 1);
    if (!okClear) return;
    rollBroadcastSaved({ seq: seq0 + 1, rollId: "", cleared: true, by: job.by, at: Date.now() });
    pageLog("info", "骰子记录已清空（城主）");
    return;
  }
  var incoming = rollNorm(job);
  if (!incoming) {
    pageLog("info", "收到一条不合法的投掷（缺 rollId / 骰值越界），已丢弃");
    return;
  }
  var box = await rollReadBox();
  var seq = box && typeof box.seq === "number" && isFinite(box.seq) ? Math.round(box.seq) : 0;
  var existing = rollRowsOf(box);
  /* 幂等：同一个 rollId 已经落过库（LOCAL + REMOTE 各来一次、或页面重连重发）就只回一条 saved，不重复写 */
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].rollId === incoming.rollId) {
      rollBroadcastSaved({ seq: seq, rollId: incoming.rollId, duplicate: true, at: Date.now() });
      pageLog("info", "重复的投掷（同 rollId）已忽略：" + incoming.rollId);
      return;
    }
  }
  var rows = rollMerge(existing, incoming);
  var ok = await rollWrite(rows, seq + 1);
  if (!ok) return;
  rollBroadcastSaved({ seq: seq + 1, rollId: incoming.rollId, at: Date.now() });
  pageLog("info", "骰子落库：" + (incoming.rollerName || "某人") + " " + (incoming.expression || "") + " = " + incoming.total);
}

async function pumpRolls() {
  if (rollBusy) return;
  rollBusy = true;
  try {
    while (rollQueue.length) {
      var job = rollQueue.shift();
      try { await rollApply(job); } catch (e) { pageLog("err", "骰子落库失败：" + errText(e)); }
    }
  } finally {
    rollBusy = false;
  }
}

/** 收到一次投掷：只有城主客户端会真的写；写入后广播 CH_ROLL_SAVED。 */
async function onRoll(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  if (!data || typeof data !== "object") return;
  var role = await rollRole();
  if (role !== "GM") return;
  rollQueue.push(data);
  void pumpRolls();
}

/** 清空全桌记录（只有城主能做）。 */
async function onRollClear(ev) {
  var data = ev && ev.data !== undefined ? ev.data : ev;
  var role = await rollRole();
  if (role !== "GM") return;
  rollQueue.push({ clear: true, by: data && data.by });
  void pumpRolls();
}

/* ---------------------------------------------------------------------------
 * 8) 启动
 * ------------------------------------------------------------------------- */
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

async function boot() {
  if (booted) return;
  booted = true;
  var t0 = Date.now();

  pageLog("info", "OBR.onReady 触发；插件 v" + PLUGIN_VERSION + "；BASE=" + BASE);
  pageLog("info", "OBR.isAvailable=" + String(OBR.isAvailable) + "；isReady=" + String(OBR.isReady));

  /* 7.1 入口 B：工具栏（v1.3.2：速览 / 角色卡 / 先攻 / 骰子 / 设置 五个并列入口） */
  bootStatus.tool = await attempt("注册工具栏按钮 (OBR.tool.create ×5)", registerTools);

  /* 7.2 右键菜单 */
  bootStatus.menu = await attempt("注册右键菜单 (OBR.contextMenu.create)", registerContextMenu);

  /* 7.3 右下角浮动按钮（要等场景就绪） */
  bootStatus.scene = await sceneReady();
  bootStatus.button = await syncSceneButton();
  if (bootStatus.button) stepOk("打开右下角浮动按钮 ✓");
  else if (!bootStatus.scene) stepOk("场景还没就绪，浮动按钮等进入地图后再开");

  /* 7.4 事件订阅 */
  await attempt("订阅 scene.onReadyChange", function () {
    OBR.scene.onReadyChange(function () {
      void syncSceneButton();
      scheduleBars();
    });
  });
  await attempt("订阅 player.onChange", function () {
    OBR.player.onChange(scheduleRefresh);
  });
  await attempt("订阅 scene.items.onChange", function () {
    OBR.scene.items.onChange(function () {
      scheduleRefresh();
      scheduleBars();
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
    OBR.room.onMetadataChange(scheduleRefresh);
  });
  await attempt("订阅 " + CH_INFO_DRAG + "（速览弹窗拖动）", function () {
    OBR.broadcast.onMessage(CH_INFO_DRAG, onInfoDrag);
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
  await attempt("订阅 " + CH_ROLL + "（骰子落库：仅城主处理）", function () {
    OBR.broadcast.onMessage(CH_ROLL, onRoll);
  });
  await attempt("订阅 " + CH_ROLL_CLEAR + "（清空骰子记录）", function () {
    OBR.broadcast.onMessage(CH_ROLL_CLEAR, onRollClear);
  });
  await attempt("订阅 " + CH_DICE_HIST_CMD + "（记录窗口开关）", function () {
    OBR.broadcast.onMessage(CH_DICE_HIST_CMD, onDiceHistCmd);
  });
  await attempt("订阅 viewport.onChange", function () {
    if (!OBR.viewport || typeof OBR.viewport.onChange !== "function") return; /* 旧版 SDK 没有 */
    var timer = null;
    OBR.viewport.onChange(function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        void syncSceneButton();
        /* 视口变小（笔记本合盖 / 横向转纵向）后，开着的窗口重新夹回视口内 */
        void reclampWins();
        /* 先攻条贴顶居中，视口一变就按记住的偏移重新夹紧 */
        void reclampStrip();
      }, 250);
    });
  });

  await refreshInfo().catch(function (e) { stepFail("初始化速览", e); });

  /* 7.5 token 血条：先挂自愈监听，再把现有 token 画一遍 */
  await watchLocalBars();
  scheduleBars();

  /* 7.6 汇总一条通知：一眼看出哪个入口没注册上 */
  var mark = function (v) { return v ? "✓" : "✗"; };
  var okLine = "4eNEXT to owlbear v" + PLUGIN_VERSION + " 已加载：工具栏×5 " + mark(bootStatus.tool) +
    " · 右键" + mark(bootStatus.menu) +
    " · 浮动按钮" + (bootStatus.scene ? mark(bootStatus.button) : "（等进地图）");
  var allOk = bootStatus.tool && bootStatus.menu;
  pageLog(allOk ? "ok" : "err", okLine + "；耗时 " + (Date.now() - t0) + "ms");
  if (diagNotifyEnabled()) notify(okLine, allOk ? "INFO" : "WARNING");

  /* 7.7 心跳：告诉面板「后台活着」，面板也会 ping 回来 */
  await sendHello(CH_HELLO, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
  try {
    OBR.broadcast.onMessage(CH_PING, function () {
      void sendHello(CH_PONG, { version: PLUGIN_VERSION, status: bootStatus, at: Date.now(), href: location.href });
    });
  } catch (e) {
    pageLog("err", "订阅 " + CH_PING + " 失败：" + errText(e));
  }
}

/* ---------------------------------------------------------------------------
 * 9) 启动保护：任何未捕获错误都变成可见通知（而不是静默死掉）
 * ------------------------------------------------------------------------- */
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
} catch (e) { /* 忽略：注册失败也不能让后台在这里停下来 */ }

/* ---------------------------------------------------------------------------
 * 10) OBR 环境自检 + 启动
 * ------------------------------------------------------------------------- */
if (typeof OBR === "undefined" || !OBR || typeof OBR.onReady !== "function") {
  /* 没有拿到 SDK：把原因写出来。后台页是隐藏的，但绝不能静默退出 ——
   * 一旦这里悄悄 return，面板的 diag-ping 就永远等不到 pong，只会看到「后台脚本没有响应」。 */
  pageLog("err", "没有拿到 OBR 对象：vendor/obr-sdk.js 没拼进 bundle，或 SDK 加载失败");
  try {
    var stEl = document.getElementById("diag-state");
    if (stEl) { stEl.className = "bad"; stEl.textContent = "没有拿到 OBR 对象：右键菜单 / 先攻都不会工作"; }
  } catch (e2) { /* 忽略 */ }
  if (diagNotifyEnabled()) notify("4E 后台：没有拿到 OBR 对象，右键菜单 / 先攻都不会工作", "ERROR");
} else {
  /* 启动：直接把 boot 交给 onReady（不要包一层丢弃返回值）。
   *   · 已就绪 → SDK 会立刻同步调用；
   *   · 未就绪 → 等 SDK 回调。
   * 面板的 ping/pong 订阅在 boot 的最后一步，只有 boot 真的跑起来，面板才会显示「后台已连接」。 */
  try {
    OBR.onReady(boot);
  } catch (e3) {
    pageLog("err", "注册 OBR.onReady 失败：" + errText(e3));
    if (diagNotifyEnabled()) notify("4E 后台：注册 OBR.onReady 失败：" + errText(e3), "ERROR");
  }
}

})();
