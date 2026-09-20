window.SM_SUPABASE = {
  client: null,
  _boot: null,
  async init(){
    if(this.client) return this.client;
    if(this._boot) return this._boot;
    this._boot = (async()=>{
      const cfg = await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());
      if(!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
      if(!window.supabase) return null;
      this.client = window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}
      });
      this.client.auth.onAuthStateChange((event,session)=>{
        try{
          if(session?.access_token) localStorage.setItem('studyMantraToken',session.access_token);
          else if(event==='SIGNED_OUT') localStorage.removeItem('studyMantraToken');
        }catch(e){}
      });
      try{
        const {data}=await this.client.auth.getSession();
        if(data?.session?.access_token) localStorage.setItem('studyMantraToken',data.session.access_token);
      }catch(e){}
      return this.client;
    })();
    try{return await this._boot}finally{this._boot=null}
  },
  async getSession(){
    const s=await this.init();
    if(!s) return null;
    const {data,error}=await s.auth.getSession();
    if(error) throw error;
    if(data?.session?.access_token) localStorage.setItem('studyMantraToken',data.session.access_token);
    return data?.session||null;
  },
  async getAccessToken(){
    const session=await this.getSession();
    return session?.access_token || null;
  },
  async signOut(){
    try{const s=await this.init(); if(s) await s.auth.signOut()}catch(e){}
    try{localStorage.removeItem('studyMantraToken')}catch(e){}
  }
};
// Start session restoration immediately so pages never use an expired access token on first load.
window.SM_SUPABASE.init().catch(()=>{});
