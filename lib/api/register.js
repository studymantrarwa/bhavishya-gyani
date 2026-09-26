const crypto=require('crypto');
const {req:sbreq,json,makeToken,hashPassword,cleanEmail,cleanPhone,validateIdentity}=require('./_lib');
async function exists(email,phone){
  const a=await sbreq(`/rest/v1/user_accounts?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
  if(a[0])return true;
  const b=await sbreq(`/rest/v1/user_accounts?phone=eq.${encodeURIComponent(phone)}&select=id&limit=1`);
  return !!b[0];
}
module.exports=async(req,res)=>{try{
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const b=req.body||{},name=String(b.name||'').trim(),email=cleanEmail(b.email),phone=cleanPhone(b.phone),password=String(b.password||'');
  if(!name)return json(res,400,{error:'Name is required'}); validateIdentity(email,phone);
  if(password.length<6)return json(res,400,{error:'Password must be at least 6 characters'});
  if(await exists(email,phone))return json(res,409,{error:'This email or mobile is already registered in User accounts.'});
  const id=crypto.randomUUID(),hp=hashPassword(password);
  let newUserMinutes=0;
  try{const r=await sbreq('/rest/v1/platform_settings?key=eq.chat_offer_settings&select=value&limit=1');const v=r[0]?.value||{};newUserMinutes=Math.max(0,Math.floor(Number(v.new_user_free_minutes)||0))}catch(e){}
  await sbreq('/rest/v1/user_accounts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,email,phone,password_hash:hp.hash,password_salt:hp.salt,full_name:name,free_chat_minutes:newUserMinutes,free_chat_minutes_used:0})});
  if(newUserMinutes>0){try{await sbreq('/rest/v1/chat_free_minute_transactions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:id,minutes:newUserMinutes,type:'credit',source:'new_user',description:'New user welcome free chat minutes'})})}catch(e){}}
  await sbreq('/rest/v1/user_profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,full_name:name,avatar_url:null,blocked:false,referral_code:null,referred_by:null,reward_points:0})});
  return json(res,201,{ok:true,token:makeToken({id,email,account_type:'user'}),user:{id,email,name,role:'user',account_type:'user'}});
}catch(e){return json(res,400,{error:e.message||'Registration failed'})}};
