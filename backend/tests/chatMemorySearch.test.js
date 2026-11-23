const test = require('node:test');
const assert = require('node:assert/strict');

test('indexes all of the signed-in user’s summaries and searches their whole history', async t => {
  const userId = 'signed-in-user';
  const summary = {summary_id: 42, summary: '팀 발표 준비가 부담스러웠다.'};
  const filters = [];
  const indexed = [];
  const calls = [];
  const rpcDistances = [];
  const dbPath = require.resolve('../config/supabase');
  require.cache[dbPath] = {exports: {
    from(table) {
      const q = {
        select: () => q,
        eq: (key, value) => {filters.push([table, key, value]); return q;},
        order: async () => ({data: [summary]}),
        then: (resolve, reject) => Promise.resolve({data: indexed}).then(resolve, reject),
        upsert: async rows => {indexed.push(...rows); return {};},
      };
      return q;
    },
    async rpc(name, args) {
      assert.equal(name, 'match_nownow_chat_memories');
      assert.equal(args.owner_id, userId);
      assert.equal(args.candidate_ids, undefined);
      assert.equal(args.query_vector.length, 1536);
      rpcDistances.push(args.max_distance);
      return {data: args.max_distance === 0.5 ? [{summary_id: 42, content: summary.summary, created_at: null}] : []};
    },
  }};
  const previousKey = process.env.OPENAI_API_KEY;
  const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.OPENAI_API_KEY = 'test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
  });
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/embeddings');
    const {input} = JSON.parse(options.body);
    calls.push(input);
    return {ok: true, json: async () => ({data: input.map((_, index) => ({index, embedding: Array(1536).fill(0.1)}))})};
  });

  const {findChatMemories} = require('../services/chatMemorySearch');
  const question = '전에 발표 때문에 어떤 얘기를 했지?';
  const [first] = await findChatMemories(userId, question);
  assert.equal(first.summary, summary.summary);
  assert.equal('date' in first, false);
  await findChatMemories(userId, question);
  assert.equal(indexed.length, 1);
  assert.deepEqual(rpcDistances.sort(), [0.5, 0.5, 0.65, 0.65]);
  assert.equal(indexed[0].user_id, userId);
  assert.deepEqual(calls, [[question, summary.summary], [question]]);
  assert.ok(filters.filter(([, key]) => key === 'user_id').every(([, , value]) => value === userId));
  assert.equal(filters.filter(([, key]) => key === 'user_id').length, 4);
});

test('조금 먼 기억은 질문 낱말이 그날 상황·감정·분류 라벨에 있을 때만 쓴다', () => {
  const {questionWords, sharesWord} = require('../services/chatMemorySearch');
  const words = questionWords('예전에 팀장한테 혼났던 적 있었지?');
  assert.equal(sharesWord(words, {situation: '팀장 지적', emotion: '위축', category: '부장/팀장'}), true);
  assert.equal(sharesWord(words, {situation: '주말 한강 산책', emotion: '평온', category: '일상'}), false);
  // 어느 질문에나 나오는 말("예전", "기억")만 겹치면 쓰지 않는다
  assert.equal(sharesWord(questionWords('예전 기억나?'), {situation: '예전 기억', category: '일상'}), false);
  assert.equal(sharesWord(questionWords('속상해'), {situation: '팀장 지적', emotion: '속상함'}), true);
  assert.equal(sharesWord(words, undefined), false);
});
