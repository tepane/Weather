const SEJONG = {
  name: '세종시',
  nx: 66,
  ny: 103,
  airStation: '아름동'
};

/*
  API 키 입력 위치
  1) KMA_SERVICE_KEY: 공공데이터포털 > 기상청_단기예보 조회서비스 > 일반 인증키(Decoding)
  2) AIRKOREA_SERVICE_KEY: 공공데이터포털 > 한국환경공단_에어코리아_대기오염정보 > 일반 인증키(Decoding)

  주의: Encoding 키를 넣어도 되도록 처리했지만, 오류 가능성을 줄이려면 Decoding 키를 넣는 편이 낫습니다.
*/
const API_KEYS = {
  KMA_SERVICE_KEY: 'dc2a0a367d6c76fbef005c4493c1d22b4ffbb9440d625f084104db553493f213',
  AIRKOREA_SERVICE_KEY: 'dc2a0a367d6c76fbef005c4493c1d22b4ffbb9440d625f084104db553493f213'
};

const API_ENDPOINTS = {
  KMA_VILAGE_FORECAST: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst',
  KMA_ULTRA_NOWCAST: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst',
  AIRKOREA_REALTIME: 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty'
};


const dom = {
  updatedStatus: document.querySelector('#updatedStatus'),
  dateSelect: document.querySelector('#dateSelect'),
  refreshBtn: document.querySelector('#refreshBtn'),
  methodBtn: document.querySelector('#methodBtn'),
  methodPanel: document.querySelector('#methodPanel'),
  loadMessage: document.querySelector('#loadMessage'),
  totalScore: document.querySelector('#totalScore'),
  gradeChip: document.querySelector('#gradeChip'),
  mainSummary: document.querySelector('#mainSummary'),
  summaryDetail: document.querySelector('#summaryDetail'),
  weatherIcon: document.querySelector('#weatherIcon'),
  tempValue: document.querySelector('#tempValue'),
  humidityValue: document.querySelector('#humidityValue'),
  pm25Value: document.querySelector('#pm25Value'),
  rainValue: document.querySelector('#rainValue'),
  tempHint: document.querySelector('#tempHint'),
  humidityHint: document.querySelector('#humidityHint'),
  airHint: document.querySelector('#airHint'),
  rainHint: document.querySelector('#rainHint'),
  dominantTitle: document.querySelector('#dominantTitle'),
  dominantText: document.querySelector('#dominantText'),
  insightList: document.querySelector('#insightList'),
  subjectGrid: document.querySelector('#subjectGrid'),
  forecastGrid: document.querySelector('#forecastGrid')
};

let dayData = [];

init();

function init() {
  createRainDrops();
  dom.refreshBtn.addEventListener('click', loadWeather);
  dom.dateSelect.addEventListener('change', () => renderSelectedDay());
  dom.methodBtn.addEventListener('click', () => {
    dom.methodPanel.classList.toggle('is-open');
    dom.methodBtn.textContent = dom.methodPanel.classList.contains('is-open') ? '계산식 닫기' : '계산식 보기';
  });
  loadWeather();
}

function createRainDrops() {
  const rainLayer = document.querySelector('.rain-layer');
  if (!rainLayer) return;

  const dropCount = window.innerWidth < 720 ? 78 : 132;
  const drops = Array.from({ length: dropCount }, () => {
    const isLong = Math.random() > 0.54;
    const height = isLong ? random(56, 132) : random(18, 50);
    const width = isLong ? random(1.3, 2.7) : random(0.85, 1.75);
    const duration = isLong ? random(0.66, 1.28) : random(0.9, 1.75);
    const opacity = isLong ? random(0.38, 0.78) : random(0.24, 0.54);
    const drift = random(-32, 22);
    const className = isLong ? 'rain-drop long' : 'rain-drop short';

    return `<span class="${className}" style="--x:${random(-8, 108)}vw; --y:${random(-32, 100)}vh; --h:${height}px; --w:${width}px; --d:${duration}s; --delay:${random(-2.6, 0)}s; --o:${opacity}; --drift:${drift}px;"></span>`;
  }).join('');

  rainLayer.innerHTML = drops;
}

