const https = require('https');
const { parseXML, fetchText, MEET_CODE } = require('../lib/utils');
const KRA_KEY = 'bd42bcec6bd5b33efcbf21b4cb6f96c2475c082f61ac2829894cb42a1fa9a8ea';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const { date, no, meet } = req.query;
  if (!date || !no || !meet) { res.status(400).json({ error: 'date, no, meet 파라미터 필요' }); return; }
  const meetCode = MEET_CODE[meet] || meet;
  const base = `serviceKey=${KRA_KEY}&pageNo=1&numOfRows=20&rc_date=${date}&rc_no=${no}&meet=${meetCode}`;
  try {
    const xml = await fetchText(`https://apis.data.go.kr/B551015/racedetailresult/getracedetailresult?${base}`);
    const horses = parseXML(xml);
    if (horses.length === 0) { res.status(404).json({ error: '데이터 없음', tip: '출마표는 경기 수요일부터 공개됩니다' }); return; }
    if (req.query.debug) return res.status(200).json(horses[0]);
    res.status(200).json({
      ok: true,
      meta: { date, no, meet, dist: (horses[0].rcDist||'')+'m', weather: horses[0].weather||'-', track: horses[0].trackCond||'-' },
      horses: horses.map(h => ({
        num: h.chulNo||'', name: h.hrName||'', age: h.age||'',
        weight: h.wgBudam||'', jockeyName: h.jkName||'', jockeyRate: h.jkWtRate||'',
        blood: h.faHrName||'', s1f: h.s1fBtime||'', g3f: h.g3fBtime||'',
        gf: h.rcTime||'', form: [h.ord1,h.ord2,h.ord3,h.ord4,h.ord5].filter(Boolean).join('-'),
        bodyWeight: h.wgHr||'', rating: h.hrRating||'',
      }))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
};
