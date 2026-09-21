function cfg(){return {url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),anon:process.env.SUPABASE_ANON_KEY||'',service:process.env.SUPABASE_SERVICE_ROLE_KEY||''}}
function sb(){const c=cfg();return !!(c.url&&c.service)}
async function req(path,options={}){const c=cfg();if(!c.url||!c.service)throw new Error('Supabase environment variables are missing');const headers={'Content-Type':'application/json','apikey':c.service,'Authorization':'Bearer '+c.service,...(options.headers||{})};const r=await fetch(c.url+path,{...options,headers});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.msg||d?.error_description||d?.hint||`Supabase ${r.status}`);return d}
const {getSession}=require('../security');
async function authUser(req){
  const h=req.headers.authorization||'';
  if(!h.startsWith('Bearer '))return null;
  const s=getSession(h.slice(7));
  if(!s)return null;
  try{
    const p=await profile(s.userId);
    if(!p||p.blocked)return null;
    return {id:p.id,email:p.email||s.email||'',user_metadata:{full_name:p.full_name||'',phone:p.phone||'',account_type:p.role},account_type:p.role};
  }catch{return null}
}
function json(res,status,data){res.status(status).setHeader('Content-Type','application/json; charset=utf-8').json(data)}
function adminProfile(p){return p?.role==='admin'}
async function profile(id){const a=await req(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=*`);return a[0]||null}
async function credential(accountType,email){const rows=await req(`/rest/v1/account_credentials?account_type=eq.${encodeURIComponent(accountType)}&email=eq.${encodeURIComponent(String(email||'').trim().toLowerCase())}&select=*&limit=1`);return rows[0]||null}
async function createAccount({accountType,name,email,phone,password,avatar_url=null,blocked=false}){
  const cleanEmail=String(email||'').trim().toLowerCase();
  const cleanPhone=String(phone||'').replace(/\D/g,'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))throw new Error('Valid email is required');
  if(String(password||'').length<6)throw new Error('Password must be at least 6 characters');
  if(cleanPhone && !/^\d{10,15}$/.test(cleanPhone))throw new Error('Valid mobile number is required');
  const byEmail=await req(`/rest/v1/account_credentials?account_type=eq.${encodeURIComponent(accountType)}&email=eq.${encodeURIComponent(cleanEmail)}&select=id&limit=1`);
  if(byEmail.length)throw new Error('इस account type में यह email पहले से registered है');
  if(cleanPhone){const byPhone=await req(`/rest/v1/account_credentials?account_type=eq.${encodeURIComponent(accountType)}&phone=eq.${encodeURIComponent(cleanPhone)}&select=id&limit=1`);if(byPhone.length)throw new Error('इस account type में यह mobile पहले से registered है');}
  const {hashPassword}=require('../security');
  const hp=hashPassword(password);
  const id=require('crypto').randomUUID();
  const rows=await req('/rest/v1/profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,full_name:String(name||'').trim(),email:cleanEmail,phone:cleanPhone||null,avatar_url,role:accountType,blocked,updated_at:new Date().toISOString()})});
  try{
    await req('/rest/v1/account_credentials',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,account_type:accountType,email:cleanEmail,phone:cleanPhone||null,password_hash:hp.hash,password_salt:hp.salt})});
  }catch(e){try{await req(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}})}catch{};throw e}
  return rows[0]||{id,email:cleanEmail,phone:cleanPhone||null,role:accountType,full_name:String(name||'').trim()};
}
async function ensureProfile(user){if(!user?.id)return null;let p=await profile(user.id);if(p)return p;return null}
module.exports={cfg,sb,req,authUser,json,profile,ensureProfile,adminProfile,credential,createAccount};
