const {json}=require('./_lib');
module.exports=async(req,res)=>json(res,200,{ok:true,service:'Bhavishya Gyani',version:'25.0.0',node:true,vercel:!!process.env.VERCEL,pythonEphemerisUrl:process.env.EPHEMERIS_URL||null,supabaseConfigured:!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY),blobConfigured:!!process.env.BLOB_READ_WRITE_TOKEN});
