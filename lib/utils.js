const https = require('https');
const MEET_CODE = { K: '1', B: '3', J: '2' };
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
function parseXML(xml) {
  const items = [];
  const ir = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = ir.exec(xml)) !== null) {
    const obj = {};
    const fr = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fr.exec(m[1])) !== null) obj[f[1]] = f[2].trim();
    if (Object.keys(obj).length > 0) items.push(obj);
  }
  return items;
}
module.exports = { fetchText, parseXML, MEET_CODE };
