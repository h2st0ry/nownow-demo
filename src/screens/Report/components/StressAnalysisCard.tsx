import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet} from 'react-native';

import Text from '../../../components/AppText';
import {getStressAnalysis, type StressAnalysis} from '../../../services/api/reports';
import {useAppTheme} from '../../../theme/ThemeProvider';
import CardHeader from './CardHeader';
import ReportCard from './ReportCard';
import StatPair from './StatPair';
import {usePersonalize} from '../../../context/CharacterNameProvider';

// 뿡뿡이의 스트레스 원인 분석: 비슷한 상황이 있던 날의 건강 수치를 평소와 비교한 결론
export default function StressAnalysisCard() {
  const {theme} = useAppTheme();
  const p = usePersonalize();
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
      <CardHeader title={p('뿡뿡이의 원인 분석')} />

      {failed ? (
        <Text style={[styles.muted, {color: theme.textMuted}]}>지금은 분석을 불러올 수 없어요.</Text>
      ) : !analysis ? (
        <ActivityIndicator style={styles.loading} color={theme.accent} />
      ) : top ? (
        <>
          <StatPair stats={[
            {label: `${top.label} 있던 날`, value: top.avgStress, unit: '점', sub: `${top.days}일 평균`, color: theme.accentStrong},
            {label: '다른 날', value: top.baselineStress, unit: '점', sub: `${top.baselineDays}일 평균`},
          ]} />
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
  loading: {
    marginVertical: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  muted: {
    fontSize: 13,
    lineHeight: 19,
  },
  note: {
    fontSize: 12,
    marginTop: 10,
  },
});
