const {authUser,json}=require("./_lib");
module.exports=async(req,res)=>{
 try{
  if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
  const u=await authUser(req);
  if(!u)return json(res,401,{error:"Login required"});
  const stun=(process.env.STUN_URLS||"stun:stun.cloudflare.com:3478,stun:stun.l.google.com:19302").split(",").map(x=>x.trim()).filter(Boolean);
  const base=stun.map(urls=>({urls}));
  const keyId=process.env.CLOUDFLARE_TURN_KEY_ID||"";
  const apiToken=process.env.CLOUDFLARE_TURN_API_TOKEN||"";
  if(keyId&&apiToken){
   const accountId=process.env.CLOUDFLARE_ACCOUNT_ID||"";
   if(!accountId)return json(res,500,{error:"CLOUDFLARE_ACCOUNT_ID is missing"});
   const r=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,{method:"POST",headers:{Authorization:`Bearer ${apiToken}`,"Content-Type":"application/json"},body:JSON.stringify({ttl:3600})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j?.error||j?.message||`TURN credential request failed (${r.status})`);
   const servers=Array.isArray(j.iceServers)?j.iceServers:[];
   const filtered=servers.map(s=>({...s,urls:(Array.isArray(s.urls)?s.urls:[s.urls]).filter(Boolean).filter(u=>!/:53(?:\?|$)/.test(u))})).filter(s=>s.urls.length);
   return json(res,200,{iceServers:[...base,...filtered],turnConfigured:filtered.some(s=>String(s.urls?.[0]||"").startsWith("turn"))});
  }
  const urls=(process.env.TURN_URLS||"").split(",").map(x=>x.trim()).filter(Boolean);
  const user=process.env.TURN_USERNAME||""; const cred=process.env.TURN_CREDENTIAL||"";
  if(urls.length&&user&&cred) return json(res,200,{iceServers:[...base,{urls,username:user,credential:cred}],turnConfigured:true});
  return json(res,200,{iceServers:base,turnConfigured:false});
 }catch(e){return json(res,500,{error:e.message||"TURN configuration failed"})}
};
