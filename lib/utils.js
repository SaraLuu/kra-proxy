const https = require('https');

const MEET_CODE = { K: '1', B: '3', J: '2' };

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('타임아웃')); });
  });
}

function parseXML(xml) {
  const items = [];
  const itemReg = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemReg.exec(xml)) !== null) {
    const block = m[1];
    const obj = {};
    const fieldReg = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fieldReg.exec(block)) !== null) {
      obj[f[1]] = f[2].trim();
    }
    if (Object.keys(obj).length > 0) items.push(obj);
  }
  return items;
}

module.exports = { fetchText, parseXML, MEET_CODE };
```

Commit changes!

---
