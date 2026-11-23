import React from 'react';

import {reportTabs} from '../constants/reportData';
import type {ReportTab} from '../types';
import Segmented from './Segmented';

interface ReportHeaderProps {
  tab: ReportTab;
  onChangeTab: (tab: ReportTab) => void;
}

export default function ReportHeader({tab, onChangeTab}: ReportHeaderProps) {
  return <Segmented options={reportTabs} value={tab} onChange={onChangeTab} />;
}
