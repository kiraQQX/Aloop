// I18N-4: zh and en dictionaries must expose identical key sets. Usage: node tests/i18n_parity.js
global.window = global; global.addEventListener = () => {};
global.document = { addEventListener() {}, querySelector() { return null }, querySelectorAll() { return [] }, getElementById() { return null }, documentElement: { dataset: {} } };
global.navigator = { language: "en", languages: ["en"] };
global.localStorage = { getItem() { return null }, setItem() {} };
require("../assets/i18n/site.js");
const d = global.Aloop.i18n.dict, a = Object.keys(d.zh), b = Object.keys(d.en);
const miss = [...a.filter(k => !(k in d.en)).map(k => "missing en: " + k), ...b.filter(k => !(k in d.zh)).map(k => "missing zh: " + k)];
console.log(`zh=${a.length} en=${b.length}`); if (miss.length) { console.log(miss.join("\n")); process.exit(1); } console.log("parity OK");
