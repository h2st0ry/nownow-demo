import {request} from './client';

export interface CharacterInteraction {
  interaction_id: number;
  action: string;
  choice: string | null;
  created_at: string;
}

// 캐릭터 상호작용(먹이 주기 등)과 고른 취향을 저장한다.
export const saveInteraction = async (action: string, choice: string) => {
  const res = await request<{message: string; data: CharacterInteraction}>(
    'POST',
    '/api/character/interactions',
    {body: {action, choice}},
  );
  return res.data;
};

export interface CharacterLevel {
  level: number;
  exp: number; // 이번 레벨에서 모은 경험치
  maxExp: number; // 다음 레벨까지 필요한 경험치
  totalExp: number;
  todayExp: number;
}

// 채팅·캐릭터 돌보기 기록으로 서버가 계산한 레벨
export const getCharacterLevel = async () => {
  const res = await request<{message: string; data: CharacterLevel}>(
    'GET',
    '/api/character/level',
  );
  return res.data;
};

// 그날(한국 시간, "YYYY-MM-DD") 상호작용, 오래된 순. 날짜를 빼면 오늘.
export const getTodayInteractions = async (date?: string) => {
  const res = await request<{message: string; data: CharacterInteraction[]}>(
    'GET',
    '/api/character/interactions',
    date ? {query: {date}} : undefined,
  );
  return res.data;
};
