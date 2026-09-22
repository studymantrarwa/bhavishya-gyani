import os, json
from http.server import BaseHTTPRequestHandler
import swisseph as swe

PLANETS={"Sun":swe.SUN,"Moon":swe.MOON,"Mars":swe.MARS,"Mercury":swe.MERCURY,"Jupiter":swe.JUPITER,"Venus":swe.VENUS,"Saturn":swe.SATURN}
def norm(x): return (float(x)%360.0+360.0)%360.0
def calc(inp):
    y,m,d=map(int,str(inp["dob"]).split("-")); parts=str(inp.get("time","12:00")).split(":")
    hh=int(parts[0] or 0); mm=int(parts[1] or 0); ss=int(parts[2] or 0) if len(parts)>2 else 0
    tz=float(inp.get("timezone",5.5)); jd=swe.julday(y,m,d,hh+mm/60+ss/3600-tz,swe.GREG_CAL)
    swe.set_sid_mode(swe.SIDM_LAHIRI); flags=swe.FLG_SWIEPH|swe.FLG_SPEED|swe.FLG_SIDEREAL; planets={}
    for name,pid in PLANETS.items():
        xx,_=swe.calc_ut(jd,pid,flags); planets[name]={"longitude":norm(xx[0]),"latitude":float(xx[1]),"speed":float(xx[3])}
    xx,_=swe.calc_ut(jd,swe.MEAN_NODE,flags); planets["Rahu"]={"longitude":norm(xx[0]),"latitude":float(xx[1]),"speed":float(xx[3])}; planets["Ketu"]={"longitude":norm(xx[0]+180),"latitude":float(-xx[1]),"speed":float(xx[3])}
    cusps,ascmc=swe.houses_ex(jd,float(inp["latitude"]),float(inp["longitude"]),b"P",swe.FLG_SIDEREAL)
    return {"julianDay":jd,"ayanamsa":float(swe.get_ayanamsa_ut(jd)),"nodeMode":"mean","planets":planets,"houses":{"ascendant":norm(ascmc[0]),"mc":norm(ascmc[1]),"cusps":[norm(x) for x in cusps]},"provider":"swiss-ephemeris","fallback":False}
class handler(BaseHTTPRequestHandler):
    def _send(self,status,data):
        raw=json.dumps(data,separators=(",",":" )).encode(); self.send_response(status); self.send_header("Content-Type","application/json"); self.send_header("Cache-Control","no-store"); self.end_headers(); self.wfile.write(raw)
    def do_POST(self):
        secret=os.getenv("EPHEMERIS_SECRET",""); incoming=self.headers.get("x-ephemeris-secret","")
        if secret and incoming!=secret:return self._send(401,{"error":"Unauthorized"})
        try:
            n=int(self.headers.get("content-length","0")); inp=json.loads(self.rfile.read(n).decode() or "{}")
            return self._send(200,calc(inp))
        except Exception as e:return self._send(500,{"error":str(e)})
    def do_GET(self):
        return self._send(200,{"ok":True,"service":"Swiss Ephemeris","provider":"pysweph","python":"3.12"})
