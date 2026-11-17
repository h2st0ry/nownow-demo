const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateLevel } = require("../services/characterLevel");

const TODAY = "2026-11-17";
// 한국 시간 2026-11-17 낮
const at = time => `2026-11-17T${time}+09:00`;

test("기록이 없으면 Lv.1, 0/100", () => {
  assert.deepEqual(calculateLevel([], [], TODAY), {
    level: 1, exp: 0, maxExp: 100, totalExp: 0, todayExp: 0
  });
});

test("하루에 종류마다 한 번만 경험치를 준다", () => {
  const chats = [at("09:00:00"), at("13:00:00"), at("21:00:00")];
  const interactions = [
    { action: "feed", created_at: at("10:00:00") },
    { action: "feed", created_at: at("18:00:00") },
    { action: "music", created_at: at("11:00:00") },
    { action: "play", created_at: at("12:00:00") },
    { action: "hobby", created_at: at("12:30:00") },
    { action: "unknown", created_at: at("12:40:00") }
  ];
  const result = calculateLevel(chats, interactions, TODAY);
  // 채팅 50 + 밥 30 + 음악 30 + 놀이 10 + 휴식 10 = 130
  assert.equal(result.totalExp, 130);
  assert.equal(result.todayExp, 130);
  assert.deepEqual([result.level, result.exp, result.maxExp], [2, 30, 200]);
});

test("날짜는 한국 시간 기준으로 나눈다", () => {
  // UTC로는 같은 날이지만 한국 시간으로는 11/16, 11/17
  const chats = ["2026-11-16T14:59:00Z", "2026-11-16T15:01:00Z"];
  const result = calculateLevel(chats, [], TODAY);
  assert.equal(result.totalExp, 100);
  assert.equal(result.todayExp, 50);
});

test("시각이 비어 있는 기록은 건너뛴다", () => {
  const result = calculateLevel([null, at("09:00:00")], [{ action: "feed", created_at: null }], TODAY);
  assert.equal(result.totalExp, 50);
});

test("레벨마다 필요한 경험치가 100씩 늘어난다", () => {
  // 100 + 200 = 300이면 Lv.3, 0/300
  const chats = Array.from({ length: 6 }, (_, day) => `2026-11-0${day + 1}T03:00:00Z`);
  const result = calculateLevel(chats, [], TODAY);
  assert.deepEqual([result.level, result.exp, result.maxExp], [3, 0, 300]);
});
