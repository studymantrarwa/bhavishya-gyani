const crypto=require('crypto');
function cfg(){return {url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),anon:process.env.SUPABASE_ANON_KEY||'',service:process.env.SUPABASE_SERVICE_ROLE_KEY||''}}
function sb(){const c=cfg();return !!(c.url&&c.service)}
async function req(path,options={}){const c=cfg();if(!c.url||!c.service)throw new Error('Supabase environment variables are missing');const headers={'Content-Type':'application/json','apikey':c.service,'Authorization':'Bearer '+c.service,...(options.headers||{})};const r=await fetch(c.url+path,{...options,headers});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.msg||d?.error_description||`Supabase ${r.status}`);return d}
async function authUser(req){const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))return null;const c=cfg();if(!c.url||!c.anon)return null;const r=await fetch(c.url+'/auth/v1/user',{headers:{apikey:c.anon,Authorization:'Bearer '+h.slice(7)}});return r.ok?r.json():null}
function json(res,status,data){res.status(status).setHeader('Content-Type','application/json; charset=utf-8').json(data)}
function adminProfile(p){return p?.role==='admin'}
async function profile(id){const a=await req(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=*`);return a[0]||null}
async function ensureProfile(user){if(!user?.id)return null;let p=await profile(user.id);if(p)return p;const rows=await req('/rest/v1/profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:user.id,full_name:user.user_metadata?.full_name||'',email:user.email||null,phone:user.user_metadata?.phone||null,role:'user'})});return rows[0]||null}
module.exports={cfg,sb,req,authUser,json,profile,ensureProfile,adminProfile};
