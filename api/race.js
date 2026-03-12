const https = require('https');

const KRA_KEY = 'bd42bcec6bd5b33efcbf21b4cb6f96c2475c082f61ac2829894cb42a1fa9a8ea';

// 최신 API 엔드포인트
const ENDPOINTS = {
  result: 'https://apis.data.go.kr/B551015/API214_1/RaceDetailResult_1',
  entry:  'https://apis.data.go.kr/B551015/API212_1/RaceEntryInfo_1',
};

const MEET_CODE = { K: '1', B: '3', J: '2' };

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('파싱실패')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('타임아웃')); });
  });
}

function getItems(data) {
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
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

  // meet 코드 변환 (K→1, B→3, J→2)
  const meetCode = MEET_CODE[meet] || meet;
  const base = `serviceKey=${KRA_KEY}&pageNo=1&numOfRows=20&rc_date=${date}&rc_no=${no}&meet=${meetCode}&_type=json`;

  try {
    const [entryData, resultData] = await Promise.allSettled([
      fetchJSON(`${ENDPOINTS.entry}?${base}`),
      fetchJSON(`${ENDPOINTS.result}?${base}`),
    ]);

    const entries = entryData.status === 'fulfilled' ? getItems(entryData.value) : [];
    const results = resultData.status === 'fulfilled' ? getItems(resultData.value) : [];
    const horses  = entries.length > 0 ? entries : results;

    if (horses.length === 0) {
      // 디버그용: 실제 응답 반환
      res.status(404).json({
        error: '데이터 없음',
        entryStatus: entryData.status,
        resultStatus: resultData.status,
        entryReason: entryData.reason?.message,
        resultReason: resultData.reason?.message,
        entryResponse: entryData.value?.response?.header,
        resultResponse: resultData.value?.response?.header,
      });
      return;
    }

    const first = horses[0];
    res.status(200).json({
      ok: true,
      meta: {
        date, no, meet,
        dist: (first.rc_dist || '') + 'm',
        weather: first.weather || '-',
        track: first.track_cond || '-',
      },
      horses: horses.map(h => ({
        num:        h.chul_no || h.win_no || '',
        name:       h.hr_name  || '',
        age:        h.hr_age   || '',
        weight:     h.burden_weight || '',
        jockeyName: h.jk_name  || '',
        jockeyRate: h.jk_wt_rate || '',
        blood:      h.faHrName || '',
        s1f:        h.s1f_btime || '',
        g3f:        h.g3f_btime || '',
        gf:         h.rc_time   || '',
        form: [h.ord1,h.ord2,h.ord3,h.ord4,h.ord5].filter(Boolean).join('-'),
        bodyWeight: h.hr_weight || '',
        rating:     h.rating    || '',
      }))
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
