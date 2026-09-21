const crypto=require('crypto');

// Stateless, Vercel-safe sessions. The old in-memory session Map was not reliable
// across serverless invocations, so every request can verify its own signed token.
function sessionSecret(){
  const s=process.env.AUTH_SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_ANON_KEY||'';
  if(!s) throw new Error('AUTH_SESSION_SECRET is not configured');
  return s;
}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){
  const hash=crypto.scryptSync(String(password),salt,64).toString('hex');
  return {salt,hash};
}
function verifyPassword(password,stored){
  if(!stored?.salt||!stored?.hash)return false;
  try{
    const got=crypto.scryptSync(String(password),stored.salt,64).toString('hex');
    const a=Buffer.from(got,'hex'),b=Buffer.from(stored.hash,'hex');
    return a.length===b.length&&crypto.timingSafeEqual(a,b);
  }catch{return false}
}
function b64(v){return Buffer.from(v).toString('base64url')}
function unb64(v){return Buffer.from(v,'base64url').toString('utf8')}
function sign(v){return crypto.createHmac('sha256',sessionSecret()).update(v).digest('base64url')}
function createSession(userId,email,role){
  const payload={sub:userId,email:String(email||'').toLowerCase(),role,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7*24*60*60};
  const body=b64(JSON.stringify(payload));
  return body+'.'+sign(body);
}
function getSession(token){
  try{
    const [body,sig]=String(token||'').split('.');
    if(!body||!sig||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(sign(body))))return null;
    const p=JSON.parse(unb64(body));
    if(!p?.sub||!p?.role||p.exp<Math.floor(Date.now()/1000))return null;
    return {userId:p.sub,email:p.email||'',role:p.role,createdAt:p.iat*1000,expiresAt:p.exp*1000};
  }catch{return null}
}
function deleteSession(){/* Stateless token: clearing it on the client is enough. */}
module.exports={hashPassword,verifyPassword,createSession,getSession,deleteSession};
