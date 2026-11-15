import React, { useState, useMemo } from 'react';
import {
  Heart,
  Activity,
  Gauge,
  Radiation,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Timer,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Camera,
  Check,
  HelpCircle,
  ExternalLink,
  Orbit,
} from 'lucide-react';
import { DashboardData } from '../types';
import { BodyMapSvg } from './BodyMapSvg';
import { VisionVitalsCapture } from './VisionVitalsCapture';
import { postMeasurement } from '../api';

interface OverviewViewProps {
  data: DashboardData;
  theme: 'dark' | 'light';
  operationalMode: 'spacecraft' | 'clinic';
  onRefresh: () => void;
  onSelectIndicator: (indicatorKey: string) => void;
  onOpenPiP: (funcId: string | number) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  data,
  theme,
  operationalMode: _operationalMode,
  onRefresh,
  onSelectIndicator,
  onOpenPiP,
}) => {
  const [selectedHotspot, setSelectedHotspot] = useState<string>('baroreceptors');
  const [activeTab, setActiveTab] = useState<'action' | 'measure' | 'biophysics' | 'evidence'>('action');
  const [showCVModal, setShowCVModal] = useState<boolean>(false);
  const [simGravityG, setSimGravityG] = useState<number>(data.gravity_g ?? 1.0);

  // Vitals Logger Form State — Supine HR + Standing HR for Automated Ortho Delta Calculation
  const [logSupineHr, setLogSupineHr] = useState<string>('72');
  const [logStandHr, setLogStandHr] = useState<string>('90');
  const [logSbp, setLogSbp] = useState<string>('115');
  const [logDbp, setLogDbp] = useState<string>('75');
  const [logContext, setLogContext] = useState<string>('Morning Fasted Rest');
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  // Countermeasure Logging State
  const [isLoggingCm, setIsLoggingCm] = useState<boolean>(false);
  const [cmFeedback, setCmFeedback] = useState<string | null>(null);

  // Automatically computed Orthostatic HR Delta (Standing HR - Supine HR)
  const computedOrthoDelta = useMemo(() => {
    const s = parseFloat(logStandHr);
    const sup = parseFloat(logSupineHr);
    if (isNaN(s) || isNaN(sup)) return 0;
    return Math.round((s - sup) * 10) / 10;
  }, [logStandHr, logSupineHr]);

  // Delta severity level tag
  const deltaSeverityTag = useMemo(() => {
    if (computedOrthoDelta >= 28) return { label: 'Action Alert', color: 'text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10' };
    if (computedOrthoDelta >= 18) return { label: 'Watch Review', color: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10' };
    return { label: 'Nominal Envelope', color: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10' };
  }, [computedOrthoDelta]);

  // NASA Biophysical Hemodynamic Modeling (Dynamic Gravity Hydrostatic Gradient)
  const biophysics = useMemo(() => {
    const sbp = parseFloat(logSbp) || 115;
    const dbp = parseFloat(logDbp) || 75;
    const hr = parseFloat(logSupineHr) || 72;
    const mapHeart = Math.round((dbp + (sbp - dbp) / 3.0) * 10) / 10;
    const deltaHydro = Math.round(Math.max(0, simGravityG) * 26.5 * 10) / 10;
    const mapBrain = Math.round(Math.max(10, mapHeart - deltaHydro) * 10) / 10;
    const icp = Math.round((9.5 + (1.0 - Math.min(1.0, Math.max(0, simGravityG))) * 5.0) * 10) / 10;
    const cpp = Math.round((mapBrain - icp) * 10) / 10;
    const isCritical = cpp < 50.0;
    const isWatch = cpp < 60.0;
    const status = isCritical
      ? 'CRITICAL PRE-SYNCOPE (Cerebral Ischemia Risk)'
      : isWatch
      ? 'BORDERLINE HYPOPERFUSION (Autonomic Strain)'
      : 'NOMINAL CEREBRAL PERFUSION';

    const pvContractionPct = data.active_phase.toLowerCase().includes('postflight') ? -14.2 : -11.5;
    const fluidDeficitMl = Math.round(75 * 0.20 * (Math.abs(pvContractionPct) / 100) * 1000);
    const oralElectrolyteTarget = Math.min(1500, Math.max(500, Math.round((fluidDeficitMl * 0.65) / 50) * 50));

    const pp = sbp - dbp;
    const sv = Math.max(30, Math.round(pp * 1.35));
    const co = Math.round(((hr * sv) / 1000) * 10) / 10;
    const svr = Math.round(((mapHeart - 3.0) / Math.max(1.0, co)) * 80);

    return {
      mapHeart,
      deltaHydro,
      mapBrain,
      icp,
      cpp,
      isCritical,
      isWatch,
      status,
      pvContractionPct,
      fluidDeficitMl,
      oralElectrolyteTarget,
      sv,
      co,
      svr,
    };
  }, [logSbp, logDbp, logSupineHr, simGravityG, data.active_phase]);

  // Compact 3-Min Protocol Timer State
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerPhase, setTimerPhase] = useState<1 | 2 | 3>(1); // 1: 90s Supine, 2: 90s Stand, 3: Done
  const [timerSeconds, setTimerSeconds] = useState<number>(90);

  React.useEffect(() => {
    let intv: ReturnType<typeof setInterval> | null = null;
    if (timerRunning && timerSeconds > 0) {
      intv = setInterval(() => setTimerSeconds((s) => s - 1), 1000);
    } else if (timerRunning && timerSeconds === 0) {
      if (timerPhase === 1) {
        setTimerPhase(2);
        setTimerSeconds(90);
      } else if (timerPhase === 2) {
        setTimerPhase(3);
        setTimerRunning(false);
      }
    }
    return () => {
      if (intv) clearInterval(intv);
    };
  }, [timerRunning, timerSeconds, timerPhase]);

  const handleTimerToggle = () => {
    if (timerPhase === 3) {
      setTimerPhase(1);
      setTimerSeconds(90);
      setTimerRunning(true);
    } else {
      setTimerRunning(!timerRunning);
    }
  };

  // Defensive Fast-Forward Guard: Does NOT overwrite user's custom/CV-scanned vitals if dirty
  const handleTimerFastForward = () => {
    if (timerPhase === 1) {
      setTimerPhase(2);
      setTimerSeconds(90);
    } else if (timerPhase === 2) {
      setTimerPhase(3);
      setTimerSeconds(0);
      setTimerRunning(false);

      // Only inject mock values if user has not entered or scanned custom vitals
      if (!isFormDirty) {
        setLogSupineHr('72');
        setLogStandHr('102'); // +30 bpm delta
        setLogSbp('108');
        setLogDbp('70');
      }
    }
  };

  const handleTimerReset = () => {
    setTimerRunning(false);
    setTimerPhase(1);
    setTimerSeconds(90);
  };

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitFeedback(null);
    try {
      await postMeasurement({
        astronaut_id: data.astronaut.id,
        mission_day: data.mission_day,
        phase_name: data.active_phase,
        resting_hr: parseFloat(logSupineHr),
        systolic_bp: parseFloat(logSbp),
        diastolic_bp: parseFloat(logDbp),
        orthostatic_hr_delta: computedOrthoDelta,
        activity_context: `Bento Fast-Log [${logContext}]`,
        collection_context: logContext,
        notes: `Bento Logger entry: Supine HR ${logSupineHr}, Stand HR ${logStandHr}, BP ${logSbp}/${logDbp}, Ortho Delta ${computedOrthoDelta} bpm`,
      });
      setSubmitFeedback('Logged');
      setIsFormDirty(false);
      onRefresh();
      setTimeout(() => setSubmitFeedback(null), 2500);
    } catch (_err: unknown) {
      setSubmitFeedback('Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // One-Click "Record Countermeasure Taken" Action Bridge
  const handleRecordCountermeasure = async () => {
    setIsLoggingCm(true);
    setCmFeedback(null);
    try {
      const actionText = pattern.immediate_action || data.structured_insight.recommended_crew_action;
      await postMeasurement({
        astronaut_id: data.astronaut.id,
        mission_day: data.mission_day,
        phase_name: data.active_phase,
        resting_hr: parseFloat(logSupineHr),
        systolic_bp: parseFloat(logSbp),
        diastolic_bp: parseFloat(logDbp),
        orthostatic_hr_delta: computedOrthoDelta,
        activity_context: 'Countermeasure Compliance',
        collection_context: 'Countermeasure Executed',
        notes: `Countermeasure Executed: ${actionText.slice(0, 160)}`,
      });
      setCmFeedback('Compliance Logged');
      onRefresh();
      setTimeout(() => setCmFeedback(null), 3000);
    } catch (_err: unknown) {
      setCmFeedback('Log Error');
    } finally {
      setIsLoggingCm(false);
    }
  };

  const kpis = data.kpis;
  const targetIndicator = data.target_indicator || 'orthostatic_hr_delta';
  const activeGuide = data.indicator_guides[targetIndicator] || {
    label: 'Orthostatic Heart Rate Delta',
    unit: 'bpm',
    how_to_measure: 'Perform supine-to-stand protocol. Measure 5 min supine, then 3 min standing.',
    why_it_matters: 'Detects impaired cerebral perfusion and arterial hypovolemia.',
    abnormal_action: 'Engage lower body counter-pressure and rehydrate with electrolytes.',
  };

  const handleSelectHotspot = (hotspotKey: string, indicatorKey: string) => {
    setSelectedHotspot(hotspotKey);
    onSelectIndicator(indicatorKey);
  };

  const pattern = data.coupled_pattern;
  const isPatternCritical = pattern.severity === 'CRITICAL_ACTION';
  const isPatternWatch = pattern.severity === 'WATCH_REVIEW';

  const sbpVal = kpis.systolic_bp?.value ?? null;
  const dbpVal = kpis.diastolic_bp?.value ?? 76.0;
  const hrVal = kpis.resting_hr?.value ?? null;

  const derivedHemo = data.derived_hemodynamics || {
    map_mmhg: sbpVal !== null && dbpVal !== null ? Math.round((dbpVal + (sbpVal - dbpVal) / 3.0) * 10) / 10 : 85.2,
    pulse_pressure_mmhg: sbpVal !== null && dbpVal !== null ? Math.round((sbpVal - dbpVal) * 10) / 10 : 44.7,
    pulse_pressure_flag: sbpVal !== null && dbpVal !== null && sbpVal - dbpVal < 40 ? 'Narrowed (< 40 mmHg)' : 'Normal (>= 40 mmHg)',
    is_pulse_pressure_narrowed: Boolean(sbpVal !== null && dbpVal !== null && sbpVal - dbpVal < 40),
    shock_index: hrVal !== null && sbpVal !== null && sbpVal > 0 ? Math.round((hrVal / sbpVal) * 100) / 100 : 0.67,
    shock_index_baseline: 0.51,
    shock_index_delta: null,
    shock_index_status: hrVal !== null && sbpVal !== null && hrVal / sbpVal >= 0.7 ? 'Elevated (>= 0.70)' : 'Normal Index',
    is_shock_index_elevated: Boolean(hrVal !== null && sbpVal !== null && hrVal / sbpVal >= 0.7),
  };

  const formatShortBullets = (text: string) => {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5)
      .slice(0, 3);
  };

  return (
    <div className="max-w-[1440px] w-full mx-auto flex-1 min-h-0 flex flex-col gap-3 select-none overflow-y-auto pr-1">
      {/* ========================================================================= */}
      {/* TOP KPI STRIP: 4 Primary Vitals + 3 Derived Hemodynamics                  */}
      {/* ========================================================================= */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {/* Card 1: Resting HR (Cyan Tint) */}
        <div className="p-3 rounded-xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md flex flex-col justify-between gap-1 shadow-sm transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90 text-cyan-950 dark:text-cyan-200 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" strokeWidth={2} />
              Resting HR
            </span>
            <button
              type="button"
              onClick={() => onOpenPiP('personal_baseline')}
              className="text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors p-0.5 rounded"
              title="Inspect Personal Baseline PiP Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-baseline justify-between my-0.5">
            <span className="text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white">
              {kpis.resting_hr?.value ?? '—'}{' '}
              <span className="text-xs font-semibold text-slate-500">bpm</span>
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 border border-cyan-500/30">
              {kpis.resting_hr?.delta ? `${kpis.resting_hr.delta > 0 ? '+' : ''}${kpis.resting_hr.delta}` : '0.0'} Δ
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
            <span>Z {kpis.resting_hr?.z_score ? `${kpis.resting_hr.z_score > 0 ? '+' : ''}${kpis.resting_hr.z_score}` : '0.0'}</span>
            <span>{kpis.resting_hr?.completeness_pct ?? 100}% obs</span>
          </div>
        </div>

        {/* Card 2: Systolic BP (Emerald Tint) */}
        <div className="p-3 rounded-xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md flex flex-col justify-between gap-1 shadow-sm transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90 text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2} />
              Systolic BP
            </span>
            <button
              type="button"
              onClick={() => onOpenPiP('personal_baseline')}
              className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors p-0.5 rounded"
              title="Inspect Baseline PiP Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-baseline justify-between my-0.5">
            <span className="text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white">
              {kpis.systolic_bp?.value ?? '—'}{' '}
              <span className="text-xs font-semibold text-slate-500">mmHg</span>
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30">
              {kpis.systolic_bp?.delta ? `${kpis.systolic_bp.delta > 0 ? '+' : ''}${kpis.systolic_bp.delta}` : '0.0'} Δ
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
            <span>Z {kpis.systolic_bp?.z_score ? `${kpis.systolic_bp.z_score > 0 ? '+' : ''}${kpis.systolic_bp.z_score}` : '0.0'}</span>
            <span>{kpis.systolic_bp?.completeness_pct ?? 100}% obs</span>
          </div>
        </div>

        {/* Card 3: Orthostatic HR Delta (Amber Tint) */}
        <div className="p-3 rounded-xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md flex flex-col justify-between gap-1 shadow-sm transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90 text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={2} />
              Ortho HR Δ
            </span>
            <button
              type="button"
              onClick={() => onOpenPiP('orthostatic_timer')}
              className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors p-0.5 rounded"
              title="Inspect 3-Min Orthostatic Timer PiP Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-baseline justify-between my-0.5">
            <span className="text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white">
              {kpis.orthostatic_hr_delta?.value ?? '—'}{' '}
              <span className="text-xs font-semibold text-slate-500">bpm</span>
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
              {kpis.orthostatic_hr_delta?.delta ? `${kpis.orthostatic_hr_delta.delta > 0 ? '+' : ''}${kpis.orthostatic_hr_delta.delta}` : '0.0'} Δ
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
            <span>Z {kpis.orthostatic_hr_delta?.z_score ? `${kpis.orthostatic_hr_delta.z_score > 0 ? '+' : ''}${kpis.orthostatic_hr_delta.z_score}` : '0.0'}</span>
            <span>{kpis.orthostatic_hr_delta?.completeness_pct ?? 100}% obs</span>
          </div>
        </div>

        {/* Card 4: CSA Radiation (Violet Tint) */}
        <div className="p-3 rounded-xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md flex flex-col justify-between gap-1 shadow-sm transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90 text-violet-950 dark:text-violet-200 flex items-center gap-1.5">
              <Radiation className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" strokeWidth={2} />
              CSA Radiation
            </span>
            <button
              type="button"
              onClick={() => onOpenPiP('evidence_graph')}
              className="text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors p-0.5 rounded"
              title="Inspect CSA Evidence PiP Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-baseline justify-between my-0.5">
            <span className="text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white">
              {kpis.cumulative_radiation_msv?.value ?? '12.4'}{' '}
              <span className="text-xs font-semibold text-slate-500">mSv</span>
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums bg-violet-500/20 text-violet-800 dark:text-violet-200 border border-violet-500/30">
              ALARA OK
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
            <span>Limit: 1000 mSv</span>
            <span>100% obs</span>
          </div>
        </div>

        {/* Card 5: Derived MAP Perfusion (Teal Tint) */}
        <div className="p-3 rounded-xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md flex flex-col justify-between gap-1 shadow-sm transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90 text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" strokeWidth={2} />
              MAP Perfusion
            </span>
            <button
              type="button"
              onClick={() => onOpenPiP('derived_hemodynamics')}
              className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-300 transition-colors p-0.5 rounded"
              title="Inspect Derived Hemodynamics PiP Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-baseline justify-between my-0.5">
            <span className="text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white">
              {derivedHemo.map_mmhg ?? '85.2'}{' '}
              <span className="text-xs font-semibold text-slate-500">mmHg</span>
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md tabular-nums bg-teal-500/20 text-teal-800 dark:text-teal-200 border border-teal-500/30">
              &gt;= 65 Target
            </span>
          </div>
          <div className="text-xs font-semibold text-teal-800 dark:text-teal-300 truncate">
            DBP + 1/3(SBP - DBP)
          </div>
        </div>

        {/* Card 6: Derived Pulse Pressure (Indigo Tint) */}
        <div className="p-3 rounded-xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md flex flex-col justify-between gap-1 shadow-sm transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90 text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" strokeWidth={2} />
              Pulse Pressure
            </span>
            <button
              type="button"
              onClick={() => onOpenPiP('derived_hemodynamics')}
              className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors p-0.5 rounded"
              title="Inspect Derived Hemodynamics PiP Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-baseline justify-between my-0.5">
            <span className="text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white">
              {derivedHemo.pulse_pressure_mmhg ?? '44.7'}{' '}
              <span className="text-xs font-semibold text-slate-500">mmHg</span>
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-md tabular-nums border ${
                derivedHemo.is_pulse_pressure_narrowed
                  ? 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/30'
                  : 'bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border-indigo-500/30'
              }`}
            >
              {derivedHemo.is_pulse_pressure_narrowed ? 'Narrowed' : 'Normal'}
            </span>
          </div>
          <div className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 truncate">
            Stroke Volume Index
          </div>
        </div>

        {/* Card 7: Derived Shock Index (Rose / Amber Tint) */}
        <div className="p-3 rounded-xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md flex flex-col justify-between gap-1 shadow-sm transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider opacity-90 text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={2} />
              Shock Index
            </span>
            <button
              type="button"
              onClick={() => onOpenPiP('derived_hemodynamics')}
              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 transition-colors p-0.5 rounded"
              title="Inspect Derived Hemodynamics PiP Guide"
            >
              <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-baseline justify-between my-0.5">
            <span className="text-2xl font-black tabular-nums leading-none text-slate-900 dark:text-white">
              {derivedHemo.shock_index ?? '0.67'}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-md tabular-nums border ${
                derivedHemo.is_shock_index_elevated
                  ? 'bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/30'
              }`}
            >
              {derivedHemo.is_shock_index_elevated ? 'Elevated' : 'Optimal'}
            </span>
          </div>
          <div className="text-xs font-semibold text-rose-800 dark:text-rose-300 truncate">
            Baseline ~0.51
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN GUIDED 3-COLUMN BENTO GRID: STEP 1 → STEP 2 → STEP 3                 */}
      {/* ========================================================================= */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3">
        {/* STEP 1 Card: Body Region (Cols 1-4) */}
        <div className="col-span-1 md:col-span-1 xl:col-span-4 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
          {/* Subtle Corner Reticles */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-orange-400/40 rounded-tl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-orange-400/40 rounded-br pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-orange-500/20 pb-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-800 dark:text-orange-200 border border-orange-500/30">
                STEP 1
              </span>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Body Region
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenPiP('body_map')}
              className="p-1 rounded-lg hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 transition-colors"
              title="Open Body Map Function Guide"
            >
              <HelpCircle className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {/* Center: High-Fidelity Aerospace Medical HUD Body Map */}
          <div className="flex-1 min-h-0 flex items-center justify-center py-2">
            <BodyMapSvg
              selectedHotspot={selectedHotspot}
              onSelectHotspot={handleSelectHotspot}
              kpis={kpis}
              theme={theme}
            />
          </div>
        </div>

        {/* STEP 2 Card: Status & Action (Cols 5-8) */}
        <div className="col-span-1 md:col-span-1 xl:col-span-4 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
          {/* Subtle Corner Reticles */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-indigo-400/40 rounded-tl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-indigo-400/40 rounded-br pointer-events-none" />
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-indigo-500/20 pb-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-800 dark:text-indigo-200 border border-indigo-500/30">
                STEP 2
              </span>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Status &amp; Action
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenPiP('personal_baseline')}
              className="p-1 rounded-lg hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 transition-colors"
              title="Open Personal Baseline &amp; Action Guide"
            >
              <HelpCircle className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {/* High-Contrast Status Alert Banner */}
          <div
            className={`p-3 rounded-xl border text-sm shrink-0 transition-colors ${
              isPatternCritical
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-950 dark:text-rose-200'
                : isPatternWatch
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-950 dark:text-amber-200'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-950 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-extrabold flex items-center gap-1.5 text-sm">
                {isPatternCritical ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse shrink-0" strokeWidth={2} />
                ) : isPatternWatch ? (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" strokeWidth={2} />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2} />
                )}
                {pattern.signature_name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border whitespace-nowrap shrink-0 ${
                    data.flight_rules?.overall_status === 'NO-GO'
                      ? 'bg-rose-500/30 text-rose-800 dark:text-rose-200 border-rose-500/50'
                      : data.flight_rules?.overall_status === 'CAUTION'
                      ? 'bg-amber-500/30 text-amber-800 dark:text-amber-200 border-amber-500/50'
                      : 'bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 border-emerald-500/50'
                  }`}
                  title="Illustrative Rule (Modeled on NASA Flight Rules &amp; HRP Protocols)"
                >
                  {data.flight_rules ? `Rule B13: ${data.flight_rules.overall_status}` : 'Rule B13: NO-GO'}
                </span>
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-md bg-black/20 tabular-nums whitespace-nowrap shrink-0">
                  {pattern.severity}
                </span>
              </div>
            </div>
            <p className="text-sm font-medium leading-relaxed opacity-95 line-clamp-2">
              {pattern.summary}
            </p>
          </div>

          {/* Inner Pill Tabs: Action | Measure | Biophysics | Evidence */}
          <div className="flex gap-2 border-b border-indigo-500/20 pt-2 pb-1 text-sm font-bold shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('action')}
              className={`pb-1 border-b-2 transition-colors ${
                activeTab === 'action'
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Action
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('measure')}
              className={`pb-1 border-b-2 transition-colors ${
                activeTab === 'measure'
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Measure
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('biophysics')}
              className={`pb-1 border-b-2 transition-colors ${
                activeTab === 'biophysics'
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Biophysics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('evidence')}
              className={`pb-1 border-b-2 transition-colors ${
                activeTab === 'evidence'
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Evidence
            </button>
          </div>

          {/* Tab Content: Max 3 Concise text-sm Bullets or Biophysics HUD */}
          <div className="flex-1 min-h-0 py-1.5 space-y-2 text-sm overflow-y-auto">
            {activeTab === 'action' && (
              <ul className="space-y-2 font-medium text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                {formatShortBullets(pattern.immediate_action || data.structured_insight.recommended_crew_action).map(
                  (bullet, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  )
                )}
              </ul>
            )}

            {activeTab === 'measure' && (
              <ul className="space-y-2 font-medium text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                {formatShortBullets(activeGuide.how_to_measure).map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-500 mt-2 shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}

            {activeTab === 'biophysics' && (
              <div className="space-y-2 text-xs font-mono">
                {/* Gravity Vector Selector */}
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-indigo-500/30 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Orbit className="w-3.5 h-3.5 text-sky-500" />
                    Gravity Vector:
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { g: 1.0, label: '1g' },
                      { g: 0.38, label: '0.38g' },
                      { g: 0.16, label: '0.16g' },
                      { g: 0.0, label: '0g' },
                    ].map((env) => (
                      <button
                        key={env.label}
                        type="button"
                        onClick={() => setSimGravityG(env.g)}
                        className={`px-1.5 py-0.5 rounded font-black text-[10px] transition-colors ${
                          simGravityG === env.g
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {env.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CPP & Pre-Syncope Boundary */}
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-indigo-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400">
                      Cerebral Perfusion (CPP)
                    </span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                      biophysics.isCritical
                        ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                        : biophysics.isWatch
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {biophysics.cpp} mmHg
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>MAP(brain): {biophysics.mapBrain} mmHg (ΔP -{biophysics.deltaHydro})</span>
                    <span>ICP: {biophysics.icp} mmHg</span>
                  </div>
                  <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    {biophysics.status}
                  </div>
                </div>

                {/* Plasma Volume Contraction & Rehydration Prescriber */}
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-indigo-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-600 dark:text-slate-400 block">
                      ΔPV Plasma Deficit
                    </span>
                    <span className="text-[11px] font-black text-slate-900 dark:text-white">
                      {biophysics.pvContractionPct}% (~{biophysics.fluidDeficitMl} mL)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 block">
                      Target Oral Saline
                    </span>
                    <span className="text-[11px] font-black text-indigo-800 dark:text-indigo-200">
                      {biophysics.oralElectrolyteTarget} mL isotonic
                    </span>
                  </div>
                </div>

                {/* Hemodynamic SVR & Stroke Volume */}
                <div className="p-1.5 rounded-lg bg-white/50 dark:bg-slate-900/50 border border-indigo-500/20 flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400">
                  <span>SVR: {biophysics.svr} dyn·s·cm⁻⁵</span>
                  <span>CO: {biophysics.co} L/min</span>
                  <span>SV: {biophysics.sv} mL</span>
                </div>
              </div>
            )}

            {activeTab === 'evidence' && (
              <ul className="space-y-2 font-medium text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                {formatShortBullets(data.structured_insight.scientific_background).map((bullet, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2 shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* One-Click "Record Countermeasure Taken" Action Bridge */}
          <button
            type="button"
            onClick={handleRecordCountermeasure}
            disabled={isLoggingCm}
            className="w-full h-9 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors shrink-0 disabled:opacity-50"
            title="Log prescribed non-pharmacological countermeasure adherence directly to mission telemetry"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>{isLoggingCm ? 'Recording...' : cmFeedback ? cmFeedback : 'Record Countermeasure Taken'}</span>
          </button>

          {/* Footer Strip: Active Indicator Tag + Clickable NASA/CSA Citation Link */}
          <div className="pt-2 border-t border-indigo-500/20 text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between shrink-0">
            <span>Indicator: {activeGuide.label}</span>
            <button
              type="button"
              onClick={() => onOpenPiP('evidence_graph')}
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>NASA-HRP-RISK-01</span>
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* STEP 3 Card: Timer & Log (Cols 9-12) */}
        <div className="col-span-1 md:col-span-2 xl:col-span-4 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
          {/* Subtle Corner Reticles */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-emerald-400/40 rounded-tl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-emerald-400/40 rounded-br pointer-events-none" />
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-emerald-500/20 pb-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30">
                STEP 3
              </span>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Timer &amp; Log
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onOpenPiP('orthostatic_timer')}
              className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors"
              title="Open Orthostatic Timer &amp; Log Guide"
            >
              <HelpCircle className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {/* Top Module: Compact 3-Min Orthostatic Timer */}
          <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-emerald-500/25 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-black text-sm text-emerald-800 dark:text-emerald-200 tabular-nums shrink-0">
                {timerSeconds}s
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5 leading-tight">
                  <Timer className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2} />
                  {timerPhase === 1 ? '90s Rest' : timerPhase === 2 ? '90s Stand / LBNP' : 'Protocol Complete'}
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {timerPhase === 1 ? 'Rest before standing' : timerPhase === 2 ? 'Active stand challenge' : 'Values captured'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTimerToggle}
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs text-xs font-bold transition-colors"
                title={timerRunning ? 'Pause' : 'Start Timer'}
              >
                {timerRunning ? (
                  <Pause className="w-3.5 h-3.5" strokeWidth={2} />
                ) : (
                  <Play className="w-3.5 h-3.5" strokeWidth={2} />
                )}
              </button>
              <button
                type="button"
                onClick={handleTimerFastForward}
                className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                title="Fast-Forward Protocol (Preserves user custom entries)"
              >
                <FastForward className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={handleTimerReset}
                className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
                title="Reset Timer"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Middle Module: Clean 2x2 Input Grid with Automated Ortho Delta Calculation */}
          <form onSubmit={handleLogSubmit} className="space-y-2 my-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Supine HR */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Supine HR
                </label>
                <input
                  type="number"
                  value={logSupineHr}
                  onChange={(e) => {
                    setLogSupineHr(e.target.value);
                    setIsFormDirty(true);
                  }}
                  className={`h-9 w-full px-2 text-sm font-bold bg-white/40 dark:bg-slate-900/60 border rounded-lg text-slate-900 dark:text-white tabular-nums backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    selectedHotspot === 'heart' ? 'border-orange-500 ring-1 ring-orange-400' : 'border-transparent dark:border-slate-700/60'
                  }`}
                  required
                />
              </div>

              {/* Stand HR */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Stand HR
                </label>
                <input
                  type="number"
                  value={logStandHr}
                  onChange={(e) => {
                    setLogStandHr(e.target.value);
                    setIsFormDirty(true);
                  }}
                  className={`h-9 w-full px-2 text-sm font-bold bg-white/40 dark:bg-slate-900/60 border rounded-lg text-slate-900 dark:text-white tabular-nums backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    selectedHotspot === 'baroreceptors' ? 'border-orange-500 ring-1 ring-orange-400' : 'border-transparent dark:border-slate-700/60'
                  }`}
                  required
                />
              </div>

              {/* SBP */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  SBP
                </label>
                <input
                  type="number"
                  value={logSbp}
                  onChange={(e) => {
                    setLogSbp(e.target.value);
                    setIsFormDirty(true);
                  }}
                  className={`h-9 w-full px-2 text-sm font-bold bg-white/40 dark:bg-slate-900/60 border rounded-lg text-slate-900 dark:text-white tabular-nums backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    selectedHotspot === 'aorta' ? 'border-orange-500 ring-1 ring-orange-400' : 'border-transparent dark:border-slate-700/60'
                  }`}
                  required
                />
              </div>

              {/* DBP */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  DBP
                </label>
                <input
                  type="number"
                  value={logDbp}
                  onChange={(e) => {
                    setLogDbp(e.target.value);
                    setIsFormDirty(true);
                  }}
                  className={`h-9 w-full px-2 text-sm font-bold bg-white/40 dark:bg-slate-900/60 border rounded-lg text-slate-900 dark:text-white tabular-nums backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                    selectedHotspot === 'aorta' ? 'border-orange-500 ring-1 ring-orange-400' : 'border-transparent dark:border-slate-700/60'
                  }`}
                  required
                />
              </div>
            </div>

            {/* Automated Orthostatic Delta Telemetry Strip */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/40 dark:bg-slate-900/60 border border-emerald-500/20 text-xs backdrop-blur-sm">
              <span className="font-bold text-slate-600 dark:text-slate-400">
                Computed Ortho HR Δ:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                  {computedOrthoDelta > 0 ? `+${computedOrthoDelta}` : computedOrthoDelta} bpm
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${deltaSeverityTag.color}`}>
                  {deltaSeverityTag.label}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Context
              </label>
              <select
                value={logContext}
                onChange={(e) => {
                  setLogContext(e.target.value);
                  setIsFormDirty(true);
                }}
                className="h-9 w-full px-3 text-sm font-medium bg-white/40 dark:bg-slate-900/60 border border-transparent dark:border-slate-700/60 rounded-lg text-slate-900 dark:text-white backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Morning Fasted Rest">Morning Fasted Rest</option>
                <option value="Post-Exercise (<30 min)">Post-Exercise (&lt;30 min)</option>
                <option value="Post-EVA">Post-EVA</option>
                <option value="Acute Check">Acute Check</option>
              </select>
            </div>

            {/* Bottom Action Row: Two Full-Height Icon-Led Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowCVModal(true)}
                className="h-10 text-sm font-bold rounded-xl flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-xs"
                title="Open Computer Vision Cuff Alignment &amp; Monitor OCR"
              >
                <Camera className="w-4 h-4" strokeWidth={2} />
                <span>CV Scan</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-10 text-sm font-bold rounded-xl flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" strokeWidth={2} />
                <span>{isSubmitting ? 'Logging...' : submitFeedback ? submitFeedback : 'Log Vitals'}</span>
              </button>
            </div>
          </form>

          {/* Footer Telemetry Stamp */}
          <div className="pt-2 border-t border-emerald-500/20 text-xs font-semibold text-slate-500 flex items-center justify-between shrink-0">
            <span>Day {data.mission_day} • {data.active_phase}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Ready</span>
          </div>
        </div>
      </div>

      {/* CV Modal for Camera/OCR */}
      {showCVModal && (
        <VisionVitalsCapture
          isOpen={showCVModal}
          onClose={() => setShowCVModal(false)}
          onConfirmValues={(vitals) => {
            setLogSbp(vitals.sbp.toString());
            setLogDbp(vitals.dbp.toString());
            setLogSupineHr(vitals.hr.toString());
            setLogStandHr((vitals.hr + (computedOrthoDelta || 18)).toString());
            setIsFormDirty(true);
            setShowCVModal(false);
          }}
        />
      )}
    </div>
  );
};
