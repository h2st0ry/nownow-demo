import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';

import {CHARACTER_NAME} from '../constants/app';
import {setReminderCharacterName} from '../services/notifications/dailyReminder';
import {supabase} from '../services/supabase';
import {personalize} from '../utils/characterName';

// 사용자가 정한 캐릭터 이름. 계정 정보(user_metadata.nownow_character_name)에 저장하고, 없으면 기본 이름(뿡뿡이).
export const CHARACTER_NAME_KEY = 'nownow_character_name';
export const CHARACTER_NAME_MAX = 10;

interface CharacterNameValue {
  characterName: string;
  // 저장은 계정 설정 화면이 하고, 저장한 뒤 화면에 바로 보이도록 여기 값을 바꾼다.
  applyCharacterName: (name: string | null) => void;
}

const CharacterNameContext = createContext<CharacterNameValue>({
  characterName: CHARACTER_NAME,
  applyCharacterName: () => {},
});

const nameFrom = (metadata: Record<string, unknown> | undefined) => {
  const saved = metadata?.[CHARACTER_NAME_KEY];
  return typeof saved === 'string' && saved.trim() ? saved.trim() : CHARACTER_NAME;
};

export function CharacterNameProvider({children}: {children: React.ReactNode}) {
  const [characterName, setCharacterName] = useState(CHARACTER_NAME);

  useEffect(() => {
    // 로그인·로그아웃·계정 정보 변경 때마다 다시 읽는다.
    supabase.auth.getUser().then(({data}) => setCharacterName(nameFrom(data.user?.user_metadata))).catch(() => {});
    const {data} = supabase.auth.onAuthStateChange((_event, session) => {
      setCharacterName(nameFrom(session?.user.user_metadata));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // 폰 알림(안드로이드)도 같은 이름을 쓰게 넘겨준다.
  useEffect(() => {
    void setReminderCharacterName(characterName === CHARACTER_NAME ? '' : characterName).catch(() => {});
  }, [characterName]);

  const value = useMemo(() => ({
    characterName,
    applyCharacterName: (name: string | null) => setCharacterName(name?.trim() || CHARACTER_NAME),
  }), [characterName]);

  return <CharacterNameContext.Provider value={value}>{children}</CharacterNameContext.Provider>;
}

export const useCharacterName = () => useContext(CharacterNameContext);

// 글 속 '뿡뿡이'를 정한 이름으로 바꾸는 함수를 돌려준다. 예) const p = usePersonalize(); p('뿡뿡이 알림')
export const usePersonalize = () => {
  const {characterName} = useCharacterName();
  return useCallback((text: string) => personalize(text, characterName), [characterName]);
};
