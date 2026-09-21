const {req:sbreq,json,makeToken,verifyPassword,cleanEmail,cleanPhone}=require('./_lib');

async function findAccount(table, email, phone){
  // Query email and phone separately. This avoids REST `or=` parsing edge cases
  // with encoded identifiers and makes login reliable after logout/re-login.
  let rows=[];
  if(email){
    rows=await sbreq(`/rest/v1/${table}?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
    if(rows[0]) return rows[0];
  }
  if(phone){
    rows=await sbreq(`/rest/v1/${table}?phone=eq.${encodeURIComponent(phone)}&select=*&limit=1`);
    if(rows[0]) return rows[0];
  }
  return null;
}

module.exports=async(req,res)=>{
  try{
    if(req.method!=='POST') return json(res,405,{error:'Method not allowed'});
    const b=req.body||{};
    const identifier=String(b.identifier||b.email||'').trim();
    const email=cleanEmail(identifier);
    const phone=cleanPhone(identifier);
    const password=String(b.password||'');
    const type=['user','astrologer','admin'].includes(b.account_type)?b.account_type:'user';
    const table=type==='user'?'user_accounts':type==='astrologer'?'astrologer_accounts':'admin_accounts';

    const a=await findAccount(table,email,phone);
    if(!a) return json(res,401,{error:'Invalid email/mobile or password'});
    if(!verifyPassword(password,a.password_salt,a.password_hash)) return json(res,401,{error:'Invalid email/mobile or password'});
    if(a.blocked) return json(res,403,{error:'Account blocked'});
    if(type==='astrologer'&&a.approved!==true) return json(res,403,{error:'Astrologer account is awaiting Admin approval'});

    const token=makeToken({id:a.id,email:a.email,account_type:type});
    return json(res,200,{token,user:{id:a.id,email:a.email,name:a.full_name||'',role:type,account_type:type}});
  }catch(e){
    return json(res,500,{error:e.message||'Login failed'});
  }
};
