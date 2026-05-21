const state = {
  latitude: 37.5665,
  longitude: 126.9780,
  name: 'Seoul, South Korea'
};

const $ = (id) => document.getElementById(id);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function scoreByRange(value, idealLow, idealHigh, lowLimit, highLimit) {
  if (value === null || Number.isNaN(value)) return 80;
  if (value >= idealLow && value <= idealHigh) return 100;
  if (value < idealLow) return clamp(100 - ((idealLow - value) / (idealLow - lowLimit)) * 45, 45, 100);
  return clamp(100 - ((value - idealHigh) / (highLimit - idealHigh)) * 55, 35, 100);
}

function pm25Score(pm25) {
  if (pm25 === null || Number.isNaN(pm25)) return 80;
  if (pm25 <= 5) return 100;
  if (pm25 <= 15) return 92 - (pm25 - 5) * 2.2;
  if (pm25 <= 35) return 70 - (pm25 - 15) * 1.4;
  if (pm25 <= 75) return 42 - (pm25 - 35) * 0.55;
  return 20;
}

function rainScore(rain) {
  if (rain === null || Number.isNaN(rain)) return 85;
  if (rain <= 0.1) return 100;
  if (rain <= 3) return 86;
  if (rain <= 10) return 72;
  return 58;
}

function computeIndex(weather) {
  const temp = weather.temperature;
  const humidity = weather.humidity;
  const rain = weather.precipitation;
  const pm25 = weather.pm25;

  const tempScore = scoreByRange(temp, 18, 24, 5, 35);
  const humidityScore = scoreByRange(humidity, 40, 60, 15, 90);
  const airScore = pm25Score(pm25);
  const precipitationScore = rainScore(rain);

  const focus = clamp(tempScore * 0.34 + humidityScore * 0.18 + airScore * 0.36 + precipitationScore * 0.12);
  const memory = clamp(tempScore * 0.38 + humidityScore * 0.22 + airScore * 0.26 + precipitationScore * 0.14);
  const arousal = clamp(tempScore * 0.32 + humidityScore * 0.28 + airScore * 0.16 + precipitationScore * 0.24);
  const problemSolving = clamp(tempScore * 0.42 + airScore * 0.32 + humidityScore * 0.16 + precipitationScore * 0.10);
  const overall = Math.round((focus + memory + arousal + problemSolving) / 4);

  return {
    overall,
    metrics: [
      ['집중력', Math.round(focus), focusAdvice(focus)],
      ['암기력', Math.round(memory), memoryAdvice(memory)],
      ['각성도', Math.round(arousal), arousalAdvice(arousal)],
      ['문제해결력', Math.round(problemSolving), solvingAdvice(problemSolving)]
    ],
    subjects: [
      ['수학·탐구 심화', Math.round(problemSolving * 0.65 + focus * 0.35), '고난도 문제 풀이, 사고력 과제, 오답 원인 분석'],
      ['영어·국어 독해', Math.round(focus * 0.55 + memory * 0.25 + arousal * 0.20), '장문 독해, 문법 정리, 지문 분석'],
      ['암기 과목', Math.round(memory * 0.62 + arousal * 0.23 + focus * 0.15), '단어, 개념어, 한국사·사회·과학 암기']
    ],
    components: { tempScore, humidityScore, airScore, precipitationScore }
  };
}

function focusAdvice(score) {
  if (score >= 80) return '긴 몰입 학습에 적합합니다. 50분 집중-10분 휴식 구조를 권장합니다.';
  if (score >= 65) return '집중은 가능하지만 방해 요인을 줄여야 합니다. 휴대폰 차단이 필수입니다.';
  return '긴 공부보다 짧은 단위의 복습, 노트 정리, 쉬운 문제 풀이가 낫습니다.';
}
function memoryAdvice(score) {
  if (score >= 80) return '새 암기량을 늘려도 됩니다. 누적 복습과 신규 암기를 함께 진행하세요.';
  if (score >= 65) return '신규 암기보다 반복 회상 테스트가 효율적입니다.';
  return '암기 효율이 낮을 수 있습니다. 분량을 줄이고 여러 번 나누세요.';
}
function arousalAdvice(score) {
  if (score >= 80) return '각성 수준이 양호합니다. 오전·초반 시간대에 핵심 과제를 배치하세요.';
  if (score >= 65) return '졸림 관리가 필요합니다. 가벼운 움직임 후 시작하세요.';
  return '각성 저하 가능성이 큽니다. 낮잠, 환기, 밝은 조명을 먼저 확보하세요.';
}
function solvingAdvice(score) {
  if (score >= 80) return '고난도 사고 과제에 적합합니다. 수학·과학 심화 문제를 우선하세요.';
  if (score >= 65) return '표준 난도 문제 풀이에 적합합니다. 킬러 문항은 무리하지 마세요.';
  return '새로운 고난도 문제보다 해설 복기와 개념 재정리가 현실적입니다.';
}

