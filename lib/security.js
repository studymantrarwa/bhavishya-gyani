const crypto=require("crypto");
const sessions=new Map();

function hashPassword(password,salt=crypto.randomBytes(16).toString("hex")){
  const hash=crypto.scryptSync(String(password),salt,64).toString("hex");
  return {salt,hash};
}
function verifyPassword(password,stored){
  if(!stored || !stored.salt || !stored.hash) return false;
  const got=crypto.scryptSync(String(password),stored.salt,64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(got,"hex"),Buffer.from(stored.hash,"hex"));
}
function createSession(userId){
  const token=crypto.randomBytes(32).toString("hex");
  sessions.set(token,{userId,createdAt:Date.now()});
  return token;
}
function getSession(token){
  if(!token) return null;
  const s=sessions.get(token);
  if(!s) return null;
  if(Date.now()-s.createdAt>1000*60*60*24*7){sessions.delete(token);return null;}
  return s;
}
function deleteSession(token){if(token)sessions.delete(token)}
module.exports={hashPassword,verifyPassword,createSession,getSession,deleteSession};
