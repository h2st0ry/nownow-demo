import React from 'react';
import {StyleSheet, View} from 'react-native';
import Text from '../../../components/AppText';

import {useAppTheme} from '../../../theme/ThemeProvider';
import {stressPeriodOptions} from '../constants/reportData';
import type {StressCause, StressPeriod} from '../types';
import CardHeader from './CardHeader';
import ReportCard from './ReportCard';
import Segmented from './Segmented';
import {usePersonalize} from '../../../context/CharacterNameProvider';

interface StressCauseCardProps {
  causes: StressCause[];
  unavailable?: boolean;
  period: StressPeriod;
  onPeriodChange: (period: StressPeriod) => void;
}

export default function StressCauseCard({
  causes,
  unavailable,
  period,
  onPeriodChange,
}: StressCauseCardProps) {
  const {theme} = useAppTheme();
  const p = usePersonalize();
  const totalCount = causes.reduce((sum, item) => sum + item.count, 0);
  const getCauseColor = (index: number) =>
    theme.chart[index % theme.chart.length];

  return (
    <ReportCard>
      <CardHeader title="스트레스 원인" />
      <Segmented options={stressPeriodOptions} value={period} onChange={onPeriodChange} />

      {causes.length ? <Text style={[styles.count, {color: theme.text}]}>
        {totalCount}
        <Text style={[styles.countUnit, {color: theme.textMuted}]}>
          {' '}번 언급
        </Text>
      </Text> : <Text style={[styles.empty, {color: theme.textMuted}]}>{unavailable ? '키워드 기록을 불러오지 못했어요.' : p('뿡뿡이와 하루를 정리하고 키워드를 저장하면 여기에 보여요.')}</Text>}

      <View style={styles.causes}>
        {causes.map((item, index) => (
          <View key={item.cause}>
            <View style={styles.causeRow}>
              <View style={styles.causeLabelRow}>
                <View
                  style={[
                    styles.dot,
                    {backgroundColor: getCauseColor(index)},
                  ]}
                />
                <Text style={[styles.causeLabel, {color: theme.text}]}>
                  {item.cause}
                </Text>
              </View>
              <Text style={[styles.causeValue, {color: theme.textMuted}]}>
                {item.count}회 · {item.percentage}%
              </Text>
            </View>
            <View style={[styles.track, {backgroundColor: theme.surfaceMuted}]}>
              <View
                style={[
                  styles.progress,
                  {
                    width: `${item.percentage}%`,
                    backgroundColor: getCauseColor(index),
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: 14,
    marginTop: 14,
  },
  count: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 14,
  },
  countUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  causes: {
    marginTop: 14,
    rowGap: 12,
  },
  causeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  causeLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  causeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  causeValue: {
    fontSize: 13,
  },
  track: {
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
  },
  progress: {
    borderRadius: 3,
    height: '100%',
  },
});
