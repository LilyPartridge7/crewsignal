import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Check, CheckCircle2, FastForward, HelpCircle, Pause, Play, RotateCcw } from 'lucide-react';
import { DashboardData, KpiMetric } from '../types';
import { BodyMap3D, BodyHotspot } from './BodyMap3D';
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

type Tone = 'alert' | 'watch' | 'ok';

const toneOf = (kpi?: KpiMetric | null): Tone => {
  const s = kpi?.status || '';
  if (/action|alert/i.test(s)) return 'alert';
  if (/watch|review/i.test(s)) return 'watch';
  return 'ok';
};
const TONE_TEXT: Record<Tone, string> = { alert: 'text-cs-bad', watch: 'text-cs-warn', ok: 'text-cs-good' };
const TONE_WORD: Record<Tone, string> = { alert: 'Act now', watch: 'Watch', ok: 'In range' };

const fmt = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? '—' : Number(n).toFixed(digits).replace(/\.0$/, ''));
const signed = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${fmt(n)}`);

const GRAVITY = [
  { g: 0, label: 'Zero g' },
  { g: 0.16, label: 'Moon' },
  { g: 0.38, label: 'Mars' },
  { g: 1, label: 'Earth' },
];

export const OverviewView: React.FC<OverviewViewProps> = ({ data, theme, operationalMode, onRefresh, onSelectIndicator, onOpenPiP }) => {
  const isClinic = operationalMode === 'clinic';
  const kpis = data.kpis;
  const pattern = data.coupled_pattern;

  const [selected, setSelected] = useState<string>('baro');
  const [simG, setSimG] = useState<number>(data.gravity_g ?? 1);
  const [showCV, setShowCV] = useState(false);
  useEffect(() => setSimG(data.gravity_g ?? 1), [data.gravity_g]);

  // ---- stand test form ----
  const [supine, setSupine] = useState('72');
  const [stand, setStand] = useState('90');
  const [sbp, setSbp] = useState('115');
  const [dbp, setDbp] = useState('75');
  const [context, setContext] = useState('Morning Fasted Rest');
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cmBusy, setCmBusy] = useState(false);
  const [cmFeedback, setCmFeedback] = useState<string | null>(null);

  const jump = useMemo(() => {
    const a = parseFloat(stand);
    const b = parseFloat(supine);
    return isNaN(a) || isNaN(b) ? 0 : Math.round((a - b) * 10) / 10;
  }, [stand, supine]);
  const jumpTone: Tone = jump >= 28 ? 'alert' : jump >= 18 ? 'watch' : 'ok';

  // ---- hemodynamics at the chosen gravity ----
  const hemo = useMemo(() => {
    const s = parseFloat(sbp) || 115;
    const d = parseFloat(dbp) || 75;
    const mapHeart = d + (s - d) / 3;
    const drop = Math.max(0, simG) * 26.5;
    const icp = 9.5 + (1 - Math.min(1, Math.max(0, simG))) * 5;
    const cpp = Math.round((Math.max(10, mapHeart - drop) - icp) * 10) / 10;
    const pvPct = data.active_phase.toLowerCase().includes('postflight') ? -14.2 : -11.5;
    const deficit = Math.round(75 * 0.2 * (Math.abs(pvPct) / 100) * 1000);
    const fluids = Math.min(1500, Math.max(500, Math.round((deficit * 0.65) / 50) * 50));
    return { mapHeart: Math.round(mapHeart * 10) / 10, drop: Math.round(drop * 10) / 10, icp: Math.round(icp * 10) / 10, cpp, pvPct, deficit, fluids, pool: Math.round(simG * 600) };
  }, [sbp, dbp, simG, data.active_phase]);

  const derived = data.derived_hemodynamics;
  const map = derived?.map_mmhg ?? hemo.mapHeart;
  const pp = derived?.pulse_pressure_mmhg ?? null;
  const si = derived?.shock_index ?? null;

  // ---- verdict ----
  const overall = data.flight_rules?.overall_status ?? (pattern.severity === 'CRITICAL_ACTION' ? 'NO-GO' : pattern.severity === 'WATCH_REVIEW' ? 'CAUTION' : 'GO');
  const verdict =
    overall === 'GO'
      ? { word: 'Clear to stand', tone: 'ok' as Tone, line: 'Vitals sit inside this crew member’s own preflight range.' }
      : overall === 'CAUTION'
      ? { word: 'Assist to stand', tone: 'watch' as Tone, line: 'Stand only with a crewmate holding on, then retest.' }
      : { word: 'Stay lying down', tone: 'alert' as Tone, line: 'Fluids and compression first. No standing until the next test passes.' };
  const eta = overall === 'GO' ? 'Now' : overall === 'CAUTION' ? '~18 h' : '~36 h';

  // ---- timer ----
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const [secs, setSecs] = useState(90);
  useEffect(() => {
    if (!running) return;
    if (secs === 0) {
      if (phase === 1) {
        setPhase(2);
        setSecs(90);
      } else {
        setPhase(3);
        setRunning(false);
      }
      return;
    }
    const id = setTimeout(() => setSecs((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [running, secs, phase]);
  const toggleTimer = () => {
    if (phase === 3) {
      setPhase(1);
      setSecs(90);
      setRunning(true);
    } else setRunning((r) => !r);
  };
  const skipTimer = () => {
    if (phase === 1) {
      setPhase(2);
      setSecs(90);
    } else if (phase === 2) {
      setPhase(3);
      setSecs(0);
      setRunning(false);
      if (!dirty) {
        setSupine('72');
        setStand('102');
        setSbp('108');
        setDbp('70');
      }
    }
  };
  const resetTimer = () => {
    setRunning(false);
    setPhase(1);
    setSecs(90);
  };
  const ringPct = phase === 3 ? 100 : ((90 - secs) / 90) * 100;

  const logResult = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      await postMeasurement({
        astronaut_id: data.astronaut.id,
        mission_day: data.mission_day,
        phase_name: data.active_phase,
        resting_hr: parseFloat(supine),
        systolic_bp: parseFloat(sbp),
        diastolic_bp: parseFloat(dbp),
        orthostatic_hr_delta: jump,
        activity_context: `Stand test [${context}]`,
        collection_context: context,
        notes: `Stand test: lying HR ${supine}, standing HR ${stand}, BP ${sbp}/${dbp}, jump ${jump} bpm`,
      });
      setFeedback('Logged');
      setDirty(false);
      onRefresh();
      setTimeout(() => setFeedback(null), 2500);
    } catch {
      setFeedback('Could not log. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const markCountermeasures = async () => {
    setCmBusy(true);
    setCmFeedback(null);
    try {
      await postMeasurement({
        astronaut_id: data.astronaut.id,
        mission_day: data.mission_day,
        phase_name: data.active_phase,
        resting_hr: parseFloat(supine),
        systolic_bp: parseFloat(sbp),
        diastolic_bp: parseFloat(dbp),
        orthostatic_hr_delta: jump,
        activity_context: 'Countermeasure Compliance',
        collection_context: 'Countermeasure Executed',
        notes: `Countermeasure Executed: ${(pattern.immediate_action || data.structured_insight.recommended_crew_action).slice(0, 160)}`,
      });
      setCmFeedback('Marked done');
      onRefresh();
      setTimeout(() => setCmFeedback(null), 3000);
    } catch {
      setCmFeedback('Could not save. Try again.');
    } finally {
      setCmBusy(false);
    }
  };

  // ---- body regions ----
  const cppTone: Tone = hemo.cpp < 50 ? 'alert' : hemo.cpp < 60 ? 'watch' : 'ok';
  const regions: (BodyHotspot & { title: string; body: string; pip: string })[] = [
    {
      id: 'brain',
      label: 'Brain perfusion',
      indicator: 'orthostatic_hr_delta',
      value: `${fmt(hemo.cpp)} mmHg`,
      status: cppTone,
      position: [0, 1.64, 0.1],
      anchor: 'brain',
      title: hemo.cpp < 50 ? 'Upright, the brain would get too little blood' : hemo.cpp < 60 ? 'Brain blood supply is borderline when upright' : 'The brain stays well supplied when upright',
      body: `At ${GRAVITY.find((o) => o.g === simG)?.label ?? `${simG}g`}, the column between heart and brain costs ${fmt(hemo.drop)} mmHg. Mean pressure at the heart is ${fmt(hemo.mapHeart)} and pressure inside the skull about ${fmt(hemo.icp)}, which leaves ${fmt(hemo.cpp)} mmHg to push blood through the brain. Below 50, fainting becomes likely.`,
      pip: 'derived_hemodynamics',
    },
    {
      id: 'baro',
      label: 'Stand-up reflex',
      indicator: 'orthostatic_hr_delta',
      value: `${signed(kpis.orthostatic_hr_delta?.value)} bpm`,
      status: toneOf(kpis.orthostatic_hr_delta),
      position: [-0.05, 1.3, 0.05],
      anchor: 'carotid_r@0.5',
      title: 'How hard the heart works to stand up',
      body: `Heart rate rises ${signed(kpis.orthostatic_hr_delta?.value)} bpm on standing, against a preflight normal of ${fmt(kpis.orthostatic_hr_delta?.baseline_mean)} ± ${fmt(kpis.orthostatic_hr_delta?.baseline_std)}. That is ${signed(kpis.orthostatic_hr_delta?.z_score)} standard deviations from this crew member's own baseline.`,
      pip: 'orthostatic_timer',
    },
    {
      id: 'heart',
      label: 'Resting heart',
      indicator: 'resting_hr',
      value: `${fmt(kpis.resting_hr?.value)} bpm`,
      status: toneOf(kpis.resting_hr),
      position: [0.04, 0.79, 0.11],
      anchor: 'heart',
      title: 'Resting heart rate',
      body: `${fmt(kpis.resting_hr?.value)} bpm now, ${signed(kpis.resting_hr?.delta)} on the preflight average of ${fmt(kpis.resting_hr?.baseline_mean)}. A higher resting rate after landing usually reflects lower plasma volume and settles over one to three days as fluid returns.`,
      pip: 'personal_baseline',
    },
    {
      id: 'aorta',
      label: 'Blood pressure',
      indicator: 'systolic_bp',
      value: `${fmt(kpis.systolic_bp?.value, 0)}/${fmt(kpis.diastolic_bp?.value, 0)}`,
      status: toneOf(kpis.systolic_bp),
      position: [-0.01, 0.42, -0.03],
      anchor: 'aorta@0.3',
      title: 'Arterial pressure',
      body: `Systolic ${fmt(kpis.systolic_bp?.value, 0)} mmHg against a preflight ${fmt(kpis.systolic_bp?.baseline_mean, 0)} ± ${fmt(kpis.systolic_bp?.baseline_std)}. Pulse pressure ${fmt(pp)} mmHg and a shock index of ${fmt(si, 2)} say how much blood each beat still moves.`,
      pip: 'derived_hemodynamics',
    },
    {
      id: 'legs',
      label: 'Leg pooling',
      indicator: 'cumulative_radiation_msv',
      value: `~${hemo.pool} mL`,
      status: simG >= 0.9 ? 'watch' : 'ok',
      position: [0.15, -1.25, 0.04],
      anchor: 'veins_leg_l@0.3',
      title: simG === 0 ? 'In zero g, fluid rides up into the head' : `About ${hemo.pool} mL drops into the legs`,
      body: `After months without gravity the leg veins have lost tone. Plasma is down about ${Math.abs(hemo.pvPct)}% (roughly ${hemo.deficit} mL). Calf compression at 40–50 mmHg pushes blood back toward the heart. Bone-marrow radiation dose so far: ${fmt(kpis.cumulative_radiation_msv?.value)} mSv of a 1,000 mSv career limit.`,
      pip: 'body_map',
    },
  ];
  const sel = regions.find((r) => r.id === selected) ?? regions[1];
  const pick = (id: string, indicator: string) => {
    setSelected(id);
    onSelectIndicator(indicator);
  };

  const actions = (pattern.immediate_action || data.structured_insight.recommended_crew_action)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5)
    .slice(0, 3);

  const VitalCard = ({ r }: { r: (typeof regions)[number] }) => {
    const on = r.id === selected;
    return (
      <button
        type="button"
        onClick={() => pick(r.id, r.indicator)}
        aria-pressed={on}
        className={`cs-panel flex flex-col gap-1.5 !rounded-[22px] p-4 text-left transition-colors ${on ? '!border-cs-accent !bg-cs-panel-strong' : 'hover:!bg-cs-panel-strong'}`}
      >
        <span className="text-sm font-semibold text-cs-muted">{r.label}</span>
        <span className="cs-num text-[28px] font-bold leading-none">{r.value}</span>
        <span className={`text-sm font-semibold ${TONE_TEXT[r.status]}`}>{TONE_WORD[r.status]}</span>
      </button>
    );
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-3 pb-6 sm:gap-4">
        {/* Verdict strip */}
        <section className="cs-panel flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-6" aria-live="polite">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1">
            <span className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${TONE_TEXT[verdict.tone]}`}>{verdict.word}</span>
            <div className="min-w-0">
              <p className="font-semibold">{data.astronaut.id === 'SYNTH-AST-01' ? 'Crew A-01' : 'Crew B-02'}, day {data.mission_day}, {data.active_phase.replace(/\s*\(.*\)/, '').toLowerCase()}</p>
              <p className="text-sm text-cs-muted">{verdict.line}</p>
            </div>
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-cs-muted">Unassisted standing</dt>
              <dd className="cs-num text-lg font-bold">{eta}</dd>
            </div>
            <div>
              <dt className="text-cs-muted">Pattern</dt>
              <dd className="text-lg font-bold">{pattern.signature_name.split('(')[0].trim()}</dd>
            </div>
          </dl>
        </section>

        {/* Body + vitals */}
        <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(200px,1fr)_minmax(0,1.6fr)_minmax(200px,1fr)]">
          <div className="order-2 grid grid-cols-2 gap-3 lg:order-none lg:grid-cols-1 lg:content-start">
            {regions.slice(0, 3).map((r) => (
              <VitalCard key={r.id} r={r} />
            ))}
          </div>

          <div className="cs-panel order-1 flex min-h-[460px] flex-col overflow-hidden !rounded-[28px] lg:order-none lg:min-h-[540px]">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold">Body and fluid shift</h2>
                <button type="button" onClick={() => onOpenPiP('body_map')} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-cs-muted hover:text-cs-text" aria-label="How the body map works">
                  <HelpCircle className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <div className="cs-seg" role="group" aria-label="Gravity">
                {GRAVITY.map((o) => (
                  <button key={o.label} type="button" aria-pressed={simG === o.g} onClick={() => setSimG(o.g)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative min-h-0 flex-1">
              <BodyMap3D hotspots={regions} selectedHotspot={selected} onSelectHotspot={pick} gravityG={simG} heartRate={kpis.resting_hr?.value ?? 72} theme={theme} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-xs font-semibold text-cs-muted">
              <span className="inline-flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#4c9dff]" />Toward the head</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#ff6178]" />Pooled in the legs</span>
              </span>
              <span>Drag to turn, tap a point for detail</span>
            </div>
          </div>

          <div className="order-3 grid grid-cols-2 gap-3 lg:grid-cols-1 lg:content-start">
            {regions.slice(3).map((r) => (
              <VitalCard key={r.id} r={r} />
            ))}
            <div className="cs-panel flex flex-col gap-1.5 !rounded-[22px] p-4">
              <span className="text-sm font-semibold text-cs-muted">Mean pressure</span>
              <span className="cs-num text-[28px] font-bold leading-none">{fmt(map)}</span>
              <span className={`text-sm font-semibold ${map >= 65 ? 'text-cs-good' : 'text-cs-bad'}`}>{map >= 65 ? 'Above 65 target' : 'Below 65 target'}</span>
            </div>
          </div>
        </section>

        {/* Detail + plan + stand test */}
        <section className="grid gap-3 sm:gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="cs-panel flex flex-col gap-5 !rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className={`text-sm font-bold ${TONE_TEXT[sel.status]}`}>{sel.label}</span>
                <button type="button" onClick={() => onOpenPiP(sel.pip)} className="inline-flex min-h-[36px] items-center gap-1.5 text-sm font-semibold text-cs-accent-text hover:underline">
                  <HelpCircle className="h-4 w-4" strokeWidth={2} />
                  Explain this
                </button>
              </div>
              <h3 className="text-xl font-bold leading-snug tracking-tight">{sel.title}</h3>
              <p className="max-w-[62ch] text-[15px] leading-relaxed text-cs-muted">{sel.body}</p>
            </div>

            <div className="flex flex-col gap-3 border-t border-cs-line pt-5">
              <h3 className="text-base font-bold">{isClinic ? 'Do next' : 'Do now'}</h3>
              <ol className="flex flex-col gap-2">
                {[...actions, `Drink ${hemo.fluids} mL of isotonic electrolyte solution, not plain water.`].slice(0, 4).map((a, i) => (
                  <li key={i} className="cs-well flex gap-3 px-4 py-3 text-[15px] leading-snug">
                    <span className="cs-num font-bold text-cs-accent-text">{i + 1}</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
              <button type="button" onClick={markCountermeasures} disabled={cmBusy} className="cs-btn-primary self-start">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                {cmBusy ? 'Saving…' : cmFeedback ?? 'Mark these done'}
              </button>
            </div>
          </div>

          <form onSubmit={logResult} className="cs-panel flex flex-col gap-5 !rounded-[28px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold">Three-minute stand test</h2>
              <button type="button" onClick={() => onOpenPiP('orthostatic_timer')} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-cs-muted hover:text-cs-text" aria-label="How the stand test works">
                <HelpCircle className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div
                className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(var(--cs-accent) ${ringPct}%, var(--cs-well) 0)` }}
                role="timer"
                aria-label={`${secs} seconds left`}
              >
                <span className="cs-num flex h-[74px] w-[74px] items-center justify-center rounded-full bg-cs-panel-strong text-xl font-bold">
                  {phase === 3 ? 'Done' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-bold">{phase === 1 ? 'Lie flat' : phase === 2 ? 'Stand, with a spotter' : 'Test complete'}</span>
                <span className="text-sm text-cs-muted">{phase === 1 ? 'Rest 90 s, then take a lying heart rate.' : phase === 2 ? 'Stand 90 s, then take a standing heart rate.' : 'Enter the numbers and log the result.'}</span>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" onClick={toggleTimer} className="cs-btn-primary !h-11 !w-11 !min-h-0 !px-0" aria-label={running ? 'Pause timer' : 'Start timer'}>
                  {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button type="button" onClick={skipTimer} className="cs-btn-ghost !h-11 !w-11 !min-h-0 !px-0" aria-label="Skip to next step">
                  <FastForward className="h-4 w-4" />
                </button>
                <button type="button" onClick={resetTimer} className="cs-btn-ghost !h-11 !w-11 !min-h-0 !px-0" aria-label="Reset timer">
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['Lying heart rate', supine, setSupine],
                  ['Standing heart rate', stand, setStand],
                  ['Systolic', sbp, setSbp],
                  ['Diastolic', dbp, setDbp],
                ] as [string, string, (v: string) => void][]
              ).map(([label, val, set]) => (
                <label key={label} className="flex flex-col gap-1.5 text-sm font-semibold text-cs-muted">
                  {label}
                  <input
                    type="number"
                    inputMode="numeric"
                    value={val}
                    required
                    onChange={(e) => {
                      set(e.target.value);
                      setDirty(true);
                    }}
                    className="cs-input [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </label>
              ))}
            </div>

            <div className="cs-well flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-cs-muted">Stand-up jump</span>
              <span className="flex items-baseline gap-2">
                <span className="cs-num text-lg font-bold">{signed(jump)} bpm</span>
                <span className={`text-sm font-semibold ${TONE_TEXT[jumpTone]}`}>{TONE_WORD[jumpTone]}</span>
              </span>
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-semibold text-cs-muted">
              When was this taken
              <select value={context} onChange={(e) => { setContext(e.target.value); setDirty(true); }} className="cs-input !font-medium">
                <option value="Morning Fasted Rest">Morning, before eating</option>
                <option value="Post-Exercise (<30 min)">Within 30 min of exercise</option>
                <option value="Post-EVA">After a spacewalk</option>
                <option value="Acute Check">Spot check</option>
              </select>
            </label>

            <div className="mt-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowCV(true)} className="cs-btn-ghost flex-1">
                <Camera className="h-4 w-4" strokeWidth={2} />
                Read cuff with camera
              </button>
              <button type="submit" disabled={submitting} className="cs-btn-primary flex-1">
                <Check className="h-4 w-4" strokeWidth={2} />
                {submitting ? 'Logging…' : feedback ?? 'Log result'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {showCV && (
        <VisionVitalsCapture
          isOpen={showCV}
          onClose={() => setShowCV(false)}
          onConfirmValues={(v) => {
            setSbp(String(v.sbp));
            setDbp(String(v.dbp));
            setSupine(String(v.hr));
            setStand(String(v.hr + (jump || 18)));
            setDirty(true);
            setShowCV(false);
          }}
        />
      )}
    </div>
  );
};

export default OverviewView;
