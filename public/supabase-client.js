/* Bhavishya Gyani V25 client auth bridge.
   User, Astrologer and Admin have separate local session slots while the server
   keeps the three account systems in separate Supabase tables. */
(function(){
  try{ if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}),{once:true}); } }catch(e){}
  const PREFIX='bgToken_';
  const ACTIVE='bgActiveAccountType';
  const valid=t=>['user','astrologer','admin'].includes(t)?t:null;
  const key=t=>PREFIX+(valid(t)||'user');
  function active(){try{return valid(localStorage.getItem(ACTIVE))||'user'}catch(e){return 'user'}}
  function save(t,accountType){try{
    const type=valid(accountType)||active();
    if(t){localStorage.setItem(key(type),t);localStorage.setItem(ACTIVE,type)}
    else{localStorage.removeItem(key(type));if(active()===type)localStorage.removeItem(ACTIVE)}
    // Clean legacy tokens from older builds so an old session cannot leak into V25.
    localStorage.removeItem('bhavishyaGyaniToken');localStorage.removeItem('studyMantraToken');
  }catch(e){}}
  function get(t){try{return localStorage.getItem(key(t||active()))||null}catch(e){return null}}
  window.SM_SUPABASE={
    _saveToken:save,
    _getActiveType:active,
    async init(){return this},
    async getAccessToken(){return get()},
    async getSession(){const t=get();return t?{access_token:t}:null},
    async signOut(){const t=active();save(null,t)},
    auth:{
      async signOut(){const t=active();save(null,t)},
      async getSession(){return {data:{session:await window.SM_SUPABASE.getSession()},error:null}},
      async getUser(){const t=get();if(!t)return {data:{user:null},error:null};const r=await fetch('/api/me',{headers:{Authorization:'Bearer '+t}});const j=await r.json().catch(()=>({}));return {data:{user:r.ok?j.user:null},error:r.ok?null:new Error(j.error||'Login required')}}
    }
  };
})();
