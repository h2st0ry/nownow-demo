const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzeStressCauses,
  clusterBySimilarity,
  cosineDistance,
  healthSnapshot,
} = require('../services/stressCauseAnalysis');
const { parseDaySummary } = require('../services/chatSummaryAi');

// 방향만 다른 짧은 벡터로 "비슷한 상황"과 "다른 상황"을 흉내 낸다.
const THESIS = [1, 0, 0];
const THESIS_NEAR = [0.95, 0.1, 0];
const OTHER = [0, 1, 0];

const health = entries => new Map(entries.map(([date, stress, sleep]) => [date, { stress_score: stress, sleep_hours: sleep }]));

test('코사인 거리', () => {
  assert.equal(cosineDistance(THESIS, THESIS), 0);
  assert.equal(cosineDistance(THESIS, OTHER), 1);
  assert.ok(cosineDistance(THESIS, THESIS_NEAR) < 0.45);
});

test('임베딩이 가까운 요약끼리 묶는다', () => {
  const groups = clusterBySimilarity([
    { id: 1, embedding: THESIS },
    { id: 2, embedding: OTHER },
    { id: 3, embedding: THESIS_NEAR },
  ]);
  assert.deepEqual(groups.map(group => group.map(item => item.id).sort()).sort(), [[1, 3], [2]]);
});

test('같은 상황이 3일 이상이고 평소보다 10점 이상 높으면 원인으로 결론 낸다', () => {
  const entries = [
    { summaryId: 1, date: '2026-11-01', situation: '졸업작품 마감', keywords: ['학업'], embedding: THESIS },
    { summaryId: 2, date: '2026-11-03', situation: '졸업작품 마감', keywords: ['학업'], embedding: THESIS_NEAR },
    { summaryId: 3, date: '2026-11-05', situation: '졸작 준비', keywords: ['학업'], embedding: THESIS },
    { summaryId: 4, date: '2026-11-02', situation: '친구랑 산책', keywords: ['일상'], embedding: OTHER },
  ];
  const days = health([
    ['2026-11-01', 80, 4.5], ['2026-11-03', 76, 5], ['2026-11-05', 78, 4],
    ['2026-11-02', 50, 7], ['2026-11-04', 55, 7.5], ['2026-11-06', 52, 6.5],
  ]);
  const result = analyzeStressCauses(entries, days);
  assert.equal(result.status, 'found');
  const [top] = result.causes;
  assert.equal(top.label, '졸업작품 마감');
  assert.equal(top.kind, 'situation');
  assert.deepEqual([top.days, top.avgStress, top.baselineStress, top.diff], [3, 78, 52.3, 25.7]);
  assert.match(top.conclusion, /'졸업작품 마감' 이야기가 나온 날\(3일\)은 하루 스트레스가 평균 78점/);
  assert.match(top.conclusion, /잠도 평균 2.5시간 덜 잤어/);
  // 큰 분류(학업)로도 같은 결론이 나온다
  assert.ok(result.causes.some(cause => cause.kind === 'category' && cause.label === '학업'));
  // '일상'은 원인으로 보지 않는다
  assert.ok(!result.causes.some(cause => cause.label === '일상'));
});

test('기록이 부족하거나 차이가 작으면 결론 내지 않는다', () => {
  const twoDays = analyzeStressCauses(
    [
      { summaryId: 1, date: '2026-11-01', situation: '시험 공부', keywords: ['학업'], embedding: THESIS },
      { summaryId: 2, date: '2026-11-02', situation: '시험 공부', keywords: ['학업'], embedding: THESIS },
    ],
    health([['2026-11-01', 90, 4], ['2026-11-02', 90, 4], ['2026-11-03', 40, 8], ['2026-11-04', 40, 8]]),
  );
  assert.equal(twoDays.status, 'insufficient');
  assert.match(twoDays.message, /기록이 부족해/);

  const smallDiff = analyzeStressCauses(
    ['2026-11-01', '2026-11-02', '2026-11-03'].map((date, index) => (
      { summaryId: index, date, situation: '시험 공부', keywords: ['학업'], embedding: THESIS }
    )),
    health([['2026-11-01', 60], ['2026-11-02', 62], ['2026-11-03', 58], ['2026-11-04', 55], ['2026-11-05', 54]]),
  );
  assert.equal(smallDiff.status, 'insufficient');
  assert.equal(smallDiff.checked.length > 0, true);
});

test('스트레스 점수가 없는 날은 비교에서 뺀다', () => {
  const result = analyzeStressCauses(
    ['2026-11-01', '2026-11-02', '2026-11-03'].map((date, index) => (
      { summaryId: index, date, situation: '팀장 지적', keywords: ['부장/팀장'], embedding: THESIS }
    )),
    new Map([
      ['2026-11-01', { stress_score: 85 }], ['2026-11-02', { stress_score: null }], ['2026-11-03', { stress_score: 80 }],
      ['2026-11-04', { stress_score: 50 }], ['2026-11-05', { stress_score: 50 }],
    ]),
  );
  assert.equal(result.status, 'insufficient');
});

test('하루 스트레스 계산 결과에서 건강 수치를 뽑는다', () => {
  assert.equal(healthSnapshot(null), null);
  assert.deepEqual(
    healthSnapshot({
      finalDailyStressScore: 72.5,
      sleep: { minutes: 270 },
      steps: { total: 3100 },
      bloodPressure: { avgSystolic: 128 },
      timeline: [{ avgHeartRate: 80 }, { avgHeartRate: 90 }],
    }),
    { stress_score: 72.5, sleep_hours: 4.5, steps: 3100, avg_heart_rate: 85, avg_systolic: 128 },
  );
});

test('AI 하루 정리 JSON을 검사한다', () => {
  assert.equal(parseDaySummary('not json'), null);
  assert.equal(parseDaySummary('{"summary": ""}'), null);
  assert.deepEqual(
    parseDaySummary('{"summary":"졸작 마감으로 밤을 새웠다.","situation":"졸업작품 마감","emotion":"피곤","category":"학업"}'),
    { summary: '졸작 마감으로 밤을 새웠다.', situation: '졸업작품 마감', emotion: '피곤', category: '학업' },
  );
  // 목록에 없는 분류는 '일상'으로
  assert.equal(parseDaySummary('{"summary":"x","category":"게임"}').category, '일상');
});
