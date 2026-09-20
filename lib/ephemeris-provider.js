const {execFileSync} = require("child_process");
const path = require("path");
const fallback = require("./ephemeris-provider-fallback");

function calculateEphemeris(input){
  const cmd = process.env.STUDY_MANTRA_EPHEMERIS_CMD;
  if(!cmd) return Promise.resolve(fallback.calculateFallback(input));
  try{
    const [program,...args] = cmd.trim().split(/\s+/);
    const payload = JSON.stringify(input);
    const out = execFileSync(program,args,{
      input:payload+"\n",
      encoding:"utf8",
      timeout:15000,
      maxBuffer:1024*1024
    }).trim();
    const data = JSON.parse(out.split(/\r?\n/).filter(Boolean).pop());
    if(data.error) throw new Error(data.error);
    if(!data.planets || !data.houses || data.houses.ascendant==null) throw new Error("Invalid ephemeris bridge response");
    return Promise.resolve(data);
  }catch(err){
    const x=fallback.calculateFallback(input);
    x.fallback=true;
    x.providerError=err.message;
    return Promise.resolve(x);
  }
}
module.exports={calculateEphemeris};
