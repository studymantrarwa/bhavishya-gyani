const crypto=require('crypto');
const {authUser,req:sbreq,json}=require('./_lib');

function esc(v){return encodeURIComponent(String(v??''));}
function clean(v,max=300){return String(v??'').trim().slice(0,max)}
function num(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,n):0}
function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))}
function validTime(v){return /^\d{2}:\d{2}$/.test(String(v||''))}

async function uploadImage(id,data){
  if(!data)return null;
  if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('Vercel Blob token is not configured. Add BLOB_READ_WRITE_TOKEN in Vercel Environment Variables.');
  const m=String(data).match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
  if(!m)throw new Error('Invalid pooja image. Use JPG, PNG or WEBP.');
  const raw=Buffer.from(m[2],'base64');
  if(raw.length>2*1024*1024)throw new Error('Pooja image must be 2 MB or smaller.');
  const {put}=require('@vercel/blob');
  const ext=m[1].includes('png')?'png':m[1].includes('webp')?'webp':'jpg';
  const out=await put(`poojas/${id}.${ext}`,raw,{access:'public',token:process.env.BLOB_READ_WRITE_TOKEN,contentType:m[1]==='image/jpg'?'image/jpeg':m[1]});
  return out.url;
}

async function getAstrologers(ids){
  const cleanIds=[...new Set((ids||[]).map(String).filter(Boolean))];
  if(!cleanIds.length)return new Map();
  const rows=await sbreq(`/rest/v1/astrologers?id=in.(${cleanIds.map(esc).join(',')})&select=id,full_name,avatar_url,online,verified,blocked,approved_at`);
  return new Map(rows.map(x=>[String(x.id),x]));
}
async function getAccounts(ids){
  const cleanIds=[...new Set((ids||[]).map(String).filter(Boolean))];
  if(!cleanIds.length)return new Map();
  const rows=await sbreq(`/rest/v1/astrologer_accounts?id=in.(${cleanIds.map(esc).join(',')})&select=id,full_name,email,phone,approved,blocked`);
  return new Map(rows.map(x=>[String(x.id),x]));
}
async function decoratePoojas(rows){
  const am=await getAstrologers(rows.map(x=>x.astrologer_id));
  return rows.map(x=>({...x,astrologer:am.get(String(x.astrologer_id))||null}));
}
async function decorateBookings(rows){
  const pm=new Map();
  const ids=[...new Set(rows.map(x=>String(x.pooja_id)).filter(Boolean))];
  if(ids.length){
    const ps=await sbreq(`/rest/v1/poojas?id=in.(${ids.map(esc).join(',')})&select=id,name,price,image_url,description,astrologer_id`);
    ps.forEach(x=>pm.set(String(x.id),x));
  }
  const am=await getAstrologers(rows.map(x=>x.astrologer_id));
  const um=new Map();
  const uids=[...new Set(rows.map(x=>String(x.user_id)).filter(Boolean))];
  if(uids.length){const us=await sbreq(`/rest/v1/user_accounts?id=in.(${uids.map(esc).join(',')})&select=id,full_name,email,phone`);us.forEach(x=>um.set(String(x.id),x));}
  return rows.map(x=>({...x,pooja:pm.get(String(x.pooja_id))||null,astrologer:am.get(String(x.astrologer_id))||null,user:um.get(String(x.user_id))||null}));
}

