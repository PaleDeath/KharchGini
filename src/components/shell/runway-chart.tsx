'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { formatDay, formatDayFull, type ISODate } from '@/domain/dates';
import { formatMoney, formatSigned, type Paise } from '@/domain/money';
import type { DayBalance } from '@/domain/types';
import { Card } from '@/components/ui/card';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/utils';

type RangeView = 'payday' | '30d' | '45d';

export function RunwayChart({
  projection,
  today,
  until,
}: {
  projection: DayBalance[];
  today: ISODate;
  until: ISODate;
}) {
  const [rangeView, setRangeView] = useState<RangeView>('payday');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Filter window based on user view
  const windowDays = useMemo(() => {
    if (projection.length === 0) return [];
    const endIdx = projection.findIndex((p) => p.date === until);

    if (rangeView === 'payday') {
      const limit = endIdx >= 0 ? Math.min(projection.length, endIdx + 1) : Math.min(projection.length, 30);
      return projection.slice(0, Math.max(2, limit));
    }
    if (rangeView === '30d') {
      return projection.slice(0, Math.min(projection.length, 30));
    }
    // 45d full
    return projection.slice(0, 45);
  }, [projection, until, rangeView]);

  const currentBalance = projection[0]?.balance ?? 0;

  // Key stats across the active forecast window
  const stats = useMemo(() => {
    if (windowDays.length === 0) {
      return { min: 0, max: 0, actualMin: 0, actualMax: 0, values: [] };
    }
    const balances = windowDays.map((d) => d.balance);
    const minVal = Math.min(...balances);
    const maxVal = Math.max(...balances);

    const delta = maxVal - minVal;
    // Proportional headroom and padding to avoid flatlining at the SVG ceiling
    const padding = delta > 0 ? Math.max(delta * 0.35, 50000) : Math.max(500000, Math.abs(maxVal) * 0.2);

    const effectiveMin = minVal < 0 ? minVal - padding : minVal > padding * 2 ? minVal - padding : 0;
    const effectiveMax = maxVal + padding;

    return {
      min: effectiveMin,
      max: effectiveMax,
      actualMin: minVal,
      actualMax: maxVal,
      values: balances,
    };
  }, [windowDays]);

  // Lowest balance in window
  const lowestPoint = useMemo(() => {
    if (windowDays.length === 0) return undefined;
    return windowDays.reduce((min, d) => (d.balance < min.balance ? d : min), windowDays[0]);
  }, [windowDays]);

  // Upcoming bills & income in window
  const { upcomingOutflow, upcomingInflow, upcomingCount } = useMemo(() => {
    let outSum = 0;
    let inSum = 0;
    let count = 0;
    for (const d of windowDays) {
      for (const e of d.events) {
        count++;
        if (e.direction === 'in') inSum += e.amount;
        else outSum += e.amount;
      }
    }
    return { upcomingOutflow: outSum, upcomingInflow: inSum, upcomingCount: count };
  }, [windowDays]);

  // Payday balance
  const paydayBalance = useMemo(() => {
    const pEntry = projection.find((p) => p.date === until);
    return pEntry?.balance ?? currentBalance;
  }, [projection, until, currentBalance]);

  // Chart Dimensions
  const height = 140;
  const width = 640;
  const paddingX = 24;
  const paddingY = 24;

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

  // Construct SVG cubic bezier curve
  const svgPath = useMemo(() => {
    if (points.length < 2) return '';
    return points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
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
    const bottomY = height - paddingY / 2;
    return `${svgPath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [points, svgPath, height, paddingY]);

  // Y position of zero line
  const zeroY = useMemo(() => {
    if (stats.min >= 0) return null;
    const range = Math.max(1, stats.max - stats.min);
    const normalizedZero = (0 - stats.min) / range;
    const usableH = height - paddingY * 2;
    return height - paddingY - normalizedZero * usableH;
  }, [stats, height, paddingY]);

  // Payday point
  const paydayPoint = useMemo(() => {
    return points.find((pt) => pt.dayItem.date === until);
  }, [points, until]);

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;

  // Runway Status
  const runwayStatus = useMemo(() => {
    if (lowestPoint && lowestPoint.balance < 0) {
      return {
        tone: 'bad' as const,
        label: 'Deficit Risk',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        text: `Dips below ₹0 on ${formatDay(lowestPoint.date)}`,
      };
    }
    if (lowestPoint && lowestPoint.balance < currentBalance * 0.15) {
      return {
        tone: 'warn' as const,
        label: 'Tight Margin',
        icon: <TrendingDown className="h-3.5 w-3.5" />,
        text: `Low of ${formatMoney(lowestPoint.balance)} on ${formatDay(lowestPoint.date)}`,
      };
    }
    return {
      tone: 'good' as const,
      label: 'Runway Healthy',
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      text: `Fully funded through ${formatDay(until)}`,
    };
  }, [lowestPoint, currentBalance, until]);

  return (
    <Card className="overflow-hidden rounded-2xl border border-line/70 bg-surface/95 p-4.5 sm:p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent shadow-2xs">
              <Wallet className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-ink tracking-tight">
              Cash Flow Runway Forecast
            </h3>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                runwayStatus.tone === 'good'
                  ? 'bg-good/15 text-good border border-good/20'
                  : runwayStatus.tone === 'warn'
                  ? 'bg-warn/15 text-warn border border-warn/20'
                  : 'bg-bad/15 text-bad border border-bad/20 animate-pulse',
              )}
            >
              {runwayStatus.icon}
              {runwayStatus.label}
            </span>
          </div>
          <p className="text-xs text-muted mt-1 leading-normal">
            Projected liquid cash based on scheduled recurring bills & income
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center rounded-lg border border-line/60 bg-raised/80 p-0.5 text-xs font-semibold self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setRangeView('payday')}
            className={cn(
              'rounded-md px-2.5 py-1 transition-all',
              rangeView === 'payday'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-muted hover:text-ink',
            )}
          >
            Until Payday
          </button>
          <button
            type="button"
            onClick={() => setRangeView('30d')}
            className={cn(
              'rounded-md px-2.5 py-1 transition-all',
              rangeView === '30d'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-muted hover:text-ink',
            )}
          >
            30 Days
          </button>
          <button
            type="button"
            onClick={() => setRangeView('45d')}
            className={cn(
              'rounded-md px-2.5 py-1 transition-all',
              rangeView === '45d'
                ? 'bg-surface text-ink shadow-2xs font-bold'
                : 'text-muted hover:text-ink',
            )}
          >
            45 Days
          </button>
        </div>
      </div>

      {/* Metric Micro-Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-line/60 bg-raised/40 p-2.5 sm:p-3 space-y-0.5">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted block truncate">
            Current Liquid
          </span>
          <Money
            value={currentBalance}
            className="text-sm sm:text-base font-bold text-ink tnum block"
            tone="plain"
          />
          <span className="text-[10px] text-faint block">Starting today</span>
        </div>

        <div className="rounded-xl border border-line/60 bg-raised/40 p-2.5 sm:p-3 space-y-0.5">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted block truncate">
            Upcoming Bills
          </span>
          <span className="text-sm sm:text-base font-bold text-bad tnum block">
            {upcomingOutflow > 0 ? `−${formatMoney(upcomingOutflow)}` : '₹0'}
          </span>
          <span className="text-[10px] text-faint block">
            {upcomingCount > 0 ? `${upcomingCount} event${upcomingCount > 1 ? 's' : ''}` : 'No bills due'}
          </span>
        </div>

        <div className="rounded-xl border border-line/60 bg-raised/40 p-2.5 sm:p-3 space-y-0.5">
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted block truncate">
            Payday Balance
          </span>
          <Money
            value={paydayBalance}
            className="text-sm sm:text-base font-bold text-ink tnum block"
            tone={paydayBalance < 0 ? 'bad' : 'plain'}
          />
          <span className="text-[10px] text-accent font-medium block">
            On {formatDay(until)}
          </span>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full rounded-xl border border-line/50 bg-gradient-to-b from-raised/30 to-surface/50 p-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-36 overflow-visible select-none"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="runwayGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.28" />
              <stop offset="60%" stopColor="hsl(var(--accent))" stopOpacity="0.08" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="dangerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--bad))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(var(--bad))" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Zero Danger Reference Line */}
          {zeroY !== null ? (
            <g>
              <line
                x1={paddingX}
                y1={zeroY}
                x2={width - paddingX}
                y2={zeroY}
                stroke="hsl(var(--bad))"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                opacity="0.8"
              />
              <text
                x={width - paddingX}
                y={zeroY - 4}
                textAnchor="end"
                className="fill-bad text-[10px] font-bold"
              >
                ₹0 Deficit Line
              </text>
            </g>
          ) : null}

          {/* Payday Vertical Hairline & Badge */}
          {paydayPoint ? (
            <g>
              <line
                x1={paydayPoint.x}
                y1={paddingY / 2}
                x2={paydayPoint.x}
                y2={height - paddingY / 2}
                stroke="hsl(var(--ink))"
                strokeDasharray="3 3"
                strokeWidth="1.2"
                opacity="0.35"
              />
              <text
                x={paydayPoint.x}
                y={paddingY - 6}
                textAnchor="middle"
                className="fill-accent text-[9px] font-bold uppercase tracking-wider"
              >
                Payday
              </text>
            </g>
          ) : null}

          {/* Area fill under the curve */}
          <path d={areaPath} fill="url(#runwayGradient)" />

          {/* Curved Line */}
          <path
            d={svgPath}
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Event markers & interactive hit targets */}
          {points.map((pt, i) => {
            const hasEvents = pt.dayItem.events.length > 0;
            const hasInflow = pt.dayItem.events.some((e) => e.direction === 'in');
            const hasOutflow = pt.dayItem.events.some((e) => e.direction === 'out');
            const isNegative = pt.dayItem.balance < 0;
            const isPayday = pt.dayItem.date === until;
            const isHovered = hoveredIdx === i;

            return (
              <g key={pt.dayItem.date}>
                {/* Event Marker Dots with correct cy attribute */}
                {(hasEvents || isPayday || isNegative) ? (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5.5 : hasEvents ? 4 : isPayday ? 4 : 3}
                    className={cn(
                      'transition-all duration-150',
                      isNegative
                        ? 'fill-bad stroke-surface stroke-2'
                        : hasInflow
                        ? 'fill-good stroke-surface stroke-2'
                        : hasOutflow
                        ? 'fill-orange-500 stroke-surface stroke-2'
                        : isPayday
                        ? 'fill-accent stroke-surface stroke-2'
                        : 'fill-ink stroke-surface stroke-1.5',
                    )}
                  />
                ) : null}

                {/* Wide invisible touch/mouse hit slice */}
                <rect
                  x={pt.x - width / points.length / 2}
                  y={0}
                  width={width / points.length}
                  height={height}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onTouchStart={() => setHoveredIdx(i)}
                  onTouchMove={() => setHoveredIdx(i)}
                />
              </g>
            );
          })}

          {/* Active Hover Crosshair & Indicator */}
          {activePoint ? (
            <g className="pointer-events-none transition-all duration-75">
              <line
                x1={activePoint.x}
                y1={paddingY / 2}
                x2={activePoint.x}
                y2={height - paddingY / 2}
                stroke="hsl(var(--accent))"
                strokeWidth="1.5"
                opacity="0.75"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={6}
                className="fill-accent stroke-surface stroke-2 shadow-md"
              />
            </g>
          ) : null}
        </svg>
      </div>

      {/* Dynamic Detail Inspector / Status Banner */}
      {activePoint ? (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/20 text-accent shrink-0">
              <Calendar className="h-3.5 w-3.5" />
            </span>
            <div className="truncate">
              <span className="font-semibold text-ink text-xs block">
                {formatDayFull(activePoint.dayItem.date)}
              </span>
              {activePoint.dayItem.events.length > 0 ? (
                <span className="text-[11px] text-muted truncate block">
                  {activePoint.dayItem.events.map((e) => e.label).join(', ')}
                </span>
              ) : (
                <span className="text-[11px] text-muted block">
                  No scheduled transactions on this day
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
            {activePoint.dayItem.balance !== currentBalance ? (
              <span
                className={cn(
                  'text-xs font-semibold',
                  activePoint.dayItem.balance < currentBalance ? 'text-bad' : 'text-good',
                )}
              >
                {formatSigned(activePoint.dayItem.balance - currentBalance)}
              </span>
            ) : null}
            <div className="text-right">
              <span className="text-[10px] text-muted block uppercase tracking-wider font-semibold">
                Projected Balance
              </span>
              <Money
                value={activePoint.dayItem.balance}
                className="text-sm font-bold text-ink"
                tone={activePoint.dayItem.balance < 0 ? 'bad' : 'plain'}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-muted px-1">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Today: {formatDay(today)}
          </span>
          <span className="text-faint hidden sm:inline">
            Scrub or hover across the curve to inspect daily balances
          </span>
          <span className="font-medium text-ink">
            Target Payday: {formatDay(until)}
          </span>
        </div>
      )}
    </Card>
  );
}

