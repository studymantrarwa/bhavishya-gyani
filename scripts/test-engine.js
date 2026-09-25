const assert=require("assert");
const {navamsaSign}=require("../lib/astrology-engine");
assert.equal(navamsaSign(0),1);      // Aries 0° -> Aries
assert.equal(navamsaSign(30),10);    // Taurus 0° -> Capricorn (9th from Taurus)
assert.equal(navamsaSign(60),7);     // Gemini 0° -> Libra (1st Navamsa for a dual sign)
console.log("Bhavishya Gyani V5 basic D9 tests passed.");
