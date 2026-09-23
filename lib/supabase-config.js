function getSupabaseConfig(){
  return {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  };
}
function assertSupabase(){
  const c=getSupabaseConfig();
  if(!c.url || !c.serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server persistence.");
  return c;
}
module.exports={getSupabaseConfig,assertSupabase};
