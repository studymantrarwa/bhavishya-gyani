async function post(url,body,token){
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)});
  const j=await r.json(); if(!r.ok) throw new Error(j.error||"Request failed"); return j;
}
const form=document.querySelector("#kundliForm");
if(form){
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const f=new FormData(form);
    const body=Object.fromEntries(f.entries());
    body.latitude=Number(body.latitude); body.longitude=Number(body.longitude); body.timezone=Number(body.timezone||5.5);
    const btn=form.querySelector("button[type=submit]");
    if(btn) btn.disabled=true;
    try{
      const token=localStorage.getItem("studyMantraToken");
      const r=await post("/api/kundli",body,token);
      localStorage.setItem("studyMantraLastKundli",JSON.stringify(r));
      location.href="/kundli.html";
    }catch(err){alert(err.message)}
    finally{if(btn) btn.disabled=false}
  });
}
