const chatService = require("../services/chatService");
const chatRelayService = require("../services/chatRelayService");
const { createRateLimiter, parseChatRequest } = require("../utils/chatRelay");
const { getContext } = require("../services/healthContextService");
const { findChatMemories, indexSummary } = require("../services/chatMemorySearch");
const { summarizeDay } = require("../services/chatSummaryAi");
const { getDailyStress } = require("../services/stressService");
const { healthSnapshot } = require("../services/stressCauseAnalysis");
const { getStressAnalysis } = require("../services/insightService");
const { groundedPrompt, memoryPrompt } = require("../../shared/healthRetrieval");
const { personalizationHint } = require("../utils/personalization");
const { healthSafetyReply } = require("../../shared/careSafety");
const { kstDayRange, kstToday } = require("../utils/kstDate");
const { buildHistory } = require("../utils/chatHistory");
const { getSettings } = require("../services/meService");
const { personalHealthCheck } = require("../services/personalHealthCheck");
const { MIN_SAMPLES_PER_HOUR, HIGH_STRESS_THRESHOLD } = require("../services/stressCalculator");

async function createMessage(req, res) {
  try {
    const { chat_role, message } = req.body;
    // Older app builds use AI; Supabase stores that role as ASSISTANT.
    const role = chat_role === 'AI' ? 'ASSISTANT' : chat_role;

    if (!chat_role || !message) {
      return res.status(400).json({
        message: "chat_role, message가 필요합니다."
      });
    }

    if (role !== 'USER' && role !== 'ASSISTANT') {
      return res.status(400).json({ message: '지원하지 않는 채팅 역할입니다.' });
    }

    const data = await chatService.createMessage({
      user_id: req.user.id,
      chat_role: role,
      message
    });

    res.status(201).json({
      message: "채팅 메시지 저장 성공",
      data
    });
  } catch (error) {
    res.status(500).json({
      message: "채팅 메시지 저장 실패",
      error: error.message
    });
  }
}

async function getMessages(req, res) {
  try {
    const data = await chatService.getMessagesByUser(req.user.id);

    res.json({
      message: "채팅 기록 조회 성공",
      data
    });
  } catch (error) {
    res.status(500).json({
      message: "채팅 기록 조회 실패",
      error: error.message
    });
  }
}

async function deleteMessage(req, res) {
  try {
    const { chat_id } = req.params;

    if (!chat_id) {
      return res.status(400).json({
        message: "chat_id가 필요합니다."
      });
    }

    await chatService.deleteMessage(chat_id, req.user.id);

    res.json({
      message: "채팅 메시지 삭제 성공"
    });
  } catch (error) {
    res.status(500).json({
      message: "채팅 메시지 삭제 실패",
      error: error.message
    });
  }
}

async function createSummary(req, res) {
  try {
    const { chat_id, summary, keywords = [] } = req.body;

    if (!chat_id || !summary) {
      return res.status(400).json({
        message: "chat_id, summary가 필요합니다."
      });
    }

    // 리포트 스트레스 원인 통계에 쓰는 감정·원인 키워드
    if (
      !Array.isArray(keywords) ||
      keywords.length > 10 ||
      keywords.some(word => typeof word !== "string")
    ) {
      return res.status(400).json({
        message: "keywords는 문자열 배열(최대 10개)이어야 합니다."
      });
    }

    // 오늘 대화로 AI 요약(+ 상황·감정·분류)을 만들고, 그날 건강 수치도 같이 구한다.
    // 키가 없거나 실패하면 앱이 보낸 요약을 그대로 쓴다.
    const today = kstToday();
    const { start } = kstDayRange(today);
    const [ai, daily] = await Promise.all([
      chatService.getMessagesSince(req.user.id, start)
        .then(summarizeDay)
        .catch(error => {
          console.log("[chat] AI 요약 실패:", error.message);
          return null;
        }),
      getDailyStress(req.user.id, today).catch(() => null)
    ]);

    // AI가 고른 원인 분류를 키워드에 더한다(리포트 원인 통계에도 반영). '일상'만 있었으면 바꾼다.
    let savedKeywords = keywords;
    if (ai?.category && ai.category !== "일상" && !keywords.includes(ai.category)) {
      savedKeywords = [...keywords.filter(word => word !== "일상"), ai.category].slice(0, 10);
    }

    const data = await chatService.createSummary({
      chat_id,
      user_id: req.user.id,
      summary: ai?.summary ?? summary,
      keywords: savedKeywords
    });

    // 과거 기억 검색·원인 분석용 임베딩. 실패해도 요약 저장은 성공으로 두고, 검색할 때 다시 만든다.
    const metadata = {
      date: today,
      keywords: savedKeywords,
      summary_type: ai ? "ai" : "rule",
      ...(ai && { situation: ai.situation, emotion: ai.emotion, category: ai.category }),
      health: healthSnapshot(daily)
    };
    await indexSummary(req.user.id, data.summary_id, data.summary, metadata).catch(error =>
      console.log("[chat] 요약 임베딩 실패:", error.message)
    );

    res.status(201).json({
      message: "채팅 요약 저장 성공",
      data
    });
  } catch (error) {
    res.status(error.status ?? 500).json({
      message: error.status ? error.message : "채팅 요약 저장 실패",
      error: error.message
    });
  }
}

