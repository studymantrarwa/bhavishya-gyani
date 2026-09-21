/* Bhavishya Gyani V20 auth bridge. Account systems are separated on the server.
   Supabase remains the data store; browser authentication uses the V20 signed token. */
window.SM_SUPABASE={
  _saveToken(t){try{if(t){localStorage.setItem('bhavishyaGyaniToken',t);localStorage.setItem('studyMantraToken',t)}else{localStorage.removeItem('bhavishyaGyaniToken');localStorage.removeItem('studyMantraToken')}}catch(e){}},
  async init(){return this},
  async getAccessToken(){try{return localStorage.getItem('bhavishyaGyaniToken')||localStorage.getItem('studyMantraToken')||null}catch(e){return null}},
  async getSession(){const t=await this.getAccessToken();return t?{access_token:t}:null},
  async signOut(){this._saveToken(null)},
  auth:{
    async signOut(){window.SM_SUPABASE._saveToken(null)},
    async getSession(){return {data:{session:await window.SM_SUPABASE.getSession()},error:null}},
    async getUser(){const t=await window.SM_SUPABASE.getAccessToken();if(!t)return {data:{user:null},error:null};const r=await fetch('/api/me',{headers:{Authorization:'Bearer '+t}});const j=await r.json().catch(()=>({}));return {data:{user:r.ok?j.user:null},error:r.ok?null:new Error(j.error||'Login required')}}
  }
};
