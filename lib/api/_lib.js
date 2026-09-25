const crypto=require('crypto');
function cfg(){return {url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),anon:process.env.SUPABASE_ANON_KEY||'',service:process.env.SUPABASE_SERVICE_ROLE_KEY||''}}
function sb(){const c=cfg();return !!(c.url&&c.service)}
async function req(path,options={}){const c=cfg();if(!c.url||!c.service)throw new Error('Supabase environment variables are missing');const headers={'Content-Type':'application/json','apikey':c.service,'Authorization':'Bearer '+c.service,...(options.headers||{})};const r=await fetch(c.url+path,{...options,headers});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||d?.msg||d?.error_description||d?.hint||`Supabase ${r.status}`);return d}
function secret(){return process.env.APP_AUTH_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||'change-this-secret'}
function b64(v){return Buffer.from(v).toString('base64url')}
function sign(body){return crypto.createHmac('sha256',secret()).update(body).digest('base64url')}
function makeToken(user){const payload={id:user.id,email:user.email||'',account_type:user.account_type,iat:Date.now(),persistent:true};const body=b64(JSON.stringify(payload));return body+'.'+sign(body)}
function verifyToken(token){try{const [body,sig]=String(token||'').split('.');if(!body||!sig||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(sign(body))))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));if(!p.id||!p.account_type)return null;if(p.exp&&p.exp<Date.now())return null;return p}catch{return null}}
async function authUser(req){const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))return null;const p=verifyToken(h.slice(7));if(!p)return null;return {id:p.id,email:p.email,account_type:p.account_type,user_metadata:{account_type:p.account_type}}}
async function accountRow(id,type){const table=type==='user'?'user_accounts':type==='astrologer'?'astrologer_accounts':'admin_accounts';const rows=await req(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*`);return rows[0]||null}
async function profile(id,type){
 const types=type?[type]:['user','astrologer','admin'];
 for(const t of types){
  if(t==='user'){const rows=await req(`/rest/v1/user_profiles?id=eq.${encodeURIComponent(id)}&select=*`);if(rows[0]){const a=await accountRow(id,'user');return {...rows[0],id,email:a?.email||'',phone:a?.phone||'',role:'user',account_type:'user'}}}
  if(t==='astrologer'){const rows=await req(`/rest/v1/astrologers?id=eq.${encodeURIComponent(id)}&select=*`);if(rows[0]){const a=await accountRow(id,'astrologer');return {...rows[0],id,full_name:rows[0].full_name||a?.full_name||'Astrologer',email:a?.email||'',phone:a?.phone||'',role:'astrologer',account_type:'astrologer',blocked:!!rows[0].blocked}}}
  if(t==='admin'){const rows=await req(`/rest/v1/admin_profiles?id=eq.${encodeURIComponent(id)}&select=*`);if(rows[0]){const a=await accountRow(id,'admin');return {...rows[0],id,email:a?.email||'',phone:a?.phone||'',role:'admin',account_type:'admin'}}}
 }
 return null
}
async function ensureProfile(user){if(!user?.id)return null;return profile(user.id,user.account_type)}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){const hash=crypto.pbkdf2Sync(String(password),salt,120000,32,'sha256').toString('hex');return {salt,hash}}
function verifyPassword(password,salt,hash){try{const got=crypto.pbkdf2Sync(String(password),salt,120000,32,'sha256').toString('hex');return crypto.timingSafeEqual(Buffer.from(got,'hex'),Buffer.from(String(hash),'hex'))}catch{return false}}
function cleanEmail(v){return String(v||'').trim().toLowerCase()}
function cleanPhone(v){return String(v||'').replace(/\D/g,'')}
function validateIdentity(email,phone){if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('Valid email is required');if(!/^\d{10}$/.test(phone))throw new Error('Valid 10 digit mobile number is required')}
function json(res,status,data){res.status(status).setHeader('Content-Type','application/json; charset=utf-8').json(data)}
function adminProfile(p){return p?.role==='admin'}
module.exports={cfg,sb,req,authUser,json,profile,ensureProfile,adminProfile,makeToken,hashPassword,verifyPassword,cleanEmail,cleanPhone,validateIdentity,accountRow};
