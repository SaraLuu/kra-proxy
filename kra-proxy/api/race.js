const https = require('https');

const KRA_KEY = 'bd42bcec6bd5b33efcbf21b4cb6f96c2475c082f61ac2829894cb42a1fa9a8ea';

const ENDPOINTS = {
  entry:  'https://apis.data.go.kr/B551015/API212_1/RaceEntryInfo_1',
  result: 'https://apis.data.go.kr/B551015/API214_1/RaceDetailResult_1',
  odds:   'https://apis.data.go.kr/B551015/API216/oddsWeather_1',
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('파싱실패: ' + data.slice(0,100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('타임아웃')); });
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

  const base = `serviceKey=${KRA_KEY}&pageNo=1&numOfRows=20&rc_date=${date}&rc_no=${no}&meet=${meet}&_type=json`;

  try {
    const [entryData, resultData, oddsData] = await Promise.allSettled([
      fetchJSON(`${ENDPOINTS.entry}?${base}`),
      fetchJSON(`${ENDPOINTS.result}?${base}`),
      fetchJSON(`${ENDPOINTS.odds}?${base}`),
    ]);

    const entries = entryData.status === 'fulfilled' ? getItems(entryData.value) : [];
    const results = resultData.status === 'fulfilled' ? getItems(resultData.value) : [];
    const odds    = oddsData.status === 'fulfilled'   ? getItems(oddsData.value)   : [];

    const horses = entries.length > 0 ? entries : results;

    if (horses.length === 0) {
      res.status(404).json({
        error: '데이터 없음 — 출마표 미공개이거나 잘못된 날짜/경주번호',
        tip: '출마표는 경기 수요일부터 공개됩니다'
      });
      return;
    }

    const meta = {
      date, no, meet,
      dist:    (entries[0]?.rc_dist || results[0]?.rc_dist || '') + 'm',
      weather: odds[0]?.weather    || results[0]?.weather    || '-',
      track:   odds[0]?.track_cond || results[0]?.track_cond || '-',
    };

    const horseList = horses.map(h => ({
      num:        h.chul_no   || h.win_no       || '',
      name:       h.hr_name                     || '',
      age:        h.hr_age                      || '',
      weight:     h.burden_weight               || '',
      jockeyName: h.jk_name                     || '',
      jockeyRate: h.jk_wt_rate                  || '',
      blood:      h.faHrName                    || '',
      s1f:        h.s1f_btime                   || '',
      g3f:        h.g3f_btime                   || '',
      gf:         h.rc_time                     || '',
      form:       [h.ord1,h.ord2,h.ord3,h.ord4,h.ord5].filter(Boolean).join('-'),
      bodyWeight: h.hr_weight                   || '',
      rating:     h.rating                      || '',
    }));

    res.status(200).json({ ok: true, meta, horses: horseList });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
