const http=require("http"),fs=require("fs"),path=require("path");
const {calculateKundli}=require("./lib/astrology-engine"); const {match}=require("./lib/matching"); const {buildReport}=require("./lib/report");
const DB=path.join(__dirname,"data/db.json"); const db=()=>JSON.parse(fs.readFileSync(DB,"utf8")); const save=x=>fs.writeFileSync(DB,JSON.stringify(x,null,2));
const places=[["Lucknow","Uttar Pradesh",26.8467,80.9462],["Kanpur","Uttar Pradesh",26.4499,80.3319],["Prayagraj","Uttar Pradesh",25.4358,81.8463],["Varanasi","Uttar Pradesh",25.3176,82.9739],["Delhi","Delhi",28.6139,77.209],["Mumbai","Maharashtra",19.076,72.8777],["Kolkata","West Bengal",22.5726,88.3639],["Jaipur","Rajasthan",26.9124,75.7873],["Patna","Bihar",25.5941,85.1376],["Agra","Uttar Pradesh",27.1767,78.0081],["Noida","Uttar Pradesh",28.5355,77.391]];
const mime={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".json":"application/json",".webmanifest":"application/manifest+json"};
function send(res,s,o){res.writeHead(s,{"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*"});res.end(JSON.stringify(o))}
function body(req){return new Promise((ok,bad)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{ok(s?JSON.parse(s):{})}catch(e){bad(e)}})})}
function auth(req){const h=req.headers.authorization||"";try{const x=JSON.parse(Buffer.from(h.replace("Bearer ",""),"base64url"));return db().users.find(u=>u.id===x.id)||null}catch{return null}}
function token(u){return Buffer.from(JSON.stringify({id:u.id,exp:Date.now()+86400000})).toString("base64url")}
async function api(req,res,u){
 const D=db();
 if(req.method==="POST"&&u.pathname==="/api/register"){const b=await body(req);if(D.users.some(x=>x.email===b.email))return send(res,409,{error:"Email exists"});const x={id:"u"+Date.now(),name:b.name,email:b.email,password:b.password,role:b.role==="astrologer"?"astrologer":"user",verified:false,fee:0,discount:0,online:false};D.users.push(x);save(D);return send(res,201,{token:token(x),user:{...x,password:undefined}})}
 if(req.method==="POST"&&u.pathname==="/api/login"){const b=await body(req),x=D.users.find(v=>v.email===b.email&&v.password===b.password);if(!x)return send(res,401,{error:"Invalid login"});return send(res,200,{token:token(x),user:{...x,password:undefined}})}
 if(u.pathname==="/api/me"){const x=auth(req);return x?send(res,200,{user:{...x,password:undefined}}):send(res,401,{error:"Login required"})}
 if(u.pathname==="/api/places"){const q=(u.searchParams.get("q")||"").toLowerCase();return send(res,200,{places:places.filter(x=>x[0].toLowerCase().includes(q)).map(x=>({name:x[0],state:x[1],latitude:x[2],longitude:x[3],tzOffset:5.5}))})}
 if(req.method==="POST"&&u.pathname==="/api/kundli"){const b=await body(req),r=await calculateKundli(b);const x=auth(req);if(x){D.kundalis.push({id:"k"+Date.now(),userId:x.id,input:b,calculation:r,createdAt:new Date().toISOString()});save(D)}return send(res,200,r)}
 if(u.pathname==="/api/my-kundlis"){const x=auth(req);if(!x)return send(res,401,{error:"Login required"});return send(res,200,{kundlis:D.kundalis.filter(k=>k.userId===x.id)})}
 if(u.pathname==="/api/astrologers")return send(res,200,{astrologers:D.users.filter(x=>x.role==="astrologer"&&x.verified).map(x=>({id:x.id,name:x.name,fee:x.fee,discount:x.discount,online:x.online}))});
 if(req.method==="POST"&&u.pathname==="/api/matching"){const b=await body(req);return send(res,200,match(b.a,b.b))}
 if(req.method==="POST"&&u.pathname==="/api/report"){const b=await body(req);return send(res,200,buildReport(b.kundli))}
 if(req.method==="POST"&&u.pathname==="/api/admin/astrologer"){const a=auth(req);if(!a||a.role!=="admin")return send(res,403,{error:"Admin only"});const b=await body(req),x=D.users.find(v=>v.id===b.id);if(!x)return send(res,404,{error:"Not found"});if("verified"in b)x.verified=!!b.verified;if("fee"in b)x.fee=Number(b.fee);if("discount"in b)x.discount=Number(b.discount);save(D);return send(res,200,{ok:true})}
 if(u.pathname==="/api/profile"){const x=auth(req);if(!x)return send(res,401,{error:"Login required"});return send(res,200,{profile:{id:x.id,name:x.name,email:x.email,role:x.role,verified:x.verified,fee:x.fee,discount:x.discount,online:x.online}})}
 if(req.method==="POST"&&u.pathname==="/api/astrologer/status"){const x=auth(req);if(!x||x.role!=="astrologer")return send(res,403,{error:"Astrologer only"});const b=await body(req);x.online=!!b.online;save(D);return send(res,200,{ok:true,online:x.online})}
 if(req.method==="POST"&&u.pathname==="/api/astrologer/settings"){const x=auth(req);if(!x||x.role!=="astrologer")return send(res,403,{error:"Astrologer only"});const b=await body(req);if(b.fee!=null)x.fee=Number(b.fee);if(b.discount!=null)x.discount=Number(b.discount);save(D);return send(res,200,{ok:true,fee:x.fee,discount:x.discount})}
 if(req.method==="POST"&&u.pathname==="/api/chat/request"){const x=auth(req);if(!x)return send(res,401,{error:"Login required"});const b=await body(req);D.chatRequests.push({id:"cr"+Date.now(),userId:x.id,astrologerId:b.astrologerId,status:"pending",createdAt:new Date().toISOString()});save(D);return send(res,201,{ok:true})}
 return send(res,404,{error:"Not found"});
}
async function main(req,res){if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization"});return res.end()}const u=new URL(req.url,"http://localhost");if(u.pathname.startsWith("/api/"))return api(req,res,u);let p=u.pathname==="/" ? "/index.html":u.pathname;const f=path.join(__dirname,"public",path.normalize(p));fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end("Not found")}res.writeHead(200,{"Content-Type":mime[path.extname(f)]||"text/plain"});res.end(d)})}
http.createServer(main).listen(process.env.PORT||3000,()=>console.log("Bhavishya Gyani Astrology V3: http://localhost:"+(process.env.PORT||3000)));

