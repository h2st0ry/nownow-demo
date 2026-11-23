import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {useAppTheme} from '../../../theme/ThemeProvider';

interface ReportCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

// 그림자 없는 납작한 카드 (애플 건강 앱 느낌)
export default function ReportCard({children, style}: ReportCardProps) {
  const {theme} = useAppTheme();

  return (
    <View style={[styles.card, {backgroundColor: theme.surface}, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
  },
});
