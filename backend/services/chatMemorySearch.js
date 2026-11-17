const supabase = require('../config/supabase');
const { addDays, kstDayRange, kstDateOf, kstToday } = require('../utils/kstDate');

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

async function findChatMemories(userId, question) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !userId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];

  const {start} = kstDayRange(addDays(kstToday(), -29));
  const {data, error} = await supabase.from('chat_summaries')
    .select('summary_id,summary').eq('user_id', userId)
    .gte('created_at', start).order('created_at', {ascending: false}).limit(12);
  if (error) throw error;
  const summaries = data.filter(row => row.summary?.trim())
    .map(row => ({id: row.summary_id, text: toContent(row.summary)}));
  if (!summaries.length) return [];

  const ids = summaries.map(row => row.id);
  const cached = await supabase.from('memory_embeddings').select('nownow_summary_id,content,metadata')
    .eq('user_id', userId).in('nownow_summary_id', ids);
  if (cached.error) throw cached.error;
  const indexed = new Map(cached.data.map(row => [row.nownow_summary_id, row]));
  // 저장할 때 임베딩을 못 만든 요약(키가 없었거나 실패)은 여기서 채운다. 붙여 둔 metadata는 그대로 둔다.
  const pending = summaries.filter(row => indexed.get(row.id)?.content !== row.text)
    .map(row => ({...row, metadata: indexed.get(row.id)?.metadata}));
  const [query, ...vectors] = await embed([question, ...pending.map(row => row.text)], key);
  if (pending.length) await saveEmbeddings(userId, pending, vectors);
  const matches = await supabase.rpc('match_nownow_chat_memories', {
    owner_id: userId, query_vector: query, candidate_ids: ids,
  });
  if (matches.error) throw matches.error;
  // 찾은 기억에 그날 상황·건강 수치가 있으면 같이 넘겨서 "그때 잠을 4시간 잤지" 같은 말을 할 수 있게 한다.
  return matches.data.map(row => {
    const metadata = indexed.get(row.summary_id)?.metadata ?? {};
    return {
      date: metadata.date ?? kstDateOf(row.created_at),
      summary: row.content.slice(0, 180),
      ...(metadata.situation && {situation: metadata.situation}),
      ...(metadata.health && {health: metadata.health}),
    };
  });
}

module.exports = {findChatMemories, indexSummary};
