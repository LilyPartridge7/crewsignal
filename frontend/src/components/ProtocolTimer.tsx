import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, FastForward, CheckCircle2, Clock, Zap } from 'lucide-react';

interface ProtocolResults {
  supine_hr: number;
  standing_hr: number;
  ortho_delta: number;
  sbp: number;
  dbp: number;
  map: number;
  pulse_pressure: number;
  shock_index: number;
}

interface ProtocolTimerProps {
  onComplete: (results: ProtocolResults) => void;
  operationalMode?: 'spacecraft' | 'clinic';
  initialSbp?: number;
  initialDbp?: number;
  initialRestingHr?: number;
}

export const ProtocolTimer: React.FC<ProtocolTimerProps> = ({
  onComplete,
  operationalMode = 'spacecraft',
  initialSbp = 108,
  initialDbp = 72,
  initialRestingHr = 64,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [phase, setPhase] = useState<1 | 2 | 3>(1); // 1: Supine, 2: Stand, 3: Completed
  const [secondsRemaining, setSecondsRemaining] = useState<number>(90);

  // Editable/Captured vitals during protocol
  const [supineHr, setSupineHr] = useState<number>(initialRestingHr);
  const [standingHr, setStandingHr] = useState<number>(initialRestingHr + 28);
  const [sbp, setSbp] = useState<number>(initialSbp);
  const [dbp, setDbp] = useState<number>(initialDbp);

  const isClinic = operationalMode === 'clinic';

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && secondsRemaining === 0) {
      if (phase === 1) {
        setPhase(2);
        setSecondsRemaining(90);
      } else if (phase === 2) {
        setPhase(3);
        setIsRunning(false);
        triggerCompletion();
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsRemaining, phase]);

  const triggerCompletion = () => {
    const ortho = Math.round((standingHr - supineHr) * 10) / 10;
    const mapVal = Math.round((dbp + (sbp - dbp) / 3.0) * 10) / 10;
    const ppVal = Math.round((sbp - dbp) * 10) / 10;
    const siVal = Math.round((supineHr / sbp) * 100) / 100;

    onComplete({
      supine_hr: supineHr,
      standing_hr: standingHr,
      ortho_delta: ortho,
      sbp: sbp,
      dbp: dbp,
      map: mapVal,
      pulse_pressure: ppVal,
      shock_index: siVal,
    });
  };

  const handleStartPause = () => {
    if (phase === 3) {
      // restart
      setPhase(1);
      setSecondsRemaining(90);
      setIsRunning(true);
    } else {
      setIsRunning(!isRunning);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setPhase(1);
    setSecondsRemaining(90);
  };

  const handleFastForward = () => {
    if (phase === 1) {
      // advance to end of phase 1
      setPhase(2);
      setSecondsRemaining(3);
      setIsRunning(true);
    } else if (phase === 2) {
      // finish phase 2
      setPhase(3);
      setSecondsRemaining(0);
      setIsRunning(false);
      triggerCompletion();
    } else {
      setPhase(1);
      setSecondsRemaining(2);
      setIsRunning(true);
    }
  };

  const orthoDelta = Math.round((standingHr - supineHr) * 10) / 10;
  const mapVal = Math.round((dbp + (sbp - dbp) / 3.0) * 10) / 10;
  const ppVal = Math.round((sbp - dbp) * 10) / 10;
  const siVal = Math.round((supineHr / sbp) * 100) / 100;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = phase === 1
    ? ((90 - secondsRemaining) / 90) * 50
    : phase === 2
    ? 50 + ((90 - secondsRemaining) / 90) * 50
    : 100;

  return (
    <div className="bg-[#E8EEF5] dark:bg-slate-900/90 border border-[#CBD5E1] dark:border-slate-800 rounded-xl p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
            3-Minute Orthostatic & Vitals Protocol Timer
          </span>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-400/30">
          {phase === 1
            ? 'Phase 1: Rest'
            : phase === 2
            ? 'Phase 2: Stand Challenge'
            : 'Protocol Completed'}
        </span>
      </div>

      {/* Timer Bar & Phase Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="font-bold text-slate-800 dark:text-slate-200">
            {phase === 1 && (
              <span>
                {isClinic
                  ? 'Phase 1 (90s): Quiet Supine / Bed Rest'
                  : 'Phase 1 (90s): Supine / Zero-G Baseline Rest'}
              </span>
            )}
            {phase === 2 && (
              <span>
                {isClinic
                  ? 'Phase 2 (90s): Active Upright Standing'
                  : 'Phase 2 (90s): Active Stand / LBNP Challenge (-30 mmHg)'}
              </span>
            )}
            {phase === 3 && (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 inline" /> 3-Min Protocol Complete — Hemodynamics Calculated
              </span>
            )}
          </div>
          <span className="font-mono text-base font-extrabold text-sky-600 dark:text-sky-400">
            {phase === 3 ? '00:00' : formatTime(secondsRemaining)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          {phase === 1 &&
            (isClinic
              ? 'Instruct patient to lie quietly flat for 90 seconds. Upper-arm cuff at heart level.'
              : 'Crewmember in supported supine or neutral zero-g posture. Recording baseline autonomic tone.')}
          {phase === 2 &&
            (isClinic
              ? 'Instruct patient to stand erect without moving. Recording postural heart rate surge.'
              : 'Stand test or activate LBNP chamber at -30 mmHg. Baroreceptor unloading challenge.')}
          {phase === 3 && 'Protocol complete. Calculated indices auto-populate into telemetry fields below.'}
        </p>
      </div>

      {/* Live Vitals Preview Inputs during Timer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
        <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <label className="text-[10px] font-bold text-slate-500 block">Supine HR (bpm)</label>
          <input
            type="number"
            value={supineHr}
            onChange={(e) => setSupineHr(Number(e.target.value))}
            className="w-full bg-transparent font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
          />
        </div>
        <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <label className="text-[10px] font-bold text-slate-500 block">Standing HR (bpm)</label>
          <input
            type="number"
            value={standingHr}
            onChange={(e) => setStandingHr(Number(e.target.value))}
            className="w-full bg-transparent font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
          />
        </div>
        <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <label className="text-[10px] font-bold text-slate-500 block">BP (SBP / DBP)</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={sbp}
              onChange={(e) => setSbp(Number(e.target.value))}
              className="w-12 bg-transparent font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
            />
            <span className="text-slate-400">/</span>
            <input
              type="number"
              value={dbp}
              onChange={(e) => setDbp(Number(e.target.value))}
              className="w-12 bg-transparent font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
        </div>
        <div className="p-2 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <label className="text-[10px] font-bold text-slate-500 block">Ortho HR Δ</label>
          <span className="font-mono font-extrabold text-amber-600 dark:text-amber-400 text-sm">
            +{orthoDelta} bpm
          </span>
        </div>
      </div>

      {/* Calculated Hemodynamics Live Strip */}
      <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] font-mono">
        <div>
          <span className="text-slate-500 block text-[9px] uppercase font-bold">Mean Arterial (MAP)</span>
          <span className="font-extrabold text-slate-900 dark:text-white">{mapVal} mmHg</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[9px] uppercase font-bold">Pulse Pressure (PP)</span>
          <span className={`font-extrabold ${ppVal < 25 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
            {ppVal} mmHg {ppVal < 25 && ' (Low)'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[9px] uppercase font-bold">Shock Index (SI)</span>
          <span className={`font-extrabold ${siVal >= 0.7 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
            {siVal} {siVal >= 0.7 ? '(High)' : '(Norm)'}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleStartPause}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition-colors shadow-2xs"
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> {phase === 3 ? 'Restart Timer' : 'Start Protocol'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Reset Timer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Fast-Forward Protocol Button */}
        <button
          type="button"
          onClick={handleFastForward}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
          title="Instantly advance protocol sequence timer"
        >
          <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          <span>Fast-Forward Protocol</span>
          <FastForward className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
