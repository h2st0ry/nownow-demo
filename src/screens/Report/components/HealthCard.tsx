import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Text from '../../../components/AppText';
import type {LucideIcon} from 'lucide-react-native';

import {useAppTheme} from '../../../theme/ThemeProvider';

interface HealthCardProps {
  title: string;
  value: string;
  unit?: string;
  caption?: string;
  Icon: LucideIcon;
  selected?: boolean;
  onPress?: () => void;
}

export default function HealthCard({
  title,
  value,
  unit,
  caption,
  Icon,
  selected = false,
  onPress,
}: HealthCardProps) {
  const {theme} = useAppTheme();

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({pressed}) => [
        styles.card,
        {
          backgroundColor: selected ? theme.accent : theme.surface,
          borderColor: selected ? theme.accent : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      {/* 아이콘 옆에 이름을 같은 크기로 */}
      <View style={styles.titleRow}>
        <Icon color={selected ? theme.accentText : theme.accent} size={TITLE_SIZE} />
        <Text
          numberOfLines={1}
          style={[
            styles.title,
            {color: selected ? theme.accentText : theme.textMuted},
          ]}>
          {title}
        </Text>
      </View>

      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            {color: selected ? theme.accentText : theme.text},
          ]}>
          {value}
        </Text>

        {unit && (
          <Text
            style={[
              styles.unit,
              {color: selected ? theme.accentText : theme.textMuted},
            ]}>
            {unit}
          </Text>
        )}
      </View>

      {caption && (
        <Text
          numberOfLines={1}
          style={[
            styles.caption,
            {color: selected ? theme.accentText : theme.textMuted},
          ]}>
          {caption}
        </Text>
      )}
    </Pressable>
  );
}

// 아이콘과 이름 글씨 크기 (같이 바뀐다)
const TITLE_SIZE = 18;

const styles = StyleSheet.create({
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  title: {
    flexShrink: 1,
    fontSize: TITLE_SIZE,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  pressed: {
    opacity: 0.8,
  },
  valueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
  },
  unit: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
  },
  caption: {
    fontSize: 11,
    marginTop: 3,
  },
});