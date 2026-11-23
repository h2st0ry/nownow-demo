import React, {useEffect, useRef} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';

import Text from '../../../components/AppText';
import {shadows} from '../../../theme/shadows';
import {useAppTheme} from '../../../theme/ThemeProvider';
import {interactionActions} from '../constants/homeContent';
import type {PreferenceKey, UserPreferences} from '../types';

interface ActionBarProps {
  completedPreferences: UserPreferences;
  selectedAction: PreferenceKey | null;
  onActionSelect: (action: PreferenceKey) => void;
  onCancel: () => void;
}

const BOUNCE_DURATION = 1300;

function ActionIcon({
  action,
  index,
  completed,
  selected,
  onPress,
}: {
  action: (typeof interactionActions)[number];
  index: number;
  completed: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const {theme} = useAppTheme();
  // 아이콘은 늘 통통 튄다. 아이콘마다 박자를 엇갈린다.
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bouncing = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 200),
        Animated.timing(bounceAnim, {
          duration: BOUNCE_DURATION,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          duration: BOUNCE_DURATION,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    bouncing.start();
    return () => bouncing.stop();
  }, [bounceAnim, index]);

  return (
    <Pressable
      accessibilityLabel={action.label}
      onPress={onPress}
      style={({pressed}) => [styles.item, pressed && styles.pressed]}>
      {/* 글씨 없이 흰 둥근 네모(레벨 카드와 같은 느낌) 안에 아이콘만. 고른 것만 분홍.
          이름은 화면 읽기용(accessibilityLabel)으로만 둔다. */}
      <Animated.View
        style={[
          styles.iconWrap,
          {backgroundColor: selected ? theme.accent : theme.surface},
          {
            transform: [
              {
                translateY: bounceAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -3],
                }),
              },
            ],
          },
        ]}>
        <Text style={styles.emoji}>{action.emoji}</Text>
        {/* 오늘 아직 안 한 행동 표시. 고른 뒤에도 아이콘 모양은 그대로 둔다. */}
        {!completed && (
          <View style={[styles.badge, {backgroundColor: theme.accent}]}>
            <Text style={styles.badgeMark}>!</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// 캐릭터 방 위쪽에 가로로 놓는 행동 아이콘(먹이·놀이·음악·휴식)
export default function ActionBar({
  completedPreferences,
  selectedAction,
  onActionSelect,
  onCancel,
}: ActionBarProps) {
  return (
    <View style={styles.bar}>
      {interactionActions.map((action, index) => (
        <ActionIcon
          key={action.key}
          action={action}
          index={index}
          completed={Boolean(completedPreferences[action.key])}
          selected={selectedAction === action.key}
          // 고르고 있는 아이콘을 한 번 더 누르면 선택지를 닫는다.
          onPress={() =>
            selectedAction === action.key
              ? onCancel()
              : onActionSelect(action.key)
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  item: {
    alignItems: 'center',
    width: 84,
  },
  pressed: {
    transform: [{scale: 0.9}],
  },
  iconWrap: {
    ...shadows.subtle,
    alignItems: 'center',
    borderRadius: 24,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  emoji: {
    fontSize: 42,
  },
  badge: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 20,
  },
  badgeMark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 13,
  },
});
