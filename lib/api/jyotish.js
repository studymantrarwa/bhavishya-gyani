const {req:sbreq,json}=require('./_lib');
async function ensureBucket(){
  const name='jyotish-learning';
  try{await sbreq('/storage/v1/bucket',{method:'POST',body:JSON.stringify({id:name,name,public:true,file_size_limit:52428800,allowed_mime_types:['application/pdf']})});}
  catch(e){ if(!String(e.message||'').toLowerCase().includes('already')) throw e; }
  return name;
}
module.exports=async(req,res)=>{try{
  if(req.method==='GET'){
    res.setHeader('Cache-Control','no-store, max-age=0');
    const rows=await sbreq('/rest/v1/platform_settings?key=eq.jyotish_courses&select=value&limit=1');
    let courses=[]; try{courses=rows[0]?.value||[]}catch{}
    if(!Array.isArray(courses))courses=[];
    courses.sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0));
    return json(res,200,{courses});
  }
  return json(res,405,{error:'Method not allowed'});
}catch(e){return json(res,500,{error:e.message||'Jyotish content failed'})}};
