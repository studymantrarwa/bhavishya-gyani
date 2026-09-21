window.SM_SUPABASE = {
  client: null,
  _boot: null,

  async init(){
    if(this.client) return this.client;
    if(this._boot) return this._boot;

    this._boot = (async()=>{
      const response = await fetch('/api/config?v=20260921', {cache:'no-store'});
      const cfg = await response.json();

      if(!cfg.supabaseUrl || !cfg.supabaseAnonKey){
        throw new Error('Supabase configure नहीं है।');
      }
      if(!window.supabase){
        throw new Error('Supabase library load नहीं हुई।');
      }

      this.client = window.supabase.createClient(
        cfg.supabaseUrl,
        cfg.supabaseAnonKey,
        {
          auth:{
            persistSession:true,
            autoRefreshToken:true,
            detectSessionInUrl:true,
            flowType:'pkce'
          }
        }
      );

      this.client.auth.onAuthStateChange((event, session)=>{
        try{
          if(session?.access_token){
            localStorage.setItem('bhavishyaGyaniToken', session.access_token);
            localStorage.setItem('studyMantraToken', session.access_token);
          }else if(event === 'SIGNED_OUT'){
            localStorage.removeItem('bhavishyaGyaniToken');
            localStorage.removeItem('studyMantraToken');
          }
        }catch(e){}
      });

      try{
        const {data} = await this.client.auth.getSession();
        const accessToken = data?.session?.access_token;
        if(accessToken){
          localStorage.setItem('bhavishyaGyaniToken', accessToken);
          localStorage.setItem('studyMantraToken', accessToken);
        }
      }catch(e){}

      return this.client;
    })();

    try{
      return await this._boot;
    }finally{
      this._boot = null;
    }
  },

  async getSession(){
    const s = await this.init();
    const {data,error} = await s.auth.getSession();
    if(error) throw error;

    const accessToken = data?.session?.access_token;
    if(accessToken){
      localStorage.setItem('bhavishyaGyaniToken', accessToken);
      localStorage.setItem('studyMantraToken', accessToken);
    }

    return data?.session || null;
  },

  async getAccessToken(){
    const session = await this.getSession();
    return session?.access_token || null;
  },

  async getUser(){
    const s = await this.init();
    const {data,error} = await s.auth.getUser();
    if(error) throw error;
    return data?.user || null;
  },

  async signOut(){
    try{
      const s = await this.init();
      if(s) await s.auth.signOut({scope:'local'});
    }catch(e){}
    try{
      localStorage.removeItem('bhavishyaGyaniToken');
      localStorage.removeItem('studyMantraToken');
    }catch(e){}
  }
};

window.SM_SUPABASE.init().catch(()=>{});
