import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import Text from '../../../components/AppText';
import {getTodayInteractions} from '../../../services/api/character';
import {useAppTheme} from '../../../theme/ThemeProvider';
import {interactionActions} from '../constants/homeContent';
import type {PreferenceKey, UserPreferences} from '../types';
import {usePersonalize} from '../../../context/CharacterNameProvider';

interface ChoiceHistorySheetProps {
  visible: boolean;
  onClose: () => void;
}

// 최근 며칠까지 보여 줄지
const HISTORY_DAYS = 14;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
// 홈에 있는 행동 종류만 보여 준다.
const actionKeys = new Set<string>(interactionActions.map(({key}) => key));

// 폰 시간 기준 "YYYY-MM-DD"
const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

const recentDates = () =>
  Array.from({length: HISTORY_DAYS}, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date;
  });

const dateTitle = (date: Date, index: number) => {
  const base = `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
  return index === 0 ? `오늘 · ${base}` : index === 1 ? `어제 · ${base}` : base;
};

interface DayChoices {
  title: string;
  choices: UserPreferences;
}

// 레벨 뱃지를 누르면 올라오는 창: 날짜별로 뿡뿡이에게 고른 것들
export default function ChoiceHistorySheet({visible, onClose}: ChoiceHistorySheetProps) {
  const {theme} = useAppTheme();
  const p = usePersonalize();
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<DayChoices[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setDays(null);
    setFailed(false);

    const dates = recentDates();
    Promise.all(dates.map(date => getTodayInteractions(toDateKey(date))))
      .then(results => {
        if (cancelled) return;
        const list = results
          .map((interactions, index) => {
            // 같은 종류를 여러 번 골랐으면 마지막에 고른 것만 남긴다(오래된 순).
            const choices: UserPreferences = {};
            for (const {action, choice} of interactions) {
              if (choice && actionKeys.has(action)) choices[action as PreferenceKey] = choice;
            }
            return {title: dateTitle(dates[index], index), choices};
          })
          .filter(day => Object.keys(day.choices).length > 0);
        setDays(list);
      })
      .catch(error => {
        console.log('[character] 기록 불러오기 실패:', error);
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal
      animationType="slide"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {backgroundColor: theme.surface, paddingBottom: insets.bottom + 20},
          ]}>
          <View style={[styles.handle, {backgroundColor: theme.border}]} />
          <Text style={[styles.title, {color: theme.text}]}>{p('뿡뿡이와 함께한 기록')}</Text>

          {failed ? (
            <Text style={[styles.notice, {color: theme.textMuted}]}>
              지금은 기록을 불러올 수 없어요.
            </Text>
          ) : !days ? (
            <ActivityIndicator style={styles.loading} color={theme.accent} />
          ) : days.length === 0 ? (
            <Text style={[styles.notice, {color: theme.textMuted}]}>
              {p('아직 함께한 기록이 없어요. 오늘 뿡뿡이를 돌봐 줄래?')}
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {days.map(day => (
                <View key={day.title} style={styles.day}>
                  <Text style={[styles.dayTitle, {color: theme.textMuted}]}>
                    {day.title}
                  </Text>
                  <View style={styles.chips}>
                    {interactionActions
                      .filter(({key}) => day.choices[key])
                      .map(({key, emoji}) => (
                        <View
                          key={key}
                          style={[styles.chip, {backgroundColor: theme.surfaceMuted}]}>
                          <Text style={styles.chipEmoji}>{emoji}</Text>
                          <Text
                            numberOfLines={1}
                            style={[styles.chipLabel, {color: theme.text}]}>
                            {day.choices[key]}
                          </Text>
                        </View>
                      ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    marginBottom: 14,
    width: 40,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 14,
  },
  loading: {
    marginVertical: 24,
  },
  notice: {
    fontSize: 14,
    marginVertical: 24,
    textAlign: 'center',
  },
  day: {
    marginBottom: 18,
  },
  dayTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});
