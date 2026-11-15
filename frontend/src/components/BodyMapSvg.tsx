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
  calloutSide: 'left' | 'right';
  calloutDirection: 'up' | 'down';
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
      cx: 124,
      cy: 64,
      r: 8,
      label: 'Neck Baroreflex',
      calloutSide: 'right',
      calloutDirection: 'up',
      icon: <Activity className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'heart',
      name: 'Heart',
      indicator: 'resting_hr',
      cx: 114,
      cy: 112,
      r: 9,
      label: 'Cardiac Output',
      calloutSide: 'left',
      calloutDirection: 'up',
      icon: <Heart className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'aorta',
      name: 'Aorta',
      indicator: 'systolic_bp',
      cx: 124,
      cy: 148,
      r: 8,
      label: 'Arterial Pressure',
      calloutSide: 'right',
      calloutDirection: 'down',
      icon: <Gauge className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />,
    },
    {
      id: 'peripheral',
      name: 'Peripheral',
      indicator: 'cumulative_radiation_msv',
      cx: 112,
      cy: 236,
      r: 9,
      label: 'Peripheral / Rad',
      calloutSide: 'left',
      calloutDirection: 'down',
      icon: <Radiation className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />,
    },
  ];

  const getStatusColor = (indicator: string, isSelected?: boolean) => {
    const kpi = kpis[indicator];
    if (!kpi) return isSelected ? '#38BDF8' : '#10B981';
    const status = kpi.status || '';
    if (status.includes('Action') || status.includes('Alert')) return '#E11D48'; // Rose
    if (status.includes('Watch') || status.includes('Review')) return '#F59E0B'; // Amber
    if (status.includes('Optimal') || status.includes('Nominal')) return '#06B6D4'; // Cyan
    return '#10B981'; // Emerald
  };

  const getStatusText = (indicator: string): string => {
    const kpi = kpis[indicator];
    if (!kpi) return 'NOMINAL';
    const status = kpi.status || '';
    if (status.includes('Action') || status.includes('Alert')) return 'ALERT';
    if (status.includes('Watch') || status.includes('Review')) return 'WATCH';
    if (status.includes('Optimal') || status.includes('Nominal')) return 'OPTIMAL';
    return 'NOMINAL';
  };

  const getTelemetryValue = (indicator: string): string => {
    const kpi = kpis[indicator];
    if (!kpi || kpi.value === undefined || kpi.value === null) {
      if (indicator === 'orthostatic_hr_delta') return '+11 BPM Δ';
      if (indicator === 'resting_hr') return '60 BPM';
      if (indicator === 'systolic_bp') return '118 MMHG';
      if (indicator === 'cumulative_radiation_msv') return '12.4 MSV';
      return '--';
    }
    const val = kpi.value;
    if (indicator === 'orthostatic_hr_delta') return `${val > 0 ? '+' : ''}${val} BPM Δ`;
    if (indicator === 'resting_hr') return `${val} BPM`;
    if (indicator === 'systolic_bp') return `${val} MMHG`;
    if (indicator === 'cumulative_radiation_msv') return `${val} MSV`;
    return `${val}`;
  };

  // Anatomically accurate human silhouette (proportional adult human standing frontal stance with robust, proportional arms matching leg thickness)
  const silhouettePath = "M 120 24 C 113 24 107 28 106 36 C 105 43 107 50 110 56 C 111 58 113 60 114 60 C 113 62 112 65 111 68 C 108 71 96 75 84 79 C 78 81 68 85 66 93 C 65 101 65 114 66 124 C 66 130 67 136 68 138 C 67 146 67 154 68 160 C 69 165 71 169 72 172 C 72 176 73 180 74 183 C 75 186 77 188 78 188 C 80 188 82 186 83 182 C 84 180 86 178 86 175 C 86 173 85 171 85 170 C 84 162 84 152 84 142 C 84 135 84 128 85 122 C 85 116 86 110 88 106 C 92 112 92 120 93 128 C 93 132 94 136 95 140 C 95 148 93 158 92 170 C 92 182 93 206 94 226 C 94 234 95 240 95 244 C 95 252 92 260 92 270 C 92 282 95 300 98 316 C 98 320 96 324 96 328 C 96 330 98 330 102 330 C 105 330 106 328 106 325 C 106 320 105 316 105 312 C 105 298 108 284 108 270 C 108 260 106 252 106 244 C 106 230 109 206 114 196 C 116 192 118 187 120 184 C 122 187 124 192 126 196 C 131 206 134 230 134 244 C 134 252 132 260 132 270 C 132 284 135 298 135 312 C 135 316 134 320 134 325 C 134 328 135 330 138 330 C 142 330 144 330 144 328 C 144 324 142 320 142 316 C 145 300 148 282 148 270 C 148 260 145 252 145 244 C 145 240 146 234 146 226 C 147 206 148 182 148 170 C 147 158 145 148 145 140 C 146 136 147 132 147 128 C 148 120 148 112 152 106 C 154 110 155 116 155 122 C 156 128 156 135 156 142 C 156 152 156 162 155 170 C 155 171 154 173 154 175 C 154 178 156 180 157 182 C 158 186 160 188 162 188 C 163 188 165 186 166 183 C 167 180 168 176 168 172 C 169 169 171 165 172 160 C 173 154 173 146 172 138 C 173 136 174 130 174 124 C 175 114 175 101 174 93 C 172 85 162 81 156 79 C 144 75 132 71 129 68 C 128 65 127 62 126 60 C 127 60 129 58 130 56 C 133 50 135 43 134 36 C 133 28 127 24 120 24 Z";

  return (
    <div className="flex flex-col items-center justify-between w-full h-full select-none gap-2">
      {/* Centered Anatomical SVG HUD Figure */}
      <div className="relative w-full flex items-center justify-center flex-1 min-h-0">
        <svg
          viewBox="0 0 240 340"
          className="w-full h-full max-h-[260px] xl:max-h-[290px] select-none mx-auto"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* SVG Filter for Glowing Vascular & HUD Data Streams */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Targeted Node Reticle Glow */}
            <filter id="reticleGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Fine Medical Matrix Grid Pattern */}
            <pattern id="hudGrid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke={isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(15, 23, 42, 0.06)'}
                strokeWidth="0.5"
                strokeDasharray="1 3"
              />
            </pattern>

            {/* CSS Animation: Breathing Pulse for Outer Dashed Targeting Ring ONLY */}
            <style>{`
              @keyframes hudPulse {
                0%, 100% { opacity: 0.35; stroke-dashoffset: 0; }
                50% { opacity: 0.95; stroke-dashoffset: 6; }
              }
              .hud-pulse-ring {
                animation: hudPulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
            `}</style>
          </defs>

          {/* Canvas Medical Matrix Background & Subtle HUD Framing */}
          <rect width="240" height="340" fill="url(#hudGrid)" rx="8" />

          {/* Aerospace HUD Corner Reticles */}
          <g stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" fill="none">
            <path d="M 6 14 L 6 6 L 14 6" />
            <path d="M 234 14 L 234 6 L 226 6" />
            <path d="M 6 326 L 6 334 L 14 334" />
            <path d="M 234 326 L 234 334 L 226 334" />
          </g>

          {/* Center Vertical Axis Calibration Marks */}
          <g stroke="rgba(56, 189, 248, 0.2)" strokeWidth="0.75" fill="none">
            <line x1="120" y1="4" x2="120" y2="12" />
            <line x1="120" y1="328" x2="120" y2="336" />
          </g>

          {/* ========================================================================= */}
          {/* 1. THE HUMANIC, CLINICAL SILHOUETTE ("MEDICAL GLASS" AESTHETIC)           */}
          {/* ========================================================================= */}
          <g id="humanSilhouette">
            {/* Medical Glass Silhouette Body with broad, proportional arms matching leg volume */}
            <path
              d={silhouettePath}
              fill="rgba(30, 41, 59, 0.45)"
              stroke="rgba(56, 189, 248, 0.7)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />

            {/* Subtle Anatomical Contour Lines (rgba(255, 255, 255, 0.12)) */}
            <g
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="0.75"
              fill="none"
              strokeLinecap="round"
            >
              {/* Sagittal Center Axis */}
              <line x1="120" y1="62" x2="120" y2="182" strokeDasharray="3 3" />

              {/* Clavicles */}
              <path d="M 120 72 C 114 72 98 76 84 80" />
              <path d="M 120 72 C 126 72 142 76 156 80" />

              {/* Pectoral Outlines */}
              <path d="M 118 96 C 112 106 104 110 95 108" />
              <path d="M 122 96 C 128 106 136 110 145 108" />

              {/* Ribcage / Costal Margins */}
              <path d="M 118 120 C 114 121 106 124 95 126" />
              <path d="M 122 120 C 126 121 134 124 145 126" />

              {/* Joint Markings (Faint circles and landmarks) */}
              {/* Shoulders */}
              <circle cx="84" cy="80" r="2.5" strokeDasharray="1.5 1.5" />
              <circle cx="156" cy="80" r="2.5" strokeDasharray="1.5 1.5" />
              {/* Elbows */}
              <circle cx="76" cy="135" r="2" strokeDasharray="1 1" />
              <circle cx="164" cy="135" r="2" strokeDasharray="1 1" />
              {/* Wrists */}
              <circle cx="78.5" cy="171" r="1.5" strokeDasharray="1 1" />
              <circle cx="161.5" cy="171" r="1.5" strokeDasharray="1 1" />
              {/* Knees / Patellae */}
              <ellipse cx="101" cy="244" rx="3" ry="4" strokeDasharray="2 2" />
              <ellipse cx="139" cy="244" rx="3" ry="4" strokeDasharray="2 2" />
            </g>
          </g>

          {/* ========================================================================= */}
          {/* 2. PRECISE VASCULAR & NERVOUS PATHWAYS                                    */}
          {/* ========================================================================= */}
          {/* Nervous & Spinal Pathway */}
          <g
            stroke="rgba(56, 189, 248, 0.45)"
            strokeWidth="0.8"
            strokeDasharray="1 3"
            fill="none"
            filter="url(#glow)"
          >
            <path d="M 120 36 L 120 170" />
            <path d="M 117 38 C 119 33 121 33 123 38" />
          </g>

          {/* Venous Vessel System (Blue #3B82F6) */}
          <g
            stroke="#3B82F6"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#glow)"
            opacity={0.9}
          >
            {/* Jugular Veins & Superior Vena Cava */}
            <path d="M 116 48 L 116 60 C 116 76 115 88 116 102 L 116 116" />
            <path d="M 125 48 L 125 60 C 125 76 122 88 117 102" />
            {/* Left & Right Arm Veins (comfortably centered in wider arm) */}
            <path d="M 80 172 C 78 158 78 148 78 138 L 78 126 C 78 114 82 102 88 94 C 96 86 108 94 116 102" />
            <path d="M 160 172 C 162 158 162 148 162 138 L 162 126 C 162 114 158 102 152 94 C 144 86 132 94 124 102" />
            {/* Inferior Vena Cava & Common Iliac / Femoral Veins */}
            <path d="M 116 116 L 118 172" />
            <path d="M 101 314 C 101 284 102 260 104 244 L 114 214 C 116 198 118 184 118 172" />
            <path d="M 139 314 C 139 284 138 260 136 244 L 126 214 C 124 198 118 184 118 172" />
          </g>

          {/* Arterial Vessel System (Red #E11D48) */}
          <g
            stroke="#E11D48"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#glow)"
            opacity={0.95}
          >
            {/* Aortic Arch & Descending Aorta */}
            <path d="M 117 114 C 117 104 123 102 124 106 L 124 172" />
            {/* Common Carotid Arteries */}
            <path d="M 119 102 C 119 88 118 76 118 60 L 118 48" />
            <path d="M 123 102 C 123 88 124 76 124 60 L 124 48" />
            {/* Cranial Micro-arteries */}
            <path d="M 118 48 C 116 42 114 38 114 34" />
            <path d="M 124 48 C 126 42 128 38 128 34" />
            {/* Subclavian to Brachial / Radial Arteries (comfortably centered in wider arm) */}
            <path d="M 119 102 C 108 92 94 84 84 86 C 78 94 74 112 74 126 L 75 138 C 75 148 75 158 77 172" />
            <path d="M 121 102 C 132 92 146 84 156 86 C 162 94 166 112 166 126 L 165 138 C 165 148 165 158 163 172" />
            {/* Common Iliac & Femoral Arteries */}
            <path d="M 124 172 C 121 182 115 196 113 212 L 103 244 C 101 262 99 288 99 314" />
            <path d="M 124 172 C 127 182 133 196 135 212 L 137 244 C 139 262 141 288 141 314" />
          </g>

          {/* ========================================================================= */}
          {/* 3 & 4. HUD TARGETING RETICLES, 45° LEADER LINES & CLINICAL LABELS        */}
          {/* ========================================================================= */}
          {hotspots.map((hs) => {
            const isSelected = selectedHotspot === hs.id;
            const statusColor = getStatusColor(hs.indicator, isSelected);
            const statusText = getStatusText(hs.indicator);
            const telemetryVal = getTelemetryValue(hs.indicator);

            const isRight = hs.calloutSide === 'right';
            const isUp = hs.calloutDirection === 'up';

            // Exact 45-degree angled SVG leader line
            const startX = isRight ? hs.cx + 12 : hs.cx - 12;
            const startY = isUp ? hs.cy - 6 : hs.cy + 6;
            const cornerX = isRight ? startX + 13 : startX - 13;
            const cornerY = isUp ? startY - 13 : startY + 13;
            const endX = isRight ? 232 : 8;

            const leaderPath = `M ${startX} ${startY} L ${cornerX} ${cornerY} L ${endX} ${cornerY}`;

            const textAnchor = isRight ? 'start' : 'end';
            const textX = isRight ? cornerX + 3 : cornerX - 3;
            const labelY = cornerY - 4;
            const subY = cornerY + 11;

            return (
              <g
                key={hs.id}
                onClick={() => onSelectHotspot(hs.id, hs.indicator)}
                className="cursor-pointer group"
              >
                {/* 45-Degree Angled Leader Line to HUD Label */}
                <path
                  d={leaderPath}
                  fill="none"
                  stroke={isSelected ? statusColor : 'rgba(148, 163, 184, 0.4)'}
                  strokeWidth="1"
                  strokeOpacity={isSelected ? 0.95 : 0.6}
                  className="pointer-events-none transition-all duration-200"
                />

                {/* Corner Joint Pinpoint */}
                <circle
                  cx={cornerX}
                  cy={cornerY}
                  r="1.5"
                  fill={isSelected ? statusColor : 'rgba(148, 163, 184, 0.6)'}
                  className="pointer-events-none"
                />

                {/* Clinical Monospace Typography Label */}
                <text
                  x={textX}
                  y={labelY}
                  textAnchor={textAnchor}
                  className={`text-[9.5px] font-mono tracking-widest uppercase select-none pointer-events-none font-semibold ${
                    isSelected
                      ? 'fill-white font-bold'
                      : isDark
                      ? 'fill-slate-300'
                      : 'fill-slate-700'
                  }`}
                  style={{ letterSpacing: '0.12em' }}
                >
                  {hs.label}
                </text>

                {/* Sub-telemetry Value & Status Readout */}
                <text
                  x={textX}
                  y={subY}
                  textAnchor={textAnchor}
                  className="text-[8px] font-mono tracking-wider uppercase select-none pointer-events-none font-bold"
                  fill={statusColor}
                  style={{ letterSpacing: '0.08em' }}
                >
                  {telemetryVal} [{statusText}]
                </text>

                {/* --- Aerospace Targeting Reticle --- */}

                {/* 1. Thin dashed outer targeting ring (with slow clinical breathing pulse) */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r="12"
                  fill="none"
                  stroke={statusColor}
                  strokeWidth="1"
                  strokeDasharray="2 4"
                  className="pointer-events-none hud-pulse-ring"
                />

                {/* Secondary Selected Indicator Ring */}
                {isSelected && (
                  <circle
                    cx={hs.cx}
                    cy={hs.cy}
                    r="6.5"
                    fill="none"
                    stroke={statusColor}
                    strokeWidth="0.75"
                    filter="url(#reticleGlow)"
                    className="pointer-events-none"
                  />
                )}

                {/* 2. Four tiny crosshair tick marks at Top, Bottom, Left, Right (from r=14 to r=18) */}
                <g
                  stroke={statusColor}
                  strokeWidth="1"
                  strokeOpacity={isSelected ? 1 : 0.75}
                  className="pointer-events-none"
                >
                  {/* Top Tick */}
                  <line x1={hs.cx} y1={hs.cy - 18} x2={hs.cx} y2={hs.cy - 14} />
                  {/* Bottom Tick */}
                  <line x1={hs.cx} y1={hs.cy + 14} x2={hs.cx} y2={hs.cy + 18} />
                  {/* Left Tick */}
                  <line x1={hs.cx - 18} y1={hs.cy} x2={hs.cx - 14} y2={hs.cy} />
                  {/* Right Tick */}
                  <line x1={hs.cx + 14} y1={hs.cy} x2={hs.cx + 18} y2={hs.cy} />
                </g>

                {/* 3. Tiny bright center dot (r="2.5", solid fill based on status) */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r={isSelected ? 3 : 2.5}
                  fill={statusColor}
                  className="pointer-events-none"
                />

                {/* Pinpoint White Core */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r="1"
                  fill="#FFFFFF"
                  opacity={0.9}
                  className="pointer-events-none"
                />

                {/* Invisible Generous Click Target (Zero hover jitter, zero bouncy scale) */}
                <circle
                  cx={hs.cx}
                  cy={hs.cy}
                  r="20"
                  fill="transparent"
                  className="cursor-pointer"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Flight Surgeon Bio-Telemetry Status Strip */}
      <div className="w-full flex items-center justify-between px-1 text-[10px] font-mono tracking-wider text-slate-400 dark:text-slate-400 uppercase shrink-0 border-t border-slate-200/20 dark:border-slate-800/60 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          SYS HUD: ANATOMICAL TELEMETRY
        </span>
        <span className="text-[9px] text-slate-500 dark:text-slate-400">
          SELECT RETICLE OR MODULE
        </span>
      </div>

      {/* Bottom 2x2 Aerospace Selector Buttons */}
      <div className="w-full grid grid-cols-2 gap-2 shrink-0">
        {hotspots.map((hs) => {
          const isSelected = selectedHotspot === hs.id;
          const color = getStatusColor(hs.indicator, isSelected);
          const statusText = getStatusText(hs.indicator);

          return (
            <button
              key={hs.id}
              type="button"
              onClick={() => onSelectHotspot(hs.id, hs.indicator)}
              className={`h-9 px-2.5 rounded-lg border text-left flex items-center justify-between transition-all backdrop-blur-sm ${
                isSelected
                  ? 'bg-sky-500/15 border-sky-400 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                  : 'bg-white/20 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-sky-500/50 hover:bg-slate-800/40 text-slate-800 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                  aria-hidden="true"
                />
                <span className="text-xs font-mono font-bold tracking-tight truncate">
                  {hs.name}
                </span>
              </div>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 tracking-wider"
                style={{
                  color: color,
                  backgroundColor: `${color}1A`,
                  border: `1px solid ${color}33`,
                }}
              >
                {statusText}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
