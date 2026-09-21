const {calculateEphemeris}=require('./ephemeris-provider');
const {SIGNS}=require('./astrology-engine');
const norm=x=>((Number(x)%360)+360)%360;
const sign=lon=>Math.floor(norm(lon)/30)+1;
const distance=(from,to)=>((to-from+12)%12)+1;
const REF=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn','Lagna'];
const P=['Sun','Moon','Mars','Mercury','Jupiter','Venus','Saturn'];
const TABLES={
Sun:{Sun:[1,2,4,7,8,9,10,11],Moon:[3,6,10,11],Mars:[1,2,4,7,8,9,10,11],Mercury:[3,5,6,9,10,11,12],Jupiter:[5,6,9,11],Venus:[6,7,12],Saturn:[1,2,4,7,8,9,10,11],Lagna:[3,4,6,10,11,12]},
Moon:{Sun:[3,6,7,8,10,11],Moon:[1,3,6,7,10,11],Mars:[2,3,5,6,9,10,11],Mercury:[1,3,4,5,7,8,10,11],Jupiter:[1,4,7,8,10,11,12],Venus:[3,4,5,7,9,10,11],Saturn:[3,5,6,11],Lagna:[3,6,10,11]},
Mars:{Sun:[3,5,6,10,11],Moon:[3,6,11],Mars:[1,2,4,7,8,10,11],Mercury:[3,5,6,11],Jupiter:[6,10,11,12],Venus:[6,8,11,12],Saturn:[1,4,7,8,9,10,11],Lagna:[1,3,6,10,11]},
Mercury:{Sun:[5,6,9,11,12],Moon:[2,4,6,8,10,11],Mars:[1,2,4,7,8,9,10,11],Mercury:[1,3,5,6,9,10,11,12],Jupiter:[6,8,11,12],Venus:[1,2,3,4,5,8,9,11],Saturn:[1,2,4,7,8,9,10,11],Lagna:[1,2,4,6,8,10,11]},
Jupiter:{Sun:[1,2,3,4,7,8,9,10,11],Moon:[2,5,7,9,11],Mars:[1,2,4,7,8,10,11],Mercury:[1,2,4,5,6,9,10,11],Jupiter:[1,2,3,4,7,8,10,11],Venus:[2,5,6,9,10,11],Saturn:[3,5,6,12],Lagna:[1,2,4,5,6,7,9,10,11]},
Venus:{Sun:[8,11,12],Moon:[1,2,3,4,5,8,9,11,12],Mars:[3,4,6,8,9,11,12],Mercury:[3,5,6,9,11],Jupiter:[5,8,9,10,11],Venus:[1,2,3,4,5,8,9,10,11],Saturn:[3,4,5,8,9,10,11],Lagna:[1,2,3,4,5,8,9]},
Saturn:{Sun:[1,2,4,7,8,10,11],Moon:[3,6,11],Mars:[3,5,6,10,11,12],Mercury:[6,8,9,10,11,12],Jupiter:[5,6,11,12],Venus:[6,11,12],Saturn:[3,5,6,11],Lagna:[1,3,4,6,10,11]}
};
function refsFromNatal(natal){const r={};for(const p of P)r[p]=sign(natal.planets[p].longitude);r.Lagna=sign(natal.lagna.longitude??natal.lagna);return r;}
function ashtakavarga(natal){
 const refs=refsFromNatal(natal), bav={};
 for(const target of P){const arr=Array(12).fill(0),detail={};for(const ref of REF){const sourceSign=refs[ref];const allowed=TABLES[target][ref];detail[ref]=Array(12).fill(0);for(let s=1;s<=12;s++){const h=distance(sourceSign,s);if(allowed.includes(h)){arr[s-1]++;detail[ref][s-1]=1;}}}bav[target]={signs:arr,total:arr.reduce((a,b)=>a+b,0),contributors:detail};}
 const sav=Array(12).fill(0);for(const p of P)bav[p].signs.forEach((v,i)=>sav[i]+=v);
 return {bhinna:bav,sarva:sav,total:sav.reduce((a,b)=>a+b,0),norms:{Sun:48,Moon:49,Mars:39,Mercury:54,Jupiter:56,Venus:52,Saturn:39},note:'Parashari Ashtakavarga baseline tables. Rahu/Ketu are excluded from BAV/SAV.'};
}
function sadeSati(natalMoonSign, saturnSign){const start=((natalMoonSign+10)%12)+1, end=((natalMoonSign)%12)+1;let phase=null;if(saturnSign===start)phase='First phase';else if(saturnSign===natalMoonSign)phase='Second phase';else if(saturnSign===end)phase='Third phase';const dhaiya4=((natalMoonSign+2)%12)+1,dhaiya8=((natalMoonSign+6)%12)+1;return {active:!!phase,phase,natalMoonSign,saturnSign,phaseSigns:{first:start,second:natalMoonSign,third:end},dhaiya:{from4th:saturnSign===dhaiya4,from8th:saturnSign===dhaiya8}};}
function transitSummary(planets,natal){const out={};for(const p of Object.keys(planets)){const s=sign(planets[p].longitude);out[p]={longitude:+norm(planets[p].longitude).toFixed(6),sign:s,signName:SIGNS[s-1],retrograde:Number(planets[p].speed||0)<0,fromLagnaHouse:distance(sign(natal.lagna.longitude),s),fromMoonHouse:distance(sign(natal.planets.Moon.longitude),s)};}const moonNatal=sign(natal.planets.Moon.longitude),sat=out.Saturn.sign;out.sadeSati=sadeSati(moonNatal,sat);return out;}
async function calculateAdvanced(input,target={}){
 const natal=await calculateEphemeris(input);const date=String(target.date||new Date().toISOString().slice(0,10));const time=String(target.time||'12:00');
 const transit=await calculateEphemeris({...input,dob:date,time});
 const natalWrap={lagna:{longitude:natal.houses.ascendant},planets:natal.planets};
 const av=ashtakavarga(natalWrap);const tr=transitSummary(transit.planets,natalWrap);
 const moonSign=sign(natal.planets.Moon.longitude);const satSign=sign(transit.planets.Saturn.longitude);
 return {date,time,transits:tr,sadeSati:sadeSati(moonSign,satSign),ashtakavarga:av,provider:natal.provider||'local-swiss-ephemeris'};
}
module.exports={calculateAdvanced,ashtakavarga,sadeSati,sign,norm,P,SIGNS};
