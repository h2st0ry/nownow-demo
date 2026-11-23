import React, {useRef, useState} from 'react';
import {Linking, Pressable, StyleSheet, View} from 'react-native';
import Text from '../../../components/AppText';
import {MapPin} from 'lucide-react-native';

import {useAppTheme} from '../../../theme/ThemeProvider';
import {createAiRecommendation, type AiRecommendation} from '../../../services/api/reports';
import {ApiError} from '../../../services/api/client';
import CardHeader from './CardHeader';
import ReportCard from './ReportCard';
import StatPair from './StatPair';
import {openDeliveryApp} from '../../../services/delivery/deliveryApps';
import {cinemaLinks} from '../../../constants/cinemaLinks';

interface InsightCardProps {
  peakStress: {time: string; stress: number; sampleCount: number} | null;
  lowestStress: {time: string; stress: number; sampleCount: number} | null;
  analysisUnavailable: boolean;
  analysisLoading: boolean;
}

export default function InsightCard({
  peakStress,
  lowestStress,
  analysisUnavailable,
  analysisLoading,
}: InsightCardProps) {
  const {theme} = useAppTheme();
  const [recommendation, setRecommendation] = useState<AiRecommendation | null>(null);
  const [showOfflineTip, setShowOfflineTip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRoutine, setShowRoutine] = useState(false);
  const pending = useRef(false);

  const loadRecommendation = async () => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError('');
    setShowOfflineTip(false);
    setShowRoutine(false);
    try {
      setRecommendation(await createAiRecommendation());
    } catch (failure) {
      if (failure instanceof ApiError && [0, 502, 503, 504].includes(failure.status)) {
        setRecommendation(null);
        setShowOfflineTip(true);
      } else {
        setError(failure instanceof Error ? failure.message : '추천을 불러오지 못했어요.');
      }
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };
  const routine = recommendation?.status === 'ready' ? recommendation.routine : null;
  const action = recommendation?.status === 'ready' ? recommendation.action : null;
  const musicQuery = recommendation?.status === 'ready' ? recommendation.musicQuery : undefined;
  const openLink = (url: string) => Linking.openURL(url).catch(() => setError('링크를 열지 못했어요.'));
  const extraActions = action === 'delivery' ? [
    {label: '배민 열기', open: () => openDeliveryApp('baemin')},
    {label: '쿠팡이츠 열기', open: () => openDeliveryApp('coupangEats')},
  ] : action === 'movies' ? cinemaLinks.map(({label, url}) => ({
    label,
    open: () => openLink(url),
  })) : action === 'music' && musicQuery ? [
    {label: 'YouTube Music에서 듣기', open: () => openLink(`https://music.youtube.com/search?q=${encodeURIComponent(musicQuery)}`)},
  ] : [];

  return (
    <>
      <ReportCard>
        <CardHeader title="시간대별 스트레스" right="오늘 · 1시간 단위" />
        {peakStress && lowestStress ? <>
        <StatPair stats={[
          {label: '가장 높은 시간', value: peakStress.time.slice(11, 16), sub: `지표 ${peakStress.stress}점 · 기록 ${peakStress.sampleCount}회`, color: theme.accentStrong},
          {label: '가장 안정적인 시간', value: lowestStress.time.slice(11, 16), sub: `지표 ${lowestStress.stress}점 · 기록 ${lowestStress.sampleCount}회`},
        ]} />
        {peakStress.time === lowestStress.time && <Text style={[styles.muted, {color: theme.textMuted}]}>같은 시간대가 표시될 수 있어요. 심박 기록이 더 쌓이면 비교하기 쉬워져요.</Text>}
        </> : <Text style={[styles.muted, {color: theme.textMuted}]}>{analysisUnavailable
          ? '헬스 커넥트에서 심박수를 읽지 못했어요. 읽기 권한을 확인해 주세요.'
          : analysisLoading ? '오늘 심박 기록을 불러오고 있어요…'
            : '한 시간에 심박 기록이 3회 이상 있어야 지표를 계산할 수 있어요.'}</Text>}
      </ReportCard>

      <ReportCard style={styles.recommendCard}>
        <CardHeader title="오늘의 추천" />
        <Text numberOfLines={6} style={[styles.recommendText, {color: theme.text}]}>
          {showOfflineTip ? '지금은 연결이 잠깐 쉬는 중이야. 우리도 좋아하는 노래 한 곡 들으면서 잠깐 쉬어갈까? ♡'
            : recommendation?.status === 'ready' ? recommendation.message : recommendation?.status === 'no_records'
            ? '아직 참고할 기록이 없어요. 건강 기록을 동기화하거나 오늘의 대화를 남겨 주세요.'
            : '오늘의 건강 기록과 최근 대화 키워드로 생활관리 추천을 받아보세요.'}
        </Text>
        {!!error && <Text accessibilityRole="alert" style={{color: theme.text}}>{error}</Text>}
        {showOfflineTip && <Text style={{color: theme.textMuted}}>연결 없이 보는 기본 추천</Text>}
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void loadRecommendation()}
          style={({pressed}) => [
            styles.button,
            {backgroundColor: theme.accent},
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.buttonText, {color: theme.accentText}]}>
            {loading ? '추천을 준비하고 있어요…' : recommendation || showOfflineTip ? '다시 추천받기' : '추천받기'}
          </Text>
        </Pressable>
        {recommendation?.status === 'ready' && recommendation.action === 'walk_map' && <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('근처 산책로')}`).catch(() => setError('지도를 열지 못했어요.'))}
          style={[styles.mapButton, {backgroundColor: theme.surfaceMuted}]}>
          <MapPin size={16} color={theme.textMuted} />
          <Text style={[styles.buttonText, {color: theme.text}]}>근처 산책로 보기</Text>
        </Pressable>}
        {extraActions.map(item => <Pressable key={item.label} accessibilityRole="button"
          onPress={() => void item.open().catch(() => setError('앱을 열지 못했어요.'))}
          style={[styles.mapButton, {backgroundColor: theme.surfaceMuted}]}>
          <Text style={[styles.buttonText, {color: theme.text}]}>{item.label}</Text>
        </Pressable>)}
        {routine && <Pressable accessibilityRole="button" accessibilityState={{expanded: showRoutine}} onPress={() => setShowRoutine(value => !value)}>
          <Text style={[styles.link, {color: theme.accentStrong}]}>{showRoutine ? '루틴 접기' : `${routine.title} 루틴 보기`}</Text>
        </Pressable>}
        {routine && showRoutine && routine.steps.map((step, index) => <Text key={index} style={{color: theme.text}}>{index + 1}. {step}</Text>)}
      </ReportCard>
    </>
  );
}

const styles = StyleSheet.create({
  mapButton: {alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, minHeight: 40, paddingHorizontal: 12},
  muted: {
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
  },
  recommendCard: {
    rowGap: 12,
  },
  recommendText: {
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 46,
  },
  pressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
