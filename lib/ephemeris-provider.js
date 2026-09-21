const {execFileSync}=require("child_process");
const path=require("path");
const fallback=require("./ephemeris-provider-fallback");

function localBridge(input){
  const bridge=path.join(__dirname,"..","public","ephemeris_bridge.py");
  const py=process.env.PYTHON_BIN||"python3";
  const out=execFileSync(py,[bridge],{input:JSON.stringify(input)+"\n",encoding:"utf8",timeout:20000,maxBuffer:4*1024*1024}).trim();
  const data=JSON.parse(out.split(/\r?\n/).filter(Boolean).pop());
  if(data.error)throw new Error(data.error);
  if(!data.planets||!data.houses||data.houses.ascendant==null)throw new Error("Invalid Swiss Ephemeris response");
  data.provider="swiss-ephemeris";data.fallback=false;return data;
}
async function remoteBridge(input){
  const base=process.env.EPHEMERIS_URL||(process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}/api/ephemeris`:"");
  if(!base)throw new Error("EPHEMERIS_URL/VERCEL_URL is not configured");
  const secret=process.env.EPHEMERIS_SECRET||"";
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),25000);
  try{
    const r=await fetch(base,{method:"POST",headers:{"Content-Type":"application/json","x-ephemeris-secret":secret},body:JSON.stringify(input),signal:ctrl.signal});
    const text=await r.text();let data;try{data=JSON.parse(text)}catch{throw new Error(`Ephemeris service returned invalid JSON (${r.status})`)}
    if(!r.ok||data.error)throw new Error(data.error||`Ephemeris service HTTP ${r.status}`);
    if(!data.planets||!data.houses||data.houses.ascendant==null)throw new Error("Invalid Swiss Ephemeris service response");
    data.provider="swiss-ephemeris";data.fallback=false;return data;
  }finally{clearTimeout(timer)}
}
async function calculateEphemeris(input){
  const isVercel=!!process.env.VERCEL;
  try{return isVercel?await remoteBridge(input):localBridge(input)}
  catch(err){
    if(isVercel){const e=new Error(`Swiss Ephemeris unavailable in production: ${err.message}`);e.code='EPHEMERIS_REQUIRED';throw e;}
    const x=fallback.calculateFallback(input);x.fallback=true;x.providerError=err.message;return x;
  }
}
module.exports={calculateEphemeris};