async function getSummaries(req, res) {
  try {
    const data = await chatService.getSummariesByUser(req.user.id);

    res.json({
      message: "채팅 요약 조회 성공",
      data
    });
  } catch (error) {
    res.status(500).json({
      message: "채팅 요약 조회 실패",
      error: error.message
    });
  }
}

// AI 서버 공유 한도(전체 분당 5회)를 한 사람이 다 쓰지 않게 사용자별로도 막는다.
const allowReply = createRateLimiter(5);

const explainsScore = message =>
  /스트레스/.test(message) && /계산|산출|어떻게\s*(나와|정해|구해|매겨)/.test(message);

const SCORE_EXPLANATION = `스트레스 지수는 두 단계로 계산해. 한 시간에 심박 기록이 ${MIN_SAMPLES_PER_HOUR}개 이상이면 평균 심박수 점수 60%, 심박수 표준편차 점수 40%를 합쳐 시간별 지수를 만들어.\n\n하루 점수는 시간별 평균 50%, ${HIGH_STRESS_THRESHOLD}점 이상인 시간의 비율 30%, 최고점 20%를 먼저 합쳐. 그 결과 80%에 수축기 혈압과 걸음수 점수를 각각 10% 더하고, 수면시간을 반영해 최대 100점으로 표시해. 심박 기록이 부족하면 점수가 없고, 혈압이나 걸음수 기록이 없으면 있는 항목만 다시 비율을 맞춰.\n\n내 설정의 스트레스 기준은 뿡뿡이가 생활관리를 제안할 때 참고해. 점수 계산에는 들어가지 않아.`;

const toCasual = answer => answer
  .replace(/해볼까요\?/g, '해볼까?')
  .replace(/볼래요\?/g, '볼래?')
  .replace(/알려줄게요/g, '알려줄게')
  .replace(/해드릴게요/g, '해줄게')
  .replace(/(하면|하는 게|이|가) 좋겠어요/g, '$1 좋겠어')
  .replace(/괜찮아요/g, '괜찮아')
  .replace(/이에요/g, '이야')
  .replace(/예요/g, '야')
  .replace(/하세요/g, '해 줘')
  .replace(/주세요/g, '줘')
  .replace(/해요/g, '해');

// intent: 'solution' — 대화 끝에 해결책을 달라는 버튼. 사용자가 한 말이 아니라서
// 질문은 저장하지 않고, 앱이 보낸 문장 대신 서버가 정한 지시문을 쓴다.
const solutionPrompt = causes =>
  `사용자가 말한 오늘의 상황${causes ? `과 정리한 키워드(${causes})` : ''}에 맞춰 부담 없는 해결책 한 가지만 제안해줘. 커뮤니티에 글 올리기는 빼고, 원인은 새로 추정하지 말아줘.`;

function parseReplyBody(body) {
  if (body?.intent === "solution") {
    const keywords = body.keywords ?? [];
    if (
      !Array.isArray(keywords) ||
      keywords.length > 20 ||
      keywords.some(word => typeof word !== "string" || !word.trim() || word.length > 30)
    ) {
      return { error: "keywords는 30자 이하 문자열 배열(최대 20개)이어야 합니다." };
    }
    const causes = [...new Set(keywords.map(word => word.trim()))].join(", ");
    return { message: solutionPrompt(causes), saveUserMessage: false };
  }
  const { message, error } = parseChatRequest({ message: body?.message });
  return { message, error, saveUserMessage: true };
}

const asksStressCause = message =>
  /스트레스.{0,12}(원인|이유|뭐\s*때문)|(원인|이유).{0,8}스트레스|왜.{0,8}스트레스/.test(message);

