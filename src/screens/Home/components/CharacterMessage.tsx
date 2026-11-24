import React, {useEffect, useRef} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';

import Text from '../../../components/AppText';
import {shadows} from '../../../theme/shadows';
import {useAppTheme} from '../../../theme/ThemeProvider';
import {useCharacterName} from '../../../context/CharacterNameProvider';
import type {MoodType} from '../types';

interface CharacterMessageProps {
  userMood: MoodType;
  // 말풍선을 누르면 채팅 탭으로
  onPress?: () => void;
}

// 캐릭터 머리 위 말풍선. 기분이 바뀌면 톡 튀어나오고, 누르면 채팅으로 간다.
export default function CharacterMessage({userMood, onPress}: CharacterMessageProps) {
  const {theme} = useAppTheme();
  const {characterName} = useCharacterName();
  const firstLine = '오늘 하루는 어땠어??';
  const secondLine = `${characterName}에게 말해줘!`;
  const popAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    popAnim.setValue(0);
    Animated.spring(popAnim, {
      friction: 6,
      tension: 140,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [popAnim, userMood]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: popAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
          }),
          transform: [
            {
              scale: popAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.85, 1],
              }),
            },
          ],
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${firstLine} ${secondLine} 채팅 열기`}
        disabled={!onPress}
        onPress={onPress}
        style={({pressed}) => [styles.bubble, {backgroundColor: theme.surface}, pressed && styles.pressed]}>
        <Text style={[styles.message, {color: theme.text}]}>{firstLine}{'\n'}{secondLine}</Text>
      </Pressable>
      <View style={[styles.tail, {borderTopColor: theme.surface}]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  bubble: {
    ...shadows.subtle,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  pressed: {
    transform: [{scale: 0.96}],
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  tail: {
    borderLeftColor: 'transparent',
    borderLeftWidth: 9,
    borderRightColor: 'transparent',
    borderRightWidth: 9,
    borderTopWidth: 10,
    height: 0,
    marginTop: -1,
    width: 0,
  },
});
