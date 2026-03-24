'use client';

import { useMemo } from 'react';
import type { BurndownPoint } from '@/lib/api/cycles';

interface BurndownChartProps {
  data: BurndownPoint[];
  showPoints?: boolean;
  height?: number;
}

export default function BurndownChart({
  data,
  showPoints = false,
  height = 200,
}: BurndownChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return null;

    const metric = showPoints ? 'remaining_points' : 'remaining_tasks';
    const maxValue = Math.max(...data.map(d => Math.max(d[metric], d.ideal_remaining)));
    const minValue = 0;
    const valueRange = maxValue - minValue || 1;

    const width = 100;
    const padding = { top: 10, right: 10, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Generate path for actual line
    const actualPath = data
      .map((point, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + ((maxValue - point[metric]) / valueRange) * chartHeight;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    // Generate path for ideal line
    const idealPath = data
      .map((point, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + ((maxValue - point.ideal_remaining) / valueRange) * chartHeight;
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    // Y-axis labels
    const yLabels = [0, Math.round(maxValue / 2), maxValue].map(value => ({
      value,
      y: padding.top + ((maxValue - value) / valueRange) * chartHeight,
    }));

    // X-axis labels (first, middle, last)
    const xLabels = [
      { date: data[0].date, x: padding.left },
      { date: data[Math.floor(data.length / 2)]?.date, x: padding.left + chartWidth / 2 },
      { date: data[data.length - 1].date, x: padding.left + chartWidth },
    ].filter(l => l.date);

    return {
      actualPath,
      idealPath,
      yLabels,
      xLabels,
      padding,
      chartWidth,
      chartHeight,
      lastPoint: data[data.length - 1],
      maxValue,
    };
  }, [data, showPoints, height]);

  if (!chartData || !data.length) {
    return (
      <div
        className="flex items-center justify-center glass-card rounded-xl"
        style={{ height }}
      >
        <span className="text-white/40 text-sm">No burndown data available</span>
      </div>
    );
  }

  const { actualPath, idealPath, yLabels, xLabels, padding, lastPoint, maxValue } = chartData;

  return (
    <div className="glass-card p-4 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-white">Burndown</h4>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-indigo-500 rounded" />
            <span className="text-white/60">Actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-white/30 rounded" style={{ strokeDasharray: '4 2' }} />
            <span className="text-white/60">Ideal</span>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 100 ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={label.y}
            x2={100 - padding.right}
            y2={label.y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="0.5"
          />
        ))}

        {/* Ideal line (dashed) */}
        <path
          d={idealPath}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
          strokeDasharray="4 2"
        />

        {/* Actual line */}
        <path
          d={actualPath}
          fill="none"
          stroke="url(#burndown-gradient)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Area under actual line */}
        <path
          d={`${actualPath} L ${100 - padding.right} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`}
          fill="url(#burndown-area-gradient)"
          opacity="0.2"
        />

        {/* Y-axis labels */}
        {yLabels.map((label, i) => (
          <text
            key={i}
            x={padding.left - 5}
            y={label.y}
            textAnchor="end"
            alignmentBaseline="middle"
            className="text-[8px] fill-white/40"
          >
            {label.value}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={height - 10}
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            className="text-[8px] fill-white/40"
          >
            {new Date(label.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="burndown-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
          <linearGradient id="burndown-area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>

      {/* Summary */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10 text-sm">
        <div className="text-white/60">
          Remaining: <span className="text-white font-medium">
            {showPoints ? lastPoint.remaining_points : lastPoint.remaining_tasks}
            {showPoints ? ' pts' : ' tasks'}
          </span>
        </div>
        <div className="text-white/60">
          Ideal: <span className="text-white/80">{Math.round(lastPoint.ideal_remaining)}</span>
        </div>
      </div>
    </div>
  );
}
