const {authUser,req:sbreq,json,profile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
async function user(req,res){const u=await authUser(req);if(!u||u.account_type!=='user')return null;const p=await profile(u.id,'user');if(p?.blocked){json(res,403,{error:'Account blocked'});return null}return u}
async function ensureWallet(uid){let r=await sbreq(`/rest/v1/wallets?user_id=eq.${esc(uid)}&select=*&limit=1`);if(r[0])return r[0];r=await sbreq('/rest/v1/wallets',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:uid,balance:0})});return r[0]}
module.exports=async(req,res)=>{try{
 const u=await user(req,res);if(!u)return json(res,403,{error:'User only'});
 const w=await ensureWallet(u.id);
 if(req.method==='GET'){
   const tx=await sbreq(`/rest/v1/wallet_transactions?user_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=500`);
   return json(res,200,{wallet:w,transactions:tx});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message||'Wallet request failed'})}};
