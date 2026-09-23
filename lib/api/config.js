const {cfg,json,authUser}=require("./_lib");
module.exports=async(req,res)=>{
 const base={supabaseUrl:process.env.SUPABASE_URL||"",supabaseAnonKey:process.env.SUPABASE_ANON_KEY||"",supabaseEnabled:!!(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY)};
 if(String(req.query?.call||"")==="1") {
  const u=await authUser(req);
  if(!u) return json(res,401,{error:"Login required"});
  const stun=(process.env.STUN_URLS||"stun:stun.l.google.com:19302,stun:stun.cloudflare.com:3478").split(",").map(x=>x.trim()).filter(Boolean);
  const iceServers=stun.map(urls=>({urls}));
  const turnUrls=(process.env.TURN_URLS||"").split(",").map(x=>x.trim()).filter(Boolean);
  const turnUser=process.env.TURN_USERNAME||""; const turnCred=process.env.TURN_CREDENTIAL||"";
  if(turnUrls.length&&turnUser&&turnCred) iceServers.push({urls:turnUrls,username:turnUser,credential:turnCred});
  return json(res,200,{...base,iceServers,turnConfigured:turnUrls.length>0&&!!turnUser&&!!turnCred});
 }
 return json(res,200,base);
};
