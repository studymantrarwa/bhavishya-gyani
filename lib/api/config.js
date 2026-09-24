const {json,authUser}=require('./_lib');
const DEFAULT_STUNS=[
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun3.l.google.com:19302',
  'stun:stun4.l.google.com:19302'
];
module.exports=async(req,res)=>{
  const base={supabaseUrl:process.env.SUPABASE_URL||'',supabaseAnonKey:process.env.SUPABASE_ANON_KEY||'',supabaseEnabled:!!(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY)};
  if(String(req.query?.call||'')==='1'){
    const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});
    const urls=(String(process.env.STUN_URLS||'')?String(process.env.STUN_URLS).split(','):DEFAULT_STUNS).map(x=>x.trim()).filter(Boolean).filter(x=>!x.startsWith('turn:')&&!x.startsWith('turns:'));
    return json(res,200,{...base,iceServers:[...new Set(urls)].map(urls=>({urls})),turnConfigured:false,directOnly:true});
  }
  return json(res,200,base);
};
