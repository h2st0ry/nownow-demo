import type {MonthlyReportData} from '../../../services/api/reports';
import {DEFAULT_STRESS_CARE_THRESHOLD} from './reportData';

// UI 확인용 월간 리포트 목업. MonthlyReport.tsx 의 USE_MONTHLY_MOCK 로 켜고 끈다.
// 날짜·걸음·수면·원인 키워드는 데모 계정 시나리오(backend/scripts/demoScenario.js)와 같다.
// 스트레스 점수는 그날 컨디션 종류에 맞춘 근삿값이다(실제 값은 서버 계산기가 만든다).

type Profile = 'calm' | 'low' | 'mid' | 'high' | 'late';
// [날짜, 컨디션, 잠든 시각, 깬 시각, 걸음, 분류]
type ScenarioDay = [string, Profile, string, string, number, string];

const SCENARIO: ScenarioDay[] = [
  ['2026-10-25', 'calm', '23:40', '08:10', 9400, '일상'],
  ['2026-10-26', 'mid', '00:30', '07:00', 6100, '업무 스트레스'],
  ['2026-10-27', 'mid', '00:50', '06:50', 5600, '업무 스트레스'],
  ['2026-10-28', 'late', '01:20', '06:40', 4200, '야근'],
  ['2026-10-29', 'mid', '00:40', '06:50', 5900, '업무 스트레스'],
  ['2026-10-30', 'calm', '00:00', '07:30', 8700, '일상'],
  ['2026-10-31', 'calm', '00:30', '09:20', 7300, '일상'],
  ['2026-11-01', 'calm', '23:50', '08:30', 8100, '일상'],
  ['2026-11-02', 'high', '00:20', '06:30', 4300, '부장/팀장'],
  ['2026-11-03', 'low', '00:00', '07:00', 7600, '일상'],
  ['2026-11-04', 'high', '00:40', '06:20', 3900, '부장/팀장'],
  ['2026-11-05', 'mid', '00:10', '06:50', 6300, '인간관계'],
  ['2026-11-06', 'high', '00:50', '06:20', 4100, '부장/팀장'],
  ['2026-11-07', 'calm', '23:30', '07:40', 12800, '일상'],
  ['2026-11-08', 'low', '00:20', '08:40', 6800, '미래'],
  ['2026-11-09', 'high', '01:00', '06:30', 3600, '부장/팀장'],
  ['2026-11-10', 'late', '01:30', '06:40', 4000, '야근'],
  ['2026-11-11', 'low', '00:00', '07:00', 7200, '일상'],
  ['2026-11-12', 'high', '01:30', '06:10', 3700, '부장/팀장'],
  ['2026-11-13', 'low', '00:10', '07:00', 8000, '일상'],
  ['2026-11-14', 'calm', '01:00', '10:00', 6900, '일상'],
  ['2026-11-15', 'calm', '23:40', '08:20', 10200, '일상'],
  ['2026-11-16', 'late', '00:30', '06:30', 3800, '야근'],
  ['2026-11-17', 'late', '01:40', '06:30', 3500, '야근'],
  ['2026-11-18', 'high', '01:40', '06:20', 3400, '부장/팀장'],
  ['2026-11-19', 'late', '01:10', '06:20', 3900, '야근'],
  ['2026-11-20', 'mid', '00:40', '06:30', 5800, '업무 스트레스'],
  ['2026-11-21', 'calm', '00:30', '10:30', 7700, '일상'],
  ['2026-11-22', 'low', '23:50', '08:30', 6400, '경제'],
  ['2026-11-23', 'low', '00:00', '07:00', 7400, '일상'],
];

// 컨디션별 점수 범위 [최소, 폭]
const SCORE_RANGE: Record<Profile, [number, number]> = {
  calm: [16, 8],
  low: [27, 8],
  mid: [42, 9],
  high: [72, 9],
  late: [64, 9],
};

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const sleepMinutes = (from: string, to: string) => (toMinutes(to) - toMinutes(from) + 24 * 60) % (24 * 60);
// 날짜마다 늘 같은 값이 나오게
const jitter = (date: string) => (Number(date.replace(/-/g, '')) * 2654435761) % 1000 / 1000;
const avg = (values: number[]) => (values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null);

const toDay = ([date, profile, from, to, steps, category]: ScenarioDay) => {
  const [min, span] = SCORE_RANGE[profile];
  return {
    date,
    finalDailyStressScore: Math.round(min + jitter(date) * span),
    sleepMinutes: sleepMinutes(from, to),
    totalSteps: steps,
    // 평범한 날은 원인 키워드를 붙이지 않는다(시드 스크립트와 같게).
    causes: category === '일상' ? [] : [category],
  };
};

const averageOf = (month: string) =>
  avg(SCENARIO.filter(([date]) => date.startsWith(month)).map(day => toDay(day).finalDailyStressScore));

const previousMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number);
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`;
};

export const createMockMonthlyReport = (month: string): MonthlyReportData => {
  const days = SCENARIO.filter(([date]) => date.startsWith(month)).map(toDay);
  const lastDay = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const scores = days.map(day => day.finalDailyStressScore);

  const counts = new Map<string, number>();
  days.forEach(day => day.causes.forEach(cause => counts.set(cause, (counts.get(cause) ?? 0) + 1)));
  const causes = [...counts].map(([cause, count]) => ({cause, count})).sort((a, b) => b.count - a.count);

  const findings = causes
    .map(({cause}) => {
      const withCause = days.filter(day => day.causes.includes(cause)).map(day => day.finalDailyStressScore);
      const others = days.filter(day => !day.causes.includes(cause)).map(day => day.finalDailyStressScore);
      const avgStress = Math.round(avg(withCause) ?? 0);
      const baselineStress = Math.round(avg(others) ?? 0);
      return {
        label: cause,
        kind: 'category' as const,
        days: withCause.length,
        avgStress,
        baselineStress,
        diff: avgStress - baselineStress,
        conclusion: `'${cause}' 이야기를 한 날은 다른 날보다 스트레스가 평균 ${avgStress - baselineStress}점 높았어요.`,
      };
    })
    .filter(finding => finding.days >= 2 && finding.diff > 0)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 3);

  const peak = days.reduce<(typeof days)[number] | null>(
    (max, day) => (!max || day.finalDailyStressScore > max.finalDailyStressScore ? day : max), null);

  return {
    month,
    from: days[0]?.date ?? `${month}-01`,
    to: days[days.length - 1]?.date ?? `${month}-${lastDay}`,
    dayCount: days.length,
    averageStressScore: avg(scores),
    previousAverageStressScore: averageOf(previousMonth(month)),
    highStressDays: scores.filter(score => score >= DEFAULT_STRESS_CARE_THRESHOLD).length,
    averageSleepMinutes: avg(days.map(day => day.sleepMinutes)),
    averageSteps: avg(days.map(day => day.totalSteps)),
    peakDay: peak ? {date: peak.date, score: peak.finalDailyStressScore} : null,
    days,
    causes,
    topCause: causes[0]?.cause ?? null,
    analysis: {
      status: findings.length ? 'found' : 'insufficient',
      message: '이번 달은 원인을 찾기엔 기록이 아직 부족해요.',
      causes: findings,
    },
  };
};
