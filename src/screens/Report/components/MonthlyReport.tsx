import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, BackHandler, Pressable, StyleSheet, View} from 'react-native';
import Text from '../../../components/AppText';
import {Activity, ChevronLeft, Flame, Footprints, Moon, Sparkles} from 'lucide-react-native';
import {format, getDay, parseISO, subMonths} from 'date-fns';

import {useAppTheme} from '../../../theme/ThemeProvider';
import {getStressLevel, stressLevels} from '../constants/reportData';
import {getMonthlyReport, type MonthlyReportData} from '../../../services/api/reports';
import {createMockMonthlyReport} from '../constants/monthlyReportMock';
import type {DailyStress} from '../types';
import HealthCard from './HealthCard';
import PeakStressDayCard from './PeakStressDayCard';
import ReportCard from './ReportCard';
import {KeywordChips} from './StressKeywordCard';
import WeeklyReportItem from './WeeklyReportItem';

// UI 확인용: true 면 서버 대신 목업 데이터로 월간 리포트를 그린다.
const USE_MONTHLY_MOCK = true;
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

const hours = (minutes: number | null) => (minutes === null ? '-' : String(Math.round((minutes / 60) * 10) / 10));
const count = (value: number | null) => (value === null ? '-' : Math.round(value).toLocaleString());

// 일간 탭의 건강 카드와 같은 모양으로 한 달 요약을 2x2로 보여준다.
function MonthlySummary({report}: {report: MonthlyReportData}) {
  const level = report.averageStressScore === null ? null : getStressLevel(report.averageStressScore);
  const diff = report.averageStressScore !== null && report.previousAverageStressScore !== null
    ? Math.round((report.averageStressScore - report.previousAverageStressScore) * 10) / 10
    : null;
  const diffText = diff === null ? null
    : diff > 0 ? `지난달보다 ${diff}점 ↑` : diff < 0 ? `지난달보다 ${-diff}점 ↓` : '지난달과 같음';

  return (
    <>
      <View style={styles.grid}>
        <HealthCard
          title="평균 스트레스"
          value={report.averageStressScore === null ? '-' : String(report.averageStressScore)}
          unit={report.averageStressScore === null ? undefined : '점'}
          caption={diffText ?? level?.label}
          Icon={Activity}
        />
        <HealthCard
          title="스트레스 높은 날"
          value={String(report.highStressDays)}
          unit="일"
          caption={`기록한 ${report.dayCount}일 중`}
          Icon={Flame}
        />
      </View>
      <View style={styles.grid}>
        <HealthCard
          title="평균 수면"
          value={hours(report.averageSleepMinutes)}
          unit={report.averageSleepMinutes === null ? undefined : '시간'}
          Icon={Moon}
        />
        <HealthCard
          title="평균 걸음수"
          value={count(report.averageSteps)}
          unit={report.averageSteps === null ? undefined : '걸음'}
          Icon={Footprints}
        />
      </View>
    </>
  );
}

