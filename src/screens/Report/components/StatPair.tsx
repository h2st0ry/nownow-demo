import React from 'react';
import {StyleSheet, View} from 'react-native';

import Text from '../../../components/AppText';
import {useAppTheme} from '../../../theme/ThemeProvider';

interface Stat {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  color?: string;
}

// 숫자 두세 개를 나란히: 색 상자 대신 가는 세로줄로 나눈다
export default function StatPair({stats}: {stats: Stat[]}) {
  const {theme} = useAppTheme();

  return (
    <View style={styles.row}>
      {stats.map((stat, index) => (
        <View
          key={stat.label}
          style={[styles.stat, index > 0 && [styles.divided, {borderLeftColor: theme.border}]]}>
          <Text numberOfLines={1} style={[styles.label, {color: theme.textMuted}]}>{stat.label}</Text>
          <View style={styles.valueRow}>
            <Text style={[styles.value, {color: stat.color ?? theme.text}]}>{stat.value}</Text>
            {stat.unit && <Text style={[styles.unit, {color: theme.textMuted}]}>{stat.unit}</Text>}
          </View>
          {stat.sub && <Text style={[styles.sub, {color: theme.textMuted}]}>{stat.sub}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  stat: {
    flex: 1,
  },
  divided: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  valueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 14,
    fontWeight: '600',
  },
  sub: {
    fontSize: 12,
    marginTop: 1,
  },
});
