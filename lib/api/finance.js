const {req:sbreq}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
async function commissionPercent(){try{const r=await sbreq('/rest/v1/platform_settings?key=eq.payment_settings&select=value&limit=1');const v=r[0]?.value||{};const n=Number(v.commission_percent);return Number.isFinite(n)?Math.min(100,Math.max(0,n)):20}catch{return 20}}
async function wallet(uid){let r=await sbreq(`/rest/v1/wallets?user_id=eq.${esc(uid)}&select=*&limit=1`);if(r[0])return r[0];r=await sbreq('/rest/v1/wallets',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:uid,balance:0})});return r[0]}
async function chargeConversation(c){
 if(!c||!c.astrologer_id||!c.user_id||c.channel!=='chat'||!c.accepted_at)return {charged:false,reason:'not_billable'};
 const existing=await sbreq(`/rest/v1/astrologer_earnings?conversation_id=eq.${esc(c.id)}&select=*&limit=1`);if(existing[0])return {charged:true,existing:existing[0]};
 const started=new Date(c.accepted_at).getTime(),ended=new Date(c.closed_at||new Date()).getTime();
 const seconds=Math.max(0,Math.round((ended-started)/1000));const minutes=Math.max(1,Math.ceil(seconds/60));const rate=Math.max(0,Number(c.fee_snapshot||0));const gross=Math.round(rate*minutes*100)/100;
 if(gross<=0)return {charged:false,reason:'zero_rate'};
 const commPct=await commissionPercent();const commission=Math.round(gross*commPct)/100;const net=Math.max(0,Math.round((gross-commission)*100)/100);
 const w=await wallet(c.user_id);const bal=Number(w.balance||0);if(bal<gross)return {charged:false,insufficient:true,required:gross,balance:bal,minutes,rate};
 await sbreq(`/rest/v1/wallets?id=eq.${esc(w.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({balance:Math.round((bal-gross)*100)/100,updated_at:new Date().toISOString()})});
 const payment=(await sbreq('/rest/v1/payments',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:c.user_id,astrologer_id:c.astrologer_id,conversation_id:c.id,amount:gross,currency:'INR',method:'wallet',purpose:'chat_minutes',status:'approved',reference:`CHAT-${c.id}`})}))[0];
 await sbreq('/rest/v1/wallet_transactions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:c.user_id,amount:gross,type:'debit',source:'chat',payment_id:payment?.id||null,description:`Astrologer chat ${minutes} minute${minutes===1?'':'s'} @ ₹${rate}/min`})});
 const earning=(await sbreq('/rest/v1/astrologer_earnings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({astrologer_id:c.astrologer_id,amount:net,gross_amount:gross,commission_amount:commission,net_amount:net,category:'chat',conversation_id:c.id,earned_at:new Date().toISOString()})}))[0];
 return {charged:true,minutes,rate,gross,commission,net,earning,payment};
}
module.exports={commissionPercent,chargeConversation,wallet};
