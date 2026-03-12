const https = require('https');
const http = require('http');

const KRA_KEY = 'bd42bcec6bd5b33efcbf21b4cb6f96c2475c082f61ac2829894cb42a1fa9a8ea';
const MEET_CODE = { K: '1', B: '3', J: '2' };
const MEET_NAME = { K: '서울', B: '부산경남', J: '제주' };

function fetchText(urlStr) {
  return new Promise((resolve, reject) => {
    const mod = urlStr.startsWith('https') ? https : http;
    const req = mod.get(urlStr, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // 리다이렉트 처리
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location).then(resolve).catch(reject);
      }
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

// 마사회 경주성적 페이지에서 구간기록 스크래핑
async function fetchSectorTimes(date, no, meetCode) {
  const url = `https://race.kra.co.kr/raceScore/ScoretableScoreList.do?Act=04&Sub=1&meet=${meetCode}&s_date=${date}&s_group=${no}`;
  try {
    const html = await fetchText(url);
    const result = {};
    // 테이블에서 출주번호별 S1F, G3F 추출
    const rowReg = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let row;
    while ((row = rowReg.exec(html)) !== null) {
      const cells = [];
      const tdReg = /<td[^>]*>([\s\S]*?)<\/td>/g;
      let td;
      while ((td = tdReg.exec(row[1])) !== null) {
        cells.push(td[1].replace(/<[^>]+>/g, '').trim());
      }
      // 출주번호가 첫 번째 셀에 있는 행 찾기
      if (cells.length >= 8 && /^\d+$/.test(cells[0])) {
        const num = cells[0];
        // 컬럼 순서: 착순, 출주번호, 마명, GF, S1F, G3F, ... (페이지마다 다를 수 있음)
        result[num] = { s1f: cells[4] || '', g3f: cells[5] || '' };
      }
    }
    return result;
  } catch(e) {
    return {};
  }
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
  const base = `serviceKey=${KRA_KEY}&pageNo=1&numOfRows=20&rc_date=${date}&rc_no=${no}&meet=${meetCode}`;

  try {
    const [resultXml, sectorTimes] = await Promise.all([
      fetchText(`https://apis.data.go.kr/B551015/racedetailresult/getracedetailresult?${base}`),
      fetchSectorTimes(date, no, meetCode),
    ]);

    const horses = parseXML(resultXml);

    if (horses.length === 0) {
      res.status(404).json({
        error: '데이터 없음 — 출마표 미공개이거나 잘못된 날짜/경주번호',
        tip: '출마표는 경기 수요일부터 공개됩니다',
      });
      return;
    }

    if (req.query.debug) return res.status(200).json({ horse: horses[0], sectors: sectorTimes });

    const first = horses[0];
    res.status(200).json({
      ok: true,
      meta: {
        date, no, meet,
        dist:    (first.rcDist || '') + 'm',
        weather: first.weather || '-',
        track:   first.trackCond || '-',
      },
      horses: horses.map(h => {
        const sec = sectorTimes[h.chulNo] || {};
        return {
          num:        h.chulNo    || '',
          name:       h.hrName    || '',
          age:        h.age       || '',
          weight:     h.wgBudam   || '',
          jockeyName: h.jkName    || '',
          jockeyRate: h.jkWtRate  || h.winRate || '',
          blood:      h.faHrName  || '',
          s1f:        sec.s1f     || '',
          g3f:        sec.g3f     || '',
          gf:         h.rcTime    || '',
          form:       [h.ord1,h.ord2,h.ord3,h.ord4,h.ord5].filter(Boolean).join('-'),
          bodyWeight: h.wgHr      || '',
          rating:     h.hrRating  || '',
        };
      })
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
```
