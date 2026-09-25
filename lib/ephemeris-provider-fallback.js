/*
  Vercel-safe astronomical fallback.
  Uses published low-precision orbital-element methods (Paul Schlyter style)
  for Sun/planets and lunar perturbation terms. It is NOT a third-party
  astrology calculation API. A local Swiss Ephemeris bridge remains supported
  through STUDY_MANTRA_EPHEMERIS_CMD when available.
*/
const norm=x=>((Number(x)%360)+360)%360;
const DEG=Math.PI/180;
const sind=x=>Math.sin(Number(x)*DEG);
const cosd=x=>Math.cos(Number(x)*DEG);
function kepler(M,e){
  const mr=norm(M)*DEG; let E=mr;
  for(let i=0;i<12;i++) E-=(E-e*Math.sin(E)-mr)/(1-e*Math.cos(E));
  return E;
}
function orbit(d,e){
  const N=e[0]+e[1]*d, i=e[2]+e[3]*d, w=e[4]+e[5]*d;
  const a=e[6]+e[7]*d, ec=e[8]+e[9]*d, M=e[10]+e[11]*d;
  const E=kepler(M,ec);
  const xv=a*(Math.cos(E)-ec), yv=a*Math.sqrt(1-ec*ec)*Math.sin(E);
  const v=Math.atan2(yv,xv)/DEG, r=Math.hypot(xv,yv);
  const nr=N*DEG, ir=i*DEG, vw=(v+w)*DEG;
  return {
    x:r*(Math.cos(nr)*Math.cos(vw)-Math.sin(nr)*Math.sin(vw)*Math.cos(ir)),
    y:r*(Math.sin(nr)*Math.cos(vw)+Math.cos(nr)*Math.sin(vw)*Math.cos(ir)),
    z:r*Math.sin(vw)*Math.sin(ir),
    M, v, r
  };
}
const EL={
  Mercury:[48.3313,3.24587e-5,7.0047,5e-8,29.1241,1.01444e-5,.387098,0,.205635,5.59e-10,168.6562,4.0923344368],
  Venus:[76.6799,2.46590e-5,3.3946,2.75e-8,54.8910,1.38374e-5,.72333,0,.006773,-1.302e-9,48.0052,1.6021302244],
  Mars:[49.5574,2.11081e-5,1.8497,-1.78e-8,286.5016,2.92961e-5,1.523688,0,.093405,2.516e-9,18.6021,.5240207766],
  Jupiter:[100.4542,2.76854e-5,1.3030,-1.557e-7,273.8777,1.64505e-5,5.20256,0,.048498,4.469e-9,19.8950,.0830853001],
  Saturn:[113.6634,2.38980e-5,2.4886,-1.081e-7,339.3939,2.97661e-5,9.55475,0,.055546,-9.499e-9,316.9670,.0334442282]
};
const EARTH=[0,0,0,0,282.9404,4.70935e-5,1,0,.016709,-1.151e-9,356.047,.9856002585];
function jdFromInput(input){
  const [Y,m,d]=String(input.dob).split('-').map(Number);
  const tm=String(input.time||'12:00').split(':').map(Number);
  const h=(tm[0]||0)+(tm[1]||0)/60+(tm[2]||0)/3600;
  const off=Number(input.timezone ?? input.tzOffset ?? 5.5);
  return 2440587.5 + Date.UTC(Y,m-1,d,0,0,0)/86400000 + (h-off)/24;
}
function daysSince2000Jan0(jd){return jd-2451543.5;}
function lahiri(jd){
  // Close polynomial approximation to the Lahiri/Chitrapaksha ayanamsha.
  const T=(jd-2451545.0)/36525;
  return 23.85675 + 1.396042*T + 0.000308*T*T;
}
function meanNode(jd){
  const T=(jd-2451545.0)/36525;
  return norm(125.0445550-1934.1361849*T);
}
function moonPosition(d,sunLon,sunMeanAnomaly){
  const N=125.1228-0.0529538083*d;
  const i=5.1454;
  const w=318.0634+0.1643573223*d;
  const a=60.2666, e=.0549, M=115.3654+13.0649929509*d;
  const E=kepler(M,e);
  const xv=a*(Math.cos(E)-e), yv=a*Math.sqrt(1-e*e)*Math.sin(E);
  const v=Math.atan2(yv,xv)/DEG, r=Math.hypot(xv,yv);
  const nr=N*DEG, ir=i*DEG, vw=(v+w)*DEG;
  let x=r*(Math.cos(nr)*Math.cos(vw)-Math.sin(nr)*Math.sin(vw)*Math.cos(ir));
  let y=r*(Math.sin(nr)*Math.cos(vw)+Math.cos(nr)*Math.sin(vw)*Math.cos(ir));
  let z=r*Math.sin(vw)*Math.sin(ir);
  let lon=norm(Math.atan2(y,x)/DEG), lat=Math.atan2(z,Math.hypot(x,y))/DEG;
  const Lm=norm(N+w+M), D=norm(Lm-sunLon), F=norm(Lm-N), Ms=norm(sunMeanAnomaly);
  lon=norm(lon+
    -1.274*sind(M-2*D)+0.658*sind(2*D)-0.186*sind(Ms)-
    0.059*sind(2*M-2*D)-0.057*sind(M-2*D+Ms)+0.053*sind(M+2*D)+
    0.046*sind(2*D-Ms)+0.041*sind(M-Ms)-0.035*sind(D)-
    0.031*sind(M+Ms)+0.015*sind(2*F-2*D)+0.011*sind(M-4*D));
  lat += -0.173*sind(F-2*D)-0.055*sind(M-F-2*D)-0.046*sind(M+F-2*D)+0.033*sind(F+2*D)+0.017*sind(2*M+F);
  return {longitude:lon,latitude:lat};
}
function tropicalPositions(jd){
  const d=daysSince2000Jan0(jd);
  const earth=orbit(d,EARTH);
  const sunLon=norm(Math.atan2(earth.y,earth.x)/DEG);
  const sunMean=356.047+.9856002585*d;
  const out={Sun:{longitude:sunLon,latitude:0}};
  for(const [name,el] of Object.entries(EL)){
    const p=orbit(d,el);
    const gx=p.x+earth.x, gy=p.y+earth.y, gz=p.z+earth.z;
    out[name]={longitude:norm(Math.atan2(gy,gx)/DEG),latitude:Math.atan2(gz,Math.hypot(gx,gy))/DEG};
  }
  out.Moon=moonPosition(d,sunLon,sunMean);
  const rahu=meanNode(jd); out.Rahu={longitude:rahu,latitude:0}; out.Ketu={longitude:norm(rahu+180),latitude:0};
  return out;
}
function greenwichSiderealDeg(jd){
  const T=(jd-2451545)/36525;
  return norm(280.46061837+360.98564736629*(jd-2451545)+0.000387933*T*T-T*T*T/38710000);
}
function ascendantTropical(jd,lat,lon){
  const theta=(greenwichSiderealDeg(jd)+Number(lon||0))*DEG;
  const phi=Number(lat||0)*DEG;
  const eps=(23.439291-0.0130042*((jd-2451545)/36525))*DEG;
  const lam=Math.atan2(Math.cos(theta),-(Math.sin(theta)*Math.cos(eps)+Math.tan(phi)*Math.sin(eps)))/DEG;
  return norm(lam);
}
function calc(input){
  const jd=jdFromInput(input), ay=lahiri(jd), trop=tropicalPositions(jd);
  const lat=Number(input.latitude), lon=Number(input.longitude);
  const ascT=ascendantTropical(jd,lat,lon), asc=norm(ascT-ay);
  const positions={};
  for(const [name,p] of Object.entries(trop)){
    positions[name]={longitude:norm(p.longitude-ay),latitude:p.latitude||0,speed:0};
  }
  // Angular speed by central difference. This also marks retrograde correctly.
  for(const name of Object.keys(positions)){
    const t1=tropicalPositions(jd-0.02)[name].longitude;
    const t2=tropicalPositions(jd+0.02)[name].longitude;
    let diff=norm(t2-t1); if(diff>180) diff-=360;
    positions[name].speed=diff/0.04;
  }
  const houses=Array.from({length:12},(_,i)=>norm(asc+i*30));
  return {julianDay:jd,ayanamsa:ay,planets:positions,houses:{ascendant:asc,mc:norm(asc+270),cusps:houses},nodeMode:'mean',fallback:true,provider:'built-in-sidereal-astronomy'};
}
function calculateFallback(input){return calc(input)}
module.exports={calculateFallback};
