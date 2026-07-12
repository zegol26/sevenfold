"use client";

// Small inline SVG visualization of a CashflowOption's dated cash schedule (see
// src/lib/cashflowEngine.ts). No charting library - this is 2-4 points, so a
// hand-rolled line/area is simpler and lighter than pulling in a dependency.
//
// Form: a single series (cumulative cash balance) plotted against a zero baseline,
// colored per the dataviz skill's "above/below baseline" guidance - the segment
// below zero (the cash-gap period) washes red, the segment above zero (recovered
// margin) washes green. A single series needs no legend; the two extremes (the
// minimum/cash-gap point and the break-even crossing) are the only direct labels.

type ScheduleEvent = {
  date: string;
  label: string;
  type: "cost_outflow" | "revenue_inflow";
  amount: number;
  cumulative: number;
};

const GOOD = "#0ca30c";
const CRITICAL = "#d03b3b";
const MUTED = "#898781";

function parseSchedule(schedule: string): ScheduleEvent[] {
  try {
    const parsed = JSON.parse(schedule);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function compactMoney(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function CashflowChart({ schedule, compact = false }: { schedule: string; compact?: boolean }) {
  const events = parseSchedule(schedule);
  if (events.length === 0) return null;

  const points = [{ date: events[0]?.date, label: "Start", cumulative: 0 }, ...events];
  const width = compact ? 220 : 560;
  const height = compact ? 72 : 160;
  const padX = compact ? 8 : 16;
  const padY = compact ? 14 : 24;

  const values = points.map((point) => point.cumulative);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const xFor = (index: number) => padX + (index / (points.length - 1 || 1)) * (width - padX * 2);
  const yFor = (value: number) => padY + (1 - (value - min) / range) * (height - padY * 2);
  const zeroY = yFor(0);

  const minIndex = values.indexOf(Math.min(...values));
  const breakEvenIndex = points.findIndex((point, index) => index > 0 && point.cumulative >= 0);

  // Split the polyline into above/below-zero segments so each can carry its own
  // wash color, per the diverging-vs-baseline form for "above/below a target".
  const segments: { x1: number; y1: number; x2: number; y2: number; positive: boolean }[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const sameSign = (a.cumulative >= 0) === (b.cumulative >= 0);
    if (sameSign || a.cumulative === b.cumulative) {
      segments.push({ x1: xFor(i), y1: yFor(a.cumulative), x2: xFor(i + 1), y2: yFor(b.cumulative), positive: a.cumulative >= 0 });
    } else {
      // Interpolate the zero-crossing so the color switches exactly at the baseline.
      const t = (0 - a.cumulative) / (b.cumulative - a.cumulative);
      const crossX = xFor(i) + t * (xFor(i + 1) - xFor(i));
      segments.push({ x1: xFor(i), y1: yFor(a.cumulative), x2: crossX, y2: zeroY, positive: a.cumulative >= 0 });
      segments.push({ x1: crossX, y1: zeroY, x2: xFor(i + 1), y2: yFor(b.cumulative), positive: b.cumulative >= 0 });
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Cash schedule from ${points[0]?.date} to ${points[points.length - 1]?.date}, cash gap ${compactMoney(Math.min(...values))}`}
      className="max-w-full"
    >
      <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke="var(--border)" strokeWidth={1} />
      {segments.map((segment, index) => (
        <line
          key={index}
          x1={segment.x1}
          y1={segment.y1}
          x2={segment.x2}
          y2={segment.y2}
          stroke={segment.positive ? GOOD : CRITICAL}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      {points.map((point, index) => {
        const isMin = index === minIndex && point.cumulative < 0;
        const isBreakEven = index === breakEvenIndex;
        return (
          <g key={index}>
            <circle
              cx={xFor(index)}
              cy={yFor(point.cumulative)}
              r={isMin || isBreakEven ? 4 : 3}
              fill={point.cumulative < 0 ? CRITICAL : point.cumulative > 0 ? GOOD : MUTED}
              stroke="var(--card)"
              strokeWidth={2}
            >
              <title>{`${point.label}: ${compactMoney(point.cumulative)} (${point.date})`}</title>
            </circle>
            {/* Direct labels only render at detail-page size - at compact (table
                cell) size they'd overlap and be illegible; the value is already in
                the adjacent Cash Gap / Break-even columns, and the <title> above
                covers hover. */}
            {!compact && isMin && (
              <text x={xFor(index)} y={yFor(point.cumulative) + 18} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
                {compactMoney(point.cumulative)}
              </text>
            )}
            {!compact && isBreakEven && !isMin && (
              <text x={xFor(index)} y={yFor(point.cumulative) - 8} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
                break-even
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
