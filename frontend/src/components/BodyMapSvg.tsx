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
  theme: _theme,
}) => {
  const hotspots: HotspotConfig[] = [
    {
      id: 'baroreceptors',
      name: 'Baroreflex',
      indicator: 'orthostatic_hr_delta',
      cx: 110,
      cy: 62,
      r: 7,
      label: 'Neck Baroreflex',
      icon: <Activity className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'aorta',
      name: 'Aorta',
      indicator: 'systolic_bp',
      cx: 104,
      cy: 96,
      r: 7,
      label: 'Arterial Pressure',
      icon: <Gauge className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'heart',
      name: 'Heart',
      indicator: 'resting_hr',
      cx: 124,
      cy: 118,
      r: 8,
      label: 'Cardiac Output',
      icon: <Heart className="w-4 h-4 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'peripheral',
      name: 'Peripheral',
      indicator: 'cumulative_radiation_msv',
      cx: 110,
      cy: 182,
      r: 8,
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
      {/* 3D Anatomical Telemetry Viewport (Semi-skeletal, Muscular, Cardiovascular) */}
      <div className="relative w-full max-w-[210px] aspect-square flex items-center justify-center rounded-2xl overflow-hidden border border-slate-900/15 dark:border-sky-500/30 bg-slate-950 shadow-md">
        {/* Cinematic Backdrop Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#0B0F19] to-[#030712] pointer-events-none" />

        {/* High-Tech HUD Matrix Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#38bdf80f_1px,transparent_1px),linear-gradient(to_bottom,#38bdf80f_1px,transparent_1px)] bg-[size:14px_14px] pointer-events-none" />

        {/* 3D Anatomical Render Model */}
        <img
          src="/anatomy-3d-model.png"
          alt="3D Anatomical Musculoskeletal &amp; Cardiovascular Model"
          className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none opacity-95 brightness-105 contrast-110"
        />

        {/* Ambient Subtle Scanning Sweep */}
        <div className="absolute inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-sky-400/50 to-transparent blur-[0.5px] top-1/3 animate-pulse pointer-events-none" />

        {/* Corner HUD Reticles */}
        <div className="absolute top-1.5 left-1.5 w-2 h-2 border-t-2 border-l-2 border-sky-400/60 pointer-events-none" />
        <div className="absolute top-1.5 right-1.5 w-2 h-2 border-t-2 border-r-2 border-sky-400/60 pointer-events-none" />
        <div className="absolute bottom-1.5 left-1.5 w-2 h-2 border-b-2 border-l-2 border-sky-400/60 pointer-events-none" />
        <div className="absolute bottom-1.5 right-1.5 w-2 h-2 border-b-2 border-r-2 border-sky-400/60 pointer-events-none" />

        {/* Top Viewport Micro-Badge */}
        <div className="absolute top-1.5 left-3 right-3 flex items-center justify-between text-[8px] font-mono font-bold text-sky-400/80 pointer-events-none">
          <span>BIO-TELEMETRY 3D</span>
          <span>AUTONOMIC MAP</span>
        </div>

        {/* Interactive SVG Hotspots Overlay */}
        <svg
          viewBox="0 0 220 220"
          className="absolute inset-0 w-full h-full select-none z-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          {hotspots.map((hs) => {
            const isSelected = selectedHotspot === hs.id;
            const color = getStatusColor(hs.indicator);

            return (
              <g
                key={hs.id}
                onClick={() => onSelectHotspot(hs.id, hs.indicator)}
                className="cursor-pointer group"
              >
                {/* Crosshair Ticks for Active/Selected Hotspot */}
                {isSelected && (
                  <g stroke={color} strokeWidth="1" strokeOpacity="0.8" className="pointer-events-none">
                    <line x1={hs.cx - 14} y1={hs.cy} x2={hs.cx - hs.r - 3} y2={hs.cy} />
                    <line x1={hs.cx + hs.r + 3} y1={hs.cy} x2={hs.cx + 14} y2={hs.cy} />
                    <line x1={hs.cx} y1={hs.cy - 14} x2={hs.cx} y2={hs.cy - hs.r - 3} />
                    <line x1={hs.cx} y1={hs.cy + hs.r + 3} x2={hs.cx} y2={hs.cy + 14} />
                  </g>
                )}

                {/* Outer Radar Ring */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r={hs.r + (isSelected ? 6 : 4)}
                  fill="none"
                  stroke={color}
                  strokeWidth={isSelected ? 1.5 : 1}
                  strokeDasharray={isSelected ? '2,2' : 'none'}
                  strokeOpacity={isSelected ? 1 : 0.4}
                  className="pointer-events-none transition-all duration-150"
                />

                {/* Soft Pulse Halo */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r={hs.r + 3}
                  fill={color}
                  fillOpacity={isSelected ? 0.4 : 0.15}
                  className="pointer-events-none transition-all duration-150"
                />

                {/* Solid Core Marker */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r={hs.r}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={isSelected ? 2 : 1.2}
                  className="pointer-events-none"
                />

                {/* Inner Bright Center Dot */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r="2"
                  fill="#FFFFFF"
                  className="pointer-events-none"
                />

                {/* Generous Hit-Target */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r="18"
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
        Select a 3D anatomical region to inspect status and flight guidance.
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
