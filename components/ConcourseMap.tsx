"use client";

import type { OverviewStand, Stand } from "@/lib/types";
import { money } from "@/lib/types";

type Props = {
  stands: Stand[];
  selectedId: string;
  overview: OverviewStand[];
  onSelect: (id: string) => void;
};

export default function ConcourseMap({ stands, selectedId, overview, onSelect }: Props) {
  const deltas = new Map(overview.map((item) => [item.standId, item.baseDelta]));

  return (
    <svg
      className="map-svg"
      viewBox="0 0 900 560"
      role="img"
      aria-label="Yankee Stadium concourse map with eight concession stands"
    >
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#16212b" strokeWidth="0.8" />
        </pattern>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16402e" />
          <stop offset="100%" stopColor="#0f2b20" />
        </linearGradient>
      </defs>

      <rect width="900" height="560" fill="#0b1218" />
      <rect width="900" height="560" fill="url(#grid)" opacity="0.55" />

      <rect x="55" y="32" width="790" height="496" rx="210" fill="#0e1922" stroke="#24313d" strokeWidth="1.2" />
      <rect x="112" y="86" width="676" height="388" rx="174" fill="#0b141b" stroke="#1b2732" />

      <text x="82" y="62" fill="#5f7180" fontFamily="IBM Plex Mono, monospace" fontSize="8" letterSpacing="1.6">
        CONCOURSE LEVEL 1
      </text>
      <text x="818" y="62" textAnchor="end" fill="#5f7180" fontFamily="IBM Plex Mono, monospace" fontSize="8" letterSpacing="1.2">
        YANKEE STADIUM
      </text>

      <polygon points="450,178 552,290 450,402 348,290" fill="url(#field)" stroke="#2c5e47" strokeWidth="1.1" />
      <polygon points="450,216 514,290 450,364 386,290" fill="#123326" stroke="#2c5e47" strokeWidth="0.8" opacity="0.75" />
      <circle cx="450" cy="290" r="7" fill="#2c5e47" />
      <rect x="442" y="178" width="16" height="16" fill="#d7e8dd" opacity="0.9" />
      <rect x="542" y="282" width="16" height="16" fill="#d7e8dd" opacity="0.9" />
      <rect x="442" y="394" width="16" height="16" fill="#d7e8dd" opacity="0.9" />
      <rect x="342" y="282" width="16" height="16" fill="#d7e8dd" opacity="0.9" />
      <text x="450" y="294" textAnchor="middle" fill="#6f8f7f" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" letterSpacing="1.5">
        FIELD
      </text>

      {stands.map((stand) => {
        const delta = deltas.get(stand.id) ?? 0;
        const selected = stand.id === selectedId;
        const positive = delta >= 0;
        const fill = selected ? "#22321f" : positive ? "#122a20" : "#241b1b";
        const stroke = selected ? "#f2a65a" : positive ? "#2f6b4f" : "#6b3b35";
        const badgeColor = positive ? "#5ec28a" : "#e06c5a";
        const badge = `${positive ? "+" : ""}${money(delta)}`;

        return (
          <g
            key={stand.id}
            className="map-stand"
            role="button"
            tabIndex={0}
            aria-label={`${stand.label}, modeled per-cap delta ${badge}`}
            onClick={() => onSelect(stand.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(stand.id);
              }
            }}
            filter={selected ? "url(#glow)" : undefined}
          >
            <title>{`${stand.label} · ${stand.section} · ${badge} per fan`}</title>
            <rect
              x={stand.x}
              y={stand.y}
              width={stand.w}
              height={stand.h}
              rx="7"
              fill={fill}
              stroke={stroke}
              strokeWidth={selected ? 1.8 : 1}
            />
            <rect x={stand.x} y={stand.y + 8} width="3" height={stand.h - 16} rx="1.5" fill={badgeColor} opacity={selected ? 1 : 0.7} />
            <text
              x={stand.x + 12}
              y={stand.y + 18}
              fill="#f2f0e9"
              fontFamily="Public Sans, sans-serif"
              fontSize="10.5"
              fontWeight="600"
            >
              {stand.label}
            </text>
            <text
              x={stand.x + 12}
              y={stand.y + 31}
              fill="#7d8c99"
              fontFamily="IBM Plex Mono, monospace"
              fontSize="7"
              letterSpacing="0.4"
            >
              {stand.section}
            </text>
            <text
              x={stand.x + stand.w - 10}
              y={stand.y + 18}
              textAnchor="end"
              fill={badgeColor}
              fontFamily="IBM Plex Mono, monospace"
              fontSize="8.5"
              fontWeight="500"
            >
              {badge}
            </text>
            {selected ? (
              <circle cx={stand.x + stand.w - 10} cy={stand.y + stand.h - 9} r="2.4" fill="#f2a65a" />
            ) : null}
          </g>
        );
      })}

      <text x="450" y="540" textAnchor="middle" fill="#4f606d" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" letterSpacing="1.1">
        CLICK A STAND TO SEE THE SWITCH CASE
      </text>
    </svg>
  );
}
