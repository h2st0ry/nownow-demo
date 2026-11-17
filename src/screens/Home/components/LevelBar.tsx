import React, {useEffect, useRef} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';

import Text from '../../../components/AppText';
import {shadows} from '../../../theme/shadows';
import {useAppTheme} from '../../../theme/ThemeProvider';

interface LevelBarProps {
  level: number;
  // 이번 레벨에서 모은 경험치 / 다음 레벨까지 필요한 경험치
  exp: number;
  maxExp: number;
  // 레벨 뱃지를 누르면 (날짜별 기록 창 열기)
  onPressBadge?: () => void;
}

// 캐릭터 방 위에 따로 놓는 레벨 카드: [Lv.N] ━━━━━━░░░ exp/maxExp
export default function LevelBar({level, exp, maxExp, onPressBadge}: LevelBarProps) {
  const {theme} = useAppTheme();
  const ratio = maxExp > 0 ? Math.min(1, Math.max(0, exp / maxExp)) : 0;
  const fillAnim = useRef(new Animated.Value(ratio)).current;

  // 경험치가 오르면 바가 부드럽게 차오른다.
  useEffect(() => {
    Animated.timing(fillAnim, {
      duration: 600,
      toValue: ratio,
      useNativeDriver: false,
    }).start();
  }, [fillAnim, ratio]);

  return (
    <View
      accessibilityLabel={`레벨 ${level}, 경험치 ${exp} / ${maxExp}`}
      style={[styles.card, {backgroundColor: theme.surface}]}>
      <Pressable
        accessibilityHint="날짜별로 고른 기록을 봐요"
        accessibilityRole="button"
        disabled={!onPressBadge}
        onPress={onPressBadge}
        style={({pressed}) => [
          styles.badge,
          {backgroundColor: theme.accent},
          pressed && styles.pressed,
        ]}>
        <Text style={[styles.badgeText, {color: theme.accentText}]}>
          Lv.{level}
        </Text>
      </Pressable>
      <View style={[styles.track, {backgroundColor: theme.border}]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: theme.accent,
              width: fillAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={[styles.exp, {color: theme.textMuted}]}>
        {exp}/{maxExp}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...shadows.subtle,
    alignItems: 'center',
    borderRadius: 22,
    columnGap: 10,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  badge: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pressed: {
    opacity: 0.75,
    transform: [{scale: 0.94}],
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '800',
  },
  track: {
    borderRadius: 11,
    flex: 1,
    height: 22,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 11,
    height: '100%',
  },
  exp: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'right',
  },
});
