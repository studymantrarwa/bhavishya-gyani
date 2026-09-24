const handlers = {
  "_lib": null,
  "advanced": require("../lib/api/advanced"),
  "admin": require("../lib/api/admin"),
  "admin-register": require("../lib/api/admin-register"),
  "admin-astrologer": require("../lib/api/admin-astrologer"),
  "astrologer-settings": require("../lib/api/astrologer-settings"),
  "astrologer/settings": require("../lib/api/astrologer-settings"),
  "astrologer/status": require("../lib/api/astrologer-settings"),
  "astrologer-panel": require("../lib/api/astrologer-panel"),
  "astrologer-register": require("../lib/api/astrologer-register"),
  "astrologer-profile": require("../lib/api/astrologer-profile"),
  "astrologer-requests": require("../lib/api/astrologer-requests"),
  "astrologer-users": require("../lib/api/astrologer-users"),
  "astrologers": require("../lib/api/astrologers"),
  "chat": require("../lib/api/chat"),
  "call-requests": require("../lib/api/call-requests"),
  "call-signaling": require("../lib/api/call-signaling"),
  "config": require("../lib/api/config"),
  "turn-credentials": require("../lib/api/turn-credentials"),
  "horoscope": require("../lib/api/horoscope"),
  "kundli": require("../lib/api/kundli"),
  "login": require("../lib/api/login"),
  "matching": require("../lib/api/matching"),
  "me": require("../lib/api/me"),
  "messages": require("../lib/api/messages"),
  "shared-kundli": require("../lib/api/shared-kundli"),
  "payments": require("../lib/api/payments"),
  "chat-room": require("../lib/api/chat-room"),
  "my-kundlis": require("../lib/api/my-kundlis"),
  "numerology": require("../lib/api/numerology"),
  "panchang": require("../lib/api/panchang"),
  "places": require("../lib/api/places"),
  "profile": require("../lib/api/profile"),
  "register": require("../lib/api/register"),
  "reviews": require("../lib/api/reviews"),
  "referral": require("../lib/api/referral"),
  "feedback": require("../lib/api/feedback"),
  "follow": require("../lib/api/follow"),
  "health": require("../lib/api/health"),
  "notifications": require("../lib/api/notifications")
};

module.exports = async (req, res) => {
  let route = String(req.query?.route || "").replace(/^\/+|\/+$/g, "");
  route = route.replace(/\.js$/i, "");

  if (!route || route === "index") {
    return res.status(200).json({
      ok: true,
      service: "Bhavishya Gyani Astrology API",
      version: "V9",
      message: "API gateway is running"
    });
  }

  const handler = handlers[route];
  if (!handler) {
    return res.status(404).json({ error: "API route not found", route });
  }

  return handler(req, res);
};
