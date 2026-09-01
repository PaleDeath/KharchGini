'use client';

import {
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
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

  // SVG Geometry Constants
  const SVG_WIDTH = 760;
  const COL_WIDTH = 130;
  const COL_X = [20, 315, 610]; // X coordinate for columns 0, 1, 2
  const NODE_MIN_H = 26;
  const NODE_GAP = 10;
  const PADDING_Y = 24;

  // Layout Computation
  const layout = useMemo(() => {
    if (data.isEmpty || data.nodes.length === 0) {
      return { nodes: [], links: [], height: 260 };
    }

    const col0Nodes = data.nodes.filter((n) => n.column === 0);
    const col1Nodes = data.nodes.filter((n) => n.column === 1);
    const col2Nodes = data.nodes.filter((n) => n.column === 2);

    const maxItems = Math.max(col0Nodes.length, col1Nodes.length, col2Nodes.length, 3);
    const contentHeight = Math.max(300, maxItems * (NODE_MIN_H + NODE_GAP) + PADDING_Y * 2);
    const availH = contentHeight - PADDING_Y * 2;

    const totalVal = data.totalInflow || 1;

    interface NodePos {
      node: SankeyNode;
      x: number;
      y: number;
      width: number;
      height: number;
      sourceOffset: number; // for outgoing links tracking
      targetOffset: number; // for incoming links tracking
    }

    const nodePositions = new Map<string, NodePos>();

    const layoutCol = (nodes: SankeyNode[], colIndex: number) => {
      const colX = COL_X[colIndex] ?? 0;
      const totalGap = Math.max(0, nodes.length - 1) * NODE_GAP;
      const usableH = Math.max(80, availH - totalGap);

      // Distribute height proportionally
      let currentY = PADDING_Y;
      for (const node of nodes) {
        const propHeight = (node.value / totalVal) * usableH;
        const nodeH = Math.max(NODE_MIN_H, propHeight);
        nodePositions.set(node.id, {
          node,
          x: colX,
          y: currentY,
          width: COL_WIDTH,
          height: nodeH,
          sourceOffset: 0,
          targetOffset: 0,
        });
        currentY += nodeH + NODE_GAP;
      }
    };

    layoutCol(col0Nodes, 0);
    layoutCol(col1Nodes, 1);
    layoutCol(col2Nodes, 2);

    // Calculate Bézier links between nodes
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

      const linkH = Math.max(3, (link.value / totalVal) * (availH - 40));

      const x0 = source.x + source.width;
      const y0 = source.y + source.sourceOffset;
      const x1 = target.x;
      const y1 = target.y + target.targetOffset;

      source.sourceOffset += linkH;
      target.targetOffset += linkH;

      const cX1 = x0 + (x1 - x0) * 0.48;
      const cX2 = x0 + (x1 - x0) * 0.52;

      // Ribbon closed path
      const d = `
        M ${x0} ${y0}
        C ${cX1} ${y0}, ${cX2} ${y1}, ${x1} ${y1}
        L ${x1} ${y1 + linkH}
        C ${cX2} ${y1 + linkH}, ${cX1} ${y0 + linkH}, ${x0} ${y0 + linkH}
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

    const calculatedHeight = Math.max(
      contentHeight,
      ...Array.from(nodePositions.values()).map((p) => p.y + p.height + PADDING_Y),
    );

    return {
      nodes: Array.from(nodePositions.values()),
      links: linkPaths,
      height: calculatedHeight,
    };
  }, [data, hoveredNodeId, hoveredLinkId]);

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
        <div className="overflow-x-auto no-scrollbar pb-2">
          <div className="min-w-[680px]">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${layout.height}`}
              className="w-full h-auto select-none transition-all duration-300"
              style={{ minHeight: `${layout.height}px` }}
            >
              <defs>
                {/* Linear gradients for ribbons */}
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

              {/* Column Category Labels */}
              <g className="text-[10px] font-extrabold uppercase tracking-wider fill-muted/70">
                <text x={COL_X[0]} y={14}>
                  Inflow Sources
                </text>
                <text x={COL_X[1]} y={14}>
                  Inflow Pool
                </text>
                <text x={COL_X[2]} y={14}>
                  Destinations / Allocations
                </text>
              </g>

              {/* Bézier Links */}
              <g>
                {layout.links.map(({ link, d, isHighlighted }) => (
                  <path
                    key={link.id}
                    d={d}
                    fill={`url(#grad_${link.id})`}
                    stroke={link.color}
                    strokeWidth={isHighlighted ? 1.5 : 0.5}
                    strokeOpacity={isHighlighted ? 0.9 : 0.3}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredLinkId(link.id)}
                    onMouseLeave={() => setHoveredLinkId(null)}
                  >
                    <title>{`${link.sourceName} → ${link.targetName}: ${formatMoney(link.value)} (${Math.round(link.pctOfTotal)}%)`}</title>
                  </path>
                ))}
              </g>

              {/* Nodes */}
              <g>
                {layout.nodes.map(({ node, x, y, width, height }) => {
                  const isHovered =
                    hoveredNodeId === node.id ||
                    layout.links.some(
                      (l) => l.link.id === hoveredLinkId && (l.link.sourceId === node.id || l.link.targetId === node.id),
                    );

                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer transition-transform duration-150"
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      {/* Node Rectangle */}
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={8}
                        fill={node.color}
                        fillOpacity={isHovered ? 0.95 : 0.85}
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2 : 0}
                        className="shadow-sm transition-all duration-150"
                      />

                      {/* Node Text Content */}
                      <text
                        x={x + 10}
                        y={y + height / 2 - (height > 34 ? 4 : 0)}
                        dy="0.35em"
                        className="text-[11px] font-extrabold fill-white pointer-events-none drop-shadow-xs"
                      >
                        {node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name}
                      </text>

                      {height > 34 && (
                        <text
                          x={x + 10}
                          y={y + height / 2 + 10}
                          dy="0.35em"
                          className="text-[10px] font-semibold fill-white/85 pointer-events-none"
                        >
                          {formatMoney(node.value)}
                          {node.column !== 1 ? ` · ${Math.round(node.pctOfTotal)}%` : ''}
                        </text>
                      )}

                      <title>{`${node.name}: ${formatMoney(node.value)} (${Math.round(node.pctOfTotal)}% of total cash flow)`}</title>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      )}

      {/* Interactive Tooltip Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-line/60 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          Hover over ribbons or nodes to inspect exact cash transfers and percentages.
        </span>
        <span className="font-semibold text-ink">
          {data.nodes.length} categories & streams
        </span>
      </div>
    </Card>
  );
}
