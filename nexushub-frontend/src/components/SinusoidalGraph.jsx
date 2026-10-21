import React, { useState } from "react";

/**
 * SinusoidalGraph
 * Renders data points connected by a smooth sinusoidal S-curve (cubic bezier half-sine waves)
 * with a soft gradient area, gridlines, data nodes, and interactive hover tooltips.
 */
export default function SinusoidalGraph({
  data = [], // [{ label: "Pending", value: 5, color: "#0F172A" }]
  height = 130,
  width = 340,
  graphId = "sinusoidal",
  emptyLabel = "No data recorded",
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-slate-400 font-medium">
        {emptyLabel}
      </div>
    );
  }

  // Padding inside the SVG viewBox
  const paddingX = 25;
  const paddingTop = 20;
  const paddingBottom = 28;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  // Compute maximum value for scaling (ensure min scale of 1 so flat zeroes don't break)
  const maxVal = Math.max(...data.map((d) => Number(d.value) || 0), 1);

  // Compute (x, y) coordinates for each data point
  const points = data.map((d, index) => {
    const x =
      data.length === 1
        ? width / 2
        : paddingX + (index / (data.length - 1)) * innerWidth;
    const normalizedVal = (Number(d.value) || 0) / maxVal;
    // Invert y: highest value is near paddingTop, 0 is at innerHeight + paddingTop
    const y = paddingTop + (1 - normalizedVal) * innerHeight;
    return { ...d, x, y };
  });

  // Construct sinusoidal S-curve path:
  // Using cubic bezier control points placed at midpoint x with horizontal tangents (classic sinusoidal spline)
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    // S-curve: C (p0.x + dx/2, p0.y), (p1.x - dx/2, p1.y), (p1.x, p1.y)
    pathD += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  // Closed path for the under-curve gradient area fill
  const baselineY = height - paddingBottom;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaD = `${pathD} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;

  const gradientId = `sinusoidal-grad-${graphId}`;

  return (
    <div className="w-full select-none">
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F172A" stopOpacity="0.22" />
              <stop offset="60%" stopColor="#0F172A" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#0F172A" stopOpacity="0.00" />
            </linearGradient>
          </defs>

          {/* Subtle horizontal grid lines */}
          <line
            x1={paddingX}
            y1={paddingTop}
            x2={width - paddingX}
            y2={paddingTop}
            stroke="#F1F5F9"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={paddingTop + innerHeight / 2}
            x2={width - paddingX}
            y2={paddingTop + innerHeight / 2}
            stroke="#F1F5F9"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={baselineY}
            x2={width - paddingX}
            y2={baselineY}
            stroke="#E2E8F0"
            strokeWidth="1"
          />

          {/* Sinusoidal Area Fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Sinusoidal Wave Curve Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#0F172A"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />

          {/* Interactive Data Point Nodes */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g
                key={idx}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Larger invisible hitbox for effortless hover */}
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />

                {/* Animated pulse halo on hover */}
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="8"
                    fill="#0F172A"
                    opacity="0.15"
                    className="animate-ping"
                  />
                )}

                {/* Outer Node */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 5.5 : 4}
                  fill="#FFFFFF"
                  stroke="#0F172A"
                  strokeWidth={isHovered ? 2.5 : 2}
                  className="transition-all duration-200"
                />

                {/* Value tooltip above point on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={pt.x - 22}
                      y={pt.y - 25}
                      width="44"
                      height="18"
                      rx="6"
                      fill="#0F172A"
                      className="filter drop-shadow-sm"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 13}
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {pt.value}
                    </text>
                  </g>
                )}

                {/* Bottom X-axis label */}
                <text
                  x={pt.x}
                  y={height - 8}
                  textAnchor="middle"
                  fill={isHovered ? "#0F172A" : "#64748B"}
                  fontSize="9.5"
                  fontWeight={isHovered ? "bold" : "500"}
                  className="transition-colors duration-150"
                >
                  {pt.shortLabel || pt.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Breakdown Legend Pill Badges */}
      <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-100">
        {data.map((item, i) => {
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center justify-between px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
                isHovered ? "bg-slate-100" : "hover:bg-slate-50"
              }`}
            >
              <span className="text-[#64748B] text-[11px] font-medium truncate mr-1">
                {item.label}
              </span>
              <span className="font-extrabold text-[#0F172A] text-xs">
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
