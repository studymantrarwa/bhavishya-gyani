const {json}=require('./_lib');
const {calculateEphemeris}=require('../ephemeris-provider');
const SIGNS=['Mesha (Aries)','Vrishabha (Taurus)','Mithuna (Gemini)','Karka (Cancer)','Simha (Leo)','Kanya (Virgo)','Tula (Libra)','Vrishchika (Scorpio)','Dhanu (Sagittarius)','Makara (Capricorn)','Kumbha (Aquarius)','Meena (Pisces)'];
const HN=['पहला','दूसरा','तीसरा','चौथा','पांचवां','छठा','सातवां','आठवां','नौवां','दसवां','ग्यारहवां','बारहवां'];
const signOf=x=>Math.floor(((Number(x)%360)+360)%360/30)+1;
const rel=(from,to)=>((to-from+12)%12)+1;
const signName=s=>SIGNS[s-1];
function makeText(sign,positions){
 const h=p=>rel(sign,signOf(positions[p].longitude));
 const out=[];
 if([1,5,9].includes(h('Jupiter')))out.push('गुरु का गोचर ज्ञान, मार्गदर्शन, अध्ययन और विस्तार से जुड़े विषयों को सक्रिय कर सकता है।');
 if([2,5,7,9,11].includes(h('Jupiter')))out.push('शिक्षा, सलाह, नेटवर्क या संसाधनों से जुड़े अवसरों पर ध्यान देना उपयोगी रहेगा।');
 if([1,4,7,10].includes(h('Saturn')))out.push('शनि का प्रभाव जिम्मेदारी, अनुशासन और धीमी लेकिन टिकाऊ प्रगति पर जोर देता है।');
 if([6,8,12].includes(h('Saturn')))out.push('काम और जिम्मेदारियों में धैर्य रखें; लंबित कार्यों को क्रम से पूरा करना बेहतर रहेगा।');
 if([3,6,10,11].includes(h('Mars')))out.push('मंगल सक्रियता बढ़ा सकता है; जल्दबाजी के बजाय स्पष्ट लक्ष्य और नियंत्रित ऊर्जा रखें।');
 if([2,5,7,11].includes(h('Venus')))out.push('शुक्र संबंधों, रचनात्मक कार्य और सुविधा से जुड़े मामलों में संवाद व संतुलन को समर्थन देता है।');
 if([1,5,9].includes(h('Mercury')))out.push('बातचीत, लेखन, सीखने और योजना बनाने के लिए दिन उपयोगी हो सकता है।');
 if([3,6,10,11].includes(h('Moon')))out.push('चंद्रमा का आज का गोचर कार्यों में गति और मानसिक सक्रियता बढ़ा सकता है।');
 if(!out.length)out.push('आज के गोचर मिश्रित संकेत देते हैं; प्राथमिकता वाले काम चुनकर क्रमबद्ध तरीके से आगे बढ़ें।');
 return out.slice(0,4);
}
module.exports=async(req,res)=>{try{const sign=Math.max(1,Math.min(12,Number(req.query?.sign||1)));const date=String(req.query?.date||new Date().toISOString().slice(0,10));const input={dob:date,time:String(req.query?.time||'12:00'),latitude:0,longitude:0,timezone:0};const e=await calculateEphemeris(input);const positions=e.planets;const h={};for(const p of Object.keys(positions))h[p]=rel(sign,signOf(positions[p].longitude));const text=makeText(sign,positions);return json(res,200,{date,sign,signName:signName(sign),text:text.join(' '),points:text,career:h.Saturn===10||h.Jupiter===10?'करियर/कार्य क्षेत्र पर योजनाबद्ध प्रगति और जिम्मेदारी पर ध्यान दें।':'काम में प्राथमिकता और स्पष्ट समय-सारिणी रखें।',finance:[2,8,11].includes(h.Jupiter)||h.Venus===11?'आय-व्यय को लिखकर देखें और बड़े खर्च से पहले दोबारा जाँच करें।':'खर्चों की समीक्षा और बजट अनुशासन बनाए रखें।',relationships:[5,7,11].includes(h.Venus)?'संबंधों में स्पष्ट बातचीत और समय देना सहायक हो सकता है।':'अपेक्षाओं को स्पष्ट रखें और अनावश्यक बहस से बचें।',health:'नियमित नींद, भोजन, पानी और हल्की गतिविधि को प्राथमिकता दें।',transits:Object.fromEntries(Object.entries(positions).map(([p,x])=>[p,{sign:signOf(x.longitude),signName:signName(signOf(x.longitude)),longitude:+Number(x.longitude).toFixed(4),retrograde:Number(x.speed||0)<0}])),provider:e.provider,note:'यह गतिशील वैदिक-सिडीरियल गोचर आधारित पारंपरिक राशिफल है; इसे निश्चित वैज्ञानिक भविष्यवाणी न मानें।'});}catch(e){return json(res,500,{error:e.message})}};
