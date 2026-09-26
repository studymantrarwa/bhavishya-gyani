/* Bhavishya Gyani — incoming voice-call alert.
   Uses the existing custom account/session system and the call request API.
   No paid calling SDK is used. */
(function(){
 'use strict';
 if(window.__BG_CALL_GLOBAL__)return;window.__BG_CALL_GLOBAL__=true;
 const active=()=>{try{return localStorage.getItem('bgActiveAccountType')||''}catch(e){return ''}};
 const token=()=>{try{return localStorage.getItem('bgToken_'+active())}catch(e){return null}};
 const seenKey='bgCallRequestSeen';
 let current=null,timer=null;
 const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 async function api(url,opt={}){const t=token();if(!t)throw Error('LOGIN_REQUIRED');opt.headers={...(opt.headers||{}),Authorization:'Bearer '+t};const r=await fetch(url,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Request failed');return j}
 function seen(){try{return JSON.parse(localStorage.getItem(seenKey)||'{}')}catch(e){return {}}}
 function mark(id){try{const x=seen();x[id]=Date.now();localStorage.setItem(seenKey,JSON.stringify(x))}catch(e){}}
 function cleanup(){try{const x=seen(),cut=Date.now()-86400000;Object.keys(x).forEach(k=>{if(x[k]<cut)delete x[k]});localStorage.setItem(seenKey,JSON.stringify(x))}catch(e){}}
 function ui(){if(document.getElementById('bgCallLayer'))return;
  const st=document.createElement('style');st.id='bgCallStyle';st.textContent=`#bgCallLayer{position:fixed;inset:0;z-index:2147483001;display:none;align-items:center;justify-content:center;padding:16px;background:#0009}#bgCallBox{width:min(390px,100%);background:#17191d;color:#fff;border:1px solid #ffc400;border-radius:20px;box-shadow:0 20px 70px #000c;overflow:hidden}#bgCallHead{padding:15px;background:#ffc400;color:#111;font-weight:900;font-size:18px}#bgCallBody{padding:18px}.bgCallName{font-size:21px;font-weight:900}.bgCallMeta{color:#bfc3c9;font-size:12px;margin-top:5px}.bgCallTimer{font-size:26px;font-weight:900;margin:14px 0}.bgCallActions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bgCallActions button{border:0;border-radius:12px;padding:13px;font-weight:900;font-size:15px}.bgCallAccept{background:#2bd46b;color:#06120a}.bgCallReject{background:#ff4652;color:#fff}`;document.head.appendChild(st);
  const d=document.createElement('div');d.id='bgCallLayer';d.innerHTML='<div id="bgCallBox"><div id="bgCallHead">📞 Incoming Voice Call</div><div id="bgCallBody"><div id="bgCallName" class="bgCallName">Voice Call</div><div id="bgCallMeta" class="bgCallMeta"></div><div id="bgCallTimer" class="bgCallTimer">02:00</div><div class="bgCallActions"><button class="bgCallReject" id="bgCallReject">Reject</button><button class="bgCallAccept" id="bgCallAccept">Accept</button></div></div></div>';document.body.appendChild(d);
  document.getElementById('bgCallReject').onclick=()=>respond('reject');
  document.getElementById('bgCallAccept').onclick=()=>respond('accept');
 }
 function show(c){ui();current=c;mark(c.id);document.getElementById('bgCallName').textContent=(active()==='user'?c.astrologer?.full_name:c.user?.full_name)||'Voice Call';document.getElementById('bgCallMeta').textContent='Voice call request';document.getElementById('bgCallLayer').style.display='flex';let end=Date.now()+120000;clearInterval(timer);timer=setInterval(()=>{const left=Math.max(0,end-Date.now());document.getElementById('bgCallTimer').textContent=String(Math.floor(left/60000)).padStart(2,'0')+':'+String(Math.floor(left/1000)%60).padStart(2,'0');if(!left){clearInterval(timer);hide()}},250)}
 function hide(){clearInterval(timer);const x=document.getElementById('bgCallLayer');if(x)x.style.display='none';current=null}
 async function respond(action){if(!current)return;const id=current.id;try{const x=await api('/api/call-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:id,action})});hide();if(action==='accept')location.href='/call.html?conversation_id='+encodeURIComponent(id)}catch(e){alert(e.message);hide()}}
 async function poll(){if(!['user','astrologer'].includes(active())||!token())return;try{const x=await api('/api/call-requests');const r=x.requests||[];if(!current&&r.length){const c=r[0];show(c);try{if('Notification' in window&&Notification.permission==='granted')new Notification('Incoming Voice Call',{body:((active()==='user'?c.astrologer?.full_name:c.user?.full_name)||'Someone')+' is calling you.'})}catch(e){}}}catch(e){}}
 ui();cleanup();poll();setInterval(poll,2000);
})();