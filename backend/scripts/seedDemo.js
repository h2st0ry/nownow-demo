// 데모 계정에 30일치 건강 기록 + 채팅을 넣는다. 이야기는 demoScenario.js.
// 실행(backend 폴더에서):
//   node scripts/seedDemo.js                                  미리 계산만 (DB에 안 넣음)
//   node scripts/seedDemo.js --apply --email E --password P   계정이 없으면 만들고 넣는다
//   node scripts/seedDemo.js --reset --email E                그 계정 기록을 전부 지운다(계정은 남김)
//   --reset --apply 를 같이 주면 지우고 다시 넣는다.
//
// 스트레스 점수는 넣지 않는다. 원본 기록을 넣고 서버 계산기로 점수를 만든다.
// 그래서 데모 계정 휴대폰에서는 헬스 커넥트 동기화를 켜지 않는다(걸음 수가 덮어써질 수 있다).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const { PROFILES, DAYS, DEMO_DAY } = require('./demoScenario');
const { addDays } = require('../utils/kstDate');
const { calculateByDate } = require('../services/stressCalculator');
const { analyzeStressCauses, healthSnapshot } = require('../services/stressCauseAnalysis');

const DATA_ORIGIN = 'nownow.demo';
const NICKNAME = '김대리';
const HEALTH_TABLES = ['heart_rate_records', 'steps_records', 'sleep_records', 'blood_pressure_records', 'oxygen_records'];
// 지울 때 순서: 요약·임베딩이 메시지를 참조하므로 먼저 지운다.
const USER_TABLES = ['memory_embeddings', 'chat_summaries', 'chat_messages', 'daily_stress_scores', 'character_interactions', ...HEALTH_TABLES];

// ---------- 값 만들기 (같은 결과가 나오게 고정 시드) ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = date => Number(date.replace(/-/g, ''));
const kst = (date, hhmm) => new Date(`${date}T${hhmm}:00+09:00`).toISOString();
const pad = n => String(n).padStart(2, '0');

// 한 시간 심박 패턴: 평균과 흔들림(표준편차)으로 실시간 스트레스가 정해진다.
const HOUR_TYPES = {
  S: { mean: 96, sd: 3.5 }, // 심박 높고 일정 → 약 76점
  M: { mean: 86, sd: 6 },   // 약 42점
  L: { mean: 84, sd: 8 },   // 약 30점
  C: { mean: 71, sd: 11.5 },// 안정 → 0점
};
const OFFSETS = [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5];
const OFFSET_SD = Math.sqrt(OFFSETS.reduce((s, v) => s + v * v, 0) / OFFSETS.length);

function hourPlan(profile, random, firstHour = 7, lastHour = 23) {
  const hours = [];
  for (let h = firstHour; h <= lastHour; h += 1) hours.push(h);
  const plan = new Map(hours.map(h => [h, 'C']));
  // 같은 종류의 날도 점수가 조금씩 다르게: 시간 수를 -1~+1 흔든다.
  const pick = (base, pool, type) => {
    const count = Math.max(0, base + Math.floor(random() * 3) - 1);
    const free = pool.filter(h => plan.get(h) === 'C');
    for (let i = 0; i < count && free.length; i += 1) {
      const [h] = free.splice(Math.floor(random() * free.length), 1);
      plan.set(h, type);
    }
  };
  const work = hours.filter(h => h >= 9 && h <= 18);
  const evening = hours.filter(h => h >= 18);
  pick(profile.S, profile.late ? evening : work, 'S');
  pick(profile.M, work, 'M');
  pick(profile.L, hours, 'L');
  return plan;
}

function heartRates(date, plan, random) {
  const rows = [];
  for (const [hour, type] of plan) {
    const { mean, sd } = HOUR_TYPES[type];
    const shift = (random() - 0.5) * 2;
    OFFSETS.forEach((offset, i) => {
      const minute = 3 + i * 10 + Math.floor(random() * 5);
      rows.push({
        measured_at: kst(date, `${pad(hour)}:${pad(minute)}`),
        bpm: Math.round(mean + shift + (offset * sd) / OFFSET_SD),
      });
    });
  }
  return rows;
}

const STEP_WEIGHTS = { 7: 3, 8: 8, 9: 3, 10: 1, 11: 1, 12: 6, 13: 4, 14: 1, 15: 1, 16: 1, 17: 2, 18: 7, 19: 5, 20: 3, 21: 2, 22: 1 };
function steps(date, total, random, lastHour = 22) {
  const hours = Object.keys(STEP_WEIGHTS).map(Number).filter(h => h <= lastHour);
  const weights = hours.map(h => STEP_WEIGHTS[h] * (0.7 + random() * 0.6));
  const sum = weights.reduce((s, w) => s + w, 0);
  return hours.map((h, i) => ({
    start_time: kst(date, `${pad(h)}:00`),
    end_time: kst(date, `${pad(h)}:59`),
    count: Math.round((total * weights[i]) / sum),
  }));
}