function mainAdvice(score) {
  if (score >= 82) return '오늘은 학습 조건이 좋습니다. 가장 어려운 과목을 먼저 배치하세요.';
  if (score >= 68) return '보통 수준입니다. 목표량은 유지하되 휴식 간격을 짧게 잡으세요.';
  if (score >= 52) return '학습 조건이 불리합니다. 신규 진도보다 복습·오답 정리를 우선하세요.';
  return '무리한 장시간 학습은 비효율적입니다. 환경 개선 후 최소 핵심 과제만 처리하세요.';
}

async function geocode(place) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=ko&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('지역 검색에 실패했습니다.');
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new Error('지역을 찾지 못했습니다. 영문 도시명도 시도해보세요.');
  const r = data.results[0];
  return { latitude: r.latitude, longitude: r.longitude, name: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}${r.country ? ', ' + r.country : ''}` };
}

async function fetchWeather(lat, lon) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=auto`;
  const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,carbon_monoxide,nitrogen_dioxide&timezone=auto`;
  const [weatherRes, airRes] = await Promise.all([fetch(weatherUrl), fetch(airUrl)]);
  if (!weatherRes.ok) throw new Error('날씨 데이터를 불러오지 못했습니다.');
  const weatherData = await weatherRes.json();
  let airData = null;
  if (airRes.ok) airData = await airRes.json();
  return {
    temperature: weatherData.current?.temperature_2m ?? null,
    humidity: weatherData.current?.relative_humidity_2m ?? null,
    precipitation: weatherData.current?.precipitation ?? null,
    weatherCode: weatherData.current?.weather_code ?? null,
    pm25: airData?.current?.pm2_5 ?? null,
    pm10: airData?.current?.pm10 ?? null,
    no2: airData?.current?.nitrogen_dioxide ?? null,
    co: airData?.current?.carbon_monoxide ?? null,
    time: weatherData.current?.time ?? null
  };
}

function render(weather) {
  const result = computeIndex(weather);
  $('locationTitle').textContent = `${state.name} 학습 종합 지수`;
  $('weatherSummary').textContent = `${weather.temperature ?? '--'}℃ · 습도 ${weather.humidity ?? '--'}% · 강수 ${weather.precipitation ?? '--'}mm · PM2.5 ${weather.pm25 ?? '--'}㎍/㎥`;
  $('overallScore').textContent = result.overall;
  document.querySelector('.gauge').style.background = `conic-gradient(var(--accent) ${result.overall * 3.6}deg, #e8ecf6 0deg)`;
  $('mainAdvice').textContent = mainAdvice(result.overall);

  $('metricCards').innerHTML = result.metrics.map(([title, score, text]) => cardHtml(title, score, text)).join('');
  $('subjectCards').innerHTML = result.subjects.map(([title, score, text]) => cardHtml(title, score, text, 'subject-card')).join('');
  $('dataTable').innerHTML = [
    ['기온', `${weather.temperature ?? '자료 없음'}℃`, `기온 점수 ${Math.round(result.components.tempScore)}`],
    ['습도', `${weather.humidity ?? '자료 없음'}%`, `습도 점수 ${Math.round(result.components.humidityScore)}`],
    ['강수량', `${weather.precipitation ?? '자료 없음'}mm`, `강수 점수 ${Math.round(result.components.precipitationScore)}`],
    ['PM2.5', `${weather.pm25 ?? '자료 없음'}㎍/㎥`, `대기질 점수 ${Math.round(result.components.airScore)}`]
  ].map(([a,b,c]) => `<div class="data-item"><strong>${a}</strong><span>${b}</span><br><small>${c}</small></div>`).join('');
}

function cardHtml(title, score, text, klass = 'metric-card') {
  return `<div class="${klass}">
    <div class="card-top"><span class="card-title">${title}</span><span class="score">${score}</span></div>
    <div class="bar"><span style="width:${score}%"></span></div>
    <p class="card-text">${text}</p>
  </div>`;
}

async function load() {
  try {
    $('status').textContent = '데이터를 불러오는 중입니다.';
    const weather = await fetchWeather(state.latitude, state.longitude);
    render(weather);
    $('status').textContent = `최신 데이터 기준: ${weather.time ?? '시간 정보 없음'}`;
  } catch (err) {
    $('status').textContent = err.message;
  }
}

$('searchBtn').addEventListener('click', async () => {
  try {
    const place = $('placeInput').value.trim();
    if (!place) throw new Error('지역명을 입력하세요.');
    $('status').textContent = '지역을 검색하는 중입니다.';
    Object.assign(state, await geocode(place));
    await load();
  } catch (err) {
    $('status').textContent = err.message;
  }
});

$('geoBtn').addEventListener('click', () => {
  if (!navigator.geolocation) {
    $('status').textContent = '이 브라우저는 위치 기능을 지원하지 않습니다.';
    return;
  }
  $('status').textContent = '현재 위치 권한을 확인하는 중입니다.';
  navigator.geolocation.getCurrentPosition(async (pos) => {
    state.latitude = pos.coords.latitude;
    state.longitude = pos.coords.longitude;
    state.name = '현재 위치';
    await load();
  }, () => {
    $('status').textContent = '위치 권한이 거부되었습니다. 지역명을 입력하세요.';
  });
});

load();
