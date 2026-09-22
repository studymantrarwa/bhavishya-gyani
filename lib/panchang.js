function panchang(date,location){return {
  date,location,tithi:{status:"Provider required"},vara:new Date(date).toLocaleDateString("en-IN",{weekday:"long"}),
  nakshatra:{status:"Provider required"},yoga:{status:"Provider required"},karana:{status:"Provider required"},
  sunrise:{status:"Provider required"},sunset:{status:"Provider required"},
  rahukaal:{status:"Provider required"},gulika:{status:"Provider required"},yamaganda:{status:"Provider required"},
  choghadiya:{status:"Provider required"},hora:{status:"Provider required"}
};}
function muhurat(type,date,location){return {type,date,location,status:"Needs validated Panchang/solar-time provider",times:[]};}
module.exports={panchang,muhurat};
