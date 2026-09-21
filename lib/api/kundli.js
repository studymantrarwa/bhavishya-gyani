const {authUser,req:sbreq,json}=require("./_lib");
const {calculateKundli}=require("../astrology-engine");
const {calculateAdvanced}=require("../advanced-astrology");
module.exports=async(req,res)=>{
 if(req.method!=="POST")return json(res,405,{error:"Method not allowed"});
 try{
  const b=req.body||{};const r=await calculateKundli(b);r.advanced=await calculateAdvanced(b,{date:new Date().toISOString().slice(0,10),time:'12:00'});const u=await authUser(req);
  if(u){
   await sbreq("/rest/v1/kundalis",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({user_id:u.id,name:b.name||"Kundli",gender:b.gender||null,dob:b.dob,birth_time:b.time,place:b.place,latitude:Number(b.latitude),longitude:Number(b.longitude),timezone:Number(b.timezone||5.5),ayanamsa:"Lahiri",calculation_data:r})});
  }
  json(res,200,r);
 }catch(e){json(res,500,{error:e.message})}
};