function stressCauseReply(analysis) {
  if (analysis.status !== "found") {
    return `${analysis.message} 지금까지 하루 정리 ${analysis.summaryDays}일, 스트레스 점수가 있는 날 ${analysis.scoredDays}일 모였어. 🌱`;
  }
  const [top, ...rest] = analysis.causes;
  const others = rest.slice(0, 2).map(cause => `'${cause.label}'(+${cause.diff}점)`);
  return `내가 지금까지 기록을 같이 봤는데, ${top.conclusion}` +
    (others.length ? ` 그다음으로는 ${others.join(", ")} 쪽도 스트레스가 높았어.` : "") +
    " 이건 기록으로 본 경향이라 진단은 아니야. 😊";
}

// 답변만 만든다. 저장은 reply()가 한다. 반환: { reply, suggestion? }
async function generateReply(req, message, history) {
  if (explainsScore(message)) return { reply: SCORE_EXPLANATION };

  // "내 스트레스 원인이 뭐야?" → 대화 요약 + 건강 수치로 계산한 결론을 그대로 알려 준다(AI가 지어내지 않게).
  if (asksStressCause(message)) {
    const analysis = await getStressAnalysis(req.user.id).catch(() => null);
    if (analysis) return { reply: stressCauseReply(analysis) };
  }

  let suggestion;
  // 답할 때마다 비슷한 과거 하루 요약을 찾는다(pgvector). 충분히 비슷한 게 없으면 빈 목록.
  const memoriesPromise = findChatMemories(req.user.id, message).catch(error => {
    console.log("[chat] 과거 기억 검색 실패:", error.message);
    return [];
  });
  let prompt;
  if (req.body.useHealthContext !== true) {
    prompt = memoryPrompt(message, await memoriesPromise);
  } else {
    const [context, memories] = await Promise.all([
      getContext(req.user.id, message).catch(() => null),
      memoriesPromise,
    ]);
    const today = kstToday();
    const safety = healthSafetyReply(message, context, today);
    if (safety) return { reply: safety };
    const check = await personalHealthCheck(req.user, message, context).catch(() => null);
    const score = context?.documents.find(doc => doc.kind === 'stress' && doc.date === today)?.facts.score;
    if (!check?.suggestion && /스트레스|건강\s*기록/.test(message) && typeof score === 'number') {
      const settings = await getSettings(req.user.id).catch(() => null);
      const threshold = settings?.stress_threshold ?? HIGH_STRESS_THRESHOLD;
      if (score >= threshold) suggestion = 'stress';
    }
    if (check) return { ...check, suggestion: check.suggestion ?? suggestion };
    prompt = groundedPrompt(message, context, memories, personalizationHint(req.user.user_metadata));
  }
  const answer = await chatRelayService.requestReply(prompt, history);
  return { reply: toCasual(answer), suggestion };
}

// 사용자 메시지와 답변을 서버가 저장한다. 앱은 /reply로 가는 대화를 따로 저장하지 않는다.
// 대화 맥락(history)도 앱이 보낸 값 대신 오늘 저장된 대화로 만든다.
async function reply(req, res) {
  const { message, error, saveUserMessage } = parseReplyBody(req.body);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const userId = req.user.id;

  if (!explainsScore(message) && !allowReply(userId)) {
    return res.status(429).json({
      message: "메시지를 너무 빨리 보냈어요. 1분 뒤에 다시 시도해 주세요."
    });
  }

  let history;
  let userRow;
  try {
    const { start } = kstDayRange(kstToday());
    history = buildHistory(await chatService.getMessagesSince(userId, start).catch(() => []));
    userRow = saveUserMessage
      ? await chatService.createMessage({ user_id: userId, chat_role: "USER", message })
      : null;
  } catch (saveError) {
    return res.status(500).json({ message: "메시지를 저장하지 못했어요. 다시 시도해 주세요." });
  }

  try {
    const data = await generateReply(req, message, history);
    // 답변 저장에 실패해도 답변은 보여 준다. 다음 대화 맥락에서 이 답변만 빠진다.
    const saved = await chatService
      .createMessage({ user_id: userId, chat_role: "ASSISTANT", message: data.reply })
      .catch(saveError => {
        console.log("[chat] 답변 저장 실패:", saveError.message);
        return null;
      });

    res.json({
      message: "AI 답변 성공",
      data: { ...data, userMessageId: userRow?.chat_id ?? null, assistantMessageId: saved?.chat_id ?? null }
    });
  } catch (replyError) {
    // 사용자 메시지는 이미 저장됐다. 앱이 요약 대상으로 쓸 수 있게 id를 같이 준다.
    res.status(replyError.status ?? 500).json({
      message: replyError.status ? replyError.message : "AI 답변 실패",
      data: { userMessageId: userRow?.chat_id ?? null }
    });
  }
}

module.exports = {
  createMessage,
  getMessages,
  deleteMessage,
  createSummary,
  getSummaries,
  reply
};
