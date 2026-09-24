const {authUser,json}=require('./_lib');
const DEFAULT_STUNS=[
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302'
];
module.exports=async(req,res)=>{
  try{
    if(req.method!=='GET')return json(res,405,{error:'Method not allowed'});
    const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});
    const raw=String(process.env.STUN_URLS||'');
    const urls=(raw?raw.split(','):DEFAULT_STUNS).map(x=>x.trim()).filter(Boolean).filter(x=>!x.startsWith('turn:')&&!x.startsWith('turns:'));
    const unique=[...new Set(urls)];
    return json(res,200,{iceServers:unique.map(urls=>({urls})),turnConfigured:false,directOnly:true});
  }catch(e){return json(res,500,{error:e.message||'Voice configuration failed'})}
};
