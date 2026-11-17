const supabase = require("../config/supabase");
const { kstDayRange, kstToday } = require("../utils/kstDate");
const { calculateLevel } = require("./characterLevel");

async function createInteraction(user_id, action, choice) {
  const { data, error } = await supabase
    .from("character_interactions")
    .insert([{ user_id, action, choice }])
    .select("interaction_id, action, choice, created_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// 그날(한국 시간) 상호작용, 오래된 순
async function getInteractions(user_id, date) {
  const { start, end } = kstDayRange(date);

  const { data, error } = await supabase
    .from("character_interactions")
    .select("interaction_id, action, choice, created_at")
    .eq("user_id", user_id)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// 한 번에 최대 1000행씩 끝까지 읽는다(Supabase 기본 한도).
async function readAll(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await buildQuery().range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

async function getLevel(user_id) {
  const [messages, interactions] = await Promise.all([
    readAll(() => supabase.from("chat_messages").select("created_at")
      .eq("user_id", user_id).eq("chat_role", "USER").order("created_at")),
    readAll(() => supabase.from("character_interactions").select("action, created_at")
      .eq("user_id", user_id).order("created_at"))
  ]);
  return calculateLevel(messages.map(row => row.created_at), interactions, kstToday());
}

module.exports = {
  createInteraction,
  getInteractions,
  getLevel
};
