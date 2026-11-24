// 시연 당일 하루치 걸음 수·수면만 데모 계정에 넣는다. 심박·혈압은 넣지 않는다(워치·혈압계로 실제 측정).
// 데모 앱 실시간 탭은 걸음 수·수면을 서버에서 읽고, 지금 시각까지만 보여 준다.
// 실행(backend 폴더에서):
//   node scripts/seedDemoDay.js --email E --date 2026-11-25            미리 보기 (DB에 안 넣음)
//   node scripts/seedDemoDay.js --email E --date 2026-11-25 --apply    그날 걸음·수면을 지우고 다시 넣는다
// 옵션: --steps 7200 (하루 걸음 수), --sleep 00:30-07:00 (전날 밤~그날 아침)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });

const { kstDayRange, isDate } = require('../utils/kstDate');
const { rng, seedOf, steps, sleep, findUser, DATA_ORIGIN } = require('./seedDemo');

async function main() {
  const args = process.argv.slice(2);
  const value = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const email = value('--email');
  const date = value('--date');
  const total = Number(value('--steps') ?? 7200);
  const [from, to] = (value('--sleep') ?? '00:30-07:00').split('-');
  if (!email) throw new Error('--email이 필요합니다.');
  if (!isDate(date)) throw new Error('--date는 YYYY-MM-DD 형식이어야 합니다.');
  if (!(total > 0) || !/^\d\d:\d\d$/.test(from ?? '') || !/^\d\d:\d\d$/.test(to ?? '')) throw new Error('--steps 또는 --sleep 값을 확인해 주세요.');

  const stepRows = steps(date, total, rng(seedOf(date)));
  const sleepRow = sleep(date, [from, to]);
  console.log(`${date}: 걸음 ${stepRows.length}시간 합계 ${stepRows.reduce((s, r) => s + r.count, 0)}, 수면 ${sleepRow.start_time} ~ ${sleepRow.end_time}`);
  if (!args.includes('--apply')) return console.log('미리 보기예요. 넣으려면 --apply를 붙이세요.');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('backend/.env에 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.');
  const supabase = require('../config/supabase');
  const user = await findUser(supabase, email);
  if (!user) throw new Error(`계정을 찾지 못했어요: ${email}`);

  const { start, end } = kstDayRange(date);
  const steps0 = await supabase.from('steps_records').delete().eq('user_id', user.id).gte('start_time', start).lt('start_time', end);
  const sleep0 = await supabase.from('sleep_records').delete().eq('user_id', user.id).gte('end_time', start).lt('end_time', end);
  if (steps0.error || sleep0.error) throw new Error((steps0.error ?? sleep0.error).message);

  const a = await supabase.from('steps_records').insert(stepRows.map(row => ({ user_id: user.id, ...row })));
  const b = await supabase.from('sleep_records').insert({ user_id: user.id, ...sleepRow, data_origin: DATA_ORIGIN });
  if (a.error || b.error) throw new Error((a.error ?? b.error).message);
  console.log('넣었어요.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
