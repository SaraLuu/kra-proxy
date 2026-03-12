const https = require('https');

const KRA_KEY = 'bd42bcec6bd5b33efcbf21b4cb6f96c2475c082f61ac2829894cb42a1fa9a8ea';

// 최신 API 주소 (2025 기준)
const ENDPOINTS = {
  result: 'http://apis.data.go.kr/B551015/racedetailresult/getracedetailresult',
  entry:  'http://apis.data.go.kr/B551015/racehorselist/getracehorselist',
};

// meet 코드: K→1(서울), B→3(부산경남), J→2(제주)
const MEET_CODE = { K: '1', B: '3', J: '2' };

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url.replace('http://', 'https://'), (res) => {
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { date, no, meet } = req.query;
  if (!date || !no || !meet) {
    res.status(400).json({ error: 'date, no, meet 파라미터 필요' });
    return;
  }

  const meetCode = MEET_CODE[meet] || meet;

  try {
    const resultUrl = `${ENDPOINTS.result}?serviceKey=${KRA_KEY}&pageNo=1&numOfRows=20&rc_date=${date}&rc_no=${no}&meet=${meetCode}`;
    const xml = await fetchText(resultUrl);
    const horses = parseXML(xml);

    if (horses.length === 0) {
      res.status(404).json({
        error: '데이터 없음',
        snippet: xml.slice(0, 400),
      });
      return;
    }

    const first = horses[0];
    res.status(200).json({
      ok: true,
      meta: {
        date, no, meet,
        dist:    (first.rcDist || first.rc_dist || '') + 'm',
        weather: first.weather || '-',
        track:   first.trackCond || first.track_cond || '-',
      },
      horses: horses.map(h => ({
        num:        h.chulNo    || h.winNo     || '',
        name:       h.hrName    || '',
        age:        h.hrAge     || '',
        weight:     h.budenWeight || h.buden_weight || '',
        jockeyName: h.jkName    || '',
        jockeyRate: h.jkWtRate  || '',
        blood:      h.faHrName  || '',
        s1f:        h.s1fBtime  || '',
        g3f:        h.g3fBtime  || '',
        gf:         h.rcTime    || '',
        form: [h.ord1,h.ord2,h.ord3,h.ord4,h.ord5].filter(Boolean).join('-'),
        bodyWeight: h.hrWeight  || '',
        rating:     h.rating    || '',
      }))
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