function sleep(date, [from, to]) {
  const startDate = Number(from.slice(0, 2)) >= 12 ? addDays(date, -1) : date;
  return { start_time: kst(startDate, from), end_time: kst(date, to) };
}

function dayRecords(day, { untilHour } = {}) {
  const random = rng(seedOf(day.date));
  const profile = PROFILES[day.profile] ?? PROFILES.low;
  const plan = hourPlan(profile, random, 7, untilHour ? untilHour - 1 : 23);
  return {
    heartRates: heartRates(day.date, plan, random),
    steps: steps(day.date, day.steps, random, untilHour ? untilHour - 1 : 22),
    sleeps: [sleep(day.date, day.sleep)],
    bloodPressures: [{
      measured_at: kst(day.date, '07:35'),
      systolic: day.sys,
      diastolic: Math.round(day.sys * 0.62 + random() * 4),
    }],
    oxygens: ['07:40', untilHour ? '09:20' : '13:10', untilHour ? null : '22:30'].filter(Boolean)
      .map(t => ({ measured_at: kst(day.date, t), percentage: 97 + Math.floor(random() * 3) })),
  };
}

function allRecords() {
  const list = [...DAYS.map(day => dayRecords(day)), dayRecords({ ...DEMO_DAY, profile: 'calm' }, { untilHour: DEMO_DAY.untilHour })];
  const merged = { heartRates: [], steps: [], sleeps: [], bloodPressures: [], oxygens: [] };
  for (const records of list) for (const key of Object.keys(merged)) merged[key].push(...records[key]);
  return merged;
}

// 대화 시각: 보통 21시, 야근한 날은 23시 15분부터 1~3분 간격
function chatRows(day) {
  const random = rng(seedOf(day.date) + 7);
  let minutes = PROFILES[day.profile]?.late ? 23 * 60 + 15 : 21 * 60 + Math.floor(random() * 30);
  return day.chat.map(([who, message]) => {
    minutes += 1 + Math.floor(random() * 3);
    return {
      chat_role: who === 'U' ? 'USER' : 'ASSISTANT',
      message,
      created_at: kst(day.date, `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`),
    };
  });
}

// ---------- 미리 계산 ----------
function preview() {
  const records = allRecords();
  const dates = [...DAYS.map(d => d.date), DEMO_DAY.date];
  const results = calculateByDate(dates, records);
  const health = new Map(results.map(r => [r.date, healthSnapshot(r)]));
  console.log('날짜        종류   점수  수면  걸음   분류 / 상황');
  for (const r of results) {
    const day = DAYS.find(d => d.date === r.date);
    const snap = health.get(r.date);
    console.log(
      `${r.date}  ${(day?.profile ?? 'demo').padEnd(5)} ${String(r.finalDailyStressScore).padStart(5)}  ${String(snap?.sleep_hours).padStart(4)}  ${String(snap?.steps).padStart(5)}   ${day ? `${day.category} / ${day.situation}` : '(데모 당일 오전)'}`
    );
  }
  // 분류(키워드) 기준으로 미리 본 결론. 상황 묶음은 임베딩을 만든 뒤에야 알 수 있다.
  const entries = DAYS.map((d, i) => ({ summaryId: i, date: d.date, situation: d.situation, keywords: [d.category] }));
  const analysis = analyzeStressCauses(entries, health);
  console.log(`\n원인 분석 미리보기(분류 기준): ${analysis.status}`);
  for (const c of analysis.causes) console.log(` - ${c.conclusion}`);
  for (const c of analysis.checked) console.log(` · (기준 미달) ${c.label}: ${c.days}일 평균 ${c.avgStress} vs ${c.baselineStress}`);
  console.log(`\n심박 ${records.heartRates.length}개, 걸음 ${records.steps.length}개, 수면 ${records.sleeps.length}개, 혈압 ${records.bloodPressures.length}개, 산소 ${records.oxygens.length}개, 대화 ${DAYS.reduce((s, d) => s + d.chat.length, 0)}줄, 요약 ${DAYS.length}개`);
}

// ---------- DB ----------
async function insertAll(supabase, table, rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function findUser(supabase, email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (user || data.users.length < 1000) return user ?? null;
  }
}