module.exports=async(req,res)=>{
  try{
    const u=await authUser(req); if(!u)return json(res,401,{error:'Login required'});
    const b=req.body||{};
    if(req.method==='GET'){
      if(u.account_type==='astrologer'){
        const mode=String(req.query?.mode||'poojas');
        if(mode==='bookings'){
          const rows=await sbreq(`/rest/v1/pooja_bookings?astrologer_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=500`);
          return json(res,200,{bookings:await decorateBookings(rows)});
        }
        const rows=await sbreq(`/rest/v1/poojas?astrologer_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=500`);
        return json(res,200,{poojas:rows});
      }
      if(u.account_type==='user'){
        const mode=String(req.query?.mode||'list');
        if(mode==='bookings'){
          const rows=await sbreq(`/rest/v1/pooja_bookings?user_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=200`);
          return json(res,200,{bookings:await decorateBookings(rows)});
        }
        const rows=await sbreq('/rest/v1/poojas?active=eq.true&select=*&order=created_at.desc&limit=500');
        const am=await getAccounts(rows.map(x=>x.astrologer_id));
        const ast=await getAstrologers(rows.map(x=>x.astrologer_id));
        const visible=rows.filter(x=>{const a=am.get(String(x.astrologer_id)),p=ast.get(String(x.astrologer_id));return a?.approved===true&&!a?.blocked&&p?.blocked!==true;}).map(x=>({...x,astrologer:ast.get(String(x.astrologer_id))||null}));
        return json(res,200,{poojas:visible});
      }
      return json(res,403,{error:'Not allowed'});
    }

    if(req.method==='POST'){
      if(u.account_type==='astrologer'){
        const action=String(b.action||'create');
        if(action==='create'){
          const name=clean(b.name,160),description=clean(b.description,1200),price=num(b.price);
          if(!name)return json(res,400,{error:'Pooja name is required'});
          if(price<=0)return json(res,400,{error:'Pooja price must be greater than 0'});
          const id=crypto.randomUUID();
          const image_url=await uploadImage(id,b.image_data_url);
          const rows=await sbreq('/rest/v1/poojas',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id,astrologer_id:u.id,name,description,price,image_url,active:b.active!==false})});
          return json(res,201,{pooja:rows[0]||null});
        }
        if(action==='bookings'){
          const rows=await sbreq(`/rest/v1/pooja_bookings?astrologer_id=eq.${esc(u.id)}&select=*&order=created_at.desc&limit=500`);
          return json(res,200,{bookings:await decorateBookings(rows)});
        }
        return json(res,400,{error:'Unknown action'});
      }
      if(u.account_type==='user'){
        const poojaId=clean(b.pooja_id,80),date=clean(b.booking_date,20),time=clean(b.booking_time,10),note=clean(b.note,1000);
        if(!poojaId||!validDate(date)||!validTime(time))return json(res,400,{error:'Pooja, booking date and booking time are required'});
        const ps=await sbreq(`/rest/v1/poojas?id=eq.${esc(poojaId)}&active=eq.true&select=*`);
        const p=ps[0]; if(!p)return json(res,404,{error:'Pooja not found or inactive'});
        const ac=(await sbreq(`/rest/v1/astrologer_accounts?id=eq.${esc(p.astrologer_id)}&select=id,approved,blocked`))[0];
        if(!ac?.approved||ac.blocked)return json(res,400,{error:'This astrologer is not available for pooja booking'});
        const rows=await sbreq('/rest/v1/pooja_bookings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:crypto.randomUUID(),pooja_id:p.id,user_id:u.id,astrologer_id:p.astrologer_id,pooja_name:p.name,price:p.price,booking_date:date,booking_time:time,note,status:'pending'})});
        return json(res,201,{booking:rows[0]||null,message:'Pooja booking request submitted.'});
      }
      return json(res,403,{error:'Not allowed'});
    }

    if(req.method==='PATCH'){
      if(u.account_type==='astrologer'){
        const action=String(b.action||'');
        if(action==='booking_status'){
          const id=clean(b.booking_id,80),status=['pending','accepted','rejected','completed','cancelled'].includes(b.status)?b.status:'pending';
          const rows=await sbreq(`/rest/v1/pooja_bookings?id=eq.${esc(id)}&astrologer_id=eq.${esc(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,updated_at:new Date().toISOString()})});
          return json(res,200,{booking:rows[0]||null});
        }
        const id=clean(b.pooja_id,80); if(!id)return json(res,400,{error:'pooja_id required'});
        const own=(await sbreq(`/rest/v1/poojas?id=eq.${esc(id)}&astrologer_id=eq.${esc(u.id)}&select=*`))[0]; if(!own)return json(res,404,{error:'Pooja not found'});
        const patch={};
        if(b.name!==undefined)patch.name=clean(b.name,160);
        if(b.description!==undefined)patch.description=clean(b.description,1200);
        if(b.price!==undefined)patch.price=num(b.price);
        if(b.active!==undefined)patch.active=!!b.active;
        if(b.image_data_url)patch.image_url=await uploadImage(id+'-'+Date.now(),b.image_data_url);
        patch.updated_at=new Date().toISOString();
        const rows=await sbreq(`/rest/v1/poojas?id=eq.${esc(id)}&astrologer_id=eq.${esc(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
        return json(res,200,{pooja:rows[0]||null});
      }
      if(u.account_type==='user'){
        const id=clean(b.booking_id,80); if(!id)return json(res,400,{error:'booking_id required'});
        const rows=await sbreq(`/rest/v1/pooja_bookings?id=eq.${esc(id)}&user_id=eq.${esc(u.id)}&select=*`); if(!rows[0])return json(res,404,{error:'Booking not found'});
        const status=b.status==='cancelled'?'cancelled':null; if(!status)return json(res,400,{error:'Only cancellation is allowed'});
        const out=await sbreq(`/rest/v1/pooja_bookings?id=eq.${esc(id)}&user_id=eq.${esc(u.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status,updated_at:new Date().toISOString()})});
        return json(res,200,{booking:out[0]||null});
      }
      return json(res,403,{error:'Not allowed'});
    }

    if(req.method==='DELETE'){
      if(u.account_type!=='astrologer')return json(res,403,{error:'Only astrologers can delete pooja'});
      const id=clean(req.query?.id,80); if(!id)return json(res,400,{error:'id required'});
      const used=await sbreq(`/rest/v1/pooja_bookings?pooja_id=eq.${esc(id)}&status=in.(pending,accepted)&select=id&limit=1`);
      if(used.length)return json(res,409,{error:'इस Pooja की active booking है, इसे delete करने के बजाय inactive करें।'});
      await sbreq(`/rest/v1/poojas?id=eq.${esc(id)}&astrologer_id=eq.${esc(u.id)}`,{method:'DELETE'});
      return json(res,200,{ok:true});
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){return json(res,500,{error:e.message||'Pooja request failed'});}
};
