import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {BackHandler, Pressable, StyleSheet, View} from 'react-native';
import Text from '../../../components/AppText';
import {CalendarDays, ChevronLeft, Lightbulb} from 'lucide-react-native';
import {format, getDay, parseISO, subMonths} from 'date-fns';

import {useAppTheme} from '../../../theme/ThemeProvider';
import {getStressLevel, stressLevels} from '../constants/reportData';
import {getMonthlyReport, type MonthlyReportData} from '../../../services/api/reports';
import type {DailyStress} from '../types';
import PeakStressDayCard from './PeakStressDayCard';
import ReportCard from './ReportCard';
import StressKeywordCard from './StressKeywordCard';
import WeeklyReportItem from './WeeklyReportItem';

const MONTH_COUNT = 3;
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

interface Month {
  key: string; // YYYY-MM
  label: string;
}

// 이번 달부터 최근 달을 최신순으로
const getRecentMonths = (count: number, baseDate = new Date()): Month[] =>
  Array.from({length: count}, (_, index) => {
    const date = subMonths(baseDate, index);
    return {key: format(date, 'yyyy-MM'), label: format(date, 'yyyy년 M월')};
  });

const hours = (minutes: number | null) => (minutes === null ? '-' : `${Math.round((minutes / 60) * 10) / 10}시간`);
const count = (value: number | null) => (value === null ? '-' : `${Math.round(value).toLocaleString()}보`);

function SummaryCard({report}: {report: MonthlyReportData}) {
  const {theme} = useAppTheme();
  const level = report.averageStressScore === null ? null : getStressLevel(report.averageStressScore);
  const diff = report.averageStressScore !== null && report.previousAverageStressScore !== null
    ? Math.round((report.averageStressScore - report.previousAverageStressScore) * 10) / 10
    : null;

  return (
    <ReportCard>
      <Text style={[styles.cardTitle, {color: theme.text}]}>이번 달 한눈에</Text>
      <View style={styles.statRow}>
        <View style={[styles.stat, {backgroundColor: theme.surfaceMuted}]}>
          <Text style={[styles.statLabel, {color: theme.textMuted}]}>평균 스트레스</Text>
          <Text style={[styles.statValue, {color: level ? theme[level.colorKey] : theme.text}]}>
            {report.averageStressScore ?? '-'}
          </Text>
          <Text style={[styles.statSub, {color: theme.textMuted}]}>
            {diff === null ? (level?.label ?? '기록 없음')
              : `${level?.label} · 지난달보다 ${diff > 0 ? `${diff}점 ↑` : diff < 0 ? `${-diff}점 ↓` : '같음'}`}
          </Text>
        </View>
        <View style={[styles.stat, {backgroundColor: theme.surfaceMuted}]}>
          <Text style={[styles.statLabel, {color: theme.textMuted}]}>스트레스 높은 날</Text>
          <Text style={[styles.statValue, {color: theme.text}]}>{report.highStressDays}일</Text>
          <Text style={[styles.statSub, {color: theme.textMuted}]}>기록한 {report.dayCount}일 중</Text>
        </View>
      </View>
      <View style={styles.statRow}>
        <View style={[styles.stat, {backgroundColor: theme.surfaceMuted}]}>
          <Text style={[styles.statLabel, {color: theme.textMuted}]}>평균 수면</Text>
          <Text style={[styles.statValueSmall, {color: theme.text}]}>{hours(report.averageSleepMinutes)}</Text>
        </View>
        <View style={[styles.stat, {backgroundColor: theme.surfaceMuted}]}>
          <Text style={[styles.statLabel, {color: theme.textMuted}]}>평균 걸음</Text>
          <Text style={[styles.statValueSmall, {color: theme.text}]}>{count(report.averageSteps)}</Text>
        </View>
      </View>
    </ReportCard>
  );
}

