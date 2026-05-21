const SEJONG = {
  latitude: 36.4801,
  longitude: 127.2890,
  name: '세종시'
};

const FALLBACK_DAYS = [
  { date: getDate(0), temp: 27.8, humidity: 74, pm25: 23, rain: 0.4, code: 2 },
  { date: getDate(1), temp: 22.6, humidity: 48, pm25: 10, rain: 0, code: 1 },
  { date: getDate(2), temp: 30.4, humidity: 83, pm25: 31, rain: 8.8, code: 61 },
  { date: getDate(3), temp: 18.7, humidity: 34, pm25: 9, rain: 0, code: 0 },
  { date: getDate(4), temp: 24.9, humidity: 62, pm25: 17, rain: 2.2, code: 3 }
];

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

  const dropCount = window.innerWidth < 720 ? 56 : 96;
  const drops = Array.from({ length: dropCount }, () => {
    const isLong = Math.random() > 0.54;
    const height = isLong ? random(42, 96) : random(13, 38);
    const width = isLong ? random(1.1, 2.2) : random(0.7, 1.5);
    const duration = isLong ? random(0.72, 1.42) : random(0.96, 1.95);
    const opacity = isLong ? random(0.18, 0.42) : random(0.10, 0.30);
    const drift = random(-26, 18);
    const className = isLong ? 'rain-drop long' : 'rain-drop short';

    return `<span class="${className}" style="--x:${random(-8, 108)}vw; --y:${random(-32, 100)}vh; --h:${height}px; --w:${width}px; --d:${duration}s; --delay:${random(-2.6, 0)}s; --o:${opacity}; --drift:${drift}px;"></span>`;
  }).join('');

  rainLayer.innerHTML = drops;
}

function random(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

async function loadWeather() {
  setLoading('세종시 날씨와 대기질을 불러오는 중입니다.');

  try {
    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.search = new URLSearchParams({
      latitude: SEJONG.latitude,
      longitude: SEJONG.longitude,
      hourly: 'temperature_2m,relative_humidity_2m,precipitation,weather_code',
      timezone: 'Asia/Seoul',
      forecast_days: '5'
    });

    const airUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    airUrl.search = new URLSearchParams({
      latitude: SEJONG.latitude,
      longitude: SEJONG.longitude,
      hourly: 'pm2_5,pm10',
      timezone: 'Asia/Seoul',
      forecast_days: '5'
    });

    const [forecastResponse, airResponse] = await Promise.all([fetch(forecastUrl), fetch(airUrl)]);
    if (!forecastResponse.ok || !airResponse.ok) throw new Error('API 응답 실패');

    const forecast = await forecastResponse.json();
    const air = await airResponse.json();
    dayData = buildDailyData(forecast.hourly, air.hourly);

    if (!dayData.length) throw new Error('일별 데이터 없음');

    setStatus('실시간 데이터 연결됨');
    setLoading('세종시 기준 최신 예보를 반영했습니다.');
  } catch (error) {
    console.warn(error);
    dayData = FALLBACK_DAYS;
    setStatus('예시 데이터 사용 중');
    setLoading('API 연결이 불안정해 예시 데이터로 표시합니다. 다시 시도할 수 있습니다.');
  }

  fillDateOptions();
  renderSelectedDay();
  renderForecast();
}

function buildDailyData(weatherHourly, airHourly) {
  const dates = [...new Set(weatherHourly.time.map(item => item.slice(0, 10)))].slice(0, 5);

  return dates.map(date => {
    const weatherIndexes = weatherHourly.time
      .map((time, index) => ({ time, index }))
      .filter(item => item.time.startsWith(date) && isStudyHour(item.time));

    const airIndexes = airHourly.time
      .map((time, index) => ({ time, index }))
      .filter(item => item.time.startsWith(date) && isStudyHour(item.time));

    const temps = weatherIndexes.map(({ index }) => weatherHourly.temperature_2m[index]);
    const humidities = weatherIndexes.map(({ index }) => weatherHourly.relative_humidity_2m[index]);
    const rains = weatherIndexes.map(({ index }) => weatherHourly.precipitation[index]);
    const codes = weatherIndexes.map(({ index }) => weatherHourly.weather_code[index]);
    const pm25s = airIndexes.map(({ index }) => airHourly.pm2_5[index]);

    return {
      date,
      temp: mean(temps),
      humidity: mean(humidities),
      pm25: mean(pm25s),
      rain: sum(rains),
      code: mode(codes)
    };
  }).filter(day => Number.isFinite(day.temp) && Number.isFinite(day.humidity));
}

function isStudyHour(isoTime) {
  const hour = Number(isoTime.slice(11, 13));
  return hour >= 8 && hour <= 22;
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
  const selected = dayData.find(day => day.date === dom.dateSelect.value) || dayData[0] || FALLBACK_DAYS[0];
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
