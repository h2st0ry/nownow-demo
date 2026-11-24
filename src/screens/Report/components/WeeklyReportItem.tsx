import React from 'react';
import {ChevronRight} from 'lucide-react-native';
import {Pressable, StyleSheet, View} from 'react-native';
import Text from '../../../components/AppText';
import {useAppTheme} from '../../../theme/ThemeProvider';

interface Props {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  // 목록 맨 아래 줄이면 구분선을 그리지 않는다
  last?: boolean;
}

// iOS 목록 한 줄 (ReportList 안에 넣는다)
export default function WeeklyReportItem({title, subtitle, onPress, last = false}: Props) {
  const {theme} = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && {backgroundColor: theme.pressed}]}>
      <View style={[styles.content, !last && {borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth}]}>
        <View style={styles.texts}>
          <Text style={[styles.title, {color: theme.text}]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, {color: theme.textMuted}]}>{subtitle}</Text>}
        </View>
        <ChevronRight size={18} color={theme.placeholder} />
      </View>
    </Pressable>
  );
}

// 줄들을 하나의 둥근 카드로 묶는다
export function ReportList({children}: {children: React.ReactNode}) {
  const {theme} = useAppTheme();
  return <View style={[styles.list, {backgroundColor: theme.surface}]}>{children}</View>;
}

const styles = StyleSheet.create({
  list: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    paddingLeft: 16,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingRight: 14,
    paddingVertical: 12,
  },
  texts: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
