/* Bhavishya Gyani role-aware client guard */
(function(){
  const VALID=['user','astrologer','admin'];
  const key=t=>'bgToken_'+t;
  function token(t){try{return localStorage.getItem(key(t))||null}catch(e){return null}}
  function active(){try{const a=localStorage.getItem('bgActiveAccountType');return VALID.includes(a)?a:null}catch(e){return null}}
  function go(t){
    const dest=t==='admin'?'/admin-login.html':t==='astrologer'?'/astrologer-login.html':'/';
    location.replace(dest+'?next='+encodeURIComponent(location.pathname+location.search));
  }
  window.BG_AUTH={
    token,active,
    async check(roles){
      const list=Array.isArray(roles)?roles:[roles];
      let t=active();
      if(!t || !list.includes(t) || !token(t)){go(list[0]||'user');return null}
      try{
        const r=await fetch('/api/me',{headers:{Authorization:'Bearer '+token(t)},cache:'no-store'});
        const j=await r.json().catch(()=>({}));
        if(!r.ok || !j.user || !list.includes(j.user.account_type||j.user.role)){throw Error(j.error||'Session expired')}
        return j.user;
      }catch(e){try{localStorage.removeItem(key(t));if(active()===t)localStorage.removeItem('bgActiveAccountType')}catch(_){}
        go(t);return null}
    }
  };
})();