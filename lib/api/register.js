const {json,createAccount}=require('./_lib');
module.exports=async(req,res)=>{
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  try{
    const b=req.body||{};
    const name=String(b.name||b.full_name||'').trim(),phone=String(b.phone||'').replace(/\D/g,''),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
    if(!name)return json(res,400,{error:'Full name is required'});
    const p=await createAccount({accountType:'user',name,email,phone,password});
    return json(res,201,{ok:true,message:'User account created successfully',user:{id:p.id,email:p.email,name:p.full_name,role:'user'}});
  }catch(e){return json(res,400,{error:e.message||'Registration failed'})}
};
