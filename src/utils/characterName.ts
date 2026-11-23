import {CHARACTER_NAME} from '../constants/app';
import {withJosa} from './josa';

// 글 속 '뿡뿡이(+조사)'를 사용자가 정한 캐릭터 이름으로 바꾼다. 조사는 새 이름 받침에 맞춘다.
// 예) personalize('뿡뿡이랑 쉬어갈래?', '콩') → '콩이랑 쉬어갈래?'
// 안드로이드 알림(DailyReminder.kt)에도 같은 규칙이 있다.
const JOSA = {
  가: '이/가',
  랑: '이랑/랑',
  는: '은/는',
  를: '을/를',
  와: '과/와',
  야: '이야/야',
} as const;

const PATTERN = new RegExp(`${CHARACTER_NAME}(${Object.keys(JOSA).join('|')})?`, 'g');

export const personalize = (text: string, name: string) => {
  if (!name || name === CHARACTER_NAME) return text;
  return text.replace(PATTERN, (_match, josa?: keyof typeof JOSA) =>
    josa ? withJosa(name, JOSA[josa]) : name);
};
