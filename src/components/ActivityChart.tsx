"use client";
import { useState, useEffect, useRef } from "react";
import { gsap } from "gsap";
import type { Trade } from "../shared/types";

export function ActivityChart({ trades }: { trades: Trade[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const line = useRef<SVGPathElement>(null);
  const values = Array.from({ length: 48 }, () => 0);
  for (const t of trades) {
    const d = new Date(t.timestamp);
    const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() - 225;
    const index = Math.max(0, Math.min(47, Math.floor((minutes / 375) * 48)));
    values[index] += (t.quantity * t.pricePaise) / 100;
  }
  let sum = 0;
  const cumulative = values.map((v) => {
    sum += v;
    return sum;
  });
  const max = Math.max(...cumulative, 1);
  const points = cumulative.map(
    (v, i) => `${18 + (i / 47) * 744},${190 - (v / max) * 155}`,
  );
  const path = `M ${points.join(" L ")}`;
  useEffect(() => {
    if (!line.current || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const length = line.current.getTotalLength();
    const animation = gsap.fromTo(
      line.current,
      { strokeDasharray: length, strokeDashoffset: length },
      {
        strokeDashoffset: 0,
        duration: 1.3,
        ease: "power2.inOut",
        clearProps: "strokeDasharray,strokeDashoffset",
      },
    );
    return () => {
      animation.revert();
    };
  }, [sum]);
  const selected = hover === null ? null : Math.min(47, Math.max(0, hover));
  return (
    <div className="activity-chart">
      <svg
        viewBox="0 0 800 256"
        role="img"
        aria-label={`Cumulative traded value, ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(sum)}, from 9:15 AM to 3:30 PM IST`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(
            Math.round(
              ((((e.clientX - r.left) / r.width) * 800 - 18) / 744) * 47,
            ),
          );
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#517af0" stopOpacity=".2" />
            <stop offset="100%" stopColor="#517af0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[35, 85, 135, 190].map((y) => (
          <line key={y} x1="18" x2="762" y1={y} y2={y} className="chart-grid" />
        ))}
        <path d={`${path} L 762,196 L 18,196 Z`} fill="url(#chart-fill)" />
        <path
          className="chart-line"
          ref={line}
          d={path}
          fill="none"
          stroke="#5980f3"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {values.map((v, i) => (
          <rect
            key={i}
            x={18 + (i / 48) * 752}
            y={234 - (v / Math.max(...values, 1)) * 22}
            width="7"
            height={Math.max(1, (v / Math.max(...values, 1)) * 22)}
            rx="1.5"
            fill="#8499d7"
            opacity=".48"
          />
        ))}
        {selected !== null && (
          <g>
            <line
              x1={18 + (selected / 47) * 744}
              x2={18 + (selected / 47) * 744}
              y1="22"
              y2="236"
              stroke="var(--muted)"
              strokeDasharray="3 4"
            />
            <circle
              cx={18 + (selected / 47) * 744}
              cy={190 - (cumulative[selected] / max) * 155}
              r="5"
              fill="#5980f3"
              stroke="var(--surface)"
              strokeWidth="3"
            />
          </g>
        )}
      </svg>
      {selected !== null && (
        <div className="chart-tooltip">
          Cumulative value · ₹{(cumulative[selected] / 10000000).toFixed(2)} Cr
        </div>
      )}
      <div className="chart-times">
        <span>09:15</span>
        <span>10:30</span>
        <span>11:45</span>
        <span>13:00</span>
        <span>14:15</span>
        <span>15:30</span>
      </div>
    </div>
  );
}

export function Sparkline({
  values,
  positive,
}: {
  values: number[];
  positive: boolean;
}) {
  const low = Math.min(...values),
    range = Math.max(...values) - low || 1;
  const points = values
    .map(
      (v, i) =>
        `${(i / Math.max(values.length - 1, 1)) * 88},${25 - ((v - low) / range) * 22}`,
    )
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 90 30" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "var(--green)" : "var(--red)"}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
