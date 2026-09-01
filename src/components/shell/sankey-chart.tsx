'use client';

import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  addMonthsToKey,
  currentMonth,
  formatMonth,
  type MonthKey,
} from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { computeActualSankey, type SankeyData, type SankeyLink, type SankeyNode } from '@/domain/sankey';
import { Badge, Money } from '@/components/ui/money';
import { Card } from '@/components/ui/card';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';

export function SankeyChart({
  initialMonth = currentMonth(),
  className,
}: {
  initialMonth?: MonthKey;
  className?: string;
}) {
  const { ledger } = useLedger();
  const [month, setMonth] = useState<MonthKey>(initialMonth);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  const data: SankeyData = useMemo(() => computeActualSankey(ledger, month), [ledger, month]);
  const isCurrent = month === currentMonth();

  // SVG Geometry Dimensions
  const SVG_WIDTH = 900;
  const BAR_WIDTH = 12;
  const HUB_BAR_WIDTH = 14;
  
  // X positions for the 3 columns (slim vertical bars)
  const COL_X = [230, 443, 650];
  const MIN_NODE_H = 28;
  const MAX_NODE_H = 140;
  const NODE_GAP = 14;
  const PADDING_TOP = 40;
  const PADDING_BOTTOM = 28;

  // Compute Layout Positions
  const layout = useMemo(() => {
    if (data.isEmpty || data.nodes.length === 0) {
      return { nodes: [], links: [], height: 260 };
    }

    const col0Nodes = data.nodes.filter((n) => n.column === 0);
    const col1Nodes = data.nodes.filter((n) => n.column === 1);
    const col2Nodes = data.nodes.filter((n) => n.column === 2);

    const maxItems = Math.max(col0Nodes.length, col1Nodes.length, col2Nodes.length, 2);
    const targetHeight = Math.max(280, Math.min(480, maxItems * 58 + PADDING_TOP + PADDING_BOTTOM));
    const availH = targetHeight - PADDING_TOP - PADDING_BOTTOM;

    const totalVal = data.totalInflow || 1;

    interface NodePos {
      node: SankeyNode;
      x: number;
      y: number;
      width: number;
      height: number;
      sourceOffset: number;
      targetOffset: number;
    }

    const nodePositions = new Map<string, NodePos>();

    const layoutCol = (nodes: SankeyNode[], colIndex: number) => {
      const colX = COL_X[colIndex] ?? 0;
      const isHub = colIndex === 1;
      const w = isHub ? HUB_BAR_WIDTH : BAR_WIDTH;

      const totalGap = Math.max(0, nodes.length - 1) * NODE_GAP;
      const usableH = Math.max(60, availH - totalGap);

      // Compute proportional heights clamped between min and max
      const rawHeights = nodes.map((n) => {
        const prop = (n.value / totalVal) * usableH;
        return Math.min(MAX_NODE_H, Math.max(MIN_NODE_H, prop));
      });

      const sumCalculatedH = rawHeights.reduce((a, b) => a + b, 0);
      const totalColHeight = sumCalculatedH + totalGap;
      
      // Center column vertically within canvas
      let currentY = PADDING_TOP + Math.max(0, (availH - totalColHeight) / 2);

      nodes.forEach((node, idx) => {
        const nodeH = rawHeights[idx]!;
        nodePositions.set(node.id, {
          node,
          x: colX,
          y: currentY,
          width: w,
          height: nodeH,
          sourceOffset: 0,
          targetOffset: 0,
        });
        currentY += nodeH + NODE_GAP;
      });
    };

    layoutCol(col0Nodes, 0);
    layoutCol(col1Nodes, 1);
    layoutCol(col2Nodes, 2);

    interface LinkPath {
      link: SankeyLink;
      d: string;
      sourcePos: NodePos;
      targetPos: NodePos;
      isHighlighted: boolean;
    }

    const linkPaths: LinkPath[] = [];

    for (const link of data.links) {
      const source = nodePositions.get(link.sourceId);
      const target = nodePositions.get(link.targetId);
      if (!source || !target) continue;

      // Link ribbon height proportional to link value
      const sourceLinkH = Math.max(3, (link.value / (source.node.value || totalVal)) * source.height);
      const targetLinkH = Math.max(3, (link.value / (target.node.value || totalVal)) * target.height);

      const x0 = source.x + source.width;
      const y0 = source.y + source.sourceOffset;
      const x1 = target.x;
      const y1 = target.y + target.targetOffset;

      source.sourceOffset += sourceLinkH;
      target.targetOffset += targetLinkH;

      const cX1 = x0 + (x1 - x0) * 0.46;
      const cX2 = x0 + (x1 - x0) * 0.54;

      const d = `
        M ${x0} ${y0}
        C ${cX1} ${y0}, ${cX2} ${y1}, ${x1} ${y1}
        L ${x1} ${y1 + targetLinkH}
        C ${cX2} ${y1 + targetLinkH}, ${cX1} ${y0 + sourceLinkH}, ${x0} ${y0 + sourceLinkH}
        Z
      `;

      const isHighlighted =
        hoveredLinkId === link.id ||
        hoveredNodeId === link.sourceId ||
        hoveredNodeId === link.targetId;

      linkPaths.push({
        link,
        d,
        sourcePos: source,
        targetPos: target,
        isHighlighted,
      });
    }

    const maxY = Math.max(
      targetHeight,
      ...Array.from(nodePositions.values()).map((p) => p.y + p.height + PADDING_BOTTOM),
    );

    return {
      nodes: Array.from(nodePositions.values()),
      links: linkPaths,
      height: maxY,
    };
  }, [data, hoveredNodeId, hoveredLinkId]);

  const activeInspectInfo = useMemo(() => {
    if (hoveredLinkId) {
      const linkItem = data.links.find((l) => l.id === hoveredLinkId);
      if (linkItem) {
        return `${linkItem.sourceName} → ${linkItem.targetName}: ${formatMoney(linkItem.value)} (${Math.round(linkItem.pctOfTotal)}% of cash flow)`;
      }
    }
    if (hoveredNodeId) {
      const nodeItem = data.nodes.find((n) => n.id === hoveredNodeId);
      if (nodeItem) {
        return `${nodeItem.name}: ${formatMoney(nodeItem.value)} (${Math.round(nodeItem.pctOfTotal)}% of total)`;
      }
    }
    return null;
  }, [hoveredLinkId, hoveredNodeId, data]);

  return (
    <Card className={cn('overflow-hidden rounded-3xl border border-line bg-surface/95 p-5 shadow-card space-y-4', className)}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-500 shadow-2xs">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-ink flex items-center gap-2">
              <span>Cash Flow Sankey</span>
              {data.savingsRatePct > 0 ? (
                <Badge tone="good" className="text-[10px] py-0.5 px-2 font-bold">
                  {Math.round(data.savingsRatePct)}% Retained
                </Badge>
              ) : null}
            </h3>
            <p className="text-xs text-faint">Visual money flow: Income → Spendable Pool → Categories & Savings</p>
          </div>
        </div>

        {/* Month Picker Controls */}
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface/90 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setMonth(addMonthsToKey(month, -1))}
            aria-label="Previous month"
            className="rounded-xl p-1.5 text-muted hover:bg-raised hover:text-ink transition-colors active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMonth(currentMonth())}
            className={cn(
              'min-w-[6.5rem] rounded-xl px-2.5 py-1 text-center text-xs font-bold transition-all active:scale-95',
              isCurrent ? 'bg-raised text-ink' : 'text-accent hover:bg-raised',
            )}
            title={isCurrent ? undefined : 'Back to current month'}
          >
            {formatMonth(month)}
          </button>
          <button
            type="button"
            onClick={() => setMonth(addMonthsToKey(month, 1))}
            aria-label="Next month"
            className="rounded-xl p-1.5 text-muted hover:bg-raised hover:text-ink transition-colors active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-3 gap-2 border-y border-line/70 py-2.5 text-center text-xs">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-faint block">Total Inflow</span>
          <Money value={data.totalInflow} tone="good" className="font-extrabold text-sm sm:text-base mt-0.5" />
        </div>
        <div className="border-x border-line/70">
          <span className="text-[11px] font-bold uppercase tracking-wider text-faint block">Total Outflow</span>
          <Money value={data.totalOutflow} tone="plain" className="font-extrabold text-sm sm:text-base mt-0.5 text-ink" />
        </div>
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-faint block">Net Saved</span>
          <Money value={data.netSaved} signed tone="auto" className="font-extrabold text-sm sm:text-base mt-0.5" />
        </div>
      </div>

      {/* Empty State */}
      {data.isEmpty ? (
        <div className="py-12 text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-raised border border-line text-faint">
            <Layers className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-ink">No transaction flow recorded in {formatMonth(month)}</p>
          <p className="text-xs text-faint max-w-xs mx-auto">
            Log income and expenses using the command bar to see your interactive cash flow graph.
          </p>
        </div>
      ) : (
        <div className="w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${layout.height}`}
            className="w-full h-auto max-h-[520px] transition-all duration-300"
          >
            <defs>
              {layout.links.map(({ link, sourcePos, targetPos }) => (
                <linearGradient
                  key={`grad_${link.id}`}
                  id={`grad_${link.id}`}
                  gradientUnits="userSpaceOnUse"
                  x1={sourcePos.x + sourcePos.width}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                >
                  <stop offset="0%" stopColor={link.color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={link.color} stopOpacity={0.25} />
                </linearGradient>
              ))}
            </defs>

            {/* Column Headers */}
            <g className="text-[11px] font-extrabold uppercase tracking-wider fill-muted">
              <text x={COL_X[0]} y={20} textAnchor="end">
                Inflow Sources
              </text>
              <text x={COL_X[1] + HUB_BAR_WIDTH / 2} y={20} textAnchor="middle">
                Spendable Pool
              </text>
              <text x={COL_X[2]} y={20} textAnchor="start">
                Destinations / Allocations
              </text>
            </g>

            {/* Bézier Flow Ribbons */}
            <g>
              {layout.links.map(({ link, d, isHighlighted }) => (
                <path
                  key={link.id}
                  d={d}
                  fill={`url(#grad_${link.id})`}
                  stroke={link.color}
                  strokeWidth={isHighlighted ? 1.5 : 0.5}
                  strokeOpacity={isHighlighted ? 0.95 : 0.4}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredLinkId(link.id)}
                  onMouseLeave={() => setHoveredLinkId(null)}
                >
                  <title>{`${link.sourceName} → ${link.targetName}: ${formatMoney(link.value)} (${Math.round(link.pctOfTotal)}%)`}</title>
                </path>
              ))}
            </g>

            {/* Node Bars & Crisp External Typography */}
            <g>
              {layout.nodes.map(({ node, x, y, width, height }) => {
                const isHovered =
                  hoveredNodeId === node.id ||
                  layout.links.some(
                    (l) => l.link.id === hoveredLinkId && (l.link.sourceId === node.id || l.link.targetId === node.id),
                  );

                const isCol0 = node.column === 0;
                const isCol1 = node.column === 1;
                const isCol2 = node.column === 2;

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer group"
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                  >
                    {/* Slim Vertical Pill Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      rx={6}
                      fill={node.color}
                      fillOpacity={isHovered ? 1 : 0.9}
                      stroke={isHovered ? '#ffffff' : 'none'}
                      strokeWidth={isHovered ? 2 : 0}
                      className="shadow-sm transition-all duration-150"
                    />

                    {/* Column 0 Text: Right Aligned to left of bar */}
                    {isCol0 && (
                      <g className="text-right pointer-events-none">
                        <text
                          x={x - 10}
                          y={y + height / 2 - 5}
                          textAnchor="end"
                          dy="0.3em"
                          className="text-[12px] font-extrabold fill-current text-ink"
                        >
                          {node.name}
                        </text>
                        <text
                          x={x - 10}
                          y={y + height / 2 + 10}
                          textAnchor="end"
                          dy="0.3em"
                          className="text-[11px] font-semibold fill-current text-muted"
                        >
                          {formatMoney(node.value)}
                          {node.pctOfTotal < 99 && (
                            <tspan className="text-[10px] text-faint"> · {Math.round(node.pctOfTotal)}%</tspan>
                          )}
                        </text>
                      </g>
                    )}

                    {/* Column 1 Text: Central Spendable Pool Hub */}
                    {isCol1 && (
                      <g className="pointer-events-none">
                        <text
                          x={x + width / 2}
                          y={y + height / 2 - 6}
                          textAnchor="middle"
                          dy="0.3em"
                          className="text-[12px] font-black fill-current text-ink"
                        >
                          Total Inflow
                        </text>
                        <text
                          x={x + width / 2}
                          y={y + height / 2 + 9}
                          textAnchor="middle"
                          dy="0.3em"
                          className="text-[11px] font-bold fill-current text-teal-500"
                        >
                          {formatMoney(node.value)}
                        </text>
                      </g>
                    )}

                    {/* Column 2 Text: Left Aligned to right of bar */}
                    {isCol2 && (
                      <g className="text-left pointer-events-none">
                        <text
                          x={x + width + 10}
                          y={y + height / 2 - 5}
                          textAnchor="start"
                          dy="0.3em"
                          className="text-[12px] font-extrabold fill-current text-ink"
                        >
                          {node.name}
                        </text>
                        <text
                          x={x + width + 10}
                          y={y + height / 2 + 10}
                          textAnchor="start"
                          dy="0.3em"
                          className="text-[11px] font-semibold fill-current text-muted"
                        >
                          {formatMoney(node.value)}
                          <tspan className="text-[10px] text-faint"> · {Math.round(node.pctOfTotal)}%</tspan>
                        </text>
                      </g>
                    )}

                    <title>{`${node.name}: ${formatMoney(node.value)} (${Math.round(node.pctOfTotal)}% of total)`}</title>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}

      {/* Interactive Tooltip / Detail Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-line/60 text-xs">
        <span className="flex items-center gap-1.5 text-muted font-medium truncate">
          <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
          {activeInspectInfo ? (
            <span className="font-bold text-ink animate-in fade-in duration-150">
              {activeInspectInfo}
            </span>
          ) : (
            'Hover over ribbons or nodes to inspect exact cash flow transfers and percentages.'
          )}
        </span>
        <span className="font-semibold text-faint shrink-0 text-[11px]">
          {data.nodes.length} categories & streams
        </span>
      </div>
    </Card>
  );
}
