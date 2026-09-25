const crypto=require('crypto');
const {authUser,req:sbreq,json,profile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
function razor(){
 const id=String(process.env.RAZORPAY_KEY_ID||'').trim();
 const secret=String(process.env.RAZORPAY_KEY_SECRET||'').trim();
 if(!id||!secret) throw new Error('Razorpay keys are not configured for this deployment. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the Bhavishya Gyani project Environment Variables, then redeploy.');
 if(!/^rzp_(test|live)_/i.test(id)) throw new Error('Invalid Razorpay Key ID format. Use the Key ID from the same Razorpay mode as the Secret Key (Test: rzp_test_..., Live: rzp_live_...).');
 return {id,secret}
}
async function rz(path,options={}){
 const r=razor();
 const headers={'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(r.id+':'+r.secret).toString('base64'),...(options.headers||{})};
 const x=await fetch('https://api.razorpay.com/v1'+path,{...options,headers});
 const t=await x.text();let d;try{d=t?JSON.parse(t):{}}catch{d={message:t}}
 if(!x.ok){
   if(x.status===401) throw new Error('Razorpay Authentication failed. Check that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are the matching pair from the same Razorpay account and the same mode (both Test or both Live). After changing Vercel variables, redeploy the project.');
   throw new Error(d.error?.description||d.message||`Razorpay ${x.status}`);
 }
 return d
}
async function wallet(uid){let r=await sbreq(`/rest/v1/wallets?user_id=eq.${esc(uid)}&select=*&limit=1`);if(r[0])return r[0];r=await sbreq('/rest/v1/wallets',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:uid,balance:0})});return r[0]}
async function credit(uid,amount,paymentId,desc){const w=await wallet(uid);const next=Number(w.balance||0)+Number(amount||0);await sbreq(`/rest/v1/wallets?id=eq.${esc(w.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({balance:next,updated_at:new Date().toISOString()})});await sbreq('/rest/v1/wallet_transactions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:uid,amount:Number(amount),type:'credit',source:'razorpay',payment_id:paymentId,description:desc||'Wallet top-up'})})}
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});const p=await profile(u.id,u.account_type);if(p?.blocked)return json(res,403,{error:'Account blocked'});
 if(req.method==='POST'){
  const b=req.body||{};const action=String(b.action||'create_order');
  if(action==='create_order'){
   if(p?.role!=='user')return json(res,403,{error:'Only users can create payment orders'});
   const amount=Math.round(Number(b.amount||0)*100)/100;if(!Number.isFinite(amount)||amount<10||amount>200000)return json(res,400,{error:'Amount must be between ₹10 and ₹2,00,000'});
   const purpose=String(b.purpose||'wallet_topup').slice(0,60);const order=await rz('/orders',{method:'POST',body:JSON.stringify({amount:Math.round(amount*100),currency:'INR',receipt:`BG-${Date.now()}`,notes:{purpose,user_id:u.id}})});
   const rows=await sbreq('/rest/v1/payments',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:u.id,amount,currency:'INR',method:'razorpay',gateway:'razorpay',gateway_order_id:order.id,purpose,status:'pending',reference:order.id})});
   return json(res,201,{key_id:raz().id,order,payment:rows[0]||null});
  }
  if(action==='verify'){
   if(p?.role!=='user')return json(res,403,{error:'Only users can verify user payments'});
   const orderId=String(b.razorpay_order_id||''),paymentId=String(b.razorpay_payment_id||''),signature=String(b.razorpay_signature||'');if(!orderId||!paymentId||!signature)return json(res,400,{error:'Razorpay verification data missing'});
   const expected=crypto.createHmac('sha256',raz().secret).update(orderId+'|'+paymentId).digest('hex');if(expected!==signature)return json(res,400,{error:'Payment signature verification failed'});
   const pay=(await sbreq(`/rest/v1/payments?gateway_order_id=eq.${esc(orderId)}&user_id=eq.${esc(u.id)}&select=*&limit=1`))[0];if(!pay)return json(res,404,{error:'Payment order not found'});
   if(pay.status!=='approved'){const rows=await sbreq(`/rest/v1/payments?id=eq.${esc(pay.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'approved',gateway_payment_id:paymentId,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()})});await credit(u.id,Number(pay.amount),pay.id,'Wallet top-up via Razorpay');return json(res,200,{ok:true,payment:rows[0]||null});}
   return json(res,200,{ok:true,payment:pay,already_processed:true});
  }
  return json(res,400,{error:'Unknown payment action'});
 }
 if(req.method==='GET'){
  if(String(req.query?.action||'')==='config'){
   const id=String(process.env.RAZORPAY_KEY_ID||'').trim();
   return json(res,200,{configured:!!id&&!!String(process.env.RAZORPAY_KEY_SECRET||'').trim(),mode:id.startsWith('rzp_test_')?'test':id.startsWith('rzp_live_')?'live':'unknown'});
  }
  const rows=await sbreq(`/rest/v1/payments?user_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=500`);return json(res,200,{payments:rows});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message||'Payment request failed'})}};
