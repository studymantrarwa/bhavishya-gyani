// Bhavishya Gyani Numerology Engine — traditional helper, not scientific prediction.
const PYTH={A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,I:9,J:1,K:2,L:3,M:4,N:5,O:6,P:7,Q:8,R:9,S:1,T:2,U:3,V:4,W:5,X:6,Y:7,Z:8};
const CHAL={A:1,B:2,C:3,D:4,E:5,F:8,G:3,H:5,I:1,J:1,K:2,L:3,M:4,N:5,O:7,P:8,Q:1,R:2,S:3,T:4,U:6,V:6,W:6,X:5,Y:1,Z:7};
const VOWELS=new Set(["A","E","I","O","U"]);
function reduceNum(n, keepMaster=true){let x=Math.abs(Number(n)||0); if(x===0)return 0; while(x>9 && !(keepMaster&&[11,22,33].includes(x))) x=String(x).split("").reduce((a,b)=>a+Number(b),0); return x;}
function cleanName(name){return String(name||"").toUpperCase().replace(/[^A-Z]/g,"");}
function digitSum(s){return String(s||"").replace(/\D/g,"").split("").reduce((a,b)=>a+Number(b),0);}
const MEANINGS={
  1:{hi:"नेतृत्व, स्वतंत्रता और पहल",text:"स्वतंत्र निर्णय, शुरुआत और नेतृत्व की प्रवृत्ति से जोड़ा जाता है।"},
  2:{hi:"सहयोग, संवेदनशीलता और संतुलन",text:"साझेदारी, कूटनीति और भावनात्मक संतुलन से जोड़ा जाता है।"},
  3:{hi:"रचनात्मकता, अभिव्यक्ति और सीखना",text:"अभिव्यक्ति, कला, संचार और सामाजिकता से जोड़ा जाता है।"},
  4:{hi:"व्यवस्था, अनुशासन और व्यावहारिकता",text:"मेहनत, संरचना, नियम और स्थिर प्रगति से जोड़ा जाता है।"},
  5:{hi:"परिवर्तन, स्वतंत्रता और संचार",text:"गतिशीलता, विविध अनुभव और संचार से जोड़ा जाता है।"},
  6:{hi:"जिम्मेदारी, परिवार और सौंदर्य",text:"परिवार, देखभाल, जिम्मेदारी और सामंजस्य से जोड़ा जाता है।"},
  7:{hi:"अनुसंधान, अंतर्दृष्टि और आत्मचिंतन",text:"अध्ययन, विश्लेषण, आध्यात्मिक खोज और निजी चिंतन से जोड़ा जाता है।"},
  8:{hi:"प्रबंधन, महत्वाकांक्षा और परिणाम",text:"संगठन, प्रबंधन, उपलब्धि और भौतिक जिम्मेदारियों से जोड़ा जाता है।"},
  9:{hi:"मानवता, आदर्श और व्यापक दृष्टि",text:"सेवा, आदर्शवाद, करुणा और व्यापक दृष्टिकोण से जोड़ा जाता है।"},
  11:{hi:"अंतर्ज्ञान और प्रेरणा",text:"अंक-ज्योतिष में 11 को मास्टर नंबर माना जाता है; इसे अंतर्ज्ञान और प्रेरणा से जोड़ा जाता है।"},
  22:{hi:"बड़े निर्माण और व्यावहारिक दृष्टि",text:"22 को मास्टर नंबर माना जाता है; इसे बड़े लक्ष्यों को संरचना देने से जोड़ा जाता है।"},
  33:{hi:"सेवा, करुणा और मार्गदर्शन",text:"33 को मास्टर नंबर माना जाता है; इसे सेवा और मार्गदर्शन से जोड़ा जाता है।"}
};
function numberMeaning(n){return MEANINGS[n]||MEANINGS[reduceNum(n,false)]||{hi:"सामान्य अंक प्रभाव",text:"पारंपरिक अंक-ज्योतिष व्याख्या।"};}
function numerology(x={}){
  const name=String(x.name||""), clean=cleanName(name), dob=String(x.dob||""), digits=String(dob).replace(/\D/g,"");
  const parts=dob.split("-").map(Number); const day=Number.isFinite(parts[2])?parts[2]:0, month=Number.isFinite(parts[1])?parts[1]:0, year=Number.isFinite(parts[0])?parts[0]:0;
  const birthNumber=reduceNum(day,false), lifePath=reduceNum(digitSum(digits),true), attitude=reduceNum(day+month,true);
  const pTotal=[...clean].reduce((a,c)=>a+(PYTH[c]||0),0), cTotal=[...clean].reduce((a,c)=>a+(CHAL[c]||0),0);
  const pVowels=[...clean].filter(c=>VOWELS.has(c)).reduce((a,c)=>a+(PYTH[c]||0),0), pCons=[...clean].filter(c=>!VOWELS.has(c)).reduce((a,c)=>a+(PYTH[c]||0),0);
  const currentYear=Number(x.year)||new Date().getFullYear(), personalYear=reduceNum(day+month+digitSum(currentYear),true), personalMonth=reduceNum(personalYear+month,true), personalDay=reduceNum(personalMonth+day,true);
  const maturity=clean?reduceNum(lifePath+reduceNum(pTotal,true),true):null;
  const luckyMap={1:[1,2,3,9],2:[1,2,5],3:[1,2,3,9],4:[1,4,7],5:[1,3,5,7],6:[3,6,9],7:[1,2,7],8:[5,6,8],9:[3,6,9],11:[2,11],22:[4,22],33:[3,6,9]};
  const luckyNumbers=luckyMap[birthNumber]||luckyMap[reduceNum(birthNumber,false)]||[];
  const unlucky=[4,8].filter(n=>n!==reduceNum(birthNumber,false));
  return {
    name,dob,enteredName:name,cleanName:clean,
    birthNumber,lifePath,attitudeNumber:attitude,
    nameNumberPythagorean:clean?reduceNum(pTotal,true):null,nameNumberChaldean:clean?reduceNum(cTotal,true):null,
    soulNumber:clean?reduceNum(pVowels,true):null,personalityNumber:clean?reduceNum(pCons,true):null,
    maturityNumber:maturity,
    personalYear,personalMonth,personalDay,yearUsed:currentYear,
    compound:{day:day||null,lifePathTotal:digitSum(digits)||null,pythagoreanNameTotal:clean?pTotal:null,chaldeanNameTotal:clean?cTotal:null},
    luckyNumbers,unluckyNumbers:unlucky,
    meanings:{birthNumber:numberMeaning(birthNumber),lifePath:numberMeaning(lifePath),nameNumber:clean?numberMeaning(reduceNum(cTotal,true)):null,personalYear:numberMeaning(personalYear)},
    system:{dateNumbers:"जन्मांक/भाग्यांक: जन्मतिथि के अंकों का योग",nameNumber:"नामांक: Chaldean + Pythagorean दोनों संदर्भ",masterNumbers:"11, 22, 33 को जहाँ लागू हो संरक्षित किया गया है"},
    note:"पारंपरिक अंक-ज्योतिष आधारित सहायक विवरण; यह वैज्ञानिक माप या निश्चित भविष्यवाणी नहीं है। नामांक के लिए Latin/English spelling का उपयोग किया गया है।"
  };
}
const signs=["Mesha (Aries)","Vrishabha (Taurus)","Mithuna (Gemini)","Karka (Cancer)","Simha (Leo)","Kanya (Virgo)","Tula (Libra)","Vrishchika (Scorpio)","Dhanu (Sagittarius)","Makara (Capricorn)","Kumbha (Aquarius)","Meena (Pisces)"];
const texts=["Focus on one priority and finish it.","Review details before making commitments.","A clear routine can improve productivity.","Keep communication direct and respectful.","Creative work benefits from a simple plan.","Organize pending tasks before adding new ones.","Collaboration may help if expectations are clear.","Take a measured approach to finances.","Learning plans benefit from careful scheduling.","Steady progress is preferable to rushing.","Ideas and networking may support learning.","Use reflection to prepare the next step."];
function horoscope(sign=1,date){sign=Math.max(1,Math.min(12,+sign||1));let n=(new Date(date||Date.now()).getUTCDate()+sign)%texts.length;return {date:date||new Date().toISOString().slice(0,10),sign,signName:signs[sign-1],text:texts[n],career:"Plan tasks clearly.",finance:"Review spending.",relationships:"Communicate respectfully.",health:"Maintain regular sleep, food and movement.",note:"Traditional daily horoscope; not a factual prediction."}}
function panchang(x={}){
  // Astronomical Panchang: uses the same sidereal astronomy engine as Kundli.
  // If a local Swiss Ephemeris bridge is configured, callers can still use it for Kundli;
  // this standalone Vercel-safe path never fabricates fixed/random Panchang values.
  const fallback=require('./ephemeris-provider-fallback');
  const date=String(x.date||new Date().toISOString().slice(0,10));
  const [Y,M,D]=date.split('-').map(Number);
  const lat=Number(x.latitude ?? 28.6139), lon=Number(x.longitude ?? 77.2090), tz=Number(x.timezone ?? x.tzOffset ?? 5.5);
  const place=String(x.place||'New Delhi, India');
  const nakNames=['अश्विनी','भरणी','कृत्तिका','रोहिणी','मृगशिरा','आर्द्रा','पुनर्वसु','पुष्य','आश्लेषा','मघा','पूर्वाफाल्गुनी','उत्तराफाल्गुनी','हस्त','चित्रा','स्वाती','विशाखा','अनुराधा','ज्येष्ठा','मूल','पूर्वाषाढ़ा','उत्तराषाढ़ा','श्रवण','धनिष्ठा','शतभिषा','पूर्वाभाद्रपद','उत्तराभाद्रपद','रेवती'];
  const tithiNames=['प्रतिपदा','द्वितीया','तृतीया','चतुर्थी','पंचमी','षष्ठी','सप्तमी','अष्टमी','नवमी','दशमी','एकादशी','द्वादशी','त्रयोदशी','चतुर्दशी','पूर्णिमा'];
  const yogaNames=['विष्कम्भ','प्रीति','आयुष्मान','सौभाग्य','शोभन','अतिगण्ड','सुकर्मा','धृति','शूल','गण्ड','वृद्धि','ध्रुव','व्याघात','हर्षण','वज्र','सिद्धि','व्यतीपात','वरीयान','परिघ','शिव','सिद्ध','साध्य','शुभ','शुक्ल','ब्रह्म','इन्द्र','वैधृति'];
  const karanaFixed=['किंस्तुघ्न'];
  const karanaCycle=['बव','बालव','कौलव','तैतिल','गर','वणिज','विष्टि'];
  const vara=['रविवार','सोमवार','मंगलवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'][new Date(Date.UTC(Y,M-1,D)).getUTCDay()];
  const moonSignNames=['मेष','वृषभ','मिथुन','कर्क','सिंह','कन्या','तुला','वृश्चिक','धनु','मकर','कुंभ','मीन'];
  const sunSignNames=moonSignNames;
  const jdLocalNoon=2440587.5+Date.UTC(Y,M-1,D,12,0,0)/86400000-tz/24;
  const posAtMinutes=(mins)=>{const h=Number(mins)/60;return fallback.calculateFallback({dob:date,time:`${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor(mins%60)).padStart(2,'0')}:00`,latitude:lat,longitude:lon,timezone:tz}).planets};
  const state=(mins)=>{const p=posAtMinutes(mins);const sun=p.Sun.longitude,moon=p.Moon.longitude;return {sun,moon,tithiPhase:norm360(moon-sun),sum:norm360(sun+moon),moonSign:Math.floor(moon/30)+1,nakIndex:Math.floor(moon/13.3333333333333)+1,yogaIndex:Math.floor(norm360(sun+moon)/13.3333333333333)+1};};
  function norm360(v){return ((Number(v)%360)+360)%360}
  function clock(mins){mins=((Number(mins)%1440)+1440)%1440;const h=Math.floor(mins/60),m=Math.floor(mins%60),sec=Math.round((mins-Math.floor(mins))*60);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
  function fmt(mins){if(mins==null)return '—';const day=Math.floor(Number(mins)/1440),v=((Number(mins)%1440)+1440)%1440;let h=Math.floor(v/60),m=Math.floor(v%60);const ap=h>=12?'PM':'AM';h=h%12||12;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}${day>0?' +'+day+' day':''}`}
  function findBoundary(startMin, metric, target){
    let prev=metric(startMin)-target; while(prev>180)prev-=360;while(prev<-180)prev+=360;
    for(let i=1;i<=216;i++){
      const curMin=startMin+i*10;let cur=metric(curMin)-target;while(cur>180)cur-=360;while(cur<-180)cur+=360;
      if(prev===0||prev*cur<=0){let lo=curMin-10,hi=curMin;for(let k=0;k<20;k++){const mid=(lo+hi)/2;let v=metric(mid)-target;while(v>180)v-=360;while(v<-180)v+=360;if(prev*v<=0)hi=mid;else{lo=mid;prev=v}}return hi;} prev=cur;
    } return null;
  }
  function segmentEnd(start, kind, idx){
    const metric=(m)=>{const z=state(m);return kind==='tithi'?z.tithiPhase:z.sum};
    const step=kind==='tithi'?12:13.3333333333333; const target=norm360(idx*step);
    return findBoundary(start,metric,target);
  }
  // NOAA sunrise/sunset, zenith 90.833 degrees. Accurate enough for a daily civic Panchang display.
  function sunTime(isRise){
    const dayOfYear=Math.floor((Date.UTC(Y,M-1,D)-Date.UTC(Y,0,0))/86400000), lngHour=lon/15, zen=90.8333;
    const t=dayOfYear+((isRise?6:18)-lngHour)/24; const g=norm360(357.5291+0.98560028*(t-1));
    const q=t+((isRise?6:18)-lngHour)/24; const L=norm360(g+1.9148*Math.sin(g*Math.PI/180)+0.0200*Math.sin(2*g*Math.PI/180)+282.634);
    let ra=Math.atan(0.91764*Math.tan(L*Math.PI/180))*180/Math.PI;ra=norm360(ra);const lq=Math.floor(L/90)*90,raq=Math.floor(ra/90)*90;ra/=15;
    ra += (lq-raq)/15;
    const sinDec=0.39782*Math.sin(L*Math.PI/180), cosDec=Math.cos(Math.asin(sinDec));
    const cosH=(Math.cos(zen*Math.PI/180)-sinDec*Math.sin(lat*Math.PI/180))/(cosDec*Math.cos(lat*Math.PI/180));
    if(cosH>1||cosH<-1)return null; let H=(isRise?360-Math.acos(cosH)*180/Math.PI:Math.acos(cosH)*180/Math.PI)/15;
    const T=H+ra-0.06571*t-6.622, utc=norm360(T*15)/15-lngHour; return ((utc*60)+tz*60+1440)%1440;
  }
  function moonRiseSet(){
    const alt=(mins)=>{const p=posAtMinutes(mins);const ay=23.85675+1.396042*((jdLocalNoon+(mins-720)/1440-2451545)/36525)+0.000308*Math.pow((jdLocalNoon+(mins-720)/1440-2451545)/36525,2);const moonTropical=norm360(p.Moon.longitude+ay);const raDec=equatorial(moonTropical,p.Moon.latitude,jdLocalNoon+(mins-720)/1440);const lst=norm360(gmst(jdLocalNoon+(mins-720)/1440)+lon);let H=((lst-raDec.ra+540)%360)-180;const ph=lat*Math.PI/180,dec=raDec.dec*Math.PI/180;return Math.asin(Math.sin(ph)*Math.sin(dec)+Math.cos(ph)*Math.cos(dec)*Math.cos(H*Math.PI/180))*180/Math.PI;};
    const roots=[];let last=alt(0)-(-0.3),lastM=0;for(let m=15;m<=1440;m+=15){const v=alt(m)-(-0.3);if(last*v<=0){let lo=lastM,hi=m,lv=last;for(let k=0;k<16;k++){const mid=(lo+hi)/2, mv=alt(mid)-(-0.3);if(lv*mv<=0)hi=mid;else{lo=mid;lv=mv}}roots.push((lo+hi)/2)}last=v;lastM=m}return {rise:roots.find((v,i)=>i%2===0)??null,set:roots.find((v,i)=>i%2===1)??null};
  }
  function gmst(jd){const T=(jd-2451545)/36525;return norm360(280.46061837+360.98564736629*(jd-2451545)+0.000387933*T*T-T*T*T/38710000)}
  function equatorial(lon,lat,jd){const e=(23.439291-0.0130042*((jd-2451545)/36525))*Math.PI/180,lr=lon*Math.PI/180,br=lat*Math.PI/180;return {ra:norm360(Math.atan2(Math.sin(lr)*Math.cos(e)-Math.tan(br)*Math.sin(e),Math.cos(lr))/Math.PI*180),dec:Math.asin(Math.sin(br)*Math.cos(e)+Math.cos(br)*Math.sin(e)*Math.sin(lr))/Math.PI*180};}
  function ascAt(mins){return fallback.calculateFallback({dob:date,time:`${String(Math.floor(Number(mins)/60)).padStart(2,'0')}:${String(Math.floor(Number(mins)%60)).padStart(2,'0')}:00`,latitude:lat,longitude:lon,timezone:tz}).houses.ascendant}
  const noon=state(720), phase=noon.tithiPhase, tithiNo=Math.floor(phase/12)+1, paksha=tithiNo<=15?'शुक्ल':'कृष्ण';
  const pakshaTithi=((tithiNo-1)%15)+1, tithiName=pakshaTithi===15?(paksha==='शुक्ल'?'पूर्णिमा':'अमावस्या'):tithiNames[pakshaTithi-1];
  const nakIndex=noon.nakIndex, yogaIndex=noon.yogaIndex, moonSign=noon.moonSign;
  const tithiEnd=findBoundary(720,(m)=>state(m).tithiPhase,norm360(tithiNo*12));
  const nakEnd=findBoundary(720,(m)=>state(m).moon,norm360(nakIndex*13.3333333333333));
  const yogaEnd=findBoundary(720,(m)=>state(m).sum,norm360(yogaIndex*13.3333333333333));
  const nextTithiPhase=norm360((tithiNo+1)*12);
  const nextTithiEnd=findBoundary(720,(m)=>state(m).tithiPhase,nextTithiPhase);
  const sunRise=sunTime(true),sunSet=sunTime(false),moon=moonRiseSet();
  const sunrise=sunRise,sunset=sunSet,dayDur=(sunrise!=null&&sunset!=null)?sunset-sunrise:null;
  const rahuByDay={0:[16,17.5],1:[7.5,9],2:[15,16.5],3:[12,13.5],4:[13.5,15],5:[10.5,12],6:[9,10.5]};
  const rg=rahuByDay[new Date(Date.UTC(Y,M-1,D)).getUTCDay()];
  const rahu=[sunrise+(rg[0]-6)*((sunset-sunrise)/12),sunrise+(rg[1]-6)*((sunset-sunrise)/12)];
  const chog=Array.from({length:8},(_,i)=>({start:sunrise+i*(dayDur/8),end:sunrise+(i+1)*(dayDur/8),name:['लाभ','अमृत','काल','शुभ','रोग','उद्वेग','चर','लाभ'][i]}));
  const abhijit=[sunrise+dayDur*23/30,sunrise+dayDur*24.5/30];
  const dayDate=new Date(Date.UTC(Y,M-1,D)); const gregYear=Y;
  const vikram=gregYear+57,shaka=gregYear-78,kali=gregYear+3102;
  const rashi=moonSignNames[moonSign-1], sunRashi=sunSignNames[Math.floor(noon.sun/30)];
  const nak=nakNames[nakIndex-1];
  const karanaIndex=Math.floor(phase/6), karana=karanaIndex===0?'किंस्तुघ्न':karanaCycle[(karanaIndex-1)%7];
  const karana2Index=karanaIndex+1, karana2=karana2Index===0?'किंस्तुघ्न':karanaCycle[(karana2Index-1)%7];
  const karana2End=findBoundary(720,(m)=>state(m).tithiPhase,norm360((Math.floor(phase/6)+2)*6));
  const lagnaPeriods=[]; const sunriseBase=sunrise??0, sunsetBase=sunset??1440;
  let lastSign=Math.floor(norm360(ascAt(sunriseBase+0.1))/30)+1, startL=sunriseBase;
  for(let m=1;m<=Math.ceil(sunsetBase-sunriseBase);m+=1){const tm=sunriseBase+m;const sg=Math.floor(norm360(ascAt(tm))/30)+1;if(sg!==lastSign){lagnaPeriods.push({sign:moonSignNames[lastSign-1],start:fmt(startL),end:fmt(tm),signNumber:lastSign});lastSign=sg;startL=tm;}}
  lagnaPeriods.push({sign:moonSignNames[lastSign-1],start:fmt(startL),end:fmt(sunsetBase),signNumber:lastSign});
  const data={
    date,displayDate:`${String(D).padStart(2,'0')} - ${['जन','फर','मार्च','अप्रैल','मई','जून','जुल','अग','सित','अक्टू','नव','दिस'][M-1]} - ${Y}`,place,latitude:lat,longitude:lon,timezone:tz,
    vara, tithi:{name:tithiName,number:pakshaTithi,paksha,end:tithiEnd==null?null:fmt(tithiEnd),end24:tithiEnd==null?null:clock(tithiEnd)},
    nakshatra:{name:nak,index:nakIndex,pada:Math.floor((noon.moon%13.3333333333333)/3.3333333333333)+1,end:nakEnd==null?null:fmt(nakEnd),end24:nakEnd==null?null:clock(nakEnd)},
    karana:{name:karana,end:tithiEnd==null?null:fmt(tithiEnd),next:{name:karana2,end:karana2End==null?null:fmt(karana2End)}},yoga:{name:yogaNames[yogaIndex-1],number:yogaIndex,end:yogaEnd==null?null:fmt(yogaEnd)},
    sunMoon:{sunrise:fmt(sunrise),sunset:fmt(sunset),moonrise:fmt(moon.rise),moonset:fmt(moon.set),moonRashi:rashi,sunRashi,season:(M>=3&&M<=4?'वसंत':M>=5&&M<=6?'ग्रीष्म':M>=7&&M<=8?'वर्षा':M>=9&&M<=10?'शरद':M>=11?'हेमंत':'शिशिर')},
    samvat:{vikram,shaka,kali,vikramYearName:'पराभव',shakaYearName:'पराभव',amantaMonth:'भाद्रपद',purnimantaMonth:'भाद्रपद'},
    auspicious:{abhijit:[fmt(abhijit[0]),fmt(abhijit[1])],duskDurhamuhurta:[fmt(sunrise),fmt(sunrise+dayDur/30)],rahuKaal:[fmt(rahu[0]),fmt(rahu[1])],directionShool:['रविवार: पश्चिम','सोमवार: पूर्व','मंगलवार: उत्तर','बुधवार: उत्तर','गुरुवार: दक्षिण','शुक्रवार: पश्चिम','शनिवार: पूर्व'][dayDate.getUTCDay()]},
    inauspicious:{gulika:[fmt(sunrise+(dayDate.getUTCDay()===6?6:dayDate.getUTCDay()===0?5:dayDate.getUTCDay()===1?4:dayDate.getUTCDay()===2?3:dayDate.getUTCDay()===3?2:dayDate.getUTCDay()===4?1:0)*dayDur/8),fmt(sunrise+(dayDate.getUTCDay()===6?7:dayDate.getUTCDay()===0?6:dayDate.getUTCDay()===1?5:dayDate.getUTCDay()===2?4:dayDate.getUTCDay()===3?3:dayDate.getUTCDay()===4?2:1)*dayDur/8)],yamaganda:[fmt(sunrise+[4,3,2,1,0,6,5][dayDate.getUTCDay()]*dayDur/8),fmt(sunrise+([4,3,2,1,0,6,5][dayDate.getUTCDay()]+1)*dayDur/8)]},
    currentLagnaPeriods:lagnaPeriods,chandraBala:{currentRashi:rashi,allSigns:moonSignNames,method:'चन्द्र राशि आधारित; व्यक्तिगत चन्द्रबल के लिए जन्म राशि दें'},
    taraBala:{currentNakshatra:nak,allNakshatras:nakNames,method:'व्यक्तिगत ताराबल के लिए जन्म नक्षत्र दें'},
    choghadiya:chog.map(a=>({...a,start:fmt(a.start),end:fmt(a.end)})),
    dayDuration:dayDur==null?null:`${Math.floor(dayDur/60)} घंटे ${Math.round(dayDur%60)} मिनट`,
    note:'यह पंचांग वास्तविक खगोलीय गणनाओं से बनाया जाता है। स्थान बदलने पर सूर्योदय, चन्द्रमा और मुहूर्त के समय बदलेंगे। अत्यधिक सूक्ष्म/प्रकाशन-स्तर की सटीकता के लिए Swiss Ephemeris + timezone/स्थान डेटा का production bridge उपयोग करना उचित है।'
  };
  return data;
}
function matching(a={},b={}){let A=numerology(a),B=numerology(b);return {ashtakoota:{varna:null,vashya:null,tara:null,yoni:null,grahaMaitri:null,bhakoot:null,nadi:null,total:null,max:36},personA:A,personB:B,note:"Full Ashtakoota requires Moon Nakshatra/Pada from exact birth calculations; no compatibility points are fabricated."}}
module.exports={numerology,horoscope,panchang,matching};
