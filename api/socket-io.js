const http = require('http');
const { Server } = require('socket.io');
let createAdapter = null, createClient = null;
try {
  ({ createAdapter } = require('@socket.io/redis-adapter'));
  ({ createClient } = require('redis'));
} catch (_) {}
const { cfg, req: sbreq, ensureProfile } = require('../lib/api/_lib');

const server = http.createServer();
const io = new Server(server, {
  path: '/api/socket-io/socket.io',
  transports: ['websocket','polling'],
  cors: { origin: true, credentials: true },
  maxHttpBufferSize: 1e6,
  pingInterval: 25000,
  pingTimeout: 20000
});

const esc = v => encodeURIComponent(String(v));
const room = id => `conversation:${id}`;
const userRoom = id => `user:${id}`;
const onlineUsers = new Map();

async function setupRedis(){
  if(!process.env.REDIS_URL || !createAdapter || !createClient) return;
  try{
    const pub=createClient({url:process.env.REDIS_URL});
    const sub=pub.duplicate();
    await Promise.all([pub.connect(),sub.connect()]);
    io.adapter(createAdapter(pub,sub));
  }catch(e){ console.warn('Socket.IO Redis adapter unavailable:',e.message); }
}
setupRedis();

async function authToken(token){
  if(!token) return null;
  const c=cfg();
  if(!c.url||!c.anon) return null;
  try{
    const r=await fetch(c.url+'/auth/v1/user',{headers:{apikey:c.anon,Authorization:'Bearer '+token}});
    return r.ok ? await r.json() : null;
  }catch(_){ return null; }
}
async function getConv(id){
  const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}&select=*`);
  return rows[0]||null;
}
function canAccess(socket,c){
  if(!c) return false;
  const uid=socket.user.id;
  return c.user_id===uid || c.astrologer_id===uid || c.admin_id===uid || socket.profile?.role==='admin';
}
async function guard(socket,id,active=false){
  const c=await getConv(id);
  if(!canAccess(socket,c)) throw new Error('Forbidden');
  if(active && c.status!=='accepted') throw new Error('Chat is not active');
  return c;
}
function addOnline(uid,sid){let s=onlineUsers.get(uid);if(!s)onlineUsers.set(uid,s=new Set());s.add(sid)}
function removeOnline(uid,sid){const s=onlineUsers.get(uid);if(!s)return;s.delete(sid);if(!s.size)onlineUsers.delete(uid)}
function isOnline(uid){return (onlineUsers.get(uid)?.size||0)>0}

io.use(async(socket,next)=>{
  try{
    const token=socket.handshake.auth?.token||'';
    const user=await authToken(token);
    if(!user?.id) return next(new Error('AUTH_REQUIRED'));
    const p=await ensureProfile(user);
    if(p?.blocked) return next(new Error('ACCOUNT_BLOCKED'));
    socket.user=user;
    socket.profile=p||{role:'user'};
    next();
  }catch(e){next(new Error('AUTH_FAILED'))}
});

io.on('connection',socket=>{
  const uid=socket.user.id;
  addOnline(uid,socket.id);
  socket.join(userRoom(uid));
  socket.emit('socket:ready',{user_id:uid,role:socket.profile?.role||'user'});

  socket.on('join_conversation',async(data={},ack)=>{
    try{
      const id=String(data.conversationId||'').trim();
      if(!id)throw new Error('conversationId required');
      const c=await guard(socket,id,false);
      socket.join(room(id));
      socket.data.rooms=socket.data.rooms||new Set(); socket.data.rooms.add(id);
      const other=c.user_id===uid?(c.astrologer_id||c.admin_id):c.user_id;
      socket.to(room(id)).emit('presence',{user_id:uid,online:true});
      socket.emit('presence',{user_id:other,online:other?isOnline(other):false});
      if(typeof ack==='function')ack({ok:true,conversation_id:id,status:c.status});
    }catch(e){if(typeof ack==='function')ack({ok:false,error:e.message})}
  });

  socket.on('send_message',async(data={},ack)=>{
    try{
      const id=String(data.conversationId||'').trim();
      const body=String(data.body||'').trim().slice(0,4000);
      if(!id||!body)throw new Error('conversationId and message required');
      const c=await guard(socket,id,true);
      const rows=await sbreq('/rest/v1/messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({conversation_id:id,sender_id:uid,body,kundali_id:data.kundaliId||null})});
      const message=rows[0];
      await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({last_message_at:new Date().toISOString()})});
      io.to(room(id)).emit('message:new',{message});
      const recipients=[c.user_id,c.astrologer_id,c.admin_id].filter(Boolean);
      for(const rid of recipients)io.to(userRoom(rid)).emit('conversation:changed',{conversation_id:id,type:'message',message});
      if(typeof ack==='function')ack({ok:true,message});
    }catch(e){if(typeof ack==='function')ack({ok:false,error:e.message})}
  });

  socket.on('typing',async(data={})=>{
    try{
      const id=String(data.conversationId||'').trim();
      if(!id)return;
      await guard(socket,id,true);
      socket.to(room(id)).emit('typing',{user_id:uid,typing:!!data.typing});
    }catch(_){}
  });

  socket.on('read_messages',async(data={},ack)=>{
    try{
      const id=String(data.conversationId||'').trim();
      const c=await guard(socket,id,true);
      const at=new Date().toISOString();
      await sbreq(`/rest/v1/messages?conversation_id=eq.${esc(id)}&sender_id=neq.${esc(uid)}&read_at=is.null`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({read_at:at})});
      io.to(room(id)).emit('message:read',{conversation_id:id,reader_id:uid,read_at:at});
      if(typeof ack==='function')ack({ok:true});
    }catch(e){if(typeof ack==='function')ack({ok:false,error:e.message})}
  });

  socket.on('close_chat',async(data={},ack)=>{
    try{
      const id=String(data.conversationId||'').trim();
      const c=await guard(socket,id,false);
      const at=new Date().toISOString();
      const rows=await sbreq(`/rest/v1/conversations?id=eq.${esc(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status:'closed',closed_at:at})});
      io.to(room(id)).emit('conversation:closed',{conversation:rows[0]||{...c,status:'closed'}});
      if(typeof ack==='function')ack({ok:true});
    }catch(e){if(typeof ack==='function')ack({ok:false,error:e.message})}
  });

  socket.on('disconnect',()=>{
    removeOnline(uid,socket.id);
    const rooms=socket.data.rooms||new Set();
    for(const id of rooms)socket.to(room(id)).emit('presence',{user_id:uid,online:isOnline(uid)});
  });
});

module.exports=server;
