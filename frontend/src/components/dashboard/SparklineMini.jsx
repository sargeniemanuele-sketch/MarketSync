function readPointValue(point) {
  if (typeof point === "number") {
    return point;
  }

  return Number(point?.value ?? point?.y ?? point?.total);
}

function normalizePoints(points) {
  if (Array.isArray(points)) {
    return points;
  }

  if (Array.isArray(points?.points)) {
    return points.points;
  }

  return [];
}

export default function SparklineMini({
  className = "",
  height = 36,
  points,
  stroke = "#0891b2",
  width = 120,
}) {
  const values = normalizePoints(points)
    .map(readPointValue)
    .filter((value) => Number.isFinite(value));

  if (values.length < 2) {
    return <div className={["h-9 w-full", className].join(" ")} aria-hidden="true" />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const polylinePoints = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${x},${Math.max(1, Math.min(height - 1, y))}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      className={["h-9 w-full overflow-visible", className].join(" ")}
      focusable="false"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        fill="none"
        points={polylinePoints}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.9"
        strokeWidth="1.6"
      />
    </svg>
  );
}
