// 하루 대화를 OpenAI로 정리한다: 2~3문장 요약 + 상황 라벨 + 감정 + 원인 분류.
// 요약은 임베딩해서 과거 기억 검색과 스트레스 원인 분석에 쓴다.
// 키가 없거나 실패하면 null을 돌려주고, 부르는 쪽이 앱이 만든 요약을 그대로 쓴다.
const { CAUSE_KEYWORDS } = require('./insightCalculator');

const MODEL = 'gpt-4o-mini';
const MAX_TRANSCRIPT = 4000;

const INSTRUCTIONS =
  '너는 감정일기 앱의 하루 정리 도우미야. 아래 대화는 사용자와 캐릭터 뿡뿡이의 오늘 대화야. ' +
  '다음 JSON 하나만 출력해: {"summary": string, "situation": string, "emotion": string, "category": string}. ' +
  'summary: 사용자가 오늘 겪은 일, 그때 느낀 감정, 스트레스 원인이 드러나게 한국어 2~3문장. "사용자는"으로 시작하지 말고 "~했다"체로. 뿡뿡이가 한 말이나 제안은 넣지 마. ' +
  'situation: 오늘 가장 중심이 된 구체적 상황을 15자 이내 명사구로 (예: "졸업작품 마감", "팀장 지적", "시험 공부"). 특별한 일이 없으면 "평범한 하루". ' +
  'emotion: 가장 두드러진 감정 한 단어 (예: 불안, 속상함, 피곤, 기쁨, 평온). ' +
  `category: 다음 중 하나만 고른다: ${CAUSE_KEYWORDS.join(', ')}. 해당 없으면 "일상". ` +
  '대화에 없는 내용은 추측하지 마.';

// messages: [{chat_role, message}] 오래된 순
function buildTranscript(messages) {
  const lines = messages
    .filter(row => row.message?.trim())
    .map(row => `${row.chat_role === 'USER' ? '사용자' : '뿡뿡이'}: ${row.message.trim()}`);
  // 길면 최근 대화를 남긴다.
  let transcript = lines.join('\n');
  if (transcript.length > MAX_TRANSCRIPT) transcript = transcript.slice(-MAX_TRANSCRIPT);
  return transcript;
}

const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// AI 응답(JSON 문자열)을 검사해서 정리한다. 요약이 없으면 null.
function parseDaySummary(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const summary = clean(data?.summary, 800);
  if (!summary) return null;
  const category = CAUSE_KEYWORDS.includes(data.category) ? data.category : '일상';
  return {
    summary,
    situation: clean(data.situation, 30) || '평범한 하루',
    emotion: clean(data.emotion, 15) || null,
    category,
  };
}

// 반환: {summary, situation, emotion, category} 또는 null
async function summarizeDay(messages) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !messages.some(row => row.chat_role === 'USER' && row.message?.trim())) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: INSTRUCTIONS },
        { role: 'user', content: buildTranscript(messages) },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Summary HTTP ${response.status}`);
  const data = await response.json();
  return parseDaySummary(data?.choices?.[0]?.message?.content ?? '');
}

module.exports = { buildTranscript, parseDaySummary, summarizeDay };
