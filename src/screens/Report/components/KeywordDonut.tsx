import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Svg, {Circle, G} from 'react-native-svg';

import Text from '../../../components/AppText';
import {useAppTheme} from '../../../theme/ThemeProvider';

interface KeywordDonutProps {
  causes: {cause: string; count: number}[];
  selectedCause: string | null;
  onSelectCause: (cause: string | null) => void;
}

const SIZE = 136;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// 조각 사이 틈 (원 둘레 기준 길이)
const GAP = 3;
// theme.chart 다섯 색 뒤에 이어 쓸 색
const EXTRA_COLORS = ['#7FB3D5', '#D99A8B', '#A3C58F'];

// 스트레스 원인 키워드를 언급 횟수만큼 나눈 도넛 그래프 + 옆 목록.
// 조각이나 목록을 누르면 그 원인을 고른다(달력에 그날이 칠해진다). 다시 누르면 해제.
export default function KeywordDonut({causes, selectedCause, onSelectCause}: KeywordDonutProps) {
  const {theme} = useAppTheme();
  const palette = [...theme.chart, ...EXTRA_COLORS];
  const colorOf = (index: number) => palette[index % palette.length];
  const total = causes.reduce((sum, item) => sum + item.count, 0);
  const selected = causes.find(item => item.cause === selectedCause);
  const toggle = (cause: string) => onSelectCause(selectedCause === cause ? null : cause);

  let offset = 0;
  const slices = causes.map((item, index) => {
    const length = (item.count / total) * CIRCUMFERENCE;
    const slice = {...item, color: colorOf(index), length, offset};
    offset += length;
    return slice;
  });

  return (
    <View style={styles.row}>
      <View style={styles.chart}>
        <Svg width={SIZE} height={SIZE}>
          {/* 12시 방향부터 시계 방향으로 그린다 */}
          <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
            {slices.map(slice => {
              const dim = selectedCause !== null && selectedCause !== slice.cause;
              const visible = Math.max(slice.length - (slices.length > 1 ? GAP : 0), 1);
              return (
                <Circle
                  key={slice.cause}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${visible} ${CIRCUMFERENCE - visible}`}
                  strokeDashoffset={-slice.offset}
                  opacity={dim ? 0.25 : 1}
                  onPress={() => toggle(slice.cause)}
                />
              );
            })}
          </G>
        </Svg>
        {/* 가운데: 고른 원인 또는 전체 언급 수 */}
        <View pointerEvents="none" style={styles.center}>
          <Text style={[styles.centerValue, {color: theme.text}]}>
            {selected ? selected.count : total}
            <Text style={[styles.centerUnit, {color: theme.textMuted}]}>회</Text>
          </Text>
          <Text numberOfLines={1} style={[styles.centerLabel, {color: theme.textMuted}]}>
            {selected ? selected.cause : '전체 언급'}
          </Text>
        </View>
      </View>

      <View style={styles.legend}>
        {slices.map(slice => {
          const active = selectedCause === slice.cause;
          const dim = selectedCause !== null && !active;
          return (
            <Pressable
              key={slice.cause}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              accessibilityLabel={`${slice.cause} ${slice.count}회`}
              onPress={() => toggle(slice.cause)}
              style={({pressed}) => [
                styles.legendRow,
                active && {backgroundColor: theme.surfaceMuted},
                (pressed || dim) && styles.dim,
              ]}>
              <View style={[styles.dot, {backgroundColor: slice.color}]} />
              <Text numberOfLines={1} style={[styles.legendName, {color: theme.text}, active && styles.legendActive]}>
                {slice.cause}
              </Text>
              <Text style={[styles.legendCount, {color: theme.textMuted}]}>{slice.count}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  chart: {
    height: SIZE,
    width: SIZE,
  },
  center: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: STROKE,
    position: 'absolute',
    right: STROKE,
    top: 0,
  },
  centerValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  centerUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  centerLabel: {
    fontSize: 12,
    marginTop: 1,
  },
  legend: {
    flex: 1,
    gap: 2,
  },
  legendRow: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  dim: {
    opacity: 0.45,
  },
  dot: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  legendName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  legendActive: {
    fontWeight: '700',
  },
  legendCount: {
    fontSize: 13,
    fontWeight: '600',
  },
});
