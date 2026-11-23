import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';

import Text from '../../../components/AppText';
import {useAppTheme} from '../../../theme/ThemeProvider';

interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
}

// 상세 화면 머리: 왼쪽 위 뒤로가기, 그 아래 큰 제목 (리포트 제목·탭은 상세 화면에서 숨긴다)
export default function DetailHeader({title, subtitle, backLabel, onBack}: DetailHeaderProps) {
  const {theme} = useAppTheme();

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${backLabel} 목록으로 돌아가기`}
        hitSlop={12}
        onPress={onBack}
        style={({pressed}) => [styles.back, pressed && styles.pressed]}>
        <ChevronLeft color={theme.text} size={26} strokeWidth={2.4} />
        <Text style={[styles.backLabel, {color: theme.text}]}>{backLabel}</Text>
      </Pressable>

      {/* 날짜 범위는 제목 바로 옆에 (글자 아랫선 맞춤) */}
      <View style={styles.titleRow}>
        {/* 상세 화면 제목만 분홍으로 강조 */}
        <Text style={[styles.title, {color: theme.accentStrong}]}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, {color: theme.textMuted}]}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    marginBottom: 10,
    marginLeft: -8,
  },
  pressed: {
    opacity: 0.5,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: '500',
  },
  titleRow: {
    alignItems: 'baseline',
    columnGap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
  },
});
