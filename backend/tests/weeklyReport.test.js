const test = require('node:test');
const assert = require('node:assert/strict');

test('주간 리포트: 날짜별 원인을 그날 요약 키워드로 붙인다', async () => {
  const summaries = [
    {keywords: ['학업', '학업'], created_at: '2026-11-10T03:00:00Z'}, // 11-10 KST
    {keywords: ['인간관계'], created_at: '2026-11-10T14:30:00Z'}, // 11-10 23:30 KST
    {keywords: ['학업'], created_at: '2026-11-10T15:30:00Z'}, // 11-11 00:30 KST
    {keywords: ['일상'], created_at: null},
  ];
  const chain = {
    select: () => chain, eq: () => chain, gte: () => chain, lt: () => chain,
    range: async () => ({data: summaries, error: null}),
    then: (resolve, reject) => Promise.resolve({data: summaries, error: null}).then(resolve, reject),
  };
  require.cache[require.resolve('../config/supabase')] = {exports: {from: () => chain}};
  const day = (date, score) => ({
    date, finalDailyStressScore: score, dailyStress: score,
    sleep: {minutes: 420}, steps: {total: 5000}, missing: [],
  });
  require.cache[require.resolve('../services/stressService')] = {exports: {
    getDailyStressRange: async () => [day('2026-11-10', 72), day('2026-11-11', 55), day('2026-11-12', 30)],
  }};

  const {getWeeklyReport} = require('../services/insightService');
  const report = await getWeeklyReport('user', '2026-11-10');

  assert.deepEqual(report.days.map(d => [d.date, d.causes]), [
    ['2026-11-10', ['학업', '인간관계']],
    ['2026-11-11', ['학업']],
    ['2026-11-12', []],
  ]);
  assert.deepEqual(report.causes, [{cause: '학업', count: 2}, {cause: '인간관계', count: 1}, {cause: '일상', count: 1}]);
});
