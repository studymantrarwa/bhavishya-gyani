/* Global USER chat request/confirmation alert.
   Chat-only patch: watches for an astrologer accepting a user's pending request
   and lets the user confirm/start the chat from the User Panel. */
(function(){
  'use strict';
  if(window.__BG_USER_GLOBAL_CHAT__) return;
  window.__BG_USER_GLOBAL_CHAT__=true;
  const TOKEN_KEY='bgToken_user', ACTIVE_KEY='bgActiveAccountType';
  let timer=null,current=null,audioCtx=null;
  const token=()=>{try{return localStorage.getItem(TOKEN_KEY)}catch(e){return null}};
  const active=()=>{try{return localStorage.getItem(ACTIVE_KEY)||''}catch(e){return ''}};
  const isUser=()=>active()==='user'&&!!token();
  async function api(url,opt={}){opt.headers={...(opt.headers||{}),Authorization:'Bearer '+token()};const r=await fetch(url,opt);const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Request failed');return j}
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function sound(){try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=740;g.gain.value=.035;o.connect(g);g.connect(audioCtx.destination);o.start();setTimeout(()=>o.frequency.value=980,120);setTimeout(()=>{o.stop();g.disconnect()},260)}catch(e){}}
  function ensureUI(){if(document.getElementById('bgUserChatConfirmLayer'))return;
    const st=document.createElement('style');st.id='bgUserChatConfirmStyle';st.textContent=`
      #bgUserChatConfirmLayer{position:fixed;inset:0;z-index:2147483000;display:none;align-items:flex-start;justify-content:center;padding:14px;pointer-events:none;background:rgba(0,0,0,.28)}
      #bgUserChatConfirmBox{pointer-events:auto;width:min(430px,100%);margin-top:max(12px,env(safe-area-inset-top));background:#18191c;color:#fff;border:1px solid #ffc400;border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.55);overflow:hidden}
      #bgUserChatConfirmBox .uc-head{padding:14px 16px;background:#ffc400;color:#111;font-weight:900;display:flex;justify-content:space-between;gap:10px}
      #bgUserChatConfirmBox .uc-body{padding:16px}.uc-name{font-size:19px;font-weight:900}.uc-meta{color:#c4c4c8;font-size:13px;margin-top:5px}.uc-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}.uc-actions button{border:0;border-radius:11px;padding:12px;font-weight:900;cursor:pointer}.uc-start{background:#42d466;color:#07140a}.uc-later{background:#34363b;color:#fff}.uc-status{margin-top:9px;color:#aaa;font-size:12px;min-height:16px}
    `;document.head.appendChild(st);
    const layer=document.createElement('div');layer.id='bgUserChatConfirmLayer';layer.innerHTML=`<div id="bgUserChatConfirmBox"><div class="uc-head"><span>💬 Chat Request Accepted</span><span>✓</span></div><div class="uc-body"><div class="uc-name" id="bgUcName">Astrologer</div><div class="uc-meta" id="bgUcMeta">Astrologer ने आपका chat request accept कर लिया है।</div><div class="uc-actions"><button class="uc-start" id="bgUcStart">✓ Confirm & Start Chat</button><button class="uc-later" id="bgUcLater">बाद में</button></div><div class="uc-status" id="bgUcStatus"></div></div></div>`;
    document.body.appendChild(layer);
    document.getElementById('bgUcStart').onclick=confirmStart;
    document.getElementById('bgUcLater').onclick=hide;
  }
  function show(c){current=c;ensureUI();document.getElementById('bgUcName').textContent=c.astrologer?.full_name||'Astrologer';document.getElementById('bgUcMeta').textContent='Astrologer ने आपका chat request accept कर लिया है। अब Confirm & Start Chat दबाएँ।';document.getElementById('bgUcStatus').textContent='';document.getElementById('bgUserChatConfirmLayer').style.display='flex';sound();}
  function hide(){const l=document.getElementById('bgUserChatConfirmLayer');if(l)l.style.display='none';}
  async function confirmStart(){if(!current)return;const id=current.id;const btn=document.getElementById('bgUcStart');btn.disabled=true;document.getElementById('bgUcStatus').textContent='Chat start हो रही है…';try{const x=await api('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'user-confirm',conversationId:id})});hide();location.href='/chat.html?conversation_id='+encodeURIComponent(x?.conversation?.id||id)}catch(e){document.getElementById('bgUcStatus').textContent=e.message||'Chat start नहीं हो सकी';btn.disabled=false;poll()}}
  async function poll(){if(!isUser())return;try{const x=await api('/api/chat');const rows=(x.conversations||[]).filter(c=>c.channel==='chat'&&c.status==='astrologer_accepted');rows.sort((a,b)=>new Date(b.astrologer_accepted_at||b.created_at)-new Date(a.astrologer_accepted_at||a.created_at));const c=rows[0];if(!c){if(current)hide();return}if(current?.id===c.id)return;show(c)}catch(e){/* transient chat polling errors are silent */}}
  function start(){if(!isUser())return;ensureUI();poll();clearInterval(timer);timer=setInterval(()=>{if(isUser())poll();else{hide();clearInterval(timer)}},2000);}
  window.BG_USER_GLOBAL_CHAT={start,poll,show};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
