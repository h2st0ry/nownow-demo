const supabase = require("../config/supabase");
const fetchAll = require("../utils/fetchAll");
const {
  addDays,
  kstDateOf,
  kstDayRange,
  kstToday,
  weekStartOf,
  datesBetween
} = require("../utils/kstDate");
const stressService = require("./stressService");
const { analyzeStressCauses, healthSnapshot } = require("./stressCauseAnalysis");
const {
  buildRecommendation,
  countCauses,
  summarizeDays
} = require("./insightCalculator");

const PERIOD_DAYS = { day: 1, yesterday: 1, week: 7, month: 30 };

// from ~ to(포함) 사이에 저장된 챗봇 요약의 키워드
function getSummaries(user_id, from, to) {
  const { start, end } = kstDayRange(from, datesBetween(from, to).length);

  return fetchAll(() =>
    supabase
      .from("chat_summaries")
      .select("keywords, created_at")
      .eq("user_id", user_id)
      .gte("created_at", start)
      .lt("created_at", end)
  );
}

// 최근 7일(week) 또는 30일(month), 오늘 포함
async function getStressCauses(user_id, period) {
  const to = period === 'yesterday' ? addDays(kstToday(), -1) : kstToday();
  const from = addDays(to, -(PERIOD_DAYS[period] - 1));
  const summaries = await getSummaries(user_id, from, to);

  return { period, from, to, causes: countCauses(summaries, true) };
}

// 그날 점수 + 그날까지 최근 7일 대화의 가장 큰 원인
async function getRecommendation(user_id, date) {
  const [daily, summaries] = await Promise.all([
    stressService.getDailyStress(user_id, date),
    getSummaries(user_id, addDays(date, -6), date)
  ]);
  const [topCause] = countCauses(summaries);

  return {
    date,
    score: daily.finalDailyStressScore,
    topCause: topCause?.cause ?? null,
    ...buildRecommendation({
      score: daily.finalDailyStressScore,
      topCause: topCause?.cause ?? null
    })
  };
}

function weekEndOf(weekStart) {
  return addDays(weekStart, 6);
}

// 지난 주부터 limit주 (이번 주 제외, 최신순). 주 시작은 월요일.
async function getWeeklyReports(user_id, limit) {
  const thisWeek = weekStartOf(kstToday());
  const weekStarts = Array.from({ length: limit }, (_, i) =>
    addDays(thisWeek, -7 * (i + 1))
  );
  const from = weekStarts[weekStarts.length - 1];
  const to = addDays(thisWeek, -1);

  const [days, summaries] = await Promise.all([
    stressService.getDailyStressRange(user_id, from, to),
    getSummaries(user_id, from, to)
  ]);

  const items = weekStarts.map(weekStart => {
    const weekEnd = weekEndOf(weekStart);
    const inWeek = date => date >= weekStart && date <= weekEnd;
    const { averageStressScore, dayCount } = summarizeDays(
      days.filter(day => inWeek(day.date))
    );
    const [topCause] = countCauses(
      summaries.filter(row => inWeek(kstDateOf(row.created_at))), true
    );

    return {
      weekStart,
      weekEnd,
      averageStressScore,
      dayCount,
      topCause: topCause?.cause ?? null
    };
  });

  return { items };
}

// weekStart(월요일)부터 7일. 이번 주라면 오늘까지만.
async function getWeeklyReport(user_id, weekStart) {
  const weekEnd = weekEndOf(weekStart);
  const today = kstToday();
  const to = weekEnd < today ? weekEnd : today;

  const [days, summaries] = await Promise.all([
    stressService.getDailyStressRange(user_id, weekStart, to),
    getSummaries(user_id, weekStart, to)
  ]);
  const causes = countCauses(summaries, true);
  // 날짜별 원인: 그날 요약들의 키워드를 주간 집계와 같은 기준으로 모은다.
  const causesOf = date => countCauses(
    summaries.filter(row => row.created_at && kstDateOf(row.created_at) === date), true
  ).map(({ cause }) => cause);

  return {
    weekStart,
    weekEnd,
    ...summarizeDays(days),
    days: days.map(day => ({
      date: day.date,
      finalDailyStressScore: day.finalDailyStressScore,
      dailyStress: day.dailyStress,
      sleepMinutes: day.sleep.minutes,
      totalSteps: day.steps.total,
      missing: day.missing,
      causes: causesOf(day.date)
    })),
    causes,
    topCause: causes[0]?.cause ?? null
  };
}

// 스트레스 원인 분석: 최근 60일 하루 요약(상황·임베딩)과 날짜별 건강 수치를 비교한다.
const ANALYSIS_DAYS = 60;
const parseVector = value => (typeof value === "string" ? JSON.parse(value) : value);

async function getStressAnalysis(user_id) {
  const to = kstToday();
  const from = addDays(to, -(ANALYSIS_DAYS - 1));

  const [summaries, embeddings, daily] = await Promise.all([
    fetchAll(() =>
      supabase
        .from("chat_summaries")
        .select("summary_id, keywords, created_at")
        .eq("user_id", user_id)
        .order("summary_id")
    ),
    fetchAll(() =>
      supabase
        .from("memory_embeddings")
        .select("nownow_summary_id, embedding, metadata")
        .eq("user_id", user_id)
        .eq("source_type", "CHAT_SUMMARY")
        .order("nownow_summary_id")
    ),
    stressService.getDailyStressRange(user_id, from, to)
  ]);

  const vectors = new Map(embeddings.map(row => [row.nownow_summary_id, row]));
  const health = new Map(daily.map(day => [day.date, healthSnapshot(day)]));

  const entries = [];
  for (const row of summaries) {
    const vector = vectors.get(row.summary_id);
    const metadata = vector?.metadata ?? {};
    // 대화한 날짜: 임베딩에 붙여 둔 날짜, 없으면 요약 저장 시각. 둘 다 없으면 쓸 수 없다.
    const date = metadata.date ?? (row.created_at ? kstDateOf(row.created_at) : null);
    if (!date || date < from || date > to) continue;
    // 그날 점수를 새로 계산하지 못하면 요약 저장 때 붙여 둔 건강 수치를 쓴다.
    if (!Number.isFinite(health.get(date)?.stress_score) && metadata.health) {
      health.set(date, metadata.health);
    }
    entries.push({
      summaryId: row.summary_id,
      date,
      situation: metadata.situation ?? null,
      keywords: row.keywords ?? [],
      embedding: vector ? parseVector(vector.embedding) : undefined
    });
  }

  return { from, to, ...analyzeStressCauses(entries, health) };
}

module.exports = {
  getStressAnalysis,
  getStressCauses,
  getRecommendation,
  getWeeklyReports,
  getWeeklyReport
};
