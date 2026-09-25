const {authUser,req:sbreq,json,profile}=require('./_lib');
function monthStart(){const d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).toISOString()}
async function getAstro(id){const rows=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(id)}&select=*`);return rows[0]||null}
async function safe(path, fallback){try{return await sbreq(path)}catch{return fallback}}
module.exports=async(req,res)=>{try{
 const u=await authUser(req);if(!u)return json(res,401,{error:'Login required'});const p=await profile(u.id);if(p?.role!=='astrologer')return json(res,403,{error:'Approved astrologer account required'});
 const view=String(req.query?.view||'');
 if(req.method==='GET'&&!view){
   const a=await getAstro(u.id);if(!a)return json(res,404,{error:'Astrologer profile not found'});
   const reviews=await safe(`/rest/v1/reviews?astrologer_id=eq.${encodeURIComponent(u.id)}&select=rating`,[]);
   const conv=await safe(`/rest/v1/conversations?astrologer_id=eq.${encodeURIComponent(u.id)}&select=id`,[]);
   const today=new Date().toISOString().slice(0,10);
   const earn=await safe(`/rest/v1/astrologer_earnings?astrologer_id=eq.${encodeURIComponent(u.id)}&earned_at=gte.${encodeURIComponent(today+'T00:00:00Z')}&select=amount`,[]);
   const total=reviews.reduce((s,r)=>s+Number(r.rating||0),0);const avg=reviews.length?Math.round(total/reviews.length*10)/10:0;
   return json(res,200,{profile:p,astrologer:a,fee_per_minute:Number(a.fee_per_minute??a.fee??0),followers:Number(a.followers_count||0),rating:{average:avg,count:reviews.length},todayEarning:earn.reduce((s,x)=>s+Number(x.amount||0),0),connections:conv.length});
 }
 if(req.method==='GET'&&view==='earnings'){
   const rows=await safe(`/rest/v1/astrologer_earnings?astrologer_id=eq.${encodeURIComponent(u.id)}&earned_at=gte.${encodeURIComponent(monthStart())}&select=*`,[]);
   const sum=k=>rows.filter(x=>String(x.category||'service')===k).reduce((s,x)=>s+Number(x.amount||x.net_amount||0),0);
   const today=new Date().toISOString().slice(0,10);const todayRows=rows.filter(x=>String(x.earned_at||'').slice(0,10)===today);
   const daily={};for(const x of rows){const d=String(x.earned_at||'').slice(0,10);daily[d]=(daily[d]||0)+Number(x.amount||x.net_amount||0)}
   const gross=rows.reduce((s,x)=>s+Number(x.gross_amount||x.amount||0),0),commission=rows.reduce((s,x)=>s+Number(x.commission_amount||0),0),net=rows.reduce((s,x)=>s+Number(x.net_amount||x.amount||0),0);
   const payouts=await safe(`/rest/v1/payouts?astrologer_id=eq.${encodeURIComponent(u.id)}&select=*&order=period_start.desc&limit=24`,[]);
   return json(res,200,{total:net,gross,commission,net,varta:sum('varta'),affiliate:sum('affiliate'),reportAffiliate:sum('report_affiliate'),service:sum('service'),today:todayRows.reduce((s,x)=>s+Number(x.net_amount||x.amount||0),0),daily,payouts});
 }
 if(req.method==='GET'&&view==='performance'){
   const start=new Date(Date.now()-30*86400000).toISOString();const rows=await safe(`/rest/v1/astrologer_performance_daily?astrologer_id=eq.${encodeURIComponent(u.id)}&day=gte.${encodeURIComponent(start.slice(0,10))}&select=*`,[]);
   const avg=(key)=>{const a=rows.map(x=>Number(x[key])).filter(Number.isFinite);return a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length*100)/100:0};
   const reviews=await safe(`/rest/v1/reviews?astrologer_id=eq.${encodeURIComponent(u.id)}&select=rating`,[]);const rating=reviews.length?Math.round(reviews.reduce((s,r)=>s+Number(r.rating||0),0)/reviews.length*10)/10:0;const a=await getAstro(u.id);
   return json(res,200,{callRating:'NA',chatRating:'NA',chatQuality:avg('chat_quality'),liveHours:avg('live_hours'),callPickup:avg('call_pickup_rate'),chatPickup:avg('chat_pickup_rate'),conversion:avg('conversion_rate'),responseTime:avg('response_time_sec'),loginHours:avg('login_hours'),visibleRating:rating,followers:Number(a?.followers_count||0),reviews:reviews.length,violations:Number(a?.policy_violations||0)});
 }
 if(req.method==='POST'){
   const b=req.body||{};
   if(b.action==='toggle'){
     const map={call:'call_enabled',chat:'chat_enabled',video:'video_enabled',boost:'boost_enabled',live:'online'};const col=map[String(b.key||'')];if(!col)return json(res,400,{error:'Invalid toggle'});const rows=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...{[col]:!!b.value},...(col==='online'?{last_seen:b.value?new Date().toISOString():null}:{})})});return json(res,200,{ok:true,astrologer:rows[0]||null});
   }
   if(b.action==='leave'){if(!b.from||!b.to)return json(res,400,{error:'Leave dates required'});const rows=await sbreq('/rest/v1/astrologer_leaves',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({astrologer_id:u.id,from_date:b.from,to_date:b.to,reason:String(b.reason||''),status:'pending'})});return json(res,201,{leave:rows[0]});}
   if(b.action==='ticket'){if(!b.subject)return json(res,400,{error:'Subject required'});const rows=await sbreq('/rest/v1/support_tickets',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:u.id,subject:String(b.subject),message:String(b.message||''),status:'open'})});return json(res,201,{ticket:rows[0]});}
   return json(res,400,{error:'Unknown action'});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