async function reset(supabase, userId) {
  for (const table of USER_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`${table} 삭제: ${error.message}`);
  }
  console.log('데모 계정 기록을 모두 지웠어요(계정은 남김).');
}

async function apply(supabase, user) {
  const userId = user.id;
  const { count } = await supabase.from('chat_messages').select('chat_id', { count: 'exact', head: true }).eq('user_id', userId);
  if (count) throw new Error(`이 계정에 이미 대화 ${count}개가 있어요. --reset --apply로 지우고 다시 넣으세요.`);

  const records = allRecords();
  const withUser = (rows, origin = true) => rows.map(row => ({ user_id: userId, ...row, ...(origin && { data_origin: DATA_ORIGIN }) }));
  await insertAll(supabase, 'heart_rate_records', withUser(records.heartRates));
  await insertAll(supabase, 'steps_records', withUser(records.steps, false));
  await insertAll(supabase, 'sleep_records', withUser(records.sleeps));
  await insertAll(supabase, 'blood_pressure_records', withUser(records.bloodPressures));
  await insertAll(supabase, 'oxygen_records', withUser(records.oxygens));
  console.log('건강 기록을 넣었어요.');

  // 점수는 서버 계산기로 만들고 저장한다(리포트가 쓰는 것과 같은 경로).
  const stressService = require('../services/stressService');
  const daily = await stressService.getDailyStressRange(userId, DAYS[0].date, DEMO_DAY.date);
  const byDate = new Map(daily.map(d => [d.date, d]));
  console.log('스트레스 점수를 계산해 저장했어요.');

  const { indexSummary } = require('../services/chatMemorySearch');
  let embedded = 0;
  for (const day of DAYS) {
    const messages = chatRows(day).map(row => ({ user_id: userId, ...row }));
    const { data: saved, error } = await supabase.from('chat_messages').insert(messages).select('chat_id, created_at');
    if (error) throw new Error(`chat_messages: ${error.message}`);
    const last = saved.sort((a, b) => a.chat_id - b.chat_id).at(-1);
    // 평범한 날은 원인 키워드를 붙이지 않는다(주간 리포트에서 '일상'이 원인 1위로 나오지 않게).
    const keywords = day.category === '일상' ? [] : [day.category];
    const { data: summary, error: summaryError } = await supabase.from('chat_summaries').insert({
      user_id: userId,
      chat_id: last.chat_id,
      message_count: messages.length,
      summary: day.summary,
      keywords,
      created_at: new Date(Date.parse(last.created_at) + 2 * 60000).toISOString(),
    }).select('summary_id').single();
    if (summaryError) throw new Error(`chat_summaries: ${summaryError.message}`);
    const metadata = {
      date: day.date, keywords, summary_type: 'ai',
      situation: day.situation, emotion: day.emotion, category: day.category,
      health: healthSnapshot(byDate.get(day.date)),
    };
    if (await indexSummary(userId, summary.summary_id, day.summary, metadata)) embedded += 1;
  }
  console.log(`대화와 요약 ${DAYS.length}일치를 넣었어요. 임베딩 ${embedded}개.`);

  const { getStressAnalysis } = require('../services/insightService');
  const analysis = await getStressAnalysis(userId);
  console.log(`\n실제 원인 분석: ${analysis.status} (요약 ${analysis.summaryDays}일, 점수 ${analysis.scoredDays}일)`);
  for (const c of analysis.causes) console.log(` - [${c.kind}] ${c.conclusion}`);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = name => args.includes(name);
  const value = name => args[args.indexOf(name) + 1];
  if (!flag('--apply') && !flag('--reset')) return preview();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('backend/.env에 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  const email = flag('--email') && value('--email');
  if (!email) throw new Error('--email이 필요합니다.');
  const supabase = require('../config/supabase');

  let user = await findUser(supabase, email);
  if (flag('--reset')) {
    if (!user) throw new Error('그 이메일의 계정이 없어요.');
    await reset(supabase, user.id);
  }
  if (!flag('--apply')) return;

  if (!user) {
    const password = flag('--password') && value('--password');
    if (!password) throw new Error('새 계정을 만들려면 --password가 필요합니다.');
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { nickname: NICKNAME },
    });
    if (error) throw error;
    user = data.user;
    const info = await supabase.from('user_informations').insert({
      user_id: user.id, nickname: NICKNAME, character_type: 'default', notification_enabled: false,
    });
    if (info.error) throw new Error(`user_informations: ${info.error.message}`);
    console.log(`데모 계정을 만들었어요: ${email}`);
  }
  await apply(supabase, user);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { rng, seedOf, steps, sleep, findUser, DATA_ORIGIN };
