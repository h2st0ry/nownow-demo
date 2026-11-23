import React from 'react';
import {StyleSheet, View} from 'react-native';

import Text from '../../../components/AppText';
import {useAppTheme} from '../../../theme/ThemeProvider';

// 리포트 카드 제목 (기본 글씨색). 아이콘은 넣지 않는다.
// 기본은 가운데 정렬이고 보조 글씨(right)는 제목 아래에 작게. 건강 데이터 카드만 왼쪽 정렬.
export const CARD_HEADER_SIZE = 15;

interface CardHeaderProps {
  title: string;
  right?: React.ReactNode;
  color?: string;
  align?: 'center' | 'left';
}

export default function CardHeader({title, right, color, align = 'center'}: CardHeaderProps) {
  const {theme} = useAppTheme();
  const tint = color ?? theme.text;
  const extra = typeof right === 'string'
    ? <Text style={[styles.right, {color: theme.textMuted}]}>{right}</Text>
    : right;

  if (align === 'left') {
    return (
      <View style={[styles.header, styles.leftRow]}>
        <Text numberOfLines={1} style={[styles.title, styles.leftTitle, {color: tint}]}>{title}</Text>
        {extra}
      </View>
    );
  }

  return (
    <View style={[styles.header, styles.centered]}>
      <Text numberOfLines={1} style={[styles.title, styles.centeredTitle, {color: tint}]}>{title}</Text>
      {extra}
      {/* 제목과 내용을 나누는 가는 선 */}
      <View style={[styles.divider, {backgroundColor: theme.border}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  centered: {
    alignItems: 'center',
    gap: 2,
    marginBottom: 14,
  },
  divider: {
    alignSelf: 'stretch',
    height: 1,
    marginTop: 10,
  },
  leftRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: CARD_HEADER_SIZE,
    fontWeight: '700',
    textAlign: 'center',
  },
  // 가운데 제목은 건강 데이터 카드 제목보다 크게
  centeredTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  leftTitle: {
    flexShrink: 1,
    textAlign: 'left',
  },
  right: {
    fontSize: 13,
  },
});
