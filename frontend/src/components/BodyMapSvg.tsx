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
      cy: 68,
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
      cy: 114,
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
      cx: 123,
      cy: 150,
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

  // Medically realistic, proportionate adult human silhouette path in viewBox="0 0 240 340" (Center X = 120)
  // Features: Proportionate cranium (38px tall, 24px wide), normal neck (12px), broader shoulders (acromion-to-acromion 64px),
  // athletic chest and torso, realistic limb thickness (arms and thighs), and grounded anatomical posture.
  const silhouettePath = [
    'M 120 24',
    // Cranium left
    'C 114 24 109 29 108 36',
    'C 107 43 110 50 113 56',
    'C 114 58 116 61 117 62',
    // Neck left
    'C 116 65 115 70 114 74',
    // Trapezius & Shoulder left (Broader shoulders)
    'C 110 75 98 77 88 80',
    'C 84 81 81 85 81 92',
    // Left upper limb outer (Realistic limb thickness)
    'C 81 99 82 112 83 126',
    'C 83 134 83 146 83 158',
    'C 83 166 82 174 82 184',
    'C 82 189 83 194 85 194',
    'C 86 194 87 190 88 184',
    // Left upper limb inner back to axilla
    'C 89 174 89 164 90 152',
    'C 90 140 91 126 93 114',
    'C 94 108 96 105 98 104',
    // Torso left (Chest, waist, and iliac crest)
    'C 97 112 96 122 96 130',
    'C 96 138 97 144 98 150',
    'C 97 156 95 164 94 172',
    // Left leg outer (Proportionate muscular thigh and calf)
    'C 94 182 95 202 96 220',
    'C 96 228 97 236 97 244',
    'C 97 254 95 266 95 278',
    'C 95 290 98 304 99 316',
    // Left foot and ankle
    'C 99 321 97 325 94 329',
    'C 94 331 96 332 100 332',
    'C 104 332 106 330 106 327',
    'C 106 322 105 319 104 316',
    // Left leg inner up to perineum / crotch
    'C 104 304 107 290 107 278',
    'C 107 266 106 254 106 244',
    'C 106 236 108 226 110 216',
    'C 112 204 116 190 120 178',
    // Right leg inner down from crotch
    'C 124 190 128 204 130 216',
    'C 132 226 134 236 134 244',
    'C 134 254 133 266 133 278',
    'C 133 290 136 304 136 316',
    // Right foot and ankle
    'C 135 319 134 322 134 327',
    'C 134 330 136 332 140 332',
    'C 144 332 146 331 146 329',
    'C 143 325 141 321 141 316',
    // Right leg outer up to hip
    'C 142 304 145 290 145 278',
    'C 145 266 143 254 143 244',
    'C 143 236 144 228 144 220',
    'C 145 202 146 182 146 172',
    // Right torso (Iliac, waist, and axilla)
    'C 145 164 143 156 142 150',
    'C 143 144 144 138 144 130',
    'C 144 122 143 112 142 104',
    // Right upper limb inner down to hand
    'C 144 105 146 108 147 114',
    'C 149 126 150 140 150 152',
    'C 151 164 151 174 152 184',
    'C 153 190 154 194 155 194',
    // Right upper limb outer back up to shoulder
    'C 157 194 158 189 158 184',
    'C 158 174 157 166 157 158',
    'C 157 146 157 134 157 126',
    'C 158 112 159 99 159 92',
    'C 159 85 156 81 152 80',
    // Right shoulder, neck & cranium back to vertex
    'C 142 77 130 75 126 74',
    'C 125 70 124 65 123 62',
    'C 124 61 126 58 127 56',
    'C 130 50 133 43 132 36',
    'C 131 29 126 24 120 24',
    'Z',
  ].join(' ');

  return (
    <div className="flex flex-col items-center justify-between w-full h-full select-none gap-2">
      {/* Centered Anatomical SVG HUD Figure */}
      <div className="relative w-full flex items-center justify-center flex-1 min-h-0">
        <svg
          viewBox="0 0 240 340"
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
              <line x1="120" y1="64" x2="120" y2="178" strokeDasharray="3 3" />

              {/* Clavicles */}
              <path d="M 120 74 C 114 74 102 76 90 79" />
              <path d="M 120 74 C 126 74 138 76 150 79" />

              {/* Pectoral Outlines */}
              <path d="M 118 94 C 114 104 106 108 98 107" />
              <path d="M 122 94 C 126 104 134 108 142 107" />

              {/* Ribcage / Costal Margins */}
              <path d="M 118 116 C 114 117 106 120 98 122" />
              <path d="M 122 116 C 126 117 134 120 142 122" />
              <path d="M 118 124 C 114 125 107 128 100 130" />
              <path d="M 122 124 C 126 125 133 128 140 130" />

              {/* Iliac Crest / Pelvic Outlines */}
              <path d="M 118 152 C 112 152 104 155 96 160" />
              <path d="M 122 152 C 128 152 136 155 144 160" />

              {/* Joint Markings (Faint circles and landmarks) */}
              {/* Shoulders */}
              <circle cx="90" cy="82" r="2.5" strokeDasharray="1.5 1.5" />
              <circle cx="150" cy="82" r="2.5" strokeDasharray="1.5 1.5" />
              {/* Elbows */}
              <circle cx="84" cy="134" r="2" strokeDasharray="1 1" />
              <circle cx="156" cy="134" r="2" strokeDasharray="1 1" />
              {/* Wrists */}
              <circle cx="83" cy="168" r="1.5" strokeDasharray="1 1" />
              <circle cx="157" cy="168" r="1.5" strokeDasharray="1 1" />
              {/* Knees / Patellae */}
              <ellipse cx="101" cy="240" rx="3" ry="4" strokeDasharray="2 2" />
              <ellipse cx="139" cy="240" rx="3" ry="4" strokeDasharray="2 2" />
              {/* Ankles */}
              <line x1="99" y1="316" x2="105" y2="316" />
              <line x1="135" y1="316" x2="141" y2="316" />
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
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#glow)"
            opacity={0.9}
          >
            {/* Jugular Veins & Superior Vena Cava */}
            <path d="M 115 48 L 115 62 C 115 78 114 90 115 104 L 115 116" />
            <path d="M 126 48 L 126 62 C 126 78 122 90 116 104" />
            {/* Left & Right Arm Veins */}
            <path d="M 82 166 L 83 134 C 84 112 87 98 92 90 C 100 85 110 96 115 104" />
            <path d="M 158 166 L 157 134 C 156 112 153 98 148 90 C 140 85 130 96 116 104" />
            {/* Inferior Vena Cava & Common Iliac / Femoral Veins */}
            <path d="M 115 116 L 117 168" />
            <path d="M 101 312 C 101 284 102 258 104 240 L 114 210 C 116 192 117 178 117 168" />
            <path d="M 139 312 C 139 284 138 258 136 240 L 132 210 C 130 192 117 178 117 168" />
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
            <path d="M 116 114 C 116 104 122 102 123 106 L 123 168" />
            {/* Common Carotid Arteries */}
            <path d="M 119 104 C 119 90 117 78 117 62 L 117 48" />
            <path d="M 123 104 C 123 90 124 78 124 62 L 124 48" />
            {/* Cranial Micro-arteries */}
            <path d="M 117 48 C 115 42 113 38 113 34" />
            <path d="M 124 48 C 126 42 128 38 128 34" />
            {/* Subclavian to Brachial / Radial Arteries */}
            <path d="M 119 104 C 110 96 98 87 90 89 C 85 96 83 112 84 134 L 83 166" />
            <path d="M 123 104 C 132 96 144 87 150 89 C 155 96 157 112 156 134 L 157 166" />
            {/* Common Iliac & Femoral Arteries */}
            <path d="M 123 168 C 120 178 114 192 112 210 L 102 240 C 100 258 99 284 99 312" />
            <path d="M 123 168 C 126 178 132 192 134 210 L 138 240 C 140 258 141 284 141 312" />
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
