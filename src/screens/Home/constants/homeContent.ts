import type {PreferenceKey} from '../types';

export const interactionActions: {
  key: PreferenceKey;
  label: string;
  emoji: string;
}[] = [
  {key: 'feed', label: '밥주기', emoji: '🍚'},
  {key: 'play', label: '놀이', emoji: '🎾'},
  {key: 'music', label: '음악', emoji: '🎧'},
  {key: 'hobby', label: '휴식', emoji: '🛁'},
];