// 달력: 날마다 스트레스 단계 색을 옅게 깔고, 원인 키워드를 고르면 그날을 진하게 채운다.
function StressCalendar({report, highlighted}: {report: MonthlyReportData; highlighted: Set<string>}) {
  const {theme} = useAppTheme();
  const byDate = new Map(report.days.map(day => [day.date, day]));
  const first = parseISO(`${report.month}-01`);
  const lead = (getDay(first) + 6) % 7; // 월요일 시작
  const lastDate = Number(report.days[report.days.length - 1]?.date.slice(8, 10) ?? 0);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({length: cells.length / 7}, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <ReportCard>
      <Text style={[styles.title, styles.calendarTitle, {color: theme.text}]}>날짜별 스트레스</Text>

      {/* 한 줄에 7칸을 직접 묶는다(퍼센트 너비는 반올림 때문에 6칸에서 줄이 넘어갔다). */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map(label => (
          <Text key={label} style={[styles.weekday, {color: theme.textMuted}]}>{label}</Text>
        ))}
      </View>
      {weeks.map((week, row) => (
        <View key={`week-${row}`} style={styles.weekRow}>
          {week.map((dayNumber, col) => {
            if (dayNumber === null) return <View key={`empty-${row}-${col}`} style={styles.cell} />;
            const date = `${report.month}-${String(dayNumber).padStart(2, '0')}`;
            const score = byDate.get(date)?.finalDailyStressScore ?? null;
            const level = score === null ? null : getStressLevel(score);
            const color = level ? theme[level.colorKey] : null;
            const future = dayNumber > lastDate;
            const marked = highlighted.has(date);
            // 평소엔 배경 없이 숫자 색으로 단계를 보이고, 키워드로 고른 날만 칸을 진하게 채운다.
            const filled = marked && color;
            return (
              <View key={date} style={styles.cell}>
                <View
                  accessibilityLabel={`${dayNumber}일 ${score === null ? '기록 없음' : `${score}점 ${level?.label}`}`}
                  style={styles.cellInner}>
                  {/* 채움은 따로 그린다: 같은 칸의 배경색만 바꾸면 안드로이드에서 모서리가 각지게 나왔다. */}
                  {filled && <View style={[styles.cellFill, {backgroundColor: color}]} />}
                  <Text
                    style={[
                      styles.cellText,
                      {color: filled ? theme.surface : color ?? theme.textMuted},
                      future && styles.future,
                    ]}>
                    {dayNumber}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <View style={[styles.divider, {backgroundColor: theme.border}]} />
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

// 일간 탭의 '뿡뿡이의 스트레스 원인 분석' 카드와 같은 모양
function MonthlyAnalysisCard({analysis}: {analysis: MonthlyReportData['analysis']}) {
  const {theme} = useAppTheme();
  const [top, ...rest] = analysis.causes;
  return (
    <ReportCard>
      <View style={styles.iconTitleRow}>
        <View style={[styles.iconWrap, {backgroundColor: theme.iconSurface}]}>
          <Sparkles color={theme.icon} size={20} />
        </View>
        <Text style={[styles.title, {color: theme.text}]}>이번 달 스트레스 원인 분석</Text>
      </View>

      {top ? (
        <>
          <View style={styles.compare}>
            <View style={[styles.stat, {backgroundColor: theme.accentMuted}]}>
              <Text numberOfLines={1} style={[styles.statLabel, {color: theme.textMuted}]}>'{top.label}' 날</Text>
              <Text style={[styles.statValue, {color: theme.text}]}>{top.avgStress}점</Text>
              <Text style={[styles.statSub, {color: theme.textMuted}]}>{top.days}일 평균</Text>
            </View>
            <View style={[styles.stat, {backgroundColor: theme.surfaceMuted}]}>
              <Text style={[styles.statLabel, {color: theme.textMuted}]}>다른 날</Text>
              <Text style={[styles.statValue, {color: theme.text}]}>{top.baselineStress}점</Text>
              <Text style={[styles.statSub, {color: theme.textMuted}]}>평균</Text>
            </View>
          </View>
          <Text style={[styles.body, {color: theme.text}]}>{top.conclusion}</Text>
          {rest.filter(cause => cause.label !== top.label).slice(0, 2).map(cause => (
            <Text key={`${cause.kind}:${cause.label}`} style={[styles.muted, {color: theme.textMuted}]}>
              · '{cause.label}' 날도 평소보다 {cause.diff}점 높았어요 ({cause.days}일)
            </Text>
          ))}
          <Text style={[styles.note, {color: theme.textMuted}]}>
            이번 달 하루 정리와 스트레스 점수로 본 경향이에요. 진단이 아니에요.
          </Text>
        </>
      ) : (
        <Text style={[styles.body, {color: theme.text}]}>{analysis.message}</Text>
      )}
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
    if (USE_MONTHLY_MOCK) {
      setReport(createMockMonthlyReport(month.key));
      return;
    }
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

      {!report || report.dayCount === 0 ? (
        <ReportCard>
          {!report && !unavailable ? (
            <ActivityIndicator style={styles.loading} color={theme.accent} />
          ) : (
            <Text style={[styles.muted, {color: theme.textMuted}]}>
              {unavailable ? '월간 기록을 불러오지 못했어요. 서버 연결을 확인해 주세요.' : '이 달에 표시할 스트레스 기록이 없어요.'}
            </Text>
          )}
        </ReportCard>
      ) : (
        <>
          {peakDay && (
            <PeakStressDayCard
              day={peakDay}
              compact
              // 원인 키워드 버튼: 누르면 아래 달력에 그 원인이 나온 날이 칠해진다.
              footer={report.causes.length > 0 && (
                <KeywordChips
                  causes={report.causes}
                  selectedCause={selectedCause}
                  onSelectCause={setSelectedCause}
                  style={styles.chipsInCard}
                />
              )}
            />
          )}
          <StressCalendar report={report} highlighted={highlighted} />
          <MonthlyAnalysisCard analysis={report.analysis} />
          <MonthlySummary report={report} />
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
  grid: {flexDirection: 'row', gap: 10},
  chipsInCard: {marginTop: 12},
  title: {fontSize: 17, fontWeight: '800'},
  calendarTitle: {marginBottom: 14},
  weekRow: {flexDirection: 'row'},
  weekday: {flex: 1, fontSize: 12, fontWeight: '700', marginBottom: 6, textAlign: 'center'},
  cell: {aspectRatio: 1, flex: 1, padding: 3},
  cellInner: {alignItems: 'center', flex: 1, justifyContent: 'center'},
  cellFill: {borderRadius: 12, bottom: 0, left: 0, position: 'absolute', right: 0, top: 0},
  cellText: {fontSize: 18, fontWeight: '800'},
  future: {opacity: 0.4},
  divider: {height: StyleSheet.hairlineWidth, marginBottom: 12, marginTop: 10},
  legend: {columnGap: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center'},
  legendItem: {alignItems: 'center', columnGap: 5, flexDirection: 'row'},
  legendDot: {borderRadius: 5, height: 10, width: 10},
  legendText: {fontSize: 12, fontWeight: '600'},
  iconTitleRow: {alignItems: 'center', columnGap: 10, flexDirection: 'row', marginBottom: 12},
  iconWrap: {alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36},
  compare: {columnGap: 10, flexDirection: 'row', marginBottom: 12},
  stat: {borderRadius: 14, flex: 1, paddingHorizontal: 12, paddingVertical: 10},
  statLabel: {fontSize: 12, fontWeight: '600'},
  statValue: {fontSize: 22, fontWeight: '800', marginTop: 2},
  statSub: {fontSize: 11, marginTop: 1},
  loading: {marginVertical: 12},
  body: {fontSize: 14, lineHeight: 21, marginBottom: 8},
  muted: {fontSize: 12, lineHeight: 18},
  note: {fontSize: 11, marginTop: 8},
});
