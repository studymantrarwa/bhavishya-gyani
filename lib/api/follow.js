const {authUser,req:sbreq,json}=require('./_lib');
const esc=v=>encodeURIComponent(String(v));
module.exports=async(req,res)=>{try{
 const u=await authUser(req);
 if(!u||u.account_type!=='user')return json(res,403,{error:'User only'});
 const aid=String(req.body?.astrologerId||req.query?.astrologerId||'').trim();
 if(!aid)return json(res,400,{error:'astrologerId required'});
 const ast=(await sbreq(`/rest/v1/astrologers?id=eq.${esc(aid)}&select=id,followers,followers_count`))[0];
 if(!ast)return json(res,404,{error:'Astrologer not found'});
 const base=`/rest/v1/astrologer_follows?user_id=eq.${esc(u.id)}&astrologer_id=eq.${esc(aid)}`;
 if(req.method==='GET'){
   const rows=await sbreq(`${base}&select=id`);
   return json(res,200,{following:!!rows.length,followers:Number(ast.followers||ast.followers_count||0)});
 }
 if(req.method==='POST'){
   const ex=await sbreq(`${base}&select=id`);
   if(!ex.length)await sbreq('/rest/v1/astrologer_follows',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({user_id:u.id,astrologer_id:aid})});
   const countRows=await sbreq(`/rest/v1/astrologer_follows?astrologer_id=eq.${esc(aid)}&select=id&limit=100000`);
   const n=countRows.length;
   await sbreq(`/rest/v1/astrologers?id=eq.${esc(aid)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({followers:n,followers_count:n})});
   return json(res,200,{following:true,followers:n});
 }
 if(req.method==='DELETE'){
   await sbreq(base,{method:'DELETE',headers:{Prefer:'return=minimal'}});
   const countRows=await sbreq(`/rest/v1/astrologer_follows?astrologer_id=eq.${esc(aid)}&select=id&limit=100000`);
   const n=countRows.length;
   await sbreq(`/rest/v1/astrologers?id=eq.${esc(aid)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({followers:n,followers_count:n})});
   return json(res,200,{following:false,followers:n});
 }
 return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message})}};
