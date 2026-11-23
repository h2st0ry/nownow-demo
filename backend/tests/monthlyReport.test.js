const test = require('node:test');
const assert = require('node:assert/strict');

test('월간 리포트: 달 범위, 지난달 평균, 높은 날, 날짜별 원인', async () => {
  const summaries = [
    {summary_id: 1, keywords: ['부장/팀장'], created_at: '2026-11-02T12:00:00Z'},
    {summary_id: 2, keywords: ['야근'], created_at: '2026-11-03T14:30:00Z'}, // 11-03 23:30 KST
  ];
  const stored = [
    {record_date: '2026-10-28', final_score: 40, missing: []},
    {record_date: '2026-10-29', final_score: 20, missing: []},
    {record_date: '2026-10-30', final_score: 90, missing: ['demo_fixture']}, // 빼야 한다
  ];
  const tables = {chat_summaries: summaries, memory_embeddings: [], daily_stress_scores: stored};
  require.cache[require.resolve('../config/supabase')] = {exports: {from(table) {
    const rows = tables[table];
    const chain = {select: () => chain, eq: () => chain, gte: () => chain, lt: () => chain, lte: () => chain, order: () => chain,
      range: async () => ({data: rows, error: null})};
    return chain;
  }}};
  const day = (date, score, sleep = 420) => ({
    date, finalDailyStressScore: score, dailyStress: score, timeline: [],
    sleep: {minutes: sleep}, steps: {total: 6000}, bloodPressure: {}, missing: [],
  });
  const ranges = [];
  require.cache[require.resolve('../services/stressService')] = {exports: {
    getDailyStressRange: async (user, from, to) => {
      ranges.push([from, to]);
      return [day('2026-11-01', 20), day('2026-11-02', 75, 300), day('2026-11-03', 50, null)];
    },
  }};
  require('../utils/kstDate').kstToday = () => '2026-11-03'; // 오늘 = 11-03으로 고정
  delete require.cache[require.resolve('../services/insightService')];

  const {getMonthlyReport} = require('../services/insightService');
  const report = await getMonthlyReport('user', '2026-11');

  assert.deepEqual(ranges, [['2026-11-01', '2026-11-03']]); // 이번 달은 오늘까지, 계산은 한 번
  assert.equal(report.averageStressScore, 48.3);
  assert.equal(report.previousAverageStressScore, 30);
  assert.equal(report.highStressDays, 1);
  assert.equal(report.averageSleepMinutes, 360);
  assert.deepEqual(report.peakDay, {date: '2026-11-02', score: 75});
  assert.deepEqual(report.days.map(d => d.causes), [[], ['부장/팀장'], ['야근']]);
  assert.equal(report.topCause, '부장/팀장');
  assert.equal(report.analysis.status, 'insufficient');
});
