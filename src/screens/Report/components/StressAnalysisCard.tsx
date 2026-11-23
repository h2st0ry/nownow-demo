import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {Sparkles} from 'lucide-react-native';

import Text from '../../../components/AppText';
import {getStressAnalysis, type StressAnalysis} from '../../../services/api/reports';
import {useAppTheme} from '../../../theme/ThemeProvider';
import ReportCard from './ReportCard';

// 뿡뿡이의 스트레스 원인 분석: 비슷한 상황이 있던 날의 건강 수치를 평소와 비교한 결론
export default function StressAnalysisCard() {
  const {theme} = useAppTheme();
  const [analysis, setAnalysis] = useState<StressAnalysis | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStressAnalysis()
      .then(result => !cancelled && setAnalysis(result))
      .catch(error => {
        console.log('[report] 스트레스 원인 분석 실패:', error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const top = analysis?.causes[0];

  return (
    <ReportCard>
      <View style={styles.titleRow}>
        <View style={[styles.iconWrap, {backgroundColor: theme.iconSurface}]}>
          <Sparkles color={theme.icon} size={20} />
        </View>
        <Text style={[styles.title, {color: theme.text}]}>뿡뿡이의 스트레스 원인 분석</Text>
      </View>

      {failed ? (
        <Text style={[styles.muted, {color: theme.textMuted}]}>지금은 분석을 불러올 수 없어요.</Text>
      ) : !analysis ? (
        <ActivityIndicator style={styles.loading} color={theme.accent} />
      ) : top ? (
        <>
          <View style={styles.compare}>
            <View style={[styles.stat, {backgroundColor: theme.accentMuted}]}>
              <Text style={[styles.statLabel, {color: theme.textMuted}]}>'{top.label}' 날</Text>
              <Text style={[styles.statValue, {color: theme.text}]}>{top.avgStress}점</Text>
              <Text style={[styles.statSub, {color: theme.textMuted}]}>{top.days}일 평균</Text>
            </View>
            <View style={[styles.stat, {backgroundColor: theme.surfaceMuted}]}>
              <Text style={[styles.statLabel, {color: theme.textMuted}]}>다른 날</Text>
              <Text style={[styles.statValue, {color: theme.text}]}>{top.baselineStress}점</Text>
              <Text style={[styles.statSub, {color: theme.textMuted}]}>{top.baselineDays}일 평균</Text>
            </View>
          </View>
          <Text style={[styles.body, {color: theme.text}]}>{top.conclusion}</Text>
          {analysis.causes.slice(1, 3).map(cause => (
            <Text key={`${cause.kind}:${cause.label}`} style={[styles.muted, {color: theme.textMuted}]}>
              · '{cause.label}' 날도 평소보다 {cause.diff}점 높았어요 ({cause.days}일)
            </Text>
          ))}
          <Text style={[styles.note, {color: theme.textMuted}]}>
            최근 60일 하루 정리와 스트레스 점수로 본 경향이에요. 진단이 아니에요.
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.body, {color: theme.text}]}>{analysis.message}</Text>
          <Text style={[styles.muted, {color: theme.textMuted}]}>
            지금까지 하루 정리 {analysis.summaryDays}일 · 스트레스 점수 있는 날 {analysis.scoredDays}일
          </Text>
        </>
      )}
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    alignItems: 'center',
    columnGap: 10,
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  loading: {
    marginVertical: 12,
  },
  compare: {
    columnGap: 10,
    flexDirection: 'row',
    marginBottom: 12,
  },
  stat: {
    borderRadius: 14,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  statSub: {
    fontSize: 11,
    marginTop: 1,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  muted: {
    fontSize: 12,
    lineHeight: 18,
  },
  note: {
    fontSize: 11,
    marginTop: 8,
  },
});
