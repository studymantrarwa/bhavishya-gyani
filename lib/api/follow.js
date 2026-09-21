const {authUser,req:sbreq,json}=require('./_lib');
module.exports=async(req,res)=>{try{
 const u=await authUser(req); if(!u)return json(res,401,{error:'Login required'});
 const method=(req.method||'GET').toUpperCase();
 const body=typeof req.body==='object'&&req.body?req.body:{};
 const astrologerId=String(body.astrologerId||req.query?.astrologerId||'').trim();
 if(!astrologerId)return json(res,400,{error:'astrologerId required'});
 const ast=await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(astrologerId)}&select=id,followers`); if(!ast[0])return json(res,404,{error:'Astrologer not found'});
 if(method==='GET'){
  const rows=await sbreq(`/rest/v1/astrologer_follows?user_id=eq.${encodeURIComponent(u.id)}&astrologer_id=eq.${encodeURIComponent(astrologerId)}&select=id,created_at`);
  return json(res,200,{following:!!rows.length,followers:Number(ast[0].followers||0)});
 }
 if(method==='POST'){
  const existing=await sbreq(`/rest/v1/astrologer_follows?user_id=eq.${encodeURIComponent(u.id)}&astrologer_id=eq.${encodeURIComponent(astrologerId)}&select=id`);
  if(!existing.length){await sbreq('/rest/v1/astrologer_follows',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:u.id,astrologer_id:astrologerId})});
   await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(astrologerId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({followers:Number(ast[0].followers||0)+1})});
  }
  return json(res,200,{following:true,followers:Number(ast[0].followers||0)+(existing.length?0:1)});
 }
 if(method==='DELETE'){
  const existing=await sbreq(`/rest/v1/astrologer_follows?user_id=eq.${encodeURIComponent(u.id)}&astrologer_id=eq.${encodeURIComponent(astrologerId)}&select=id`);
  if(existing.length){await sbreq(`/rest/v1/astrologer_follows?user_id=eq.${encodeURIComponent(u.id)}&astrologer_id=eq.${encodeURIComponent(astrologerId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
   await sbreq(`/rest/v1/astrologers?id=eq.${encodeURIComponent(astrologerId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({followers:Math.max(0,Number(ast[0].followers||0)-1)})});
  }
  return json(res,200,{following:false,followers:Math.max(0,Number(ast[0].followers||0)-(existing.length?1:0))});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
