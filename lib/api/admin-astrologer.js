const {authUser,req:sbreq,json}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));

module.exports=async(req,res)=>{
  try{
    const u=await authUser(req);
    if(!u||u.account_type!=='admin') return json(res,403,{error:'Admin only'});

    if(req.method==='GET'){
      const rows=await sbreq('/rest/v1/astrologer_applications?select=id,user_id,education,bio,experience_years,expertise,languages,requested_fee,avatar_url,status,admin_note,created_at,updated_at&order=created_at.desc&limit=500');
      const ids=[...new Set(rows.map(x=>x.user_id).filter(Boolean))];
      const accounts=ids.length
        ? await sbreq(`/rest/v1/astrologer_accounts?id=in.(${ids.map(esc).join(',')})&select=id,full_name,email,phone,blocked,approved`)
        : [];
      const map=new Map(accounts.map(x=>[String(x.id),x]));
      return json(res,200,{applications:rows.map(x=>({...x,profile:map.get(String(x.user_id))||null}))});
    }

    if(req.method==='POST'||req.method==='PATCH'){
      const b=req.body||{};
      const id=String(b.user_id||b.userId||'');
      const status=String(b.status||'');
      if(!id||!['approved','rejected'].includes(status)) return json(res,400,{error:'Invalid approval request'});

      const app=(await sbreq(`/rest/v1/astrologer_applications?user_id=eq.${esc(id)}&select=id,user_id,status&limit=1`))[0];
      if(!app) return json(res,404,{error:'Application not found'});
      const now=new Date().toISOString();

      if(status==='approved'){
        await sbreq(`/rest/v1/astrologer_accounts?id=eq.${esc(id)}`,{
          method:'PATCH',headers:{Prefer:'return=minimal'},
          body:JSON.stringify({approved:true})
        });
        await sbreq(`/rest/v1/astrologers?id=eq.${esc(id)}`,{
          method:'PATCH',headers:{Prefer:'return=minimal'},
          body:JSON.stringify({verified:true,approved_at:now})
        });
      }else{
        await sbreq(`/rest/v1/astrologer_accounts?id=eq.${esc(id)}`,{
          method:'PATCH',headers:{Prefer:'return=minimal'},
          body:JSON.stringify({approved:false})
        }).catch(()=>{});
        await sbreq(`/rest/v1/astrologers?id=eq.${esc(id)}`,{
          method:'PATCH',headers:{Prefer:'return=minimal'},
          body:JSON.stringify({verified:false})
        }).catch(()=>{});
      }

      const updated=await sbreq(`/rest/v1/astrologer_applications?id=eq.${esc(app.id)}`,{
        method:'PATCH',headers:{Prefer:'return=representation'},
        body:JSON.stringify({status,admin_note:String(b.admin_note||''),updated_at:now})
      });
      return json(res,200,{application:updated[0]||null});
    }

    return json(res,405,{error:'Method not allowed'});
  }catch(e){
    return json(res,500,{error:e.message||'Admin astrologer approval failed'});
  }
};
