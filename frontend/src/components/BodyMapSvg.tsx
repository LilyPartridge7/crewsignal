import React from 'react';
import { Heart, Activity, Gauge, Radiation } from 'lucide-react';

interface BodyMapSvgProps {
  selectedHotspot: string;
  onSelectHotspot: (hotspotKey: string, indicatorKey: string) => void;
  kpis: Record<string, any>;
  theme: 'dark' | 'light';
}

interface HotspotConfig {
  id: string;
  name: string;
  indicator: string;
  cx: number;
  cy: number;
  r: number;
  label: string;
  icon: React.ReactNode;
}

export const BodyMapSvg: React.FC<BodyMapSvgProps> = ({
  selectedHotspot,
  onSelectHotspot,
  kpis,
  theme,
}) => {
  const isDark = theme === 'dark';

  const hotspots: HotspotConfig[] = [
    {
      id: 'baroreceptors',
      name: 'Baroreflex',
      indicator: 'orthostatic_hr_delta',
      cx: 120,
      cy: 78,
      r: 8,
      label: 'Neck Baroreflex',
      icon: <Activity className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'heart',
      name: 'Heart',
      indicator: 'resting_hr',
      cx: 112,
      cy: 122,
      r: 9,
      label: 'Cardiac Output',
      icon: <Heart className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'aorta',
      name: 'Aorta',
      indicator: 'systolic_bp',
      cx: 124,
      cy: 160,
      r: 8,
      label: 'Arterial Pressure',
      icon: <Gauge className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'peripheral',
      name: 'Peripheral',
      indicator: 'cumulative_radiation_msv',
      cx: 120,
      cy: 242,
      r: 9,
      label: 'Peripheral / Rad',
      icon: <Radiation className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
  ];

  const getStatusColor = (indicator: string) => {
    const kpi = kpis[indicator];
    if (!kpi) return '#10B981';
    const status = kpi.status || '';
    if (status.includes('Action') || status.includes('Alert')) return '#E11D48';
    if (status.includes('Watch') || status.includes('Review')) return '#F59E0B';
    return '#10B981';
  };

  const getStatusText = (indicator: string): string => {
    const kpi = kpis[indicator];
    if (!kpi) return 'Normal';
    const status = kpi.status || '';
    if (status.includes('Action') || status.includes('Alert')) return 'Alert';
    if (status.includes('Watch') || status.includes('Review')) return 'Watch';
    return 'Normal';
  };

  return (
    <div className="flex flex-col items-center justify-between w-full h-full select-none gap-2">
      {/* Centered Anatomical SVG Figure */}
      <div className="relative w-full flex items-center justify-center flex-1 min-h-0">
        <svg
          viewBox="0 0 240 340"
          className="w-auto h-full max-h-[210px] select-none mx-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Warm Natural Skin-Tone Gradients (#F6D2B8 → #DFA278 in Light Mode and #D99E76 → #B57850 in Dark Mode) */}
            <linearGradient id="skinGradientLight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F6D2B8" />
              <stop offset="100%" stopColor="#DFA278" />
            </linearGradient>

            <linearGradient id="skinGradientDark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#D99E76" />
              <stop offset="100%" stopColor="#B57850" />
            </linearGradient>

            {/* Subtle Matrix Grid Pattern */}
            <pattern id="bodyGrid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke={isDark ? '#1E293B' : '#E2E8F0'}
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            </pattern>
          </defs>

          {/* Canvas Subtle Grid Background */}
          <rect width="240" height="340" fill="url(#bodyGrid)" rx="12" opacity={0.2} />

          {/* Warm Natural Skin-Tone Body Silhouette */}
          <g
            stroke="#B97A52"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill={isDark ? 'url(#skinGradientDark)' : 'url(#skinGradientLight)'}
          >
            {/* Cranium / Head */}
            <circle cx="120" cy="42" r="22" />

            {/* Neck */}
            <path d="M 112 63 L 112 82 L 128 82 L 128 63 Z" />

            {/* Torso & Upper Limbs */}
            <path d="M 88 88 C 95 82, 105 82, 112 82 L 128 82 C 135 82, 145 82, 152 88 L 164 104 C 173 118, 178 138, 182 168 L 170 172 L 162 136 L 155 200 L 85 200 L 78 136 L 70 172 L 58 168 C 62 138, 67 118, 76 104 Z" />

            {/* Lower Extremities */}
            <path d="M 89 200 L 94 288 L 103 324 L 114 324 L 111 226 L 117 216 L 123 216 L 129 226 L 126 324 L 137 324 L 146 288 L 151 200 Z" />
          </g>

          {/* Overlaid Arterial Vessel System (Red #DC2626) */}
          <g stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={isDark ? 0.95 : 0.85}>
            <path d="M 118 116 C 118 100, 116 86, 116 72" />
            <path d="M 122 116 C 122 100, 124 86, 124 72" />
            <path d="M 117 122 C 115 116, 122 114, 123 120 L 123 196" />
            <path d="M 118 116 C 102 119, 84 129, 78 158" />
            <path d="M 122 116 C 138 119, 156 129, 162 158" />
            <path d="M 123 196 C 118 214, 109 240, 105 288" />
            <path d="M 123 196 C 128 214, 137 240, 141 288" />
          </g>

          {/* Overlaid Venous Vessel System (Blue #2563EB) */}
          <g stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={isDark ? 0.9 : 0.8}>
            <path d="M 114 72 C 114 88, 115 98, 115 116" />
            <path d="M 126 72 C 126 88, 125 98, 125 116" />
            <path d="M 117 116 L 117 196" />
            <path d="M 117 196 C 113 214, 106 240, 102 288" />
            <path d="M 117 196 C 121 214, 131 240, 134 288" />
          </g>

          {/* Clickable Anatomical Hotspots — ZERO CSS SCALE HOVER TRANSFORMS, NEVER JITTERS */}
          {hotspots.map((hs) => {
            const isSelected = selectedHotspot === hs.id;
            const color = getStatusColor(hs.indicator);

            return (
              <g
                key={hs.id}
                onClick={() => onSelectHotspot(hs.id, hs.indicator)}
                className="cursor-pointer"
              >
                {/* Decorative Static Outer Ring */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r={hs.r + 6}
                  fill="none"
                  stroke={color}
                  strokeWidth={isSelected ? 1.5 : 1}
                  strokeDasharray={isSelected ? '3,3' : 'none'}
                  strokeOpacity={isSelected ? 0.95 : 0.3}
                  className="pointer-events-none transition-opacity duration-150"
                />

                {/* Soft Mid Glow */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r={hs.r + 3}
                  fill={color}
                  fillOpacity={isSelected ? 0.35 : 0.15}
                  className="pointer-events-none transition-opacity duration-150"
                />

                {/* Solid Core Circle */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r={hs.r}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="pointer-events-none"
                />

                {/* Center White Pin Dot */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r="2.2"
                  fill="#FFFFFF"
                  className="pointer-events-none"
                />

                {/* Hit-Target (Generous click area, zero scale transforms) */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r="16"
                  fill="transparent"
                  className="cursor-pointer"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* 1-Line Helper Prompt */}
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center tracking-tight">
        Select a body region to inspect status and guidance.
      </p>

      {/* Bottom 2x2 High-Contrast Selector Buttons with Text Status */}
      <div className="w-full grid grid-cols-2 gap-2 shrink-0">
        {hotspots.map((hs) => {
          const isSelected = selectedHotspot === hs.id;
          const color = getStatusColor(hs.indicator);
          const statusText = getStatusText(hs.indicator);

          return (
            <button
              key={hs.id}
              type="button"
              onClick={() => onSelectHotspot(hs.id, hs.indicator)}
              className={`h-10 px-2.5 text-xs sm:text-sm font-bold rounded-xl border flex items-center justify-between transition-all backdrop-blur-sm ${
                isSelected
                  ? 'bg-orange-500/25 text-orange-950 dark:text-orange-200 border-orange-500 shadow-xs'
                  : 'bg-white/20 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 border-transparent dark:border-slate-700/60 hover:border-orange-400 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="truncate">{hs.name}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                statusText === 'Alert'
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                  : statusText === 'Watch'
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              }`}>
                {statusText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
