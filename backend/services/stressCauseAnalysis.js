// 스트레스 원인 분석. DB 없이 계산만 한다.
// 하루 요약(상황·분류·임베딩)과 그날 건강 수치를 모아,
// "이 상황이 있던 날"이 "다른 날"보다 스트레스가 확실히 높으면 원인으로 결론 낸다.
// 결론은 숫자로만 내고, 문장은 정해진 틀로 만든다(AI가 지어내지 않게).

// 같은 상황이 이만큼 이상(서로 다른 날) 있어야 판단한다.
const MIN_DAYS = 3;
// 비교할 다른 날(스트레스 점수 있는 날)이 이만큼은 있어야 한다.
const MIN_BASELINE_DAYS = 2;
// 평소보다 이만큼 이상 높아야 원인으로 본다(100점 만점 하루 스트레스).
const MIN_DIFF = 10;
// 요약끼리 임베딩 거리가 이보다 가까우면 같은 상황으로 묶는다(코사인 거리).
const SAME_SITUATION_DISTANCE = 0.45;
// 수면 차이를 문장에 넣는 최소 차이(시간)
const MIN_SLEEP_DIFF_HOURS = 0.5;

const round1 = value => Math.round(value * 10) / 10;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;

function cosineDistance(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (!normA || !normB) return 1;
  return 1 - dot / Math.sqrt(normA * normB);
}

// 하루 스트레스 계산 결과(stressCalculator) → 요약에 붙여 둘 건강 수치
function healthSnapshot(daily) {
  if (!daily) return null;
  const hourlyHeart = (daily.timeline ?? []).map(hour => hour.avgHeartRate).filter(Number.isFinite);
  const snapshot = {
    stress_score: daily.finalDailyStressScore ?? null,
    sleep_hours: Number.isFinite(daily.sleep?.minutes) ? round1(daily.sleep.minutes / 60) : null,
    steps: Number.isFinite(daily.steps?.total) ? daily.steps.total : null,
    avg_heart_rate: hourlyHeart.length ? round1(mean(hourlyHeart)) : null,
    avg_systolic: daily.bloodPressure?.avgSystolic ?? null,
  };
  return Object.values(snapshot).some(value => value !== null) ? snapshot : null;
}

// 같은 상황끼리 묶기: 임베딩 거리가 가까운 요약을 한 묶음으로(서로 이어지면 같은 묶음).
function clusterBySimilarity(items) {
  const parent = items.map((_, index) => index);
  const find = index => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  for (let a = 0; a < items.length; a += 1) {
    for (let b = a + 1; b < items.length; b += 1) {
      if (cosineDistance(items[a].embedding, items[b].embedding) <= SAME_SITUATION_DISTANCE) {
        parent[find(a)] = find(b);
      }
    }
  }
  const groups = new Map();
  items.forEach((item, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(item);
  });
  return [...groups.values()];
}

// 묶음 이름: 가장 많이 나온 상황 라벨
function labelOf(items) {
  const counts = new Map();
  for (const item of items) {
    if (item.situation && item.situation !== '평범한 하루') {
      counts.set(item.situation, (counts.get(item.situation) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// 한 묶음(그 상황이 있던 날들)을 다른 날과 비교한다.
function compare(label, kind, dates, health) {
  const inGroup = [...dates].filter(date => Number.isFinite(health.get(date)?.stress_score));
  const others = [...health.keys()].filter(
    date => !dates.has(date) && Number.isFinite(health.get(date)?.stress_score),
  );
  if (inGroup.length < MIN_DAYS || others.length < MIN_BASELINE_DAYS) return null;

  const stressOf = list => round1(mean(list.map(date => health.get(date).stress_score)));
  const sleepOf = list => {
    const hours = list.map(date => health.get(date).sleep_hours).filter(Number.isFinite);
    return hours.length ? round1(mean(hours)) : null;
  };
  const avgStress = stressOf(inGroup);
  const baselineStress = stressOf(others);
  return {
    label,
    kind, // 'situation'(구체 상황) | 'category'(큰 분류)
    days: inGroup.length,
    dates: inGroup.sort(),
    avgStress,
    baselineDays: others.length,
    baselineStress,
    diff: round1(avgStress - baselineStress),
    avgSleepHours: sleepOf(inGroup),
    baselineSleepHours: sleepOf(others),
  };
}

function conclusionText(cause) {
  let text =
    `'${cause.label}' 이야기가 나온 날(${cause.days}일)은 하루 스트레스가 평균 ${cause.avgStress}점으로, ` +
    `다른 날(${cause.baselineDays}일 평균 ${cause.baselineStress}점)보다 ${cause.diff}점 높았어.`;
  if (
    cause.avgSleepHours !== null &&
    cause.baselineSleepHours !== null &&
    cause.baselineSleepHours - cause.avgSleepHours >= MIN_SLEEP_DIFF_HOURS
  ) {
    text += ` 그날들은 잠도 평균 ${round1(cause.baselineSleepHours - cause.avgSleepHours)}시간 덜 잤어.`;
  }
  return `${text} 요즘은 '${cause.label}' 쪽이 스트레스 원인으로 보여.`;
}

/**
 * @param {{summaryId: number, date: string, situation?: string, keywords?: string[], embedding?: number[]}[]} entries
 *   하루 요약들 (같은 날 여러 개여도 된다)
 * @param {Map<string, {stress_score: number|null, sleep_hours: number|null}>} health 날짜별 건강 수치
 */
function analyzeStressCauses(entries, health) {
  const candidates = [];

  // 1) 구체 상황: 임베딩이 비슷한 요약끼리
  const withEmbedding = entries.filter(entry => Array.isArray(entry.embedding));
  for (const group of clusterBySimilarity(withEmbedding)) {
    const label = labelOf(group);
    if (!label) continue;
    const result = compare(label, 'situation', new Set(group.map(entry => entry.date)), health);
    if (result) candidates.push(result);
  }

  // 2) 큰 분류: 원인 키워드가 같은 날끼리 ('일상'은 원인으로 보지 않는다)
  const byCategory = new Map();
  for (const entry of entries) {
    for (const keyword of entry.keywords ?? []) {
      if (keyword === '일상') continue;
      if (!byCategory.has(keyword)) byCategory.set(keyword, new Set());
      byCategory.get(keyword).add(entry.date);
    }
  }
  for (const [keyword, dates] of byCategory) {
    const result = compare(keyword, 'category', dates, health);
    if (result) candidates.push(result);
  }

  const causes = candidates
    .filter(result => result.diff >= MIN_DIFF)
    .sort((a, b) => b.diff - a.diff || b.days - a.days)
    .map(cause => ({ ...cause, conclusion: conclusionText(cause) }));

  const scoredDays = [...health.values()].filter(day => Number.isFinite(day?.stress_score)).length;
  return {
    status: causes.length ? 'found' : 'insufficient',
    summaryDays: new Set(entries.map(entry => entry.date)).size,
    scoredDays,
    causes,
    // 원인까지는 아니지만 비교는 된 것들(기준 미달) — 화면에서 참고용
    checked: candidates.filter(result => result.diff < MIN_DIFF),
    message: causes.length
      ? causes[0].conclusion
      : `아직 원인을 판단하기엔 기록이 부족해. 같은 상황이 ${MIN_DAYS}번 이상 쌓이고 그날 스트레스 점수가 있으면 알려 줄게.`,
  };
}

module.exports = {
  MIN_DAYS,
  MIN_DIFF,
  SAME_SITUATION_DISTANCE,
  analyzeStressCauses,
  clusterBySimilarity,
  cosineDistance,
  healthSnapshot,
};
