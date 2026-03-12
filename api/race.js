const { fetchText, parseXML, MEET_CODE } = require('../lib/utils');
const KRA_KEY = 'bd42bcec6bd5b33efcbf21b4cb6f96c2475c082f61ac2829894cb42a1fa9a8ea';

async function getHorseDetail(hrNo) {
  try {
    const url = `https://apis.data.go.kr/B551015/API15_2/raceHorseResult_2?serviceKey=${KRA_KEY}&pageNo=1&numOfRows=5&hr_no=${hrNo}&_type=json`;
    const text = await fetchText(url);
    const data = JSON.parse(text);
    const items = data?.response?.body?.items?.item;
    if (!items) return { debugRaw: text.slice(0,200) };
    const list = Array.isArray(items) ? items : [items];
    const s1f = list.map(i=>i.s1fBtime||'').find(v=>v) || '';
    const g3f = list.map(i=>i.g3fBtime||'').find(v=>v) || '';
    const form = list.map(i=>i.ord||'').filter(Boolean).join('-');
    return { blood: list[0].faHrName||'', s1f, g3f, form };
  } catch(e) { return { debugErr: e.message }; }
}
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
    if (!horses.length) { res.status(404).json({ error: '데이터 없음', tip: '출마표는 경기 수요일부터 공개됩니다' }); return; }
      if (req.query.debug) {
      const d = await getHorseDetail(horses[0].hrNo);
      return res.status(200).json({ hrNo: horses[0].hrNo, detail: d });
    }
    const details = await Promise.all(horses.map(h => getHorseDetail(h.hrNo)));
    res.status(200).json({
      ok: true,
      meta: { date, no, meet, dist: (horses[0].rcDist||'')+'m', weather: horses[0].weather||'-', track: horses[0].trackCond||'-' },
      horses: horses.map((h,i) => ({
        num:        h.chulNo    || '',
        name:       h.hrName    || '',
        age:        h.age       || '',
        weight:     h.wgBudam   || '',
        jockeyName: h.jkName    || '',
        jockeyRate: h.jkWtRate  || '',
        blood:      details[i].blood || '',
        s1f:        details[i].s1f   || '',
        g3f:        details[i].g3f   || '',
        gf:         h.rcTime    || '',
        form:       details[i].form  || '',
        bodyWeight: h.wgHr      || '',
        rating:     h.hrRating  || '',
      }))
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
};
