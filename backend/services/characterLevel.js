// 캐릭터 레벨 계산. DB 없이 계산만 한다.
// 경험치는 하루(한국 시간)에 종류마다 한 번씩만 준다.
const { kstDateOf } = require("../utils/kstDate");

const EXP_RULES = {
  chat: 50, // 그날 채팅을 한 번이라도 하면
  feed: 30, // 밥주기
  music: 30,
  play: 10,
  hobby: 10 // 휴식
};

// Lv.N → Lv.N+1에 필요한 경험치. 레벨마다 100씩 늘어난다.
const expToNextLevel = level => level * 100;

// chatTimes: 사용자가 보낸 채팅 시각들, interactions: [{action, created_at}]
function calculateLevel(chatTimes, interactions, today) {
  const earned = new Set(); // "날짜:종류"
  // 시각이 비어 있는 옛 기록은 날짜를 알 수 없어 건너뛴다.
  const hasTime = time => time && !Number.isNaN(Date.parse(time));
  for (const time of chatTimes) {
    if (hasTime(time)) earned.add(`${kstDateOf(time)}:chat`);
  }
  for (const { action, created_at } of interactions) {
    if (EXP_RULES[action] && hasTime(created_at)) earned.add(`${kstDateOf(created_at)}:${action}`);
  }

  let totalExp = 0;
  let todayExp = 0;
  for (const key of earned) {
    const [date, kind] = key.split(":");
    totalExp += EXP_RULES[kind];
    if (date === today) todayExp += EXP_RULES[kind];
  }

  let level = 1;
  let exp = totalExp;
  while (exp >= expToNextLevel(level)) {
    exp -= expToNextLevel(level);
    level += 1;
  }

  return { level, exp, maxExp: expToNextLevel(level), totalExp, todayExp };
}

module.exports = { EXP_RULES, expToNextLevel, calculateLevel };
