const {req:sbreq,json,authUser,profile,createAccount}=require('./_lib');
function cleanEmail(v){return String(v||'').trim().toLowerCase()}
function validPassword(v){return typeof v==='string'&&v.length>=6}
async function registrationCode(){
  if(process.env.ADMIN_REGISTRATION_CODE)return String(process.env.ADMIN_REGISTRATION_CODE);
  try{const r=await sbreq('/rest/v1/platform_settings?key=eq.admin_registration_code&select=value&limit=1');const v=r[0]?.value;return typeof v==='string'?v:String(v||'').replace(/^"|"$/g,'')}catch{return ''}
}
module.exports=async(req,res)=>{
 try{
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const b=req.body||{};const email=cleanEmail(b.email),password=String(b.password||''),name=String(b.full_name||'').trim(),phone=String(b.phone||'').replace(/\D/g,''),code=String(b.registration_code||'');
  if(!name)return json(res,400,{error:'Admin name is required'});
  if(!email)return json(res,400,{error:'Valid email is required'});
  if(!validPassword(password))return json(res,400,{error:'Password must be at least 6 characters'});
  const caller=await authUser(req);let allowed=false;
  if(caller){const p=await profile(caller.id);allowed=p?.role==='admin'}
  const configured=await registrationCode();if(code&&configured&&code===configured)allowed=true;
  if(!allowed)return json(res,403,{error:'Admin registration is protected. Enter the correct registration code.'});
  const p=await createAccount({accountType:'admin',name,email,phone,password});
  return json(res,201,{ok:true,message:'Admin account created successfully',admin:{id:p.id,email:p.email,full_name:p.full_name,role:'admin'}});
 }catch(e){return json(res,400,{error:e.message||'Admin registration failed'})}
};
