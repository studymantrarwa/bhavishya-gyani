const {authUser,req:sbreq,json}=require('./_lib');

module.exports=async(req,res)=>{
  try{
    const u=await authUser(req);
    if(!u || u.account_type!=='user') return json(res,401,{error:'User login required'});

    // Do not join `profiles` here. The current Bhavishya Gyani schema
    // keeps astrologer profile data directly in `astrologers`, so a
    // PostgREST relationship join can fail with a schema-cache error.
    const rows=await sbreq(
      '/rest/v1/astrologers?verified=eq.true&blocked=eq.false&select=*&order=rank_position.asc.nullslast,rank_score.desc,online.desc'
    );

    const active=rows.map(a=>({
      ...a,
      online:!!a.online,
      full_name:a.full_name||'Astrologer',base_fee_per_minute:Number(a.fee_per_minute??a.fee??0),discount_percent:[0,25,50,75].includes(Number(a.discount))?Number(a.discount):0,effective_fee_per_minute:Math.round(Number(a.fee_per_minute??a.fee??0)*(1-(Number(a.discount)||0)/100)*100)/100
    }));

    return json(res,200,{astrologers:active});
  }catch(e){
    return json(res,500,{error:e.message});
  }
};
