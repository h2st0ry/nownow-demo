import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {ActivityTrend} from '../../../services/api/health';
import Text from '../../../components/AppText';
import {useAppTheme} from '../../../theme/ThemeProvider';
import {metricConfig} from '../constants/reportData';
import CardHeader from './CardHeader';
import ReportCard from './ReportCard';

import AnimatedBar from './AnimatedBar';
import TrendChart from './TrendChart';

const HOUR_MS = 60 * 60 * 1000;
const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString('ko-KR', {
  hour: '2-digit', minute: '2-digit', hour12: false,
});

// 데모 앱: 시간대별 걸음 수·수면은 서버 기록(ReportPage가 불러온 값)으로 그린다.
export default function ActivityTrendCard({metric, trend, failed}: {metric: 'steps' | 'sleep'; trend: ActivityTrend | null; failed: boolean}) {
  const {theme} = useAppTheme();
  const config = metricConfig[metric];
  const error = failed ? '서버에서 기록을 불러오지 못했어요.' : '';

  if (metric === 'steps') {
    return <TrendChart selectedMetric="steps" hourlySteps={trend?.points} stepsStatus={error} />;
  }

  const start = trend ? Date.parse(trend.start) : 0;
  const points = new Map<number, number>();
  for (const point of trend?.points ?? []) {
    const time = new Date(point.time);
    const hour = Math.round((time.getTime() - start) / HOUR_MS);
    points.set(hour, (points.get(hour) ?? 0) + point.value);
  }
  const max = Math.max(config.chartBaseMax, ...points.values());
  const total = [...points.values()].reduce((sum, value) => sum + value, 0);

  return <ReportCard>
    <CardHeader title={config.chartTitle} />
    {trend && points.size > 0 ? <>
      {points.size > 0 && <Text style={[styles.summary, {color: theme.text}]}>{Math.round(total).toLocaleString()} {config.unit}</Text>}
      <Text style={{color: theme.textMuted}}>어제 {timeLabel(start)} ~ 오늘 {timeLabel(Date.parse(trend.end))}</Text>
      <View style={styles.chart}>
        {Array.from({length: 24}, (_, index) => {
          const value = points.get(index);
          const hour = timeLabel(start + index * HOUR_MS);
          return <View key={index} style={styles.column} accessible
            accessibilityLabel={`${hour}부터 1시간, ${value === undefined ? '기록 없음' : `${Math.round(value)}${config.unit}`}`}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55}
              style={[styles.valueLabel, {color: theme.textMuted}]}>{value === undefined ? '' : Math.round(value)}</Text>
            <AnimatedBar index={index} animationKey={`${metric}-${trend.start}`} height={value ? Math.max(18, value / max * 140) : 2}
              colorStyle={{backgroundColor: value === undefined ? theme.border : theme.nav}} />
          </View>;
        })}
      </View>
      <View style={styles.labels}>
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(hour => <Text key={hour} style={{color: theme.textMuted, fontSize: 9}}>{timeLabel(start + hour * HOUR_MS)}</Text>)}
      </View>
      <Text style={{color: theme.textMuted, fontSize: 12}}>막대는 각 시간대에 기록된 수면 시간이에요.</Text>
    </> : <Text style={{color: theme.textMuted}}>{error || (trend ? '최근 24시간에 공유된 기록이 없어요.' : '기록을 불러오고 있어요…')}</Text>}
  </ReportCard>;
}

const styles = StyleSheet.create({
  summary: {fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2},
  chart: {height: 170, flexDirection: 'row', gap: 3, alignItems: 'flex-end', marginTop: 12},
  column: {flex: 1, justifyContent: 'flex-end'},
  valueLabel: {fontSize: 8, textAlign: 'center', marginBottom: 8, width: '100%'},
  labels: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 10},
});
