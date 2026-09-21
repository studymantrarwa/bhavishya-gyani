const {cfg,json}=require("./_lib");
module.exports=(req,res)=>json(res,200,{supabaseUrl:process.env.SUPABASE_URL||"",supabaseAnonKey:process.env.SUPABASE_ANON_KEY||"",supabaseEnabled:!!(process.env.SUPABASE_URL&&process.env.SUPABASE_ANON_KEY)});
