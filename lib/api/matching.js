const {match}=require("../matching");
module.exports=async(req,res)=>{
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  try{return res.status(200).json(await match(req.body?.a||{},req.body?.b||{}));}
  catch(e){return res.status(400).json({error:e.message||"Matching calculation failed"});}
};
