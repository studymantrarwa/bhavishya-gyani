const rules = [
  /(?:https?:\/\/|www\.)\S+/iu,
  /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/iu,
  /(?:^|[^\d])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/u,
  /(?:^|[^\d])\+?\d{1,3}[\s.-]?\d{3,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\d)/u,
  /\b\d{10,12}\b/u,
  /\b(?:whats?app|telegram|instagram|facebook|messenger|snapchat|imo|signal|viber|skype|discord|linkedin|x\.com|twitter|threads)\b/iu,
  /\b(?:phone|mobile|contact|call|number|email|e-mail|mail|address|website|url|dm|direct message|whatsapp|telegram|instagram|facebook|upi|paytm|phonepe|gpay|google\s*pay|qr\s*code)\b/iu,
  /\b(?:पता|मोबाइल|फोन|नंबर|ईमेल|मेल|व्हाट्स?ऐप|टेलीग्राम|इंस्टाग्राम|फेसबुक|संपर्क|कॉन्टैक्ट|कॉल|पता)\b/iu,
  /@[a-z0-9_.-]{2,}/iu,
  /\b[a-z0-9._-]+@(paytm|ybl|oksbi|okaxis|okicici|okhdfcbank|upi)\b/iu
];
function normalize(s){return String(s||'').replace(/[\u200b-\u200f\u202a-\u202e]/g,'').trim()}
function contactViolation(text){
  const s=normalize(text);
  if(!s)return {blocked:false};
  for(const re of rules) if(re.test(s)) return {blocked:true,reason:'Contact details are not allowed in chat.'};
  return {blocked:false};
}
module.exports={contactViolation};
