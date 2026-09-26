const {req:sbreq}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
function effectiveRate(base,discount){const b=Math.max(0,Number(base)||0);const d=[0,25,50,75].includes(Number(discount))?Number(discount):Math.min(100,Math.max(0,Number(discount)||0));return Math.round(b*(1-d/100)*100)/100}
async function chatBudget(uid,rate){const r=Math.max(0,Number(rate)||0);const free=await userFree(uid);const w=await wallet(uid);const freeMinutes=Math.max(0,Math.floor(Number(free.free_chat_minutes)||0));const balance=Math.max(0,Number(w.balance)||0);const paidMinutes=r>0?Math.floor((balance+1e-9)/r):0;return {free_minutes:freeMinutes,wallet_balance:balance,paid_minutes:paidMinutes,total_minutes:freeMinutes+paidMinutes,total_seconds:(freeMinutes+paidMinutes)*60,rate:r};}
async function commissionPercent(){try{const r=await sbreq('/rest/v1/platform_settings?key=eq.payment_settings&select=value&limit=1');const v=r[0]?.value||{};const n=Number(v.commission_percent);return Number.isFinite(n)?Math.min(100,Math.max(0,n)):20}catch{return 20}}
async function wallet(uid){let r=await sbreq(`/rest/v1/wallets?user_id=eq.${esc(uid)}&select=*&limit=1`);if(r[0])return r[0];r=await sbreq('/rest/v1/wallets',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:uid,balance:0})});return r[0]}
async function userFree(uid){const r=await sbreq(`/rest/v1/user_accounts?id=eq.${esc(uid)}&select=id,free_chat_minutes,free_chat_minutes_used&limit=1`);return r[0]||{id:uid,free_chat_minutes:0,free_chat_minutes_used:0}}
async function activeChatOffers(uid){
 const now=new Date().toISOString();
 let offers=[];
 try{offers=await sbreq(`/rest/v1/chat_festival_offers?active=eq.true&start_at=lte.${encodeURIComponent(now)}&end_at=gte.${encodeURIComponent(now)}&select=*&order=created_at.desc&limit=100`)}catch{return []}
 const out=[];
 for(const o of offers){
  const target=String(o.target||'all');
  if(target==='selected'&&!(Array.isArray(o.user_ids)&&o.user_ids.map(String).includes(String(uid))))continue;
  const claims=await sbreq(`/rest/v1/chat_offer_claims?offer_id=eq.${esc(o.id)}&user_id=eq.${esc(uid)}&select=id&limit=1`);
  if(claims[0])continue;
  out.push(o);
 }
 return out;
}
async function applyActiveChatOffers(uid){
 const offers=await activeChatOffers(uid); let added=0;
 for(const o of offers){
  const mins=Math.max(0,Math.floor(Number(o.minutes)||0)); if(!mins)continue;
  try{
   // Read current value, then add the grant.
   const current=await userFree(uid); const next=Number(current.free_chat_minutes||0)+mins;
   await sbreq(`/rest/v1/user_accounts?id=eq.${esc(uid)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({free_chat_minutes:next,updated_at:new Date().toISOString()})});
   await sbreq('/rest/v1/chat_offer_claims',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({offer_id:o.id,user_id:uid,minutes_granted:mins})});
   added+=mins;
  }catch(e){}
 }
 return added;
}
async function grantFreeMinutes(uid,minutes,source='admin',description='Free chat minutes'){
 const n=Math.max(0,Math.floor(Number(minutes)||0)); if(!n)return 0;
 const current=await userFree(uid); const next=Number(current.free_chat_minutes||0)+n;
 await sbreq(`/rest/v1/user_accounts?id=eq.${esc(uid)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({free_chat_minutes:next,updated_at:new Date().toISOString()})});
 try{await sbreq('/rest/v1/chat_free_minute_transactions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:uid,minutes:n,type:'credit',source,description})})}catch(e){}
 return next;
}
async function consumeFreeMinutes(uid,minutes,conversationId){
 const n=Math.max(0,Math.floor(Number(minutes)||0)); if(!n)return {used:0,remaining:0};
 const current=await userFree(uid); const available=Math.max(0,Number(current.free_chat_minutes||0)); const used=Math.min(available,n); if(!used)return {used:0,remaining:available};
 const next=available-used; const totalUsed=Number(current.free_chat_minutes_used||0)+used;
 await sbreq(`/rest/v1/user_accounts?id=eq.${esc(uid)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({free_chat_minutes:next,free_chat_minutes_used:totalUsed,updated_at:new Date().toISOString()})});
 try{await sbreq('/rest/v1/chat_free_minute_transactions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:uid,minutes:used,type:'debit',source:'chat',conversation_id:conversationId||null,description:`Free chat ${used} minute${used===1?'':'s'} used`})})}catch(e){}
 return {used,remaining:next};
}
async function chargeConversation(c){
 if(!c||!c.astrologer_id||!c.user_id||c.channel!=='chat'||!c.accepted_at)return {charged:false,reason:'not_billable'};
 const existing=await sbreq(`/rest/v1/astrologer_earnings?conversation_id=eq.${esc(c.id)}&select=*&limit=1`);if(existing[0])return {charged:true,existing:existing[0]};
 const started=new Date(c.accepted_at).getTime(),ended=new Date(c.closed_at||new Date()).getTime();
 const seconds=Math.max(0,Math.round((ended-started)/1000));const minutes=Math.max(1,Math.ceil(seconds/60));const rate=Math.max(0,Number(c.fee_snapshot||0));const gross=Math.round(rate*minutes*100)/100;
 if(gross<=0)return {charged:false,reason:'zero_rate',minutes,free_minutes_used:0,wallet_amount:0};
 const currentFree=await userFree(c.user_id); const availableFree=Math.max(0,Number(currentFree.free_chat_minutes||0));
 const walletNow=await wallet(c.user_id); const walletBalance=Number(walletNow.balance||0);
 const maxFree=Math.min(minutes,availableFree); const requiredPaid=Math.round(rate*Math.max(0,minutes-maxFree)*100)/100;
 if(walletBalance<requiredPaid)return {charged:false,insufficient:true,required:requiredPaid,balance:walletBalance,minutes,rate,free_minutes_available:availableFree};
 const free=await consumeFreeMinutes(c.user_id,minutes,c.id); const paidMinutes=Math.max(0,minutes-free.used); const paidAmount=Math.round(rate*paidMinutes*100)/100;
 const earningGross=paidAmount; const commPct=await commissionPercent();const commission=Math.round(earningGross*commPct)/100;const netAmount=Math.max(0,Math.round((earningGross-commission)*100)/100);
 let payment=null;
 if(paidAmount>0){
   const w=await wallet(c.user_id);const bal=Number(w.balance||0);if(bal<paidAmount)return {charged:false,insufficient:true,required:paidAmount,balance:bal,minutes,rate,free_minutes_used:free.used,paid_minutes:paidMinutes};
   await sbreq(`/rest/v1/wallets?id=eq.${esc(w.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({balance:Math.round((bal-paidAmount)*100)/100,updated_at:new Date().toISOString()})});
   payment=(await sbreq('/rest/v1/payments',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:c.user_id,astrologer_id:c.astrologer_id,conversation_id:c.id,amount:paidAmount,currency:'INR',method:'wallet',purpose:'chat_minutes',status:'approved',reference:`CHAT-${c.id}`})}))[0];
   await sbreq('/rest/v1/wallet_transactions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:c.user_id,amount:paidAmount,type:'debit',source:'chat',payment_id:payment?.id||null,description:`Astrologer chat ${paidMinutes} paid minute${paidMinutes===1?'':'s'} @ ₹${rate}/min`})});
 }
 const earningBody={astrologer_id:c.astrologer_id,amount:netAmount,gross_amount:earningGross,commission_amount:commission,net_amount:netAmount,paid_amount:paidAmount,paid_minutes:paidMinutes,category:'chat',conversation_id:c.id,earned_at:new Date().toISOString()};
 let earning;
 try{
   earning=(await sbreq('/rest/v1/astrologer_earnings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(earningBody)}))[0];
 }catch(e){
   const msg=String(e?.message||'');
   if(!/paid_amount|paid_minutes|column.*schema cache|does not exist/i.test(msg))throw e;
   const legacy={astrologer_id:c.astrologer_id,amount:netAmount,gross_amount:earningGross,commission_amount:commission,net_amount:netAmount,category:'chat',conversation_id:c.id,earned_at:new Date().toISOString()};
   earning=(await sbreq('/rest/v1/astrologer_earnings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(legacy)}))[0];
 }
 try{await sbreq(`/rest/v1/conversations?id=eq.${esc(c.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({billed_seconds:seconds,billed_amount:paidAmount})})}catch(e){}
 return {charged:true,minutes,seconds,rate,gross,commission,net:netAmount,free_minutes_used:free.used,paid_minutes:paidMinutes,wallet_amount:paidAmount,earning,payment};
}
module.exports={commissionPercent,chargeConversation,wallet,grantFreeMinutes,applyActiveChatOffers,userFree,chatBudget,effectiveRate};
