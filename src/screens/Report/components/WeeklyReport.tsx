import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {BackHandler, StyleSheet} from 'react-native';
import Text from '../../../components/AppText';
import {format, parseISO} from 'date-fns';

import {useAppTheme} from '../../../theme/ThemeProvider';
import {WEEKLY_REPORT_COUNT} from '../constants/reportData';
import {getRecentWeeks} from '../utils/weekLabels';
import {request} from '../../../services/api/client';
import type {WeeklyReport as WeeklyReportData} from '../types';
import DetailHeader from './DetailHeader';
import PeakStressDayCard from './PeakStressDayCard';
import ReportCard from './ReportCard';
import StressKeywordCard from './StressKeywordCard';
import WeeklyReportItem, {ReportList} from './WeeklyReportItem';
import WeeklyStressChart from './WeeklyStressChart';

type Week = ReturnType<typeof getRecentWeeks>[number];

const formatRange = (start: string, end: string) =>
  `${format(parseISO(start), 'M.d')} ~ ${format(parseISO(end), 'M.d')}`;

interface WeeklyReportDetailProps {
  week: Week;
  onBack: () => void;
}

function WeeklyReportDetail({week, onBack}: WeeklyReportDetailProps) {
  const {theme} = useAppTheme();
  const [selectedCause, setSelectedCause] = useState<string | null>(null);
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    request<{data: Omit<WeeklyReportData, 'days'> & {
      days: {date: string; finalDailyStressScore: number | null; missing?: string[]; causes?: string[]}[];
    }}>('GET', `/api/reports/weekly/${week.key}`)
      .then(({data}) => {
        if (!active) return;
        setReport({...data, days: data.days.flatMap(day =>
          day.finalDailyStressScore !== null && Number.isFinite(day.finalDailyStressScore) && !day.missing?.includes('demo_fixture')
            ? [{date: day.date, score: day.finalDailyStressScore, causes: day.causes ?? []}] : [])});
      })
      .catch(() => {if (active) setUnavailable(true);});
    return () => {active = false;};
  }, [week.key]);

  const peakDay = useMemo(
    () =>
      report?.days.reduce<WeeklyReportData['days'][number] | null>(
        (max, day) => (!max || day.score > max.score ? day : max), null) ?? null,
    [report],
  );

  // 원인 키워드를 고르면 그 원인이 나온 날들을, 아니면 가장 높았던 날을 그래프에 표시한다.
  const highlightedDates = useMemo(() => {
    if (selectedCause && report) {
      return new Set(report.days.filter(day => day.causes.includes(selectedCause)).map(day => day.date));
    }
    return new Set(peakDay ? [peakDay.date] : []);
  }, [selectedCause, report, peakDay]);

  // 안드로이드 뒤로가기 버튼으로도 목록으로 돌아간다.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack();
        return true;
      },
    );

    return () => subscription.remove();
  }, [onBack]);

  return (
    <>
      <DetailHeader
        backLabel="주간"
        onBack={onBack}
        title={week.label}
        subtitle={report ? formatRange(report.weekStart, report.weekEnd) : undefined}
      />

      {report?.days.length ? <WeeklyStressChart
        days={report.days}
        highlightedDates={highlightedDates}
        animationKey={week.key}
      /> : <ReportCard><Text style={[styles.muted, {color: theme.textMuted}]}>{unavailable
        ? '주간 기록을 불러오지 못했어요. 서버 연결을 확인해 주세요.'
        : report ? '이 주에 표시할 스트레스 기록이 없어요.' : '주간 기록을 불러오고 있어요…'}</Text></ReportCard>}

      {report && <StressKeywordCard
        causes={report.causes}
        selectedCause={selectedCause}
        onSelectCause={setSelectedCause}
      />}

      {peakDay && <PeakStressDayCard day={peakDay} />}
    </>
  );
}

export default function WeeklyReport({onDetailChange}: {onDetailChange?: (open: boolean) => void}) {
  const weeks = useMemo(() => getRecentWeeks(WEEKLY_REPORT_COUNT), []);
  const [selectedWeek, setSelectedWeek] = useState<Week | null>(null);
  const handleBack = useCallback(() => setSelectedWeek(null), []);

  // 상세 화면이 열리고 닫히는 걸 리포트 화면에 알린다 (맨 위 제목·탭 숨김용)
  useEffect(() => {
    onDetailChange?.(selectedWeek !== null);
  }, [selectedWeek, onDetailChange]);

  if (selectedWeek) {
    return (
      <WeeklyReportDetail
        week={selectedWeek}
        onBack={handleBack}
      />
    );
  }

  return (
    <ReportList>
      {weeks.map((week, index) => (
        <WeeklyReportItem
          key={week.key}
          title={week.label}
          last={index === weeks.length - 1}
          onPress={() => setSelectedWeek(week)}
        />
      ))}
    </ReportList>
  );
}

const styles = StyleSheet.create({
  muted: {
    fontSize: 14,
  },
});
