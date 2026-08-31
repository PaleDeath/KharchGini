'use client';

import { useMemo, useState } from 'react';
import { Calendar, TrendingDown, Wallet } from 'lucide-react';

import { formatDay, formatDayFull, type ISODate } from '@/domain/dates';
import type { DayBalance } from '@/domain/types';
import { Card } from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/utils';

export function RunwayChart({
  projection,
  today,
  until,
}: {
  projection: DayBalance[];
  today: ISODate;
  until: ISODate;
}) {
  // Limit chart to runway window (today to next payday / end of month, plus a few days buffer up to 35 days)
  const windowDays = useMemo(() => {
    const endIdx = projection.findIndex((p) => p.date === until);
    const limit = endIdx >= 0 ? Math.min(projection.length, Math.max(14, endIdx + 7)) : Math.min(projection.length, 30);
    return projection.slice(0, limit);
  }, [projection, until]);

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const stats = useMemo(() => {
    if (windowDays.length === 0) return { min: 0, max: 0, values: [] };
    const balances = windowDays.map((d) => d.balance);
    const minVal = Math.min(0, ...balances);
    const maxVal = Math.max(10_000, ...balances);
    return { min: minVal, max: maxVal, values: balances };
  }, [windowDays]);

  const height = 120;
  const width = 600;
  const paddingX = 20;
  const paddingY = 16;

  const points = useMemo(() => {
    if (windowDays.length < 2) return [];
    const count = windowDays.length;
    const range = Math.max(1, stats.max - stats.min);
    const usableW = width - paddingX * 2;
    const usableH = height - paddingY * 2;

    return windowDays.map((dayItem, i) => {
      const x = paddingX + (i / (count - 1)) * usableW;
      const normalizedY = (dayItem.balance - stats.min) / range;
      const y = height - paddingY - normalizedY * usableH;
      return { x, y, dayItem };
    });
  }, [windowDays, stats, width, height, paddingX, paddingY]);

  // Construct SVG path
  const svgPath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      // Smooth cubic bezier curve
      const prev = points[i - 1]!;
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length < 2 || !svgPath) return '';
    const first = points[0]!;
    const last = points[points.length - 1]!;
    const bottomY = height - paddingY;
    return `${svgPath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [points, svgPath, height, paddingY]);

  // Y position of 0 line
  const zeroY = useMemo(() => {
    const range = Math.max(1, stats.max - stats.min);
    const normalizedZero = (0 - stats.min) / range;
    const usableH = height - paddingY * 2;
    return height - paddingY - normalizedZero * usableH;
  }, [stats, height, paddingY]);

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : points[0];

  return (
    <Card className="overflow-hidden p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
            <Wallet className="h-4 w-4 text-accent" /> Cash Flow Runway Forecast
          </h3>
          <p className="text-[12px] text-muted mt-0.5">
            Projected liquidity until {formatDayFull(until)} based on recurring bills & income
          </p>
        </div>

        {activePoint ? (
          <div className="text-right">
            <span className="text-[11px] text-faint block">{formatDay(activePoint.dayItem.date)}</span>
            <Money
              value={activePoint.dayItem.balance}
              className="text-sm font-bold"
              tone={activePoint.dayItem.balance < 0 ? 'bad' : 'plain'}
            />
          </div>
        ) : null}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-28 overflow-visible select-none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="runwayGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Zero reference line */}
          {stats.min < 0 ? (
            <line
              x1={paddingX}
              y1={zeroY}
              x2={width - paddingX}
              y2={zeroY}
              stroke="hsl(var(--bad))"
              strokeDasharray="4 4"
              strokeWidth="1.2"
              opacity="0.6"
            />
          ) : null}

          {/* Area under curve */}
          <path d={areaPath} fill="url(#runwayGradient)" />

          {/* Line curve */}
          <path
            d={svgPath}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Points & Interactive hits */}
          {points.map((pt, i) => {
            const isPayday = pt.dayItem.date === until;
            const isNegative = pt.dayItem.balance < 0;
            const isHovered = hoveredIdx === i;

            return (
              <g key={pt.dayItem.date}>
                {isPayday ? (
                  <line
                    x1={pt.x}
                    y1={paddingY}
                    x2={pt.x}
                    y2={height - paddingY}
                    stroke="hsl(var(--muted))"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                ) : null}

                {(isHovered || isPayday || isNegative || pt.dayItem.events.length > 0) ? (
                  <circle
                    cx={pt.x}
                    y={pt.y}
                    r={isHovered ? 5 : isNegative ? 4.5 : isPayday ? 4 : 3}
                    className={cn(
                      'transition-all',
                      isNegative
                        ? 'fill-bad stroke-surface stroke-2'
                        : isPayday
                          ? 'fill-accent stroke-surface stroke-2'
                          : 'fill-ink stroke-surface stroke-1'
                    )}
                  />
                ) : null}

                {/* Invisible wide hit target for touch / mouse */}
                <rect
                  x={pt.x - (width / points.length) / 2}
                  y={0}
                  width={width / points.length}
                  height={height}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onTouchStart={() => setHoveredIdx(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Events tooltip on active day */}
      {activePoint && activePoint.dayItem.events.length > 0 ? (
        <div className="rounded-lg bg-raised/70 px-3 py-2 text-[12px] flex items-center justify-between gap-2 border border-line/60">
          <span className="flex items-center gap-1.5 text-muted truncate">
            <Calendar className="h-3.5 w-3.5 text-accent shrink-0" />
            Due {formatDay(activePoint.dayItem.date)}: {activePoint.dayItem.events.map((e) => e.label).join(', ')}
          </span>
          <span className="shrink-0 font-medium text-ink">
            {activePoint.dayItem.events.map((e) => (
              <span key={e.label} className={e.direction === 'in' ? 'text-good' : 'text-bad'}>
                {e.direction === 'in' ? '+' : '−'}
                <Money value={e.amount} tone="plain" />
              </span>
            ))}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-faint px-1">
          <span>Today ({formatDay(today)})</span>
          <span>Target Payday ({formatDay(until)})</span>
        </div>
      )}
    </Card>
  );
}
