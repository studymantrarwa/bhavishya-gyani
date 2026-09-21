const {req,json,authUser,profile}=require('./_lib');

function cleanEmail(v){return String(v||'').trim().toLowerCase()}
function validPassword(v){return typeof v==='string' && v.length>=6}

module.exports=async(req,res)=>{
  try{
    if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
    const b=req.body||{};
    const email=cleanEmail(b.email), password=String(b.password||''), name=String(b.full_name||'').trim(), phone=String(b.phone||'').trim(), code=String(b.registration_code||'');
    if(!name) return json(res,400,{error:'Admin name is required'});
    if(!email || !email.includes('@')) return json(res,400,{error:'Valid email is required'});
    if(!validPassword(password)) return json(res,400,{error:'Password must be at least 6 characters'});

    // Either an existing admin may create another admin, or the one-time/admin registration code may be used.
    const caller=await authUser(req);
    let allowed=!!(process.env.ADMIN_REGISTRATION_CODE && code && code===process.env.ADMIN_REGISTRATION_CODE);
    if(caller){const p=await profile(caller.id); if(p?.role==='admin') allowed=true;}
    if(!allowed) return json(res,403,{error:'Admin registration is protected. Enter the correct registration code or login as an existing admin.'});

    const c=require('./_lib').cfg();
    if(!c.url||!c.service) return json(res,500,{error:'Supabase server environment variables are missing'});

    const r=await fetch(c.url+'/auth/v1/admin/users',{method:'POST',headers:{'Content-Type':'application/json',apikey:c.service,Authorization:'Bearer '+c.service},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{full_name:name,phone}})});
    const t=await r.text(); let d; try{d=t?JSON.parse(t):null}catch{d=t}
    if(!r.ok) return json(res,r.status,{error:d?.message||d?.msg||d?.error_description||'Admin account could not be created'});
    const id=d?.user?.id;
    if(!id) return json(res,500,{error:'Admin account created but user id was not returned'});

    const rows=await req('/rest/v1/profiles',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id,full_name:name,phone:phone||null,role:'admin',updated_at:new Date().toISOString()})});
    return json(res,201,{ok:true,message:'Admin account created successfully',admin:{id,email,full_name:name,role:'admin',profile:rows[0]||null}});
  }catch(e){return json(res,500,{error:e.message||'Admin registration failed'})}
};
