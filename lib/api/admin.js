const {authUser,req:sbreq,json,profile}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
const normalizePoojaBooking=b=>({...b,preferred_date:b.preferred_date??b.booking_date??'',preferred_time:b.preferred_time??b.booking_time??'',amount:b.amount??b.price??0,notes:b.notes??b.note??'',status:b.status==='accepted'?'confirmed':b.status});
const isPoojaSchemaMismatch=e=>/column .* does not exist|could not find the ['\"]?(?:amount|preferred_date|preferred_time|admin_note|astrologer_note)['\"]? column|schema cache|check constraint|violates.*constraint/i.test(String(e?.message||e));


async function guard(req,res){
  const u=await authUser(req);
  if(!u){json(res,401,{error:'Login required'});return null}
  const p=await profile(u.id,'admin');
  if(p?.role!=='admin'){json(res,403,{error:'Admin only'});return null}
  return u;
}

async function audit(adminId,action,details){
  try{await sbreq('/rest/v1/admin_audit_logs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({admin_id:adminId,action,details})})}catch(e){}
}

async function getJyotishCourses(){
  const rows=await sbreq('/rest/v1/platform_settings?key=eq.jyotish_courses&select=value&limit=1');
  const v=rows[0]?.value;return Array.isArray(v)?v:[];
}
async function saveJyotishCourses(adminId,courses){
  const row={key:'jyotish_courses',value:courses,updated_by:adminId,updated_at:new Date().toISOString()};
  return sbreq('/rest/v1/platform_settings',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
}
async function ensureJyotishBucket(){
  const name='jyotish-learning';
  try{await sbreq('/storage/v1/bucket',{method:'POST',body:JSON.stringify({id:name,name,public:true,file_size_limit:52428800,allowed_mime_types:['application/pdf']})});}
  catch(e){if(!String(e.message||'').toLowerCase().includes('already'))throw e;}
  return name;
}
async function getAccounts(type,ids){
  if(!ids?.length)return [];
  const table=type==='user'?'user_accounts':type==='astrologer'?'astrologer_accounts':'admin_accounts';
  const wanted=new Set(ids.map(String));
  const select=type==='astrologer'?'id,email,phone,full_name,blocked,approved':'id,email,phone,full_name,blocked';
  const rows=await sbreq(`/rest/v1/${table}?select=${select}&limit=5000`);
  return rows.filter(x=>wanted.has(String(x.id)));
}

async function allAccounts(){
  const [users,astros,admins]=await Promise.all([
    sbreq('/rest/v1/user_accounts?select=id,email,phone,full_name,blocked,created_at,updated_at&order=created_at.desc&limit=5000'),
    sbreq('/rest/v1/astrologer_accounts?select=id,email,phone,full_name,blocked,approved,created_at,updated_at&order=created_at.desc&limit=5000'),
    sbreq('/rest/v1/admin_accounts?select=id,email,phone,full_name,blocked,created_at,updated_at&order=created_at.desc&limit=5000')
  ]);
  return {users,astros,admins};
}

async function rankAstrologers(){
  const [as,convs,reviews]=await Promise.all([
    sbreq('/rest/v1/astrologers?select=id,verified,online,blocked,rank_score&limit=1000'),
    sbreq('/rest/v1/conversations?select=id,astrologer_id,status,missed_by,astrologer_response_seconds&limit=5000'),
    sbreq('/rest/v1/reviews?select=astrologer_id,rating,moderation_status&limit=5000')
  ]);
  const arr=as.map(a=>{
    const cs=convs.filter(c=>c.astrologer_id===a.id);
    const completed=cs.filter(c=>c.status==='closed').length;
    const attempts=cs.filter(c=>['accepted','closed','missed','rejected','astrologer_accepted'].includes(c.status)).length;
    const accepted=cs.filter(c=>['accepted','closed'].includes(c.status)).length;
    const missed=cs.filter(c=>c.missed_by==='astrologer').length;
    const rs=reviews.filter(r=>r.astrologer_id===a.id&&r.moderation_status!=='hidden');
    const avg=rs.length?rs.reduce((s,r)=>s+Number(r.rating||0),0)/rs.length:0;
    const responses=cs.map(c=>Number(c.astrologer_response_seconds)).filter(n=>Number.isFinite(n)&&n>=0);
    const avgResp=responses.length?responses.reduce((s,n)=>s+n,0)/responses.length:120;
    const rating=avg/5,completion=attempts?completed/attempts:0,acceptance=attempts?accepted/attempts:0;
    const response=Math.max(0,1-Math.min(avgResp,120)/120),reliability=attempts?Math.max(0,1-missed/attempts):0;
    const score=Math.round((rating*.35+completion*.20+acceptance*.20+response*.15+reliability*.10)*10000)/100;
    return {...a,rank_score:score,rating_avg:Math.round(avg*100)/100,completed_chats:completed,accepted_requests:accepted,missed_requests:missed,response_seconds_avg:Math.round(avgResp*100)/100};
  });
  arr.sort((x,y)=>y.rank_score-x.rank_score||y.rating_avg-x.rating_avg);
  for(let i=0;i<arr.length;i++){
    const a=arr[i];
    await sbreq(`/rest/v1/astrologers?id=eq.${esc(a.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({rank_score:a.rank_score,rank_position:i+1,rating_avg:a.rating_avg,completed_chats:a.completed_chats,accepted_requests:a.accepted_requests,missed_requests:a.missed_requests,response_seconds_avg:a.response_seconds_avg})});
  }
  return arr;
}

async function attachAccounts(rows,fields){
  const ids=[];
  for(const r of rows){for(const f of fields){if(r[f])ids.push(r[f])}}
  const unique=[...new Set(ids.map(String))];
  const [u,a,ad]=await Promise.all([
    getAccounts('user',unique),getAccounts('astrologer',unique),getAccounts('admin',unique)
  ]);
  const map=new Map([...u,...a,...ad].map(x=>[String(x.id),x]));
  return rows.map(r=>{const out={...r};for(const f of fields)out[f.replace(/_id$/,'')]=map.get(String(r[f]))||null;return out});
}

module.exports=async(req,res)=>{try{
  const u=await guard(req,res);if(!u)return;
  const action=String(req.query?.action||'overview');

  if(req.method==='GET'&&action==='overview'){
    const [ua,aa,ap,ast,convs,reviews,kundalis,payments]=await Promise.all([
      sbreq('/rest/v1/user_accounts?select=id,blocked&limit=5000'),
      sbreq('/rest/v1/admin_accounts?select=id,blocked&limit=5000'),
      sbreq('/rest/v1/astrologer_applications?select=id,status&limit=5000'),
      sbreq('/rest/v1/astrologers?select=id,verified,online,blocked&limit=5000'),
      sbreq('/rest/v1/conversations?select=id,status&limit=5000'),
      sbreq('/rest/v1/reviews?select=id,rating,moderation_status&limit=5000'),
      sbreq('/rest/v1/kundalis?select=id&limit=5000'),
      sbreq('/rest/v1/payments?select=id,status,amount&limit=5000')
    ]);
    return json(res,200,{stats:{
      users:ua.length,astrologers:ast.length,admins:aa.length,blockedUsers:ua.filter(x=>x.blocked).length,
      pendingApplications:ap.filter(x=>x.status==='pending').length,approvedAstrologers:ast.filter(x=>x.verified).length,
      onlineAstrologers:ast.filter(x=>x.online&&!x.blocked).length,activeChats:convs.filter(x=>x.status==='accepted').length,
      totalChats:convs.length,totalReviews:reviews.length,pendingReviews:reviews.filter(x=>x.moderation_status==='pending').length,
      totalKundalis:kundalis.length,pendingPayments:payments.filter(x=>x.status==='pending').length,
      approvedPayments:payments.filter(x=>x.status==='approved').length,
      revenue:payments.filter(x=>x.status==='approved').reduce((s,x)=>s+Number(x.amount||0),0),
      pendingAmount:payments.filter(x=>x.status==='pending').reduce((s,x)=>s+Number(x.amount||0),0),
      refundedAmount:payments.filter(x=>x.status==='refunded').reduce((s,x)=>s+Number(x.amount||0),0),
      astrologerPayable:payments.filter(x=>x.status==='approved').reduce((s,x)=>s+Number(x.amount||0),0)
    }});
  }

  if(req.method==='GET'&&action==='users'){
    const q=String(req.query?.q||'').trim().toLowerCase();
    const {users,astros,admins}=await allAccounts();
    const rows=[
      ...users.map(x=>({...x,role:'user',account_type:'user'})),
      ...astros.map(x=>({...x,role:'astrologer',account_type:'astrologer'})),
      ...admins.map(x=>({...x,role:'admin',account_type:'admin'}))
    ].filter(x=>!q||[x.full_name,x.email,x.phone,x.role].some(v=>String(v||'').toLowerCase().includes(q)))
     .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    return json(res,200,{users:rows});
  }

  if(req.method==='GET'&&action==='applications'){
    const apps=await sbreq('/rest/v1/astrologer_applications?select=*&order=created_at.desc&limit=500');
    const ids=[...new Set(apps.map(a=>a.user_id).filter(Boolean))];
    const accounts=await getAccounts('astrologer',ids);const map=new Map(accounts.map(a=>[String(a.id),a]));
    return json(res,200,{applications:apps.map(a=>({...a,profile:map.get(String(a.user_id))||null}))});
  }

  if(req.method==='GET'&&action==='astrologers'){
    const ranked=await rankAstrologers();
    const accounts=await getAccounts('astrologer',ranked.map(a=>a.id));const map=new Map(accounts.map(a=>[String(a.id),a]));
    return json(res,200,{astrologers:ranked.map(a=>({...a,email:map.get(String(a.id))?.email||'',phone:map.get(String(a.id))?.phone||'',full_name:a.full_name||map.get(String(a.id))?.full_name||'Astrologer'}))});
  }

  if(req.method==='GET'&&action==='conversations'){
    const rows=await sbreq('/rest/v1/conversations?select=*&order=created_at.desc&limit=500');
    const [users,astros,admins]=await Promise.all([getAccounts('user',rows.map(x=>x.user_id)),getAccounts('astrologer',rows.map(x=>x.astrologer_id)),getAccounts('admin',rows.map(x=>x.admin_id))]);
    const mu=new Map(users.map(x=>[String(x.id),x])),ma=new Map(astros.map(x=>[String(x.id),x])),md=new Map(admins.map(x=>[String(x.id),x]));
    return json(res,200,{conversations:rows.map(c=>({...c,user:mu.get(String(c.user_id))||null,astrologer:ma.get(String(c.astrologer_id))||null,admin:md.get(String(c.admin_id))||null}))});
  }

  if(req.method==='GET'&&action==='reviews'){
    const rows=await sbreq('/rest/v1/reviews?select=*&order=created_at.desc&limit=500');
    const [users,astros]=await Promise.all([getAccounts('user',rows.map(x=>x.user_id)),getAccounts('astrologer',rows.map(x=>x.astrologer_id))]);
    const mu=new Map(users.map(x=>[String(x.id),x])),ma=new Map(astros.map(x=>[String(x.id),x]));
    return json(res,200,{reviews:rows.map(r=>({...r,user:mu.get(String(r.user_id))||null,astrologer:ma.get(String(r.astrologer_id))||null}))});
  }

  if(req.method==='GET'&&action==='payments'){
    const rows=await sbreq('/rest/v1/payments?select=*&order=created_at.desc&limit=500');
    const [users,astros]=await Promise.all([getAccounts('user',rows.map(x=>x.user_id)),getAccounts('astrologer',rows.map(x=>x.astrologer_id))]);
    const mu=new Map(users.map(x=>[String(x.id),x])),ma=new Map(astros.map(x=>[String(x.id),x]));
    return json(res,200,{payments:rows.map(p=>({...p,user:mu.get(String(p.user_id))||null,astrologer:ma.get(String(p.astrologer_id))||null}))});
  }

  if(req.method==='GET'&&action==='audit'){
    const rows=await sbreq('/rest/v1/admin_audit_logs?select=*&order=created_at.desc&limit=300');
    const admins=await getAccounts('admin',rows.map(x=>x.admin_id));const map=new Map(admins.map(a=>[String(a.id),a]));
    return json(res,200,{logs:rows.map(l=>({...l,admin:map.get(String(l.admin_id))||null}))});
  }

  if(req.method==='GET'&&action==='messages'){
    const id=String(req.query?.conversation_id||'');if(!id)return json(res,400,{error:'conversation_id required'});
    const rows=await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&select=*&order=created_at.asc&limit=1000`);
    const senders=[...new Set(rows.map(m=>m.sender_id).filter(Boolean))];
    const [users,astros,admins]=await Promise.all([getAccounts('user',senders),getAccounts('astrologer',senders),getAccounts('admin',senders)]);
    const map=new Map([...users,...astros,...admins].map(a=>[String(a.id),a]));
    return json(res,200,{messages:rows.filter(m=>!String(m.body||'').startsWith('__BG_CALL_SIGNAL__')).map(m=>({...m,sender:map.get(String(m.sender_id))||null}))});
  }

  if(req.method==='GET'&&action==='kundlis'){
    const rows=await sbreq('/rest/v1/kundalis?select=*&order=created_at.desc&limit=500');
    const users=await getAccounts('user',rows.map(x=>x.user_id));const map=new Map(users.map(x=>[String(x.id),x]));
    return json(res,200,{kundalis:rows.map(k=>({...k,user:map.get(String(k.user_id))||null}))});
  }

  if(req.method==='GET'&&action==='kundli'){
    const id=String(req.query?.id||'');if(!id)return json(res,400,{error:'kundli id required'});
    const rows=await sbreq(`/rest/v1/kundalis?id=eq.${esc(id)}&select=*&limit=1`);const k=rows[0];if(!k)return json(res,404,{error:'Kundli not found'});
    const users=await getAccounts('user',[k.user_id]);return json(res,200,{kundli:{...k,user:users[0]||null}});
  }

  if(req.method==='GET'&&action==='poojas'){
    const rows=await sbreq('/rest/v1/poojas?select=*&order=created_at.desc&limit=500');
    const astros=await getAccounts('astrologer',rows.map(x=>x.astrologer_id));const map=new Map(astros.map(a=>[String(a.id),a]));
    return json(res,200,{poojas:rows.map(p=>({...p,astrologer:map.get(String(p.astrologer_id))||null}))});
  }

  if(req.method==='GET'&&action==='pooja-bookings'){
    const rows=await sbreq('/rest/v1/pooja_bookings?select=*&order=created_at.desc&limit=1000');
    const ids=[...new Set(rows.map(x=>x.pooja_id).filter(Boolean))];
    const [users,astros,poojas]=await Promise.all([getAccounts('user',rows.map(x=>x.user_id)),getAccounts('astrologer',rows.map(x=>x.astrologer_id)),ids.length?sbreq(`/rest/v1/poojas?id=in.(${ids.map(esc).join(',')})&select=id,name,price,image_url`):Promise.resolve([])]);
    const mu=new Map(users.map(a=>[String(a.id),a])),ma=new Map(astros.map(a=>[String(a.id),a])),mp=new Map(poojas.map(a=>[String(a.id),a]));
    return json(res,200,{bookings:rows.map(b=>({...normalizePoojaBooking(b),user:mu.get(String(b.user_id))||null,astrologer:ma.get(String(b.astrologer_id))||null,pooja:mp.get(String(b.pooja_id))||null}))});
  }

  if(req.method==='GET'&&action==='jyotish'){
    const courses=await getJyotishCourses();
    return json(res,200,{courses});
  }

  if(req.method==='GET'&&action==='settings'){
    const rows=await sbreq('/rest/v1/platform_settings?select=key,value&limit=500');
    const settings={};for(const r of rows){try{settings[r.key]=typeof r.value==='string'?JSON.parse(r.value):r.value}catch{settings[r.key]=r.value}}
    return json(res,200,{settings});
  }

  if(req.method==='POST'&&action==='recalculate-ranks'){
    const a=await rankAstrologers();await audit(u.id,'recalculate_ranks',{count:a.length});return json(res,200,{astrologers:a});
  }

  if(req.method==='POST'&&action==='jyotish-upload-url'){
    const b=req.body||{};const filename=String(b.filename||'').trim();const contentType=String(b.content_type||'application/pdf').toLowerCase();
    if(!filename)return json(res,400,{error:'filename required'});
    if(contentType!=='application/pdf')return json(res,400,{error:'Only PDF files are allowed'});
    const bucket=await ensureJyotishBucket();
    const safe=filename.replace(/[^a-zA-Z0-9._-]/g,'_').replace(/_+/g,'_');
    const path=`pdfs/${Date.now()}-${Math.random().toString(36).slice(2,9)}-${safe}`;
    const signed=await sbreq(`/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${path}`,{method:'POST',body:JSON.stringify({expiresIn:3600})});
    const uploadUrl=signed?.url?(String(signed.url).startsWith('http')?signed.url:`${process.env.SUPABASE_URL}${signed.url}`):`${process.env.SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${path}?token=${encodeURIComponent(signed?.token||'')}`;
    return json(res,200,{bucket,path,token:signed?.token||'',upload_url:uploadUrl,public_url:`${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`});
  }

  if((req.method==='POST'||req.method==='PUT')&&action==='jyotish'){
    const b=req.body||{};const id=String(b.id||'').trim();
    if(!String(b.title||'').trim())return json(res,400,{error:'Title is required'});
    const courses=await getJyotishCourses();const now=new Date().toISOString();
    const item={id:id||`jy-${Date.now()}`,title:String(b.title).trim(),description:String(b.description||'').trim(),video_url:String(b.video_url||'').trim(),pdf_url:String(b.pdf_url||'').trim(),pdf_name:String(b.pdf_name||'').trim(),order:Number(b.order)||0,published:b.published!==false,updated_at:now};
    const idx=courses.findIndex(x=>String(x.id)===item.id);if(idx>=0)courses[idx]={...courses[idx],...item};else courses.push(item);
    courses.sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
    await saveJyotishCourses(u.id,courses);await audit(u.id,id?'jyotish_update':'jyotish_create',{id:item.id,title:item.title});
    return json(res,200,{course:item,courses});
  }

  if(req.method==='DELETE'&&action==='jyotish'){
    const id=String(req.body?.id||req.query?.id||'').trim();if(!id)return json(res,400,{error:'id required'});
    const courses=await getJyotishCourses();const item=courses.find(x=>String(x.id)===id);const next=courses.filter(x=>String(x.id)!==id);
    if(item?.pdf_url&&String(item.pdf_url).includes('/storage/v1/object/public/jyotish-learning/')){
      try{const path=decodeURIComponent(String(item.pdf_url).split('/storage/v1/object/public/jyotish-learning/')[1]||'');if(path)await sbreq(`/storage/v1/object/jyotish-learning/${path}`,{method:'DELETE'});}catch(e){}
    }
    await saveJyotishCourses(u.id,next);await audit(u.id,'jyotish_delete',{id});return json(res,200,{courses:next});
  }

  if(req.method==='PATCH'){
    const b=req.body||{};
    if(action==='user'){
      const id=String(b.user_id||'');if(!id)return json(res,400,{error:'user_id required'});
      const type=String(b.account_type||b.role||'');
      let account=null;
      if(type==='user')account=(await getAccounts('user',[id]))[0];
      else if(type==='astrologer')account=(await getAccounts('astrologer',[id]))[0];
      else if(type==='admin')account=(await getAccounts('admin',[id]))[0];
      else account=(await getAccounts('user',[id]))[0]||(await getAccounts('astrologer',[id]))[0]||(await getAccounts('admin',[id]))[0];
      if(!account)return json(res,404,{error:'Account not found'});
      const actual=type||('user');
      const table=actual==='astrologer'?'astrologer_accounts':actual==='admin'?'admin_accounts':'user_accounts';
      const patch={};if('full_name'in b)patch.full_name=String(b.full_name||'');if('phone'in b)patch.phone=String(b.phone||'');
      if('blocked'in b)patch.blocked=!!b.blocked;
      const rows=await sbreq(`/rest/v1/${table}?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
      if(actual==='user'&&'blocked'in b)await sbreq(`/rest/v1/user_profiles?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({blocked:!!b.blocked})}).catch(()=>{});
      if(actual==='astrologer'&&'blocked'in b)await sbreq(`/rest/v1/astrologers?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({blocked:!!b.blocked})}).catch(()=>{});
      await audit(u.id,b.blocked?'block_user':'user_update',{user_id:id,account_type:actual,changes:patch});return json(res,200,{user:rows[0]||null});
    }

    if(action==='application'){
      const userId=String(b.user_id||'').trim();if(!userId)return json(res,400,{error:'user_id required'});
      const status=String(b.status||'').trim();if(!['approved','rejected'].includes(status))return json(res,400,{error:'Invalid status'});
      const a=(await sbreq(`/rest/v1/astrologer_applications?user_id=eq.${esc(userId)}&select=*&limit=1`))[0];if(!a)return json(res,404,{error:'Application not found'});
      const now=new Date().toISOString();
      if(status==='approved'){
        await sbreq(`/rest/v1/astrologer_accounts?id=eq.${esc(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({approved:true,blocked:false,full_name:(await getAccounts('astrologer',[userId]))[0]?.full_name||''})});
        const astro={id:userId,full_name:(await getAccounts('astrologer',[userId]))[0]?.full_name||'',avatar_url:a.avatar_url||null,bio:a.bio||'',education:a.education||'',experience_years:Number(a.experience_years||0),expertise:Array.isArray(a.expertise)?a.expertise:[],languages:Array.isArray(a.languages)?a.languages:[],fee:Number(a.requested_fee||0),discount:0,online:false,verified:true,approved_at:now};
        await sbreq('/rest/v1/astrologers',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(astro)});
      }
      const rows=await sbreq(`/rest/v1/astrologer_applications?id=eq.${esc(a.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,admin_note:String(b.admin_note||''),updated_at:now})});
      await audit(u.id,'application_'+status,{application_id:a.id,user_id:userId});return json(res,200,{ok:true,application:rows[0]||null});
    }

    if(action==='astrologer'){
      const id=String(b.astrologer_id||'');if(!id)return json(res,400,{error:'astrologer_id required'});
      const patch={};for(const k of ['bio','experience_years','expertise','languages','online','verified','blocked'])if(k in b)patch[k]=b[k];
      if('fee'in b)patch.fee=Math.max(0,Number(b.fee)||0);if('discount'in b)patch.discount=Math.min(100,Math.max(0,Number(b.discount)||0));if(b.verified===true)patch.approved_at=new Date().toISOString();
      const rows=await sbreq(`/rest/v1/astrologers?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});await audit(u.id,'astrologer_update',{astrologer_id:id,changes:patch});return json(res,200,{astrologer:rows[0]||null});
    }

    if(action==='payment'){
      const id=String(b.payment_id||'');if(!id)return json(res,400,{error:'payment_id required'});const status=['approved','rejected','refunded','pending'].includes(b.status)?b.status:null;if(!status)return json(res,400,{error:'Invalid payment status'});
      const patch={status,admin_note:String(b.admin_note||''),updated_at:new Date().toISOString()};if(status==='approved'){patch.approved_by=u.id;patch.approved_at=new Date().toISOString()}
      const rows=await sbreq(`/rest/v1/payments?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});await audit(u.id,'payment_'+status,{payment_id:id});return json(res,200,{payment:rows[0]||null});
    }

    if(action==='review'){
      const id=String(b.review_id||'');if(!id)return json(res,400,{error:'review_id required'});const status=['pending','approved','hidden','flagged'].includes(b.moderation_status)?b.moderation_status:'pending';
      const rows=await sbreq(`/rest/v1/reviews?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({moderation_status:status,admin_note:String(b.admin_note||'')})});await audit(u.id,'review_moderation',{review_id:id,status});return json(res,200,{review:rows[0]||null});
    }

    if(action==='conversation'){
      const id=String(b.conversation_id||'');if(!id)return json(res,400,{error:'conversation_id required'});const status=['requested','astrologer_accepted','accepted','rejected','missed','closed'].includes(b.status)?b.status:null;if(!status)return json(res,400,{error:'Invalid status'});
      const patch={status};if(status==='closed')patch.closed_at=new Date().toISOString();const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});await audit(u.id,'conversation_update',{conversation_id:id,status});return json(res,200,{conversation:rows[0]||null});
    }

    if(action==='pooja'){
      const id=String(b.pooja_id||'');if(!id)return json(res,400,{error:'pooja_id required'});
      const patch={};if('active' in b)patch.active=!!b.active;if('price' in b)patch.price=Math.max(0,Number(b.price)||0);if('name' in b)patch.name=String(b.name||'').trim();if('description' in b)patch.description=String(b.description||'').trim();
      const rows=await sbreq(`/rest/v1/poojas?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});
      await audit(u.id,'pooja_update',{pooja_id:id,changes:patch});return json(res,200,{pooja:rows[0]||null});
    }

    if(action==='pooja-booking'){
      const id=String(b.booking_id||'');if(!id)return json(res,400,{error:'booking_id required'});
      const allowed=['pending','confirmed','rejected','completed','cancelled'];const status=String(b.status||'');if(!allowed.includes(status))return json(res,400,{error:'Invalid booking status'});
      let rows;
      try{
        rows=await sbreq(`/rest/v1/pooja_bookings?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,admin_note:String(b.admin_note||''),updated_at:new Date().toISOString()})});
      }catch(e){
        if(!isPoojaSchemaMismatch(e))throw e;
        rows=await sbreq(`/rest/v1/pooja_bookings?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:status==='confirmed'?'accepted':status,updated_at:new Date().toISOString()})});
      }
      await audit(u.id,'pooja_booking_'+status,{booking_id:id});return json(res,200,{booking:normalizePoojaBooking(rows[0]||null)});
    }

    if(action==='settings'){
      const settings=b.settings&&typeof b.settings==='object'?b.settings:{};const out=[];
      for(const [key,value] of Object.entries(settings)){
        const row={key,value,updated_by:u.id,updated_at:new Date().toISOString()};
        const rows=await sbreq('/rest/v1/platform_settings',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});out.push(rows[0]||row);
      }
      await audit(u.id,'platform_settings_update',{keys:Object.keys(settings)});return json(res,200,{settings});
    }
  }

  return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message||'Admin request failed'})}};
