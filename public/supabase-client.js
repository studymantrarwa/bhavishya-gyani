window.SM_SUPABASE={
  client:null,_boot:null,
  _saveToken(t){try{if(t){localStorage.setItem('bhavishyaGyaniToken',t);localStorage.setItem('studyMantraToken',t)}else{localStorage.removeItem('bhavishyaGyaniToken');localStorage.removeItem('studyMantraToken')}}catch(e){}},
  async init(){
    if(this.client)return this.client;
    if(this._boot)return this._boot;
    this._boot=(async()=>{
      const cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());
      if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase)return null;
      this.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
      this.client.auth.onAuthStateChange((event,session)=>this._saveToken(session?.access_token||null));
      try{const {data}=await this.client.auth.getSession();this._saveToken(data?.session?.access_token||null)}catch(e){}
      return this.client;
    })();
    try{return await this._boot}finally{this._boot=null}
  },
  async getSession(){const s=await this.init();if(!s)return null;const {data,error}=await s.auth.getSession();if(error)throw error;this._saveToken(data?.session?.access_token||null);return data?.session||null},
  async getAccessToken(){const s=await this.getSession();return s?.access_token||localStorage.getItem('bhavishyaGyaniToken')||localStorage.getItem('studyMantraToken')||null},
  async signOut(){try{const s=await this.init();if(s)await s.auth.signOut()}catch(e){}this._saveToken(null)}
};
window.SM_SUPABASE.init().catch(()=>{});
