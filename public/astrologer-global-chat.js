/* Global Astrologer Chat Request Alert
   Runs on every page but activates only for an authenticated astrologer.
   It polls pending requests, uses BroadcastChannel/localStorage for same-browser
   instant fan-out, and shows an in-app popup + browser notification when allowed. */
(function(){
  'use strict';
  if(window.__BG_ASTRO_GLOBAL_CHAT__) return;
  window.__BG_ASTRO_GLOBAL_CHAT__=true;
  const TOKEN_KEY='bgToken_astrologer';
  const ACTIVE_KEY='bgActiveAccountType';
  const seenKey='bgAstroRequestSeen';
  let timer=null, current=null, audioCtx=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const token=()=>{try{return localStorage.getItem(TOKEN_KEY)}catch(e){return null}};
  const active=()=>{try{return localStorage.getItem(ACTIVE_KEY)||''}catch(e){return ''}};
  function isAstro(){return active()==='astrologer' && !!token()}
  async function api(url,opt={}){
    opt.headers={...(opt.headers||{}),Authorization:'Bearer '+token()};
    const r=await fetch(url,opt);const j=await r.json().catch(()=>({}));
    if(!r.ok) throw Error(j.error||'Request failed'); return j;
  }
  function seen(){try{return JSON.parse(localStorage.getItem(seenKey)||'{}')}catch(e){return {}}}
  function markSeen(id){try{const s=seen();s[id]=Date.now();localStorage.setItem(seenKey,JSON.stringify(s))}catch(e){}}
  function cleanupSeen(){try{const s=seen(),cut=Date.now()-86400000;Object.keys(s).forEach(k=>{if(Number(s[k])<cut)delete s[k]});localStorage.setItem(seenKey,JSON.stringify(s))}catch(e){}}
  function notifySound(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=880;g.gain.value=.035;o.connect(g);g.connect(audioCtx.destination);o.start();setTimeout(()=>{o.frequency.value=660},110);setTimeout(()=>{o.stop();g.disconnect()},220)}catch(e){}}
  async function browserNotify(c){try{
    if(!('Notification' in window))return;
    if(Notification.permission==='default') await Notification.requestPermission();
    if(Notification.permission==='granted'){
      const n=new Notification('New Chat Request — Bhavishya Gyani',{body:(c.user?.full_name||'User')+' ने chat request भेजी है. 2 मिनट में Accept/Reject करें.',tag:'bg-chat-'+c.id,renotify:true});
      n.onclick=()=>{window.focus();show(c)};
      setTimeout(()=>n.close(),10000);
    }
  }catch(e){}}
  function ensureUI(){if(document.getElementById('bgAstroRequestLayer'))return;
    const css=document.createElement('style');css.id='bgAstroRequestStyle';css.textContent=`
      #bgAstroRequestLayer{position:fixed;inset:0;z-index:2147483000;display:none;align-items:flex-start;justify-content:center;padding:14px;pointer-events:none;background:rgba(0,0,0,.28)}
      #bgAstroRequestBox{pointer-events:auto;width:min(430px,100%);margin-top:max(12px,env(safe-area-inset-top));background:#18191c;color:#fff;border:1px solid #ffc400;border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.55);overflow:hidden}
      #bgAstroRequestBox .bg-head{padding:14px 16px;background:#ffc400;color:#111;font-weight:900;display:flex;justify-content:space-between;gap:10px}
      #bgAstroRequestBox .bg-body{padding:16px}.bg-req-name{font-size:19px;font-weight:900}.bg-req-meta{color:#bfc0c5;font-size:13px;margin-top:4px}.bg-req-timer{font-size:24px;font-weight:900;margin:13px 0}.bg-req-kundli{display:inline-block;margin-top:8px;border:0;border-radius:9px;padding:8px 10px;background:#ffc400;color:#111;font-weight:900;cursor:pointer}.bg-req-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.bg-req-actions button{border:0;border-radius:11px;padding:12px;font-weight:900;cursor:pointer}.bg-accept{background:#42d466;color:#07140a}.bg-reject{background:#ff4652;color:#fff}.bg-req-status{margin-top:9px;color:#aaa;font-size:12px;min-height:16px}
      #bgAstroBell{position:fixed;right:14px;bottom:78px;z-index:2147482999;width:50px;height:50px;border:1px solid #ffc400;border-radius:50%;background:#18191c;color:#ffc400;font-size:21px;box-shadow:0 8px 28px rgba(0,0,0,.45);display:none;cursor:pointer}
      #bgAstroBell .bg-dot{position:absolute;right:-1px;top:-1px;width:13px;height:13px;border-radius:50%;background:#ff3d4d;border:2px solid #18191c}
    `;document.head.appendChild(css);
    const layer=document.createElement('div');layer.id='bgAstroRequestLayer';layer.innerHTML=`<div id="bgAstroRequestBox"><div class="bg-head"><span>🔔 New Chat Request</span><span id="bgReqCount"></span></div><div class="bg-body"><div class="bg-req-name" id="bgReqName">New user</div><div class="bg-req-meta" id="bgReqMeta">Chat request</div><div id="bgReqBirth" style="margin-top:10px;padding:10px;border:1px solid #383c43;border-radius:10px;font-size:12px;color:#ddd">जन्म विवरण उपलब्ध नहीं</div><div id="bgReqKundli"></div><div class="bg-req-timer" id="bgReqTimer">02:00</div><div class="bg-req-actions"><button class="bg-accept" id="bgReqAccept">✓ Accept</button><button class="bg-reject" id="bgReqReject">✕ Reject</button></div><div class="bg-req-status" id="bgReqStatus"></div></div></div>`;
    document.body.appendChild(layer);
    const bell=document.createElement('button');bell.id='bgAstroBell';bell.innerHTML='🔔<span class="bg-dot"></span>';bell.title='Chat requests';bell.onclick=()=>current&&show(current);document.body.appendChild(bell);
    document.getElementById('bgReqAccept').onclick=()=>respond('accept');
    document.getElementById('bgReqReject').onclick=()=>respond('reject');
  }
  async function show(c){current=c;ensureUI();const box=document.getElementById('bgAstroRequestLayer');box.style.display='flex';document.getElementById('bgAstroBell').style.display='none';document.getElementById('bgReqName').textContent=c.user?.full_name||'New User';document.getElementById('bgReqMeta').textContent='Chat request · '+(c.channel||'chat');document.getElementById('bgReqStatus').textContent='';const birth=document.getElementById('bgReqBirth'),kb=document.getElementById('bgReqKundli');birth.textContent='जन्म विवरण लोड हो रहा है…';kb.innerHTML='';try{const x=await api('/api/chat?conversation_id='+encodeURIComponent(c.id));const i=x.prechat||{};birth.innerHTML=i.name?('नाम: '+esc(i.name)+'<br>जन्म तारीख: '+esc(i.dob||'—')+'<br>जन्म समय: '+esc(i.birth_time||'—')+'<br>जन्म स्थान: '+esc(i.place||'—')):'जन्म विवरण उपलब्ध नहीं';if(i.kundali_id){kb.innerHTML='<button class="bg-req-kundli" id="bgReqOpenKundli">📜 Open Kundli</button>';document.getElementById('bgReqOpenKundli').onclick=()=>location.href='/shared-kundli.html?conversation_id='+encodeURIComponent(c.id)}}catch(e){birth.textContent='जन्म विवरण उपलब्ध नहीं';}updateTimer();}
  function hide(){current=null;const l=document.getElementById('bgAstroRequestLayer');if(l)l.style.display='none';const b=document.getElementById('bgAstroBell');if(b)b.style.display='none';}
  function updateTimer(){if(!current)return;const end=new Date(new Date(current.requested_at||current.created_at).getTime()+120000).getTime();const sec=Math.max(0,Math.ceil((end-Date.now())/1000));const el=document.getElementById('bgReqTimer');if(el)el.textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');if(sec<=0){hide();poll();}}
  async function respond(action){
    if(!current)return;
    const id=current.id, saved={...current};
    const accept=document.getElementById('bgReqAccept'), reject=document.getElementById('bgReqReject');
    [accept,reject].forEach(b=>{if(b){b.disabled=true;b.style.opacity='.65'}});
    const status=document.getElementById('bgReqStatus'); if(status)status.textContent=action==='accept'?'Accepting request…':'Rejecting request…';
    try{
      const x=await api('/api/astrologer-requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,conversationId:id})});
      markSeen(id);
      if(action==='accept'){
        current=null; hide();
        try{if(typeof window.loadRequests==='function')window.loadRequests()}catch(_){ }
        try{if(typeof window.loadChats==='function')window.loadChats()}catch(_){ }
        // Accept is the start signal: take the astrologer straight into the active chat.
        location.href='/chat.html?conversation_id='+encodeURIComponent(id);
      }else{
        hide();
        try{if(typeof window.loadRequests==='function')window.loadRequests()}catch(_){ }
        setTimeout(poll,250);
      }
    }catch(e){
      show(saved);
      const st=document.getElementById('bgReqStatus');if(st)st.textContent=e.message||'Request action failed';
      [accept,reject].forEach(b=>{if(b){b.disabled=false;b.style.opacity='1'}});
    }
  }
  async function poll(){if(!isAstro())return;cleanupSeen();try{const x=await api('/api/astrologer-requests');const rows=(x.requests||[]).filter(c=>c.status==='requested');rows.sort((a,b)=>new Date(a.requested_at||a.created_at)-new Date(b.requested_at||b.created_at));const c=rows.find(r=>new Date(r.requested_at||r.created_at).getTime()+120000>Date.now());if(!c){if(!current) {const bell=document.getElementById('bgAstroBell');if(bell)bell.style.display='none'}return}if(current?.id===c.id){updateTimer();return}show(c);if(!seen()[c.id]){notifySound();browserNotify(c)} }catch(e){/* transient errors are silent */}}
  async function start(){try{if(!token())return;const me=await api('/api/me');if(me.user?.role!=='astrologer')return;try{localStorage.setItem(ACTIVE_KEY,'astrologer')}catch(e){}}catch(e){return}ensureUI();poll();clearInterval(timer);timer=setInterval(()=>{if(isAstro()){updateTimer();poll()}else hide()},2000);try{const bc=new BroadcastChannel('bg-astro-chat-requests');bc.onmessage=e=>{if(e.data?.type==='chat-request'&&isAstro())poll()};window.__bgAstroBC=bc}catch(e){}
    window.addEventListener('storage',e=>{if(e.key==='bgAstroChatRequest'&&isAstro())poll()});
  }
  window.BG_ASTRO_GLOBAL_CHAT={start,poll,show};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
