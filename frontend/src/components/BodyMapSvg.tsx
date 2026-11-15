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
      cx: 155,
      cy: 72,
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
      cx: 143,
      cy: 120,
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
      cx: 153,
      cy: 158,
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
      cx: 141,
      cy: 240,
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

  // High-fidelity anatomical human silhouette continuous path centered at X = 150
  const silhouettePath = [
    'M 150 20',
    // Cranium left
    'C 142 20 136 26 136 34',
    'C 136 41 139 46 142 49',
    'C 144 52 146 55 146 58',
    // Neck left
    'C 146 62 144 66 143 71',
    // Shoulder & deltoid left
    'C 140 74 128 77 116 80',
    'C 111 81 108 86 108 94',
    // Left arm outer down to fingertips
    'C 108 103 107 118 106 134',
    'C 105 144 104 156 104 168',
    'C 104 176 102 184 102 193',
    'C 102 197 104 200 106 200',
    'C 108 200 110 196 111 189',
    // Left arm inner back to axilla
    'C 112 179 113 167 114 153',
    'C 115 141 117 125 120 113',
    'C 122 106 127 102 132 100',
    // Left flank & iliac crest
    'C 131 109 130 119 130 129',
    'C 130 139 132 147 133 153',
    'C 134 159 131 169 130 177',
    'C 129 183 130 191 131 201',
    // Left leg outer down to heel and foot
    'C 132 213 133 227 133 239',
    'C 133 247 131 259 131 273',
    'C 131 287 134 305 135 319',
    'C 135 325 132 329 129 334',
    'C 129 337 132 338 137 338',
    'C 141 338 143 336 143 332',
    'C 143 326 141 322 140 318',
    // Left leg inner up to crotch
    'C 140 304 142 286 142 272',
    'C 142 258 142 246 143 238',
    'C 144 226 145 210 147 198',
    'C 148 192 149 186 150 184',
    // Right leg inner down from crotch to ankle
    'C 151 186 152 192 153 198',
    'C 155 210 156 226 157 238',
    'C 158 246 158 258 158 272',
    'C 158 286 160 304 160 318',
    // Right foot
    'C 159 322 157 326 157 332',
    'C 157 336 159 338 163 338',
    'C 168 338 171 337 171 334',
    'C 168 329 165 325 165 319',
    // Right outer leg up to hip
    'C 166 305 169 287 169 273',
    'C 169 259 167 247 167 239',
    'C 167 227 168 213 169 201',
    'C 170 191 171 183 170 177',
    // Right flank & axilla
    'C 169 169 166 159 167 153',
    'C 168 147 170 139 170 129',
    'C 170 119 169 109 168 100',
    // Right arm inner down to fingertips
    'C 173 102 178 106 180 113',
    'C 183 125 185 141 186 153',
    'C 187 167 188 179 189 189',
    'C 190 196 192 200 194 200',
    // Right arm outer up to shoulder
    'C 196 200 198 197 198 193',
    'C 198 184 196 176 196 168',
    'C 196 156 195 144 194 134',
    'C 193 118 192 103 192 94',
    'C 192 86 189 81 184 80',
    // Right shoulder, neck & cranium back to vertex
    'C 172 77 160 74 157 71',
    'C 156 66 154 62 154 58',
    'C 154 55 156 52 158 49',
    'C 161 46 164 41 164 34',
    'C 164 26 158 20 150 20',
    'Z',
  ].join(' ');

  return (
    <div className="flex flex-col items-center justify-between w-full h-full select-none gap-2">
      {/* Centered Anatomical SVG HUD Figure */}
      <div className="relative w-full flex items-center justify-center flex-1 min-h-0">
        <svg
          viewBox="0 0 310 340"
          className="w-auto h-full max-h-[210px] select-none mx-auto"
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
            <pattern id="hudGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
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
          <rect width="310" height="340" fill="url(#hudGrid)" rx="8" />

          {/* Aerospace HUD Corner Reticles */}
          <g stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1" fill="none">
            <path d="M 8 16 L 8 8 L 16 8" />
            <path d="M 302 16 L 302 8 L 294 8" />
            <path d="M 8 324 L 8 332 L 16 332" />
            <path d="M 302 324 L 302 332 L 294 332" />
          </g>

          {/* Center Vertical Axis Calibration Marks */}
          <g stroke="rgba(56, 189, 248, 0.2)" strokeWidth="0.75" fill="none">
            <line x1="150" y1="6" x2="150" y2="14" />
            <line x1="150" y1="326" x2="150" y2="334" />
          </g>

          {/* ========================================================================= */}
          {/* 1. THE HUMANIC, CLINICAL SILHOUETTE ("MEDICAL GLASS" AESTHETIC)           */}
          {/* ========================================================================= */}
          <g id="humanSilhouette">
            {/* Medical Glass Silhouette Body */}
            <path
              d={silhouettePath}
              fill="rgba(30, 41, 59, 0.4)"
              stroke="rgba(56, 189, 248, 0.6)"
              strokeWidth="1"
              strokeLinejoin="round"
            />

            {/* Subtle Anatomical Contour Lines (rgba(255, 255, 255, 0.1)) */}
            <g
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="0.75"
              fill="none"
              strokeLinecap="round"
            >
              {/* Sagittal Center Axis */}
              <line x1="150" y1="64" x2="150" y2="182" strokeDasharray="3 3" />

              {/* Clavicles */}
              <path d="M 150 71 C 143 71 133 74 122 78" />
              <path d="M 150 71 C 157 71 167 74 178 78" />

              {/* Pectoral Outlines */}
              <path d="M 148 95 C 145 106 138 111 133 111" />
              <path d="M 152 95 C 155 106 162 111 167 111" />

              {/* Ribcage / Costal Margins */}
              <path d="M 148 118 C 144 119 138 122 133 125" />
              <path d="M 152 118 C 156 119 162 122 167 125" />
              <path d="M 148 126 C 144 127 138 130 133 133" />
              <path d="M 152 126 C 156 127 162 130 167 133" />
              <path d="M 148 134 C 144 135 139 138 135 141" />
              <path d="M 152 134 C 156 135 161 138 165 141" />

              {/* Iliac Crest / Pelvic Outlines */}
              <path d="M 148 166 C 142 166 136 169 133 174" />
              <path d="M 152 166 C 158 166 164 169 167 174" />

              {/* Joint Markings (Faint circles and crosshairs) */}
              {/* Shoulders */}
              <circle cx="121" cy="80" r="3" strokeDasharray="1.5 1.5" />
              <circle cx="179" cy="80" r="3" strokeDasharray="1.5 1.5" />
              {/* Elbows */}
              <circle cx="109" cy="134" r="2.5" strokeDasharray="1 1" />
              <circle cx="191" cy="134" r="2.5" strokeDasharray="1 1" />
              {/* Wrists */}
              <circle cx="106" cy="168" r="2" strokeDasharray="1 1" />
              <circle cx="194" cy="168" r="2" strokeDasharray="1 1" />
              {/* Knees / Patellae */}
              <ellipse cx="138" cy="242" rx="3.5" ry="4.5" strokeDasharray="2 2" />
              <ellipse cx="162" cy="242" rx="3.5" ry="4.5" strokeDasharray="2 2" />
              {/* Ankles */}
              <line x1="135" y1="318" x2="141" y2="318" />
              <line x1="159" y1="318" x2="165" y2="318" />
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
            <path d="M 150 38 L 150 178" />
            <path d="M 147 40 C 149 35 151 35 153 40" />
          </g>

          {/* Venous Vessel System (Blue #3B82F6) */}
          <g
            stroke="#3B82F6"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#glow)"
            opacity={0.9}
          >
            {/* Jugular Veins & Superior Vena Cava */}
            <path d="M 144 48 L 144 62 C 144 78 143 90 144 104 L 144 122" />
            <path d="M 158 48 L 158 62 C 158 78 152 92 145 104" />
            {/* Left & Right Arm Veins */}
            <path d="M 105 166 L 107 134 C 109 114 112 98 118 92 C 126 86 138 98 144 104" />
            <path d="M 195 166 L 193 134 C 191 114 188 98 182 92 C 174 86 162 98 145 104" />
            {/* Inferior Vena Cava & Common Iliac / Femoral Veins */}
            <path d="M 144 122 L 147 176" />
            <path d="M 139 314 C 139 286 141 262 142 244 L 144 216 C 146 198 147 186 147 176" />
            <path d="M 167 314 C 167 286 165 262 164 244 L 162 216 C 160 198 147 186 147 176" />
          </g>

          {/* Arterial Vessel System (Red #E11D48) */}
          <g
            stroke="#E11D48"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#glow)"
            opacity={0.95}
          >
            {/* Aortic Arch & Descending Aorta */}
            <path d="M 146 122 C 146 112 152 108 153 112 L 153 176" />
            {/* Common Carotid Arteries */}
            <path d="M 149 108 C 149 92 147 80 147 62 L 147 48" />
            <path d="M 153 108 C 153 92 155 80 155 62 L 155 48" />
            {/* Cranial Micro-arteries */}
            <path d="M 147 48 C 145 42 142 38 142 34" />
            <path d="M 155 48 C 157 42 160 38 160 34" />
            {/* Subclavian to Brachial / Radial Arteries */}
            <path d="M 149 108 C 140 100 128 88 120 90 C 114 98 111 114 109 134 L 107 166" />
            <path d="M 153 108 C 160 100 172 88 180 90 C 186 98 189 114 191 134 L 193 166" />
            {/* Common Iliac & Femoral Arteries */}
            <path d="M 153 176 C 150 186 144 198 142 216 L 140 244 C 139 262 137 286 137 314" />
            <path d="M 153 176 C 156 186 162 198 164 216 L 166 244 C 167 262 169 286 169 314" />
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
            const startX = isRight ? hs.cx + 14 : hs.cx - 14;
            const startY = isUp ? hs.cy - 7 : hs.cy + 7;
            const cornerX = isRight ? startX + 16 : startX - 16;
            const cornerY = isUp ? startY - 16 : startY + 16;
            const endX = isRight ? 295 : 15;

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
                  className={`text-[10px] font-mono tracking-widest uppercase select-none pointer-events-none font-semibold ${
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
                  className="text-[8.5px] font-mono tracking-wider uppercase select-none pointer-events-none font-bold"
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