// 달력: 날마다 스트레스 단계 색. 원인 키워드를 고르면 그 원인이 나온 날에 테두리를 그린다.
function StressCalendar({report, highlighted}: {report: MonthlyReportData; highlighted: Set<string>}) {
  const {theme} = useAppTheme();
  const byDate = new Map(report.days.map(day => [day.date, day]));
  const first = parseISO(`${report.month}-01`);
  const lead = (getDay(first) + 6) % 7; // 월요일 시작
  const lastDate = Number(report.days[report.days.length - 1]?.date.slice(8, 10) ?? 0);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <ReportCard>
      <View style={styles.titleRow}>
        <CalendarDays color={theme.accent} size={20} />
        <Text style={[styles.cardTitle, styles.titleInline, {color: theme.text}]}>날짜별 스트레스</Text>
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map(label => (
          <Text key={label} style={[styles.weekday, {color: theme.textMuted}]}>{label}</Text>
        ))}
        {cells.map((dayNumber, index) => {
          if (dayNumber === null) return <View key={`empty-${index}`} style={styles.cell} />;
          const date = `${report.month}-${String(dayNumber).padStart(2, '0')}`;
          const score = byDate.get(date)?.finalDailyStressScore ?? null;
          const level = score === null ? null : getStressLevel(score);
          const future = dayNumber > lastDate;
          const marked = highlighted.has(date);
          return (
            <View key={date} style={styles.cell}>
              <View
                accessibilityLabel={`${dayNumber}일 ${score === null ? '기록 없음' : `${score}점 ${level?.label}`}`}
                style={[
                  styles.cellInner,
                  {backgroundColor: level ? theme[level.colorKey] : theme.surfaceMuted},
                  future && styles.future,
                  marked && {borderColor: theme.text},
                ]}>
                <Text style={[styles.cellText, {color: level ? theme.surface : theme.textMuted}]}>{dayNumber}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        {[...stressLevels].reverse().map(level => (
          <View key={level.label} style={styles.legendItem}>
            <View style={[styles.legendDot, {backgroundColor: theme[level.colorKey]}]} />
            <Text style={[styles.legendText, {color: theme.textMuted}]}>{level.label}</Text>
          </View>
        ))}
      </View>
    </ReportCard>
  );
}

function MonthlyAnalysisCard({analysis}: {analysis: MonthlyReportData['analysis']}) {
  const {theme} = useAppTheme();
  const [top, ...rest] = analysis.causes;
  return (
    <ReportCard>
      <View style={styles.titleRow}>
        <Lightbulb color={theme.warning} size={20} />
        <Text style={[styles.cardTitle, styles.titleInline, {color: theme.text}]}>이번 달 스트레스 원인</Text>
      </View>
      <Text style={[styles.body, {color: theme.text}]}>{top ? top.conclusion : analysis.message}</Text>
      {rest.filter(cause => cause.label !== top?.label).slice(0, 2).map(cause => (
        <Text key={`${cause.kind}:${cause.label}`} style={[styles.muted, {color: theme.textMuted}]}>
          · '{cause.label}' 날도 평소보다 {cause.diff}점 높았어요 ({cause.days}일)
        </Text>
      ))}
      <Text style={[styles.note, {color: theme.textMuted}]}>
        이번 달 하루 정리와 스트레스 점수로 본 경향이에요. 진단이 아니에요.
      </Text>
    </ReportCard>
  );
}

function MonthlyReportDetail({month, onBack}: {month: Month; onBack: () => void}) {
  const {theme} = useAppTheme();
  const [report, setReport] = useState<MonthlyReportData | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [selectedCause, setSelectedCause] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMonthlyReport(month.key)
      .then(data => {if (active) setReport(data);})
      .catch(() => {if (active) setUnavailable(true);});
    return () => {active = false;};
  }, [month.key]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const scoredDays: DailyStress[] = useMemo(() => (report?.days ?? []).flatMap(day =>
    day.finalDailyStressScore !== null && !day.missing?.includes('demo_fixture')
      ? [{date: day.date, score: day.finalDailyStressScore, causes: day.causes}] : []), [report]);

  const peakDay = useMemo(() => scoredDays.reduce<DailyStress | null>(
    (max, day) => (!max || day.score > max.score ? day : max), null), [scoredDays]);

  const highlighted = useMemo(() => new Set(selectedCause
    ? scoredDays.filter(day => day.causes.includes(selectedCause)).map(day => day.date) : []),
  [selectedCause, scoredDays]);

  return (
    <>
      <View style={[styles.detailHeader, {backgroundColor: theme.surface}]}>
        <Pressable onPress={onBack} style={({pressed}) => [styles.backButton, pressed && {backgroundColor: theme.pressed}]}>
          <ChevronLeft color={theme.text} size={22} />
        </Pressable>
        <View style={styles.monthInfo}>
          <Text style={[styles.monthLabel, {color: theme.text}]}>{month.label}</Text>
          <Text style={[styles.monthRange, {color: theme.textMuted}]}>
            {report ? `${format(parseISO(report.from), 'M.d')} ~ ${format(parseISO(report.to), 'M.d')}` : ''}
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {!report ? (
        <Text style={{color: theme.textMuted}}>
          {unavailable ? '월간 기록을 불러오지 못했어요. 서버 연결을 확인해 주세요.' : '월간 기록을 불러오고 있어요…'}
        </Text>
      ) : report.dayCount === 0 ? (
        <Text style={{color: theme.textMuted}}>이 달에 표시할 스트레스 기록이 없어요.</Text>
      ) : (
        <>
          <SummaryCard report={report} />
          <StressCalendar report={report} highlighted={highlighted} />
          <StressKeywordCard
            causes={report.causes}
            selectedCause={selectedCause}
            onSelectCause={setSelectedCause}
            hint="키워드를 누르면 해당 날짜가 달력에 표시돼요."
            emptyText="이번 달에는 기록된 원인이 없어요."
          />
          <MonthlyAnalysisCard analysis={report.analysis} />
          {peakDay && <PeakStressDayCard day={peakDay} />}
        </>
      )}
    </>
  );
}

export default function MonthlyReport() {
  const months = useMemo(() => getRecentMonths(MONTH_COUNT), []);
  const [selected, setSelected] = useState<Month | null>(null);
  const handleBack = useCallback(() => setSelected(null), []);

  if (selected) return <MonthlyReportDetail month={selected} onBack={handleBack} />;

  return (
    <>
      {months.map(month => (
        <WeeklyReportItem key={month.key} title={month.label} onPress={() => setSelected(month)} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  detailHeader: {alignItems: 'center', borderRadius: 16, flexDirection: 'row', paddingHorizontal: 6, paddingVertical: 8},
  backButton: {alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36},
  monthInfo: {alignItems: 'center', flex: 1},
  monthLabel: {fontSize: 15, fontWeight: '800'},
  monthRange: {fontSize: 12, marginTop: 2},
  cardTitle: {fontSize: 16, fontWeight: '700', marginBottom: 12},
  titleRow: {alignItems: 'center', columnGap: 8, flexDirection: 'row', marginBottom: 12},
  titleInline: {marginBottom: 0},
  statRow: {columnGap: 10, flexDirection: 'row', marginBottom: 10},
  stat: {borderRadius: 14, flex: 1, paddingHorizontal: 12, paddingVertical: 10},
  statLabel: {fontSize: 12, fontWeight: '600'},
  statValue: {fontSize: 24, fontWeight: '800', marginTop: 2},
  statValueSmall: {fontSize: 18, fontWeight: '800', marginTop: 2},
  statSub: {fontSize: 11, marginTop: 1},
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  weekday: {fontSize: 11, fontWeight: '700', marginBottom: 6, textAlign: 'center', width: `${100 / 7}%`},
  cell: {aspectRatio: 1, padding: 3, width: `${100 / 7}%`},
  cellInner: {alignItems: 'center', borderColor: 'transparent', borderRadius: 10, borderWidth: 2.5, flex: 1, justifyContent: 'center'},
  future: {opacity: 0.35},
  cellText: {fontSize: 12, fontWeight: '700'},
  legend: {columnGap: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10},
  legendItem: {alignItems: 'center', columnGap: 4, flexDirection: 'row'},
  legendDot: {borderRadius: 4, height: 8, width: 8},
  legendText: {fontSize: 11},
  body: {fontSize: 14, lineHeight: 21, marginBottom: 8},
  muted: {fontSize: 12, lineHeight: 18},
  note: {fontSize: 11, marginTop: 8},
});
