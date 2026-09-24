const {json}=require('./_lib');
const {calculateAdvanced}=require('../advanced-astrology');
module.exports=async(req,res)=>{if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});try{const b=req.body||{};for(const k of ['dob','time','latitude','longitude'])if(b[k]==null||b[k]==='')return json(res,400,{error:`${k} required`});const r=await calculateAdvanced(b,{date:b.targetDate,time:b.targetTime||'12:00'});return json(res,200,r)}catch(e){return json(res,500,{error:e.message})}};
