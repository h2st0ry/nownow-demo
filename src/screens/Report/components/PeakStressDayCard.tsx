import React from 'react';
import {StyleSheet, View} from 'react-native';
import Text from '../../../components/AppText';

import {format, parseISO} from 'date-fns';
import {ko} from 'date-fns/locale';

import {useAppTheme} from '../../../theme/ThemeProvider';
import {getStressLevel} from '../constants/reportData';
import type {DailyStress} from '../types';
import CardHeader from './CardHeader';
import ReportCard from './ReportCard';

interface PeakStressDayCardProps {
  day: DailyStress;
}

export default function PeakStressDayCard({day}: PeakStressDayCardProps) {
  const {theme} = useAppTheme();
  const level = getStressLevel(day.score);
  const color = theme[level.colorKey];

  const causesText = day.causes.length > 0 ? day.causes.join(' · ') : '기록된 원인 없음';

  return (
    <ReportCard>
      <CardHeader title="가장 스트레스가 높았던 날" />

      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={[styles.date, {color: theme.text}]}>
            {format(parseISO(day.date), 'M월 d일 EEEE', {locale: ko})}
          </Text>
          <Text numberOfLines={1} style={[styles.causes, {color: theme.textMuted}]}>
            {causesText}
          </Text>
        </View>
        <View style={styles.scoreArea}>
          <Text style={[styles.score, {color}]}>{day.score}</Text>
          <Text style={[styles.level, {color}]}>{level.label}</Text>
        </View>
      </View>
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  info: {
    flex: 1,
  },
  date: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  causes: {
    fontSize: 14,
    marginTop: 3,
  },
  scoreArea: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 4,
  },
  score: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  level: {
    fontSize: 14,
    fontWeight: '700',
  },
});
