"use client";

import { useMemo, useState } from "react";

export interface LinePoint {
  /** x is either a YYYY-MM-DD date key or a numeric value */
  x: string;
  y: number;
}

interface LineChartProps {
  data: LinePoint[];
  height?: number;
  yFormat?: (v: number) => string;
  xFormat?: (x: string) => string;
  /** Optional label above the chart */
  label?: string;
}

/** Linear scale factory — cheap d3-scale replacement. */
function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

const PAD_L = 44;
const PAD_R = 8;
const PAD_T = 8;
const PAD_B = 22;

export function LineChart({ data, height = 180, yFormat, xFormat, label }: LineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [width, setWidth] = useState(600);

  const chart = useMemo(() => {
    const yMax = Math.max(1, ...data.map((d) => d.y));
    const yMin = 0;
    const innerW = Math.max(1, width - PAD_L - PAD_R);
    const innerH = Math.max(1, height - PAD_T - PAD_B);
    const x = (i: number) => PAD_L + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = scaleLinear([yMin, yMax], [PAD_T + innerH, PAD_T]);

    let line = "";
    data.forEach((d, i) => {
      line += `${i === 0 ? "M" : " L"} ${x(i).toFixed(2)} ${y(d.y).toFixed(2)}`;
    });
    const area = line && data.length > 0
      ? `${line} L ${x(data.length - 1).toFixed(2)} ${(PAD_T + innerH).toFixed(2)} L ${x(0).toFixed(2)} ${(PAD_T + innerH).toFixed(2)} Z`
      : "";

    // 4 horizontal gridlines
    const gridY: { y: number; value: number }[] = [];
    for (let i = 0; i <= 4; i++) {
      const value = (yMax * i) / 4;
      gridY.push({ y: y(value), value });
    }

    return { x, y, line, area, gridY, yMax, innerW, innerH };
  }, [data, width, height]);

  function fmtY(v: number): string {
    if (yFormat) return yFormat(v);
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return v.toFixed(0);
  }

  function fmtX(x: string): string {
    if (xFormat) return xFormat(x);
    return x;
  }

  // X axis tick indices: first, middle, last
  const xTicks = data.length === 0
    ? []
    : data.length <= 3
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <div
      className="w-full"
      ref={(el) => {
        if (el && el.clientWidth && el.clientWidth !== width) {
          setWidth(el.clientWidth);
        }
      }}
    >
      {label && (
        <p className="text-[10px] font-mono text-text-dim uppercase tracking-wider mb-2">{label}</p>
      )}
      {data.length === 0 ? (
        <div
          className="flex items-center justify-center border border-border rounded-sm bg-surface-raised/20"
          style={{ height }}
        >
          <p className="text-xs font-mono text-text-dim">No data in range</p>
        </div>
      ) : (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="border border-border rounded-sm bg-surface-raised/20"
          onMouseLeave={() => setHoverIdx(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < PAD_L || x > width - PAD_R) { setHoverIdx(null); return; }
            const frac = (x - PAD_L) / chart.innerW;
            const idx = Math.round(frac * (data.length - 1));
            setHoverIdx(Math.min(data.length - 1, Math.max(0, idx)));
          }}
        >
          {/* Horizontal gridlines */}
          {chart.gridY.map((g, i) => (
            <g key={i}>
              <line
                x1={PAD_L}
                x2={width - PAD_R}
                y1={g.y}
                y2={g.y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
              <text
                x={PAD_L - 6}
                y={g.y + 3}
                textAnchor="end"
                fontSize="9"
                fontFamily="var(--font-mono)"
                fill="var(--color-text-dim)"
              >
                {fmtY(g.value)}
              </text>
            </g>
          ))}

          {/* Area fill */}
          {chart.area && <path d={chart.area} fill="var(--color-accent)" fillOpacity="0.1" />}
          {/* Line */}
          {chart.line && (
            <path
              d={chart.line}
              stroke="var(--color-accent)"
              strokeWidth="1.5"
              strokeOpacity="0.85"
              fill="none"
            />
          )}

          {/* X-axis tick labels */}
          {xTicks.map((i) => (
            <text
              key={i}
              x={chart.x(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--font-mono)"
              fill="var(--color-text-dim)"
            >
              {fmtX(data[i].x)}
            </text>
          ))}

          {/* Hover marker + tooltip */}
          {hoverIdx !== null && data[hoverIdx] && (
            <g>
              <line
                x1={chart.x(hoverIdx)}
                x2={chart.x(hoverIdx)}
                y1={PAD_T}
                y2={PAD_T + chart.innerH}
                stroke="var(--color-accent)"
                strokeOpacity="0.4"
                strokeWidth="1"
              />
              <circle
                cx={chart.x(hoverIdx)}
                cy={chart.y(data[hoverIdx].y)}
                r="3"
                fill="var(--color-accent)"
              />
              {/* Tooltip: value + label, positioned near top */}
              <g transform={`translate(${Math.min(width - PAD_R - 110, Math.max(PAD_L, chart.x(hoverIdx) + 6))}, ${PAD_T + 4})`}>
                <rect width="110" height="30" fill="var(--color-surface-raised)" stroke="var(--color-border)" rx="2" />
                <text x="6" y="12" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-text)">
                  {fmtY(data[hoverIdx].y)}
                </text>
                <text x="6" y="24" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-text-dim)">
                  {fmtX(data[hoverIdx].x)}
                </text>
              </g>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
