const supabase = require('../config/supabase');
const { kstDateOf } = require('../utils/kstDate');

const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;

async function embed(input, key) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, dimensions: DIMENSIONS, input }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Embedding HTTP ${response.status}`);
  const {data} = await response.json();
  const vectors = input.map((_, index) => data?.find(row => row.index === index)?.embedding);
  if (vectors.some(vector => !Array.isArray(vector) || vector.length !== DIMENSIONS || !vector.every(Number.isFinite))) {
    throw new Error('Invalid embedding response');
  }
  return vectors;
}

const toContent = text => Array.from(text).slice(0, 800).join('');

// row.metadata가 있으면 같이 저장한다(날짜·상황·감정·분류·그날 건강 수치 등).
async function saveEmbeddings(userId, rows, vectors) {
  const write = await supabase.from('memory_embeddings').upsert(rows.map((row, index) => ({
    user_id: userId,
    nownow_summary_id: row.id,
    source_type: 'CHAT_SUMMARY',
    content: row.text,
    embedding: vectors[index],
    metadata: {...(row.metadata ?? {}), model: MODEL},
  })), {onConflict: 'nownow_summary_id'});
  if (write.error) throw write.error;
}

// 요약을 저장한 직후 바로 임베딩해 둔다. 키가 없으면 아무것도 안 한다.
async function indexSummary(userId, summaryId, summary, metadata = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !userId || !summaryId || !summary?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const row = {id: summaryId, text: toContent(summary), metadata};
  const [vector] = await embed([row.text], key);
  await saveEmbeddings(userId, [row], [vector]);
  return true;
}

// 한 번에 새로 임베딩할 요약 수 상한. 나머지는 다음 질문 때 이어서 채운다.
const BACKFILL_LIMIT = 50;
const MAX_MEMORIES = 3;
// 코사인 거리 기준. 실측(데모 계정): 질문 말투일 때 관련 요약 0.45~0.65, 관련 없는 요약 0.59~0.67.
const STRICT_DISTANCE = 0.5;
const LOOSE_DISTANCE = 0.65;

// 질문을 두 글자 조각으로 나눈다("팀장한테" → 팀장, 장한, 한테). 한국어는 조사가 붙어서 낱말 단위로는 잘 안 맞는다.
// 어느 질문에나 나오는 말("예전", "기억")은 뺀다.
const COMMON = new Set(['예전', '전에', '지난', '난번', '번에', '기억', '억나', '있었', '었지', '했던', '했을', '오늘', '요즘', '그때', '어땠', '땠더', '더라', '너무', '나는', '내가']);
function questionWords(question) {
  const words = new Set();
  for (const token of String(question).split(/[^가-힣a-zA-Z0-9]+/)) {
    for (let i = 0; i + 2 <= token.length; i += 1) {
      const pair = token.slice(i, i + 2);
      if (!COMMON.has(pair)) words.add(pair);
    }
  }
  return words;
}

// 상황·감정·분류 라벨(짧고 정돈된 말)에 질문 조각이 들어 있나. 요약 본문은 보지 않는다(흔한 말이 많아서).
function sharesWord(words, metadata) {
  const labels = [metadata?.situation, metadata?.emotion, metadata?.category]
    .filter(label => typeof label === 'string' && label !== '평범한 하루' && label !== '일상').join(' ');
  return [...words].some(word => labels.includes(word));
}

// 기간 제한 없이 이 사용자의 전체 요약에서 비슷한 기억을 찾는다.
async function findChatMemories(userId, question) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !userId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  const [{data, error}, cached] = await Promise.all([
    supabase.from('chat_summaries').select('summary_id,summary').eq('user_id', userId)
      .order('summary_id', {ascending: false}),
    supabase.from('memory_embeddings').select('nownow_summary_id,content,metadata')
      .eq('user_id', userId).eq('source_type', 'CHAT_SUMMARY'),
  ]);
  if (error) throw error;
  if (cached.error) throw cached.error;
  const summaries = data.filter(row => row.summary?.trim())
    .map(row => ({id: row.summary_id, text: toContent(row.summary)}));
  if (!summaries.length) return [];

  const indexed = new Map(cached.data.map(row => [row.nownow_summary_id, row]));
  // 저장할 때 임베딩을 못 만든 요약(키가 없었거나 실패)이나 내용이 바뀐 요약은 여기서 채운다. 붙여 둔 metadata는 그대로 둔다.
  const pending = summaries.filter(row => indexed.get(row.id)?.content !== row.text)
    .slice(0, BACKFILL_LIMIT)
    .map(row => ({...row, metadata: indexed.get(row.id)?.metadata}));
  const [query, ...vectors] = await embed([question, ...pending.map(row => row.text)], key);
  if (pending.length) await saveEmbeddings(userId, pending, vectors);
  // 같은 질문으로 두 번 찾는다. 아주 가까운 기억(STRICT)은 그대로 쓰고,
  // 조금 먼 기억(LOOSE)은 그날 상황·감정·분류 라벨에 질문의 낱말이 들어 있을 때만 쓴다.
  // 질문이 "예전에 ~ 기억나?" 같은 말투라 거리가 멀게 나와서, 거리만으로는 관련 있는 기억을 놓친다.
  const search = (maxDistance, count) => supabase.rpc('match_nownow_chat_memories', {
    owner_id: userId, query_vector: query, max_distance: maxDistance, match_count: count,
  });
  const [strict, loose] = await Promise.all([search(STRICT_DISTANCE, MAX_MEMORIES), search(LOOSE_DISTANCE, 10)]);
  if (strict.error) throw strict.error;
  if (loose.error) throw loose.error;
  const words = questionWords(question);
  const strictIds = new Set(strict.data.map(row => row.summary_id));
  const labelled = loose.data.filter(row => !strictIds.has(row.summary_id) &&
    sharesWord(words, indexed.get(row.summary_id)?.metadata));
  const matches = [...strict.data, ...labelled].slice(0, MAX_MEMORIES);
  // 찾은 기억에 그날 상황·건강 수치가 있으면 같이 넘겨서 "그때 잠을 4시간 잤지" 같은 말을 할 수 있게 한다.
  // 날짜가 없는 옛 요약은 date를 빼고 넘긴다.
  return matches.map(row => {
    const metadata = indexed.get(row.summary_id)?.metadata ?? {};
    const date = metadata.date ?? (row.created_at ? kstDateOf(row.created_at) : null);
    return {
      ...(date && {date}),
      summary: row.content.slice(0, 180),
      ...(metadata.situation && {situation: metadata.situation}),
      ...(metadata.health && {health: metadata.health}),
    };
  });
}

module.exports = {findChatMemories, indexSummary, questionWords, sharesWord};
