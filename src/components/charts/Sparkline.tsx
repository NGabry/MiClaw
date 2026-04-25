/**
 * Inline sparkline — no axes, no labels, just the shape.
 * Uses warm accent for the line; subtle area fill below.
 */
interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ values, width = 60, height = 14, className = "" }: SparklineProps) {
  if (!values || values.length < 2) {
    return <span className={`inline-block text-[10px] text-text-dim/50 ${className}`}>·</span>;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  const y = (v: number) => height - ((v - min) / span) * height;

  let d = `M 0 ${y(values[0]).toFixed(2)}`;
  for (let i = 1; i < values.length; i++) {
    d += ` L ${(i * stepX).toFixed(2)} ${y(values[i]).toFixed(2)}`;
  }

  // Area fill path: line → down-right → bottom-left → close
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`inline-block shrink-0 ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={area} fill="var(--color-accent)" fillOpacity="0.12" />
      <path d={d} stroke="var(--color-accent)" strokeWidth="1" strokeOpacity="0.7" fill="none" />
    </svg>
  );
}
