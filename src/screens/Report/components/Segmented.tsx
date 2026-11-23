import React from 'react';
import {Pressable, StyleSheet, View, type ViewStyle} from 'react-native';

import Text from '../../../components/AppText';
import {shadows} from '../../../theme/shadows';
import {useAppTheme} from '../../../theme/ThemeProvider';

// iOS 세그먼트 버튼: 옅은 바탕 위에 고른 칸만 흰 알약
interface SegmentedProps<K extends string> {
  options: {key: K; label: string}[];
  value: K;
  onChange: (key: K) => void;
  style?: ViewStyle;
}

export default function Segmented<K extends string>({options, value, onChange, style}: SegmentedProps<K>) {
  const {theme} = useAppTheme();

  return (
    <View style={[styles.track, {backgroundColor: theme.border}, style]}>
      {options.map(option => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="tab"
            accessibilityState={{selected: active}}
            onPress={() => onChange(option.key)}
            style={[styles.segment, active && [styles.active, {backgroundColor: theme.surface}]]}>
            <Text style={[styles.label, {color: theme.text}, active && styles.activeLabel]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 10,
    flexDirection: 'row',
    padding: 2,
  },
  segment: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    paddingVertical: 7,
  },
  active: {
    ...shadows.subtle,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeLabel: {
    fontWeight: '700',
  },
});
