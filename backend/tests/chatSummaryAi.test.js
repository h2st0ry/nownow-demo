const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTranscript, summarizeDay } = require('../services/chatSummaryAi');
const { memoryPrompt } = require('../../shared/healthRetrieval');

const withKey = (t, value) => {
  const previous = process.env.OPENAI_API_KEY;
  if (value === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = value;
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
};

const messages = [
  { chat_role: 'USER', message: '오늘 팀장한테 깨졌어' },
  { chat_role: 'ASSISTANT', message: '헉 많이 속상했겠다' },
  { chat_role: 'USER', message: '마감이 내일이라 야근해야 돼' },
];

test('대화를 사용자/뿡뿡이 줄로 만든다', () => {
  assert.equal(
    buildTranscript(messages),
    '사용자: 오늘 팀장한테 깨졌어\n뿡뿡이: 헉 많이 속상했겠다\n사용자: 마감이 내일이라 야근해야 돼',
  );
});

test('키가 없거나 사용자가 한 말이 없으면 요약하지 않는다', async t => {
  withKey(t, undefined);
  assert.equal(await summarizeDay(messages), null);
  withKey(t, 'test');
  assert.equal(await summarizeDay([{ chat_role: 'ASSISTANT', message: '안녕' }]), null);
});

test('OpenAI 요약 결과를 돌려준다', async t => {
  withKey(t, 'test');
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-4o-mini');
    assert.equal(body.response_format.type, 'json_object');
    assert.match(body.messages[1].content, /팀장한테 깨졌어/);
    const content = JSON.stringify({ summary: ' 팀장에게 혼나 속상했다. ', situation: '팀장 지적', emotion: '속상함', category: '부장/팀장' });
    return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
  });
  assert.deepEqual(await summarizeDay(messages), {
    summary: '팀장에게 혼나 속상했다.', situation: '팀장 지적', emotion: '속상함', category: '부장/팀장',
  });
});

test('요약 요청이 실패하면 에러를 던진다(부르는 쪽이 앱 요약을 쓴다)', async t => {
  withKey(t, 'test');
  t.mock.method(global, 'fetch', async () => ({ ok: false, status: 500 }));
  await assert.rejects(summarizeDay(messages), /Summary HTTP 500/);
});

test('과거 기억이 있으면 질문 앞에 참고로 붙이고, 없으면 질문 그대로', () => {
  assert.equal(memoryPrompt('안녕', []), '안녕');
  const prompt = memoryPrompt('오늘도 팀장 때문에 힘들어', [{ date: '2026-11-10', summary: '팀장에게 혼났다.' }]);
  assert.match(prompt, /relatedPastChats: \[\{"date":"2026-11-10","summary":"팀장에게 혼났다."\}\]/);
  assert.ok(prompt.endsWith('사용자: 오늘도 팀장 때문에 힘들어'));
  assert.ok(memoryPrompt('가'.repeat(1990), [{ date: 'x', summary: 'y' }]) === '가'.repeat(1990));
});