function random(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

async function loadWeather() {
  setLoading('기상청 날씨와 환경공단 대기질을 불러오는 중입니다.');

  try {
    assertApiKeysReady();

    const [forecastItems, nowcastItems] = await Promise.all([
      fetchKmaVilageForecast(),
      fetchKmaUltraNowcast().catch(error => {
        console.warn('초단기실황 호출 실패:', error);
        return [];
      })
    ]);

    let airQuality = { pm25: NaN, pm10: NaN, measuredAt: '' };
    try {
      airQuality = await fetchAirKoreaRealtime();
    } catch (error) {
      console.warn('환경공단 대기질 호출 실패:', error);
      setLoading('기상청 데이터는 연결됐지만, 대기질 값은 받아오지 못했습니다. PM2.5는 보수적으로 반영합니다.');
    }

    dayData = buildDailyDataFromKma(forecastItems, nowcastItems, airQuality.pm25);
    if (!dayData.length) throw new Error('기상청 응답에서 표시 가능한 일별 데이터를 만들지 못했습니다.');

    setStatus('실제 데이터 연결됨');
    const airText = Number.isFinite(airQuality.pm25) ? ` · ${SEJONG.airStation} PM2.5 ${airQuality.pm25}` : ' · 대기질 미수신';
    setLoading(`세종시 기상청 예보와 환경공단 대기질을 반영했습니다${airText}.`);
  } catch (error) {
    console.error(error);
    dayData = [];
    setStatus('데이터 연결 실패');
    setLoading(createErrorMessage(error));
    renderConnectionError();
    return;
  }

  fillDateOptions();
  renderSelectedDay();
  renderForecast();
}

function createErrorMessage(error) {
  const message = error?.message || String(error);
  if (message.includes('API 키')) return 'app.js 상단 API_KEYS에 일반 인증키 Decoding 값을 넣어야 합니다.';
  if (message.includes('SERVICE_KEY') || message.includes('인증')) return '인증키가 승인됐어도 서비스별 키가 다르거나 Encoding/Decoding 처리가 꼬이면 실패합니다. Decoding 키를 다시 넣어보세요.';
  if (message.includes('NO_DATA') || message.includes('03')) return '기상청 발표 직후라 데이터가 아직 없을 수 있습니다. 잠시 뒤 다시 불러오세요.';
  return `실제 데이터를 불러오지 못했습니다: ${message}`;
}

function renderConnectionError() {
  dom.dateSelect.innerHTML = '<option>데이터 없음</option>';
  dom.totalScore.textContent = '--점';
  updateScoreColor(0);
  dom.gradeChip.textContent = '연결 실패';
  dom.mainSummary.textContent = '실제 기상 데이터가 연결되지 않았습니다.';
  dom.summaryDetail.textContent = '실제 공공데이터를 불러오지 못했습니다. API 키, 브라우저 콘솔 오류, 공공데이터 응답 메시지를 확인하세요.';
  dom.weatherIcon.textContent = '—';
  dom.tempValue.textContent = '--℃';
  dom.humidityValue.textContent = '--%';
  dom.pm25Value.textContent = '--';
  dom.rainValue.textContent = '--mm';
  dom.tempHint.textContent = '기상청 기온 데이터 없음';
  dom.humidityHint.textContent = '기상청 습도 데이터 없음';
  dom.airHint.textContent = '환경공단 PM2.5 데이터 없음';
  dom.rainHint.textContent = '기상청 강수 데이터 없음';
  dom.dominantTitle.textContent = '데이터 없음';
  dom.dominantText.textContent = '실제 API 응답을 받은 뒤 계산합니다.';
  dom.insightList.innerHTML = '';
  dom.subjectGrid.innerHTML = '';
  dom.forecastGrid.innerHTML = '';
}

function assertApiKeysReady() {
  const missingKma = !API_KEYS.KMA_SERVICE_KEY || API_KEYS.KMA_SERVICE_KEY.includes('여기에_');
  const missingAir = !API_KEYS.AIRKOREA_SERVICE_KEY || API_KEYS.AIRKOREA_SERVICE_KEY.includes('여기에_');
  if (missingKma || missingAir) {
    throw new Error('API 키를 app.js의 API_KEYS에 입력해야 합니다.');
  }
}

async function fetchKmaVilageForecast() {
  const candidates = getKmaVilageBaseCandidates();
  let lastError = null;

  for (const base of candidates) {
    try {
      const url = buildPublicDataUrl(API_ENDPOINTS.KMA_VILAGE_FORECAST, API_KEYS.KMA_SERVICE_KEY, {
        pageNo: '1',
        numOfRows: '1000',
        dataType: 'JSON',
        base_date: base.date,
        base_time: base.time,
        nx: String(SEJONG.nx),
        ny: String(SEJONG.ny)
      });

      const json = await fetchJson(url);
      const items = readPublicDataItems(json, `기상청 단기예보 ${base.date} ${base.time}`);
      if (items.length) return items;
    } catch (error) {
      lastError = error;
      console.warn('단기예보 기준시각 재시도:', base, error);
    }
  }

  throw lastError || new Error('기상청 단기예보 데이터 없음');
}

async function fetchKmaUltraNowcast() {
  const base = getKmaUltraBaseDateTime();
  const url = buildPublicDataUrl(API_ENDPOINTS.KMA_ULTRA_NOWCAST, API_KEYS.KMA_SERVICE_KEY, {
    pageNo: '1',
    numOfRows: '100',
    dataType: 'JSON',
    base_date: base.date,
    base_time: base.time,
    nx: String(SEJONG.nx),
    ny: String(SEJONG.ny)
  });

  const json = await fetchJson(url);
  return readPublicDataItems(json, '기상청 초단기실황');
}

async function fetchAirKoreaRealtime() {
  const url = buildPublicDataUrl(API_ENDPOINTS.AIRKOREA_REALTIME, API_KEYS.AIRKOREA_SERVICE_KEY, {
    returnType: 'json',
    numOfRows: '100',
    pageNo: '1',
    stationName: SEJONG.airStation,
    dataTerm: 'DAILY',
    ver: '1.0'
  });

  const json = await fetchJson(url);
  const items = readPublicDataItems(json, '환경공단 대기질');
  const latest = items.find(item => isFiniteNumberLike(item.pm25Value) || isFiniteNumberLike(item.pm10Value));
  if (!latest) throw new Error('PM2.5 데이터 없음');

  return {
    pm25: toNumber(latest.pm25Value),
    pm10: toNumber(latest.pm10Value),
    measuredAt: latest.dataTime
  };
}

function buildPublicDataUrl(endpoint, serviceKey, params) {
  const key = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey);
  const search = new URLSearchParams(params).toString();
  return `${endpoint}?serviceKey=${key}&${search}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`API 응답 실패: ${response.status}`);

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(clean || 'JSON이 아닌 응답을 받았습니다.');
  }
}

function readPublicDataItems(json, label) {
  const header = json?.response?.header;
  if (!header) throw new Error(`${label} 응답 형식 오류`);

  const resultCode = String(header?.resultCode ?? '');
  if (resultCode && resultCode !== '00') {
    throw new Error(`${label} 오류 ${resultCode}: ${header?.resultMsg || '응답 실패'}`);
  }

  const items = json?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function buildDailyDataFromKma(forecastItems, nowcastItems, pm25) {
  const rows = new Map();

  forecastItems.forEach(item => {
    const date = normalizeKmaDate(item.fcstDate);
    const time = item.fcstTime;
    const hour = Number(time?.slice(0, 2));
    if (!date || !Number.isFinite(hour) || hour < 8 || hour > 22) return;

    const key = `${date}-${time}`;
    if (!rows.has(key)) rows.set(key, { date, time });
    const row = rows.get(key);

    if (item.category === 'TMP') row.temp = toNumber(item.fcstValue);
    if (item.category === 'REH') row.humidity = toNumber(item.fcstValue);
    if (item.category === 'PCP') row.rain = parseKmaRain(item.fcstValue);
    if (item.category === 'SKY') row.sky = toNumber(item.fcstValue);
    if (item.category === 'PTY') row.pty = toNumber(item.fcstValue);
  });

  const today = getKoreanDateString(new Date());
  const current = parseNowcast(nowcastItems);
  if (current) {
    const nowKey = `${today}-현재`;
    rows.set(nowKey, {
      date: today,
      time: '현재',
      temp: current.temp,
      humidity: current.humidity,
      rain: current.rain,
      pty: current.pty,
      sky: current.pty > 0 ? 4 : 1
    });
  }

  const dates = [...new Set([...rows.values()].map(row => row.date))].sort().slice(0, 5);

  return dates.map(date => {
    const dayRows = [...rows.values()].filter(row => row.date === date);
    const temps = dayRows.map(row => row.temp).filter(Number.isFinite);
    const humidities = dayRows.map(row => row.humidity).filter(Number.isFinite);
    const rains = dayRows.map(row => row.rain).filter(Number.isFinite);
    const codes = dayRows.map(row => kmaWeatherCode(row.sky, row.pty)).filter(Number.isFinite);

    return {
      date,
      temp: mean(temps),
      humidity: mean(humidities),
      pm25,
      rain: sum(rains),
      code: mode(codes)
    };
  }).filter(day => Number.isFinite(day.temp) && Number.isFinite(day.humidity));
}

function parseNowcast(items) {
  if (!items.length) return null;
  const current = {};
  items.forEach(item => {
    if (item.category === 'T1H') current.temp = toNumber(item.obsrValue);
    if (item.category === 'REH') current.humidity = toNumber(item.obsrValue);
    if (item.category === 'RN1') current.rain = parseKmaRain(item.obsrValue);
    if (item.category === 'PTY') current.pty = toNumber(item.obsrValue);
  });

  if (!Number.isFinite(current.temp) && !Number.isFinite(current.humidity)) return null;
  return {
    temp: current.temp,
    humidity: current.humidity,
    rain: Number.isFinite(current.rain) ? current.rain : 0,
    pty: Number.isFinite(current.pty) ? current.pty : 0
  };
}

function kmaWeatherCode(sky, pty) {
  if (Number(pty) > 0) return 61;
  if (Number(sky) === 1) return 0;
  if (Number(sky) === 3) return 2;
  if (Number(sky) === 4) return 3;
  return 2;
}

function parseKmaRain(value) {
  if (value === null || value === undefined) return 0;
  const text = String(value).trim();
  if (!text || text === '강수없음' || text === '없음') return 0;
  if (text.includes('1mm 미만')) return 0.5;
  if (text.includes('30.0~50.0mm')) return 40;
  if (text.includes('50.0mm 이상')) return 50;

  const range = text.match(/([0-9.]+)\s*~\s*([0-9.]+)/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;

  const number = text.match(/[0-9.]+/);
  return number ? Number(number[0]) : 0;
}

function getKmaVilageBaseCandidates() {
  const korea = getKoreaDate();
  korea.setMinutes(korea.getMinutes() - 90);

  const baseTimes = ['0200', '0500', '0800', '1100', '1400', '1700', '2000', '2300'];
  const candidates = [];

  for (let dayOffset = 0; dayOffset >= -1; dayOffset -= 1) {
    const date = new Date(korea);
    date.setDate(date.getDate() + dayOffset);
    const current = dayOffset === 0 ? korea.getHours() * 100 + korea.getMinutes() : 2400;
    baseTimes
      .filter(time => Number(time) <= current)
      .reverse()
      .forEach(time => candidates.push({ date: formatKmaDate(date), time }));
  }

  return candidates.slice(0, 5);
}

function getKmaUltraBaseDateTime() {
  const korea = getKoreaDate();
  korea.setMinutes(korea.getMinutes() - 50);
  return {
    date: formatKmaDate(korea),
    time: `${String(korea.getHours()).padStart(2, '0')}00`
  };
}

function getKoreaDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function normalizeKmaDate(value) {
  const text = String(value || '');
  if (!/^\d{8}$/.test(text)) return '';
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function formatKmaDate(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function getKoreanDateString(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function isFiniteNumberLike(value) {
  return Number.isFinite(toNumber(value));
}

function toNumber(value) {
  if (value === null || value === undefined) return NaN;
  const number = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : NaN;
}

function evaluateDay(day) {
  const penalties = {
    temp: temperaturePenalty(day.temp),
    air: airPenalty(day.pm25),
    humidity: humidityPenalty(day.humidity, day.temp),
    rain: rainPenalty(day.rain)
  };

  const stressCount = Object.values(penalties).filter(value => value >= 14).length;
  const severeCount = Object.values(penalties).filter(value => value >= 26).length;
  const complexPenalty = stressCount * 4 + severeCount * 8;
  const rawScore = 100 - penalties.temp - penalties.air - penalties.humidity - penalties.rain - complexPenalty;
  const score = Math.round(clamp(rawScore, 0, 100));

  return {
    score,
    penalties,
    complexPenalty,
    grade: getGrade(score),
    dominant: getDominant(penalties)
  };
}

function temperaturePenalty(temp) {
  let penalty = 0;
  if (temp < 18) {
    const diff = 18 - temp;
    penalty = diff * 1.9 + diff * diff * 0.42;
  } else if (temp > 24) {
    const diff = temp - 24;
    penalty = diff * 2.25 + diff * diff * 0.46;
  }
  return clamp(penalty, 0, 42);
}

function airPenalty(pm25) {
  if (!Number.isFinite(pm25)) return 10;
  let penalty = 0;
  if (pm25 <= 8) penalty = 0;
  else if (pm25 <= 15) penalty = (pm25 - 8) * 0.75;
  else if (pm25 <= 35) penalty = 5.25 + (pm25 - 15) * 1.0;
  else penalty = 25.25 + (pm25 - 35) * 0.68;
  return clamp(penalty, 0, 42);
}

function humidityPenalty(humidity, temp) {
  let penalty = 0;
  if (humidity < 40) {
    const diff = 40 - humidity;
    penalty = diff * 0.9 + diff * diff * 0.045;
  } else if (humidity > 60) {
    const diff = humidity - 60;
    penalty = diff * 0.95 + diff * diff * 0.052;
  }
  if (humidity > 70 && temp > 26) penalty += 6;
  if (humidity > 80 && temp > 28) penalty += 8;
  return clamp(penalty, 0, 34);
}

function rainPenalty(rain) {
  let penalty = 0;
  if (rain <= 0.2) penalty = 0;
  else if (rain <= 2) penalty = rain * 1.4;
  else if (rain <= 10) penalty = 2.8 + (rain - 2) * 1.05;
  else penalty = 11.2 + (rain - 10) * 0.62;
  return clamp(penalty, 0, 24);
}

function getGrade(score) {
  if (score >= 90) return '매우 좋음';
  if (score >= 82) return '좋음';
  if (score >= 74) return '보통 이상';
  if (score >= 64) return '주의';
  return '불리함';
}

function getDominant(penalties) {
  const labels = {
    temp: ['온도', '기온 조건이 오늘의 학습 효율을 가장 크게 흔듭니다. 난방·냉방이 가능한 장소를 우선하세요.'],
    air: ['대기질', 'PM2.5가 핵심 약점입니다. 환기보다 공기청정이 유리할 수 있습니다.'],
    humidity: ['습도', '습도 조건이 체감 피로와 산만도를 키웁니다. 실내 습도 조절이 필요합니다.'],
    rain: ['강수', '비가 생활 리듬과 이동 피로를 흔듭니다. 무리한 외부 이동을 줄이세요.']
  };
  const key = Object.entries(penalties).sort((a, b) => b[1] - a[1])[0][0];
  return { key, title: labels[key][0], text: labels[key][1] };
}

function renderSelectedDay() {
  const selected = dayData.find(day => day.date === dom.dateSelect.value) || dayData[0];
  if (!selected) {
    renderConnectionError();
    return;
  }
  const result = evaluateDay(selected);

  dom.totalScore.textContent = `${result.score}점`;
  updateScoreColor(result.score);
  dom.gradeChip.textContent = result.grade;
  dom.mainSummary.textContent = createHeadline(result, selected);
  dom.summaryDetail.textContent = createSummary(result, selected);
  dom.weatherIcon.textContent = weatherEmoji(selected.code, selected.rain);
  updateAtmosphere(selected);

  dom.tempValue.textContent = `${formatOne(selected.temp)}℃`;
  dom.humidityValue.textContent = `${Math.round(selected.humidity)}%`;
  dom.pm25Value.textContent = `${formatOne(selected.pm25)}`;
  dom.rainValue.textContent = `${formatOne(selected.rain)}mm`;

  dom.tempHint.textContent = getTempHint(selected.temp);
  dom.humidityHint.textContent = getHumidityHint(selected.humidity, selected.temp);
  dom.airHint.textContent = getAirHint(selected.pm25);
  dom.rainHint.textContent = getRainHint(selected.rain);

  dom.dominantTitle.textContent = result.dominant.title;
  dom.dominantText.textContent = result.dominant.text;

  renderInsights(selected, result);
  renderSubjects(selected, result);
}


function updateAtmosphere(day) {
  const isNight = getSceneHour(day.date) >= 19 || getSceneHour(day.date) < 6;
  const weatherClass = getWeatherClass(day);
  document.body.classList.remove('scene-day', 'scene-night', 'weather-clear', 'weather-cloudy', 'weather-rain', 'weather-fog');
  document.body.classList.add(isNight ? 'scene-night' : 'scene-day', weatherClass);
}

function getSceneHour(dateString) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  if (dateString === today) {
    return Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      hour12: false
    }).format(new Date()));
  }

  return 13;
}

function getWeatherClass(day) {
  if (day.rain > 0.8 || day.code >= 60) return 'weather-rain';
  if (day.code >= 45 && day.code < 60) return 'weather-fog';
  if (day.code >= 1 && day.code <= 3) return 'weather-cloudy';
  return 'weather-clear';
}

function updateScoreColor(score) {
  const color = score >= 85 ? '#17875b' : score >= 74 ? '#1e72dc' : score >= 64 ? '#c87910' : '#c9403b';
  dom.totalScore.style.setProperty('--score-color', color);
}

function createHeadline(result, day) {
  if (result.score >= 90) return '드문 고득점 조건입니다. 어려운 과목을 먼저 처리하세요.';
  if (result.score >= 82) return `${result.dominant.title}만 관리하면 학습 효율이 꽤 좋습니다.`;
  if (result.score >= 74) return `무난하지만 ${result.dominant.title} 변수가 발목을 잡습니다.`;
  if (result.score >= 64) return `${result.dominant.title} 때문에 장시간 집중은 비효율적입니다.`;
  return '오늘은 욕심내면 손해입니다. 짧고 가볍게 가야 합니다.';
}

function createSummary(result, day) {
  const strengths = findStrengths(day, result);
  const weakness = result.dominant.title;
  return `강점: ${strengths.join(', ')}. 약점: ${weakness}. 점수보다 이 차이를 보고 공부 순서를 정하는 편이 낫습니다.`;
}

function findStrengths(day, result) {
  const strengths = [];
  if (result.penalties.temp < 5) strengths.push('온도 안정');
  if (result.penalties.air < 5) strengths.push('대기질 양호');
  if (result.penalties.humidity < 5) strengths.push('습도 안정');
  if (result.penalties.rain < 2) strengths.push('강수 부담 낮음');
  return strengths.length ? strengths.slice(0, 2) : ['뚜렷한 강점 부족'];
}

function renderInsights(day, result) {
  const insights = [
    buildInsight('온도', result.penalties.temp, getTempHint(day.temp), '🌡️'),
    buildInsight('대기질', result.penalties.air, getAirHint(day.pm25), '🌫️'),
    buildInsight('습도', result.penalties.humidity, getHumidityHint(day.humidity, day.temp), '💧'),
    buildInsight('강수', result.penalties.rain, getRainHint(day.rain), '☔')
  ];

  dom.insightList.innerHTML = insights.map(item => `
    <article class="insight-card ${item.tone}">
      <i>${item.icon}</i>
      <div>
        <strong>${item.title}</strong>
        <p>${item.text}</p>
      </div>
    </article>
  `).join('');
}

function buildInsight(title, penalty, text, icon) {
  const tone = penalty < 5 ? 'good' : penalty < 12 ? 'warn' : 'bad';
  return { title, text, icon, tone };
}

function renderSubjects(day, result) {
  const p = result.penalties;
  const subjects = [
    {
      name: '수학·과학',
      score: result.score - p.temp * 0.22 - p.air * 0.28 - p.humidity * 0.14 - p.rain * 0.1,
      tag: '고난도 문제풀이',
      desc: '기온과 대기질이 좋을수록 유리합니다. 점수가 낮으면 개념 복습으로 낮추세요.'
    },
    {
      name: '영어·국어 독해',
      score: result.score - p.air * 0.24 - p.humidity * 0.20 - p.temp * 0.12,
      tag: '집중 지속',
      desc: '대기질과 습도에 민감하게 반응합니다. 흐트러지면 짧은 지문부터 처리하세요.'
    },
    {
      name: '암기 과목',
      score: result.score - p.humidity * 0.22 - p.temp * 0.12 - p.rain * 0.08,
      tag: '반복 학습',
      desc: '완벽한 집중보다 반복량이 중요합니다. 나쁜 날에도 가장 방어적인 선택입니다.'
    },
    {
      name: '오답 정리',
      score: result.score + 5 - p.air * 0.10 - p.rain * 0.10,
      tag: '안정적 선택',
      desc: '날씨가 애매할 때 효율이 비교적 안정적입니다. 새 진도보다 손실이 적습니다.'
    }
  ];

  dom.subjectGrid.innerHTML = subjects.map(subject => {
    const score = Math.round(clamp(subject.score, 0, 100));
    return `
      <article class="subject-card">
        <div class="subject-head">
          <h3>${subject.name}</h3>
          <strong>${score}</strong>
        </div>
        <p>${subject.desc}</p>
        <span>${subject.tag}</span>
      </article>
    `;
  }).join('');
}

function renderForecast() {
  dom.forecastGrid.innerHTML = dayData.map(day => {
    const result = evaluateDay(day);
    const dominant = result.dominant.title;
    return `
      <article class="day-card">
        <time>${formatDateLabel(day.date)}</time>
        <div class="day-icon">${weatherEmoji(day.code, day.rain)}</div>
        <strong>${result.score}</strong>
        <p>${getGrade(result.score)} · 약점은 ${dominant}.<br>${formatOne(day.temp)}℃ · 습도 ${Math.round(day.humidity)}% · PM2.5 ${formatOne(day.pm25)}</p>
      </article>
    `;
  }).join('');
}

function fillDateOptions() {
  dom.dateSelect.innerHTML = dayData.map(day => `<option value="${day.date}">${formatDateLabel(day.date)}</option>`).join('');
}

function getTempHint(temp) {
  if (temp < 15) return '낮은 기온입니다. 손·몸이 굳어 긴 문제풀이에 불리합니다.';
  if (temp < 18) return '조금 쌀쌀합니다. 암기보다 짧은 문제풀이가 낫습니다.';
  if (temp <= 24) return '온도 조건은 안정적입니다. 고난도 학습을 넣어도 됩니다.';
  if (temp <= 28) return '조금 덥습니다. 긴 집중 과제는 쉬는 시간을 짧게 나누세요.';
  return '고온 조건입니다. 장시간 수학·과학 문제풀이는 효율이 떨어질 수 있습니다.';
}

function getHumidityHint(humidity, temp) {
  if (humidity < 35) return '건조합니다. 눈 피로와 산만도가 올라갈 수 있습니다.';
  if (humidity < 40) return '약간 건조합니다. 물과 휴식 주기를 챙기세요.';
  if (humidity <= 60) return '습도는 안정적입니다. 집중 유지에 유리합니다.';
  if (humidity <= 70) return '습도가 조금 높습니다. 체감 피로가 빨리 올 수 있습니다.';
  if (humidity > 80 && temp > 28) return '고온다습입니다. 오늘의 핵심 위험 조건입니다.';
  return '습도가 높습니다. 졸림과 답답함을 관리해야 합니다.';
}

function getAirHint(pm25) {
  if (!Number.isFinite(pm25)) return '대기질 값이 없어 보수적으로 감점했습니다.';
  if (pm25 <= 10) return '대기질은 좋습니다. 집중 학습에 큰 방해가 없습니다.';
  if (pm25 <= 15) return '대기질은 무난합니다. 민감한 사람은 실내 공기를 확인하세요.';
  if (pm25 <= 35) return 'PM2.5가 부담됩니다. 환기보다 공기청정이 나을 수 있습니다.';
  return '대기질이 나쁩니다. 고난도 학습 점수를 크게 낮췄습니다.';
}

function getRainHint(rain) {
  if (rain <= 0.2) return '강수 부담은 거의 없습니다.';
  if (rain <= 2) return '약한 비입니다. 이동 스트레스만 조금 반영했습니다.';
  if (rain <= 10) return '비가 꽤 옵니다. 생활 리듬이 흔들릴 수 있습니다.';
  return '강수량이 큽니다. 이동 피로와 컨디션 변동성이 큽니다.';
}

function weatherEmoji(code, rain) {
  if (rain > 5) return '🌧️';
  if (code === 0) return '☀️';
  if (code >= 1 && code <= 3) return '⛅';
  if (code >= 45 && code < 60) return '🌫️';
  if (code >= 60) return '🌧️';
  return '⛅';
}

function setLoading(message) {
  dom.loadMessage.textContent = message;
}

function setStatus(message) {
  dom.updatedStatus.innerHTML = `<span></span>${message}`;
}

function getDate(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
}

function mean(values) {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return NaN;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function sum(values) {
  return values.filter(Number.isFinite).reduce((total, value) => total + value, 0);
}

function mode(values) {
  const counts = new Map();
  values.filter(Number.isFinite).forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatOne(value) {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toFixed(1);
}
