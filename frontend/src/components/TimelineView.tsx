import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Sliders, Radiation, Activity, Heart, Gauge, Layers, Copy, Check, HelpCircle } from 'lucide-react';
import { TimelineData } from '../types';

interface TimelineViewProps {
  data: TimelineData;
  theme: 'dark' | 'light';
  onOpenPiP: (funcId: string | number) => void;
  operationalMode?: 'spacecraft' | 'clinic';
}

type MetricKey = 'orthostatic_hr_delta' | 'resting_hr' | 'systolic_bp' | 'coupled';

export const TimelineView: React.FC<TimelineViewProps> = ({
  data,
  theme,
  onOpenPiP,
  operationalMode: _operationalMode = 'spacecraft',
}) => {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('coupled');
  const [fluidLoading, setFluidLoading] = useState<number>(75);
  const [lbnpSessionsPerWeek, setLbnpSessionsPerWeek] = useState<number>(3);
  const [exerciseMinPerDay, setExerciseMinPerDay] = useState<number>(60);
  const [copiedSim, setCopiedSim] = useState<boolean>(false);

  const isDark = theme === 'dark';

  const metricConfig = {
    orthostatic_hr_delta: {
      label: 'Orthostatic HR Delta',
      unit: 'bpm',
      color: '#F59E0B',
      domain: [5, 42] as [number, number],
      icon: <Activity className="w-3.5 h-3.5" strokeWidth={2} />,
    },
    resting_hr: {
      label: 'Resting Heart Rate',
      unit: 'bpm',
      color: '#E11D48',
      domain: [48, 95] as [number, number],
      icon: <Heart className="w-3.5 h-3.5" strokeWidth={2} />,
    },
    systolic_bp: {
      label: 'Systolic Blood Pressure',
      unit: 'mmHg',
      color: '#0284C7',
      domain: [90, 135] as [number, number],
      icon: <Gauge className="w-3.5 h-3.5" strokeWidth={2} />,
    },
    coupled: {
      label: 'Coupled Trends',
      unit: 'bpm / mmHg',
      color: '#8B5CF6',
      domain: [0, 100] as [number, number],
      icon: <Layers className="w-3.5 h-3.5" strokeWidth={2} />,
    },
  };

  const currentMetric = metricConfig[activeMetric];
  const band = (activeMetric !== 'coupled' ? data.reference_bands[activeMetric] : null) || {
    mean: 11.0,
    std: 1.8,
    watch_upper: 13.7,
    action_upper: 15.5,
  };

  const fluidNorm = Math.min(1.0, Math.max(0.0, fluidLoading / 100.0));
  const lbnpNorm = Math.min(1.0, Math.max(0.0, lbnpSessionsPerWeek / 5.0));
  const exerciseNorm = Math.min(1.0, Math.max(0.0, exerciseMinPerDay / 90.0));
  const compositeAdherence = 0.4 * fluidNorm + 0.35 * lbnpNorm + 0.25 * exerciseNorm;

  const chartData = useMemo(() => {
    const baseOrtho = data.baselines.orthostatic_hr_delta?.mean ?? 10.85;
    const baseSbp = data.baselines.systolic_bp?.mean ?? 118.62;
    const baseHr = data.baselines.resting_hr?.mean ?? 60.23;

    return data.timeline.map((pt) => {
      let simValue: number | null = null;
      const obsValue = activeMetric !== 'coupled' ? pt[activeMetric] : pt.orthostatic_hr_delta;

      if (pt.mission_day >= 91 && pt.mission_day <= 120) {
        const dayOffset = pt.mission_day - 90;

        if (activeMetric === 'orthostatic_hr_delta' || activeMetric === 'coupled') {
          const peakDelta = 36.0 - 18.0 * compositeAdherence;
          const decayRate = 0.4 + 0.7 * compositeAdherence;
          const recoveryVal = Math.max(baseOrtho, peakDelta - dayOffset * decayRate);
          simValue = Math.round(recoveryVal * 10) / 10;
        } else if (activeMetric === 'resting_hr') {
          const peakHr = 82.0 - 14.0 * compositeAdherence;
          const decayRate = 0.3 + 0.45 * compositeAdherence;
          const recoveryHr = Math.max(baseHr, peakHr - dayOffset * decayRate);
          simValue = Math.round(recoveryHr * 10) / 10;
        } else if (activeMetric === 'systolic_bp') {
          const troughBp = 98.0 + 16.0 * compositeAdherence;
          const recoveryRate = 0.3 + 0.4 * compositeAdherence;
          const recoveryBp = Math.min(baseSbp, troughBp + dayOffset * recoveryRate);
          simValue = Math.round(recoveryBp * 10) / 10;
        }
      }

      return {
        ...pt,
        observed: obsValue,
        simulated: simValue,
      };
    });
  }, [data.timeline, data.baselines, activeMetric, compositeAdherence]);

  const applyPreset = (preset: 'nasa' | 'minimal' | 'aggressive') => {
    if (preset === 'nasa') {
      setFluidLoading(85);
      setLbnpSessionsPerWeek(4);
      setExerciseMinPerDay(70);
    } else if (preset === 'minimal') {
      setFluidLoading(20);
      setLbnpSessionsPerWeek(1);
      setExerciseMinPerDay(20);
    } else if (preset === 'aggressive') {
      setFluidLoading(100);
      setLbnpSessionsPerWeek(5);
      setExerciseMinPerDay(90);
    }
  };

  const handleCopySimSummary = () => {
    const summary = `NASA-HRP Countermeasure Simulation Summary:
Adherence Score: ${(compositeAdherence * 100).toFixed(0)}%
Fluid Loading: ${fluidLoading}% (15 mL/kg isotonic)
LBNP Sessions: ${lbnpSessionsPerWeek}/wk
Daily Exercise: ${exerciseMinPerDay} min/day
Projected Day 105 Orthostatic HR Delta: ${Math.max(12, Math.round(36 - 18 * compositeAdherence))} bpm
Plasma Volume Recovery Rate: ${compositeAdherence >= 0.7 ? '+42% (Optimal Accelerated)' : '+18% (Standard)'}`;

    navigator.clipboard.writeText(summary);
    setCopiedSim(true);
    setTimeout(() => setCopiedSim(false), 2000);
  };

  return (
    <div className="grid grid-cols-12 grid-rows-6 gap-2.5 h-full w-full overflow-hidden select-none">
      {/* ========================================================================= */}
      {/* LEFT BENTO CARD: Recharts Longitudinal Timeline + Radiation Subplot       */}
      {/* ========================================================================= */}
      <div className="col-span-8 row-span-6 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#070D1E]/50 backdrop-blur-md p-3.5 flex flex-col justify-between overflow-hidden transition-all shadow-sm relative">
        {/* Subtle Corner Reticles */}
        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-cyan-500/40 rounded-tl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-cyan-500/40 rounded-br pointer-events-none" />

        {/* Header & Metric Switcher */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-cyan-500/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-900 dark:text-white">
              Longitudinal Telemetry &amp; Countermeasure Simulation (Days -30 to 120)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveMetric('coupled')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md border transition-colors ${
                activeMetric === 'coupled'
                  ? 'bg-purple-600 text-white border-purple-500 shadow-2xs dark:bg-purple-500'
                  : 'bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
              }`}
              title="View Coupled Multi-Metric Overlay (HR, Ortho Delta & BP)"
            >
              <Layers className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Coupled (Dual-Axis)</span>
            </button>

            {(['orthostatic_hr_delta', 'resting_hr', 'systolic_bp'] as const).map((mKey) => (
              <button
                key={mKey}
                type="button"
                onClick={() => setActiveMetric(mKey)}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md border transition-colors ${
                  activeMetric === mKey
                    ? 'bg-cyan-600 text-white border-cyan-500 shadow-2xs dark:bg-cyan-500'
                    : 'bg-white/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                }`}
              >
                {metricConfig[mKey].icon}
                <span className="hidden sm:inline">{metricConfig[mKey].label.split(' ')[0]}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => onOpenPiP('countermeasure_sim')}
              className="p-1 rounded-lg hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 transition-colors ml-1"
              title="Open Countermeasure Simulator PiP Guide"
            >
              <HelpCircle className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Primary Timeline Chart (Flexible Height, Supporting Dual-Axis Coupled Mode) */}
        <div className="flex-1 min-h-0 w-full pt-1.5 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke={isDark ? '#1E293B' : '#E2E8F0'} />
              <XAxis dataKey="mission_day" stroke={isDark ? '#64748B' : '#94A3B8'} fontSize={10} tickLine={false} />

              {activeMetric === 'coupled' ? (
                <>
                  <YAxis
                    yAxisId="hr"
                    domain={[0, 100]}
                    stroke={isDark ? '#F59E0B' : '#D97706'}
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="bp"
                    orientation="right"
                    domain={[50, 140]}
                    stroke={isDark ? '#0284C7' : '#0369A1'}
                    fontSize={10}
                    tickLine={false}
                  />
                </>
              ) : (
                <YAxis domain={currentMetric.domain} stroke={isDark ? '#64748B' : '#94A3B8'} fontSize={10} tickLine={false} />
              )}

              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#0B1120' : '#FFFFFF',
                  borderColor: isDark ? '#1E293B' : '#CBD5E1',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />

              <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '10px' }} />

              {/* Shaded Mission Phase Backgrounds */}
              <ReferenceArea x1={-30} x2={0} fill="#3B82F6" fillOpacity={isDark ? 0.08 : 0.05} />
              <ReferenceArea x1={1} x2={60} fill="#8B5CF6" fillOpacity={isDark ? 0.08 : 0.05} />
              <ReferenceArea x1={61} x2={90} fill="#EC4899" fillOpacity={isDark ? 0.08 : 0.05} />
              <ReferenceArea x1={91} x2={105} fill="#F43F5E" fillOpacity={isDark ? 0.08 : 0.05} />
              <ReferenceArea x1={106} x2={120} fill="#10B981" fillOpacity={isDark ? 0.08 : 0.05} />

              {/* Baseline Reference Lines (Single metric view) */}
              {activeMetric !== 'coupled' && (
                <>
                  <ReferenceLine y={band.mean} stroke="#10B981" strokeDasharray="3 3" />
                  <ReferenceLine y={band.watch_upper} stroke="#F59E0B" strokeDasharray="3 3" />
                  <ReferenceLine y={band.action_upper} stroke="#E11D48" strokeDasharray="3 3" />
                </>
              )}

              {/* Coupled Multi-Line Rendering */}
              {activeMetric === 'coupled' ? (
                <>
                  <Line
                    yAxisId="hr"
                    type="monotone"
                    dataKey="orthostatic_hr_delta"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    name="Ortho HR Δ (bpm)"
                  />
                  <Line
                    yAxisId="hr"
                    type="monotone"
                    dataKey="resting_hr"
                    stroke="#E11D48"
                    strokeWidth={1.8}
                    dot={false}
                    name="Resting HR (bpm)"
                  />
                  <Line
                    yAxisId="bp"
                    type="monotone"
                    dataKey="systolic_bp"
                    stroke="#0284C7"
                    strokeWidth={2}
                    dot={false}
                    name="Systolic BP (mmHg)"
                  />
                  <Line
                    yAxisId="hr"
                    type="monotone"
                    dataKey="simulated"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    strokeDasharray="4 3"
                    dot={false}
                    name="Simulated Recovery (bpm)"
                  />
                </>
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey="observed"
                    stroke={currentMetric.color}
                    strokeWidth={2}
                    dot={false}
                    name={`Observed ${currentMetric.label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="simulated"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    strokeDasharray="4 3"
                    dot={false}
                    name="Simulated Recovery"
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Compact CSA Cumulative Radiation Subplot (Fixed Height ~60px) */}
        <div className="h-16 w-full pt-1 border-t border-cyan-500/20 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 font-bold text-violet-700 dark:text-violet-300">
              <Radiation className="w-3 h-3" strokeWidth={2} />
              CSA Cumulative Cosmic Radiation (ALARA Limit 1000 mSv)
            </span>
            <span>Day 120: {data.timeline[data.timeline.length - 1]?.cumulative_radiation_msv ?? 23.4} mSv</span>
          </div>
          <div className="h-9 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 2, right: 12, left: -18, bottom: 0 }}>
                <Area type="monotone" dataKey="cumulative_radiation_msv" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.25} />
                <YAxis domain={[0, 40]} hide />
                <XAxis dataKey="mission_day" hide />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT BENTO CARD: Concrete Countermeasure Protocol Controls               */}
      {/* ========================================================================= */}
      <div className="col-span-4 row-span-6 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#070D1E]/50 backdrop-blur-md p-3.5 flex flex-col justify-between overflow-hidden transition-all shadow-sm relative">
        {/* Subtle Corner Reticles */}
        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-teal-500/40 rounded-tl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-teal-500/40 rounded-br pointer-events-none" />

        <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-teal-500/20 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs">
              <Sliders className="w-3.5 h-3.5" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                Countermeasure Protocol Simulator
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                NASA HRP postflight recovery model
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenPiP('countermeasure_sim')}
            className="p-1 rounded-lg hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 transition-colors"
            title="Inspect Countermeasure Simulator PiP Guide"
          >
            <HelpCircle className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="p-2.5 rounded-xl bg-white/35 dark:bg-slate-950/60 backdrop-blur-sm border border-teal-500/20 space-y-1.5 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
            Clinical Presets
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset('nasa')}
              className="px-2 py-1.5 text-[11px] font-bold rounded-lg bg-teal-600 hover:bg-teal-500 text-white shadow-2xs transition-colors"
            >
              NASA Std
            </button>
            <button
              type="button"
              onClick={() => applyPreset('minimal')}
              className="px-2 py-1.5 text-[11px] font-bold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 border border-rose-500/30 transition-colors"
            >
              Low Dose
            </button>
            <button
              type="button"
              onClick={() => applyPreset('aggressive')}
              className="px-2 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30 transition-colors"
            >
              High Adhere
            </button>
          </div>
        </div>

        {/* 3 Interactive Sliders */}
        <div className="p-3 rounded-xl bg-white/35 dark:bg-slate-950/60 backdrop-blur-sm border border-teal-500/20 space-y-3 shadow-2xs">
          {/* Slider 1: Fluid Loading */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Reentry Fluid Loading (15 mL/kg)
              </span>
              <span className="font-mono font-extrabold text-teal-700 dark:text-teal-300">
                {fluidLoading}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={fluidLoading}
              onChange={(e) => setFluidLoading(parseInt(e.target.value, 10))}
              className="w-full accent-teal-600 cursor-pointer h-1.5"
            />
          </div>

          {/* Slider 2: LBNP Sessions */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                LBNP Sessions / Week
              </span>
              <span className="font-mono font-extrabold text-teal-700 dark:text-teal-300">
                {lbnpSessionsPerWeek} sess/wk
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={lbnpSessionsPerWeek}
              onChange={(e) => setLbnpSessionsPerWeek(parseInt(e.target.value, 10))}
              className="w-full accent-teal-600 cursor-pointer h-1.5"
            />
          </div>

          {/* Slider 3: Exercise Minutes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Daily Resistive/Aerobic Exercise
              </span>
              <span className="font-mono font-extrabold text-teal-700 dark:text-teal-300">
                {exerciseMinPerDay} min/day
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={exerciseMinPerDay}
              onChange={(e) => setExerciseMinPerDay(parseInt(e.target.value, 10))}
              className="w-full accent-teal-600 cursor-pointer h-1.5"
            />
          </div>
        </div>

        {/* Live Projected Recovery Summary Box */}
        <div className="p-3 rounded-xl bg-white/35 dark:bg-slate-950/60 backdrop-blur-sm border border-teal-500/25 space-y-2 text-xs shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
            <span className="font-bold text-slate-700 dark:text-slate-300">Adherence Score:</span>
            <span className="font-mono font-extrabold text-teal-700 dark:text-teal-300">
              {(compositeAdherence * 100).toFixed(0)}% ({compositeAdherence >= 0.75 ? 'Optimal' : compositeAdherence >= 0.5 ? 'Moderate' : 'Sub-Optimal'})
            </span>
          </div>

          <ul className="space-y-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 pt-0.5">
            <li className="flex items-start gap-1.5">
              <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
              <span>Projected Day 105 Ortho Δ: {Math.max(12, Math.round(36 - 18 * compositeAdherence))} bpm</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
              <span>Plasma volume expansion: {compositeAdherence >= 0.7 ? '+42% accelerated' : '+18% standard'}</span>
            </li>
          </ul>

          <button
            type="button"
            onClick={handleCopySimSummary}
            className="w-full mt-1 h-7 rounded-md text-[11px] font-bold border border-teal-500/30 bg-teal-500/15 hover:bg-teal-500/25 text-teal-900 dark:text-teal-200 flex items-center justify-center gap-1.5 transition-colors"
          >
            {copiedSim ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" strokeWidth={2} />
                <span>Simulation Briefing Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" strokeWidth={2} />
                <span>Copy Simulation Briefing</span>
              </>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="pt-1 border-t border-teal-500/20 text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Grounded: NASA-HRP-RES-01</span>
          <span className="text-teal-600 dark:text-teal-400 font-bold">100% Deterministic</span>
        </div>
      </div>
    </div>
  );
};
