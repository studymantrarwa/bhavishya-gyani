/* Bhavishya Gyani performance/navigation boost. No API calls are cached. */
(function(){
  const prefetched=new Set();
  function prefetch(a){
    try{
      if(!a||a.target==='_blank'||a.hasAttribute('download'))return;
      const u=new URL(a.href,location.href);
      if(u.origin!==location.origin||!/^\/(?:[^/]+\.html)?(?:\?|#|$)/.test(u.pathname))return;
      if(!/\.html$/.test(u.pathname)&&u.pathname!=='/')return;
      const key=u.pathname+u.search;
      if(prefetched.has(key))return;
      prefetched.add(key);
      fetch(u.href,{credentials:'same-origin',cache:'force-cache'}).catch(()=>{});
    }catch(e){}
  }
  document.addEventListener('pointerover',e=>{const a=e.target.closest?.('a[href]');if(a)prefetch(a)},{passive:true});
  document.addEventListener('touchstart',e=>{const a=e.target.closest?.('a[href]');if(a)prefetch(a)},{passive:true});
})();
