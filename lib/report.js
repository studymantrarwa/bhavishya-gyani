function buildReport(k){
  const p=k.planets;
  const phala=k.phalaDesh||{summary:'',points:[],note:''};
  return {
    title:"Bhavishya Gyani Kundli Report",
    summary:{
      lagna:k.lagna.signName,
      moonSign:p.Moon.signName,
      sunSign:p.Sun.signName,
      moonNakshatra:p.Moon.nakshatra.name,
      moonPada:p.Moon.nakshatra.pada
    },
    phalaDesh:phala,
    sections:[
      {id:"personality",title:"सामान्य व्यक्तित्व",items:phala.points.filter(x=>x.title==="सामान्य व्यक्तित्व"||x.title==="स्वभाव और निर्णय क्षमता")},
      {id:"education",title:"शिक्षा और ज्ञान",items:phala.points.filter(x=>x.title==="शिक्षा और ज्ञान")},
      {id:"career",title:"करियर और व्यवसाय",items:phala.points.filter(x=>["करियर और व्यवसाय","कार्य-ऊर्जा"].includes(x.title))},
      {id:"finance",title:"धन और आय",items:phala.points.filter(x=>x.title==="धन और आय")},
      {id:"marriage",title:"विवाह और संबंध",items:phala.points.filter(x=>["विवाह और संबंध","मंगल दोष"].includes(x.title))},
      {id:"family",title:"गृह और परिवार",items:phala.points.filter(x=>x.title==="गृह और परिवार")},
      {id:"fortune",title:"भाग्य, धर्म और उच्च अध्ययन",items:phala.points.filter(x=>x.title==="भाग्य, धर्म और उच्च अध्ययन")},
      {id:"travel",title:"विदेश / यात्रा",items:phala.points.filter(x=>x.title==="विदेश/यात्रा")},
      {id:"health",title:"स्वास्थ्य-संबंधी पारंपरिक संकेत",items:phala.points.filter(x=>x.title==="स्वास्थ्य-संबंधी पारंपरिक संकेत")},
      {id:"yoga",title:"शुभ योग",items:phala.points.filter(x=>x.title==="शुभ योग"||x.title.startsWith("शुभ योग फल —"))},
      {id:"dosha",title:"अशुभ योग / दोष",items:phala.points.filter(x=>x.title==="अशुभ योग / दोष"||x.title.startsWith("अशुभ योग / दोष फल —"))},
      {id:"dasha",title:"वर्तमान महादशा",items:phala.points.filter(x=>x.title==="वर्तमान महादशा")},
      {id:"overall",title:"समग्र फलादेश",items:phala.points.filter(x=>x.title==="समग्र फलादेश")}
    ],
    disclaimer:phala.note||"यह पारंपरिक वैदिक ज्योतिषीय व्याख्या है, निश्चित या वैज्ञानिक भविष्यवाणी नहीं।"
  };
}
module.exports={buildReport};
