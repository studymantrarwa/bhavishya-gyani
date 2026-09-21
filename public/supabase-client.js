/* Bhavishya Gyani account/session client.
   Supabase is used for database/storage infrastructure; login itself is role-separated
   so the same email can exist once as User, once as Astrologer and once as Admin. */
window.SM_SUPABASE={
  client:null,_boot:null,
  roleForPage(){const p=location.pathname; if(p.includes('admin-')||p.includes('admin-panel'))return 'admin'; if(p.includes('astrologer-'))return 'astrologer'; return localStorage.getItem('bg_active_role')||'user'},
  _saveToken(t,role){try{role=role||this.roleForPage();if(t){localStorage.setItem('bg_'+role+'_token',t);localStorage.setItem('bg_active_role',role)}else localStorage.removeItem('bg_'+role+'_token')}catch(e){}},
  _clearAll(){try{['user','astrologer','admin'].forEach(r=>localStorage.removeItem('bg_'+r+'_token'));localStorage.removeItem('bg_active_role');localStorage.removeItem('bhavishyaGyaniToken');localStorage.removeItem('studyMantraToken')}catch(e){}},
  async init(){
    if(this.client)return this.client;if(this._boot)return this._boot;
    this._boot=(async()=>{try{const cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase)return null;this.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});return this.client}catch{return null}})();
    try{return await this._boot}finally{this._boot=null}
  },
  async getSession(){const t=await this.getAccessToken();return t?{access_token:t}:null},
  async getAccessToken(){try{const active=localStorage.getItem('bg_active_role')||this.roleForPage();return localStorage.getItem('bg_'+active+'_token')||null}catch{return null}},
  async signOut(role){try{role=role||this.roleForPage();localStorage.removeItem('bg_'+role+'_token');if(localStorage.getItem('bg_active_role')===role)localStorage.removeItem('bg_active_role');localStorage.removeItem('bhavishyaGyaniToken');localStorage.removeItem('studyMantraToken')}catch(e){}}
};
window.SM_SUPABASE.init().catch(()=>{});
