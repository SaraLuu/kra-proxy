const https = require('https');

const KRA_KEY = 'bd42bcec6bd5b33efcbf21b4cb6f96c2475c082f61ac2829894cb42a1fa9a8ea';

const ENDPOINTS = {
  entry:  'https://apis.data.go.kr/B551015/API212_1/RaceEntryInfo_1',
  result: 'https://apis.data.go.kr/B551015/API214_1/RaceDetailResult_1',
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('타임아웃')); });
  });
}

// XML → 배열 파싱 (라이브러리 없이)
function parseXML(xml, tag) {
  const items = [];
  const itemReg = new RegExp(`<item>([\\s\\S]*?)<\\/item>`, 'g');
  let itemMatch;
  while ((itemMatch = itemReg.exec(xml)) !== null) {
    const block = itemMatch[1];
    const obj = {};
    const fieldReg = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldReg.exec(block)) !== null) {
      obj[fieldMatch[1]] = fieldMatch[2].trim();
    }
    if (Object.keys(obj).length > 0) items.push(obj);
  }
  return items;
}

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1].trim() : '';
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

  const base = `serviceKey=${KRA_KEY}&pageNo=1&numOfRows=20&rc_date=${date}&rc_no=${no}&meet=${meet}`;

  try {
    const [entryXml, resultXml] = await Promise.all([
      fetchText(`${ENDPOINTS.entry}?${base}`).catch(() => ''),
      fetchText(`${ENDPOINTS.result}?${base}`).catch(() => ''),
    ]);

    const entries = parseXML(entryXml);
    const results = parseXML(resultXml);
    const horses  = entries.length > 0 ? entries : results;

    if (horses.length === 0) {
      res.status(404).json({
        error: '데이터 없음 — 출마표 미공개이거나 잘못된 날짜/경주번호',
        tip: '출마표는 경기 수요일부터 공개됩니다',
        entryLen: entryXml.length,
        resultLen: resultXml.length,
        entrySnippet: entryXml.slice(0, 300),
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
        num:        h.chulNo   || h.winNo    || h.chul_no  || h.win_no  || '',
        name:       h.hrName   || h.hr_name  || '',
        age:        h.hrAge    || h.hr_age   || '',
        weight:     h.budenWeight || h.burden_weight || '',
        jockeyName: h.jkName   || h.jk_name  || '',
        jockeyRate: h.jkWtRate || h.jk_wt_rate || '',
        blood:      h.faHrName || '',
        s1f:        h.s1fBtime || h.s1f_btime || '',
        g3f:        h.g3fBtime || h.g3f_btime || '',
        gf:         h.rcTime   || h.rc_time  || '',
        form: [h.ord1,h.ord2,h.ord3,h.ord4,h.ord5].filter(Boolean).join('-'),
        bodyWeight: h.hrWeight || h.hr_weight || '',
        rating:     h.rating   || '',
      }))
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
