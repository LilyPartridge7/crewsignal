import React, { useMemo, useState } from 'react';
import { ArrowUpRight, HelpCircle, LayoutDashboard } from 'lucide-react';
import { DashboardData } from '../types';
import { NavTabId } from './Navbar';

interface LandingHomeViewProps {
  theme: 'dark' | 'light';
  operationalMode: 'spacecraft' | 'clinic';
  onLaunchConsole: (tab: NavTabId, scenario?: { astronautId: string; phase: string }) => void;
  onOpenPiP: (funcId: string | number) => void;
  currentData?: DashboardData | null;
}

type Verdict = 'go' | 'assist' | 'down';

const VERDICT_COPY: Record<Verdict, { word: string; note: string; tone: string; dot: string }> = {
  go: { word: 'Clear to stand', note: 'Brain perfusion holds when upright. Stand and walk unassisted.', tone: 'text-cs-good', dot: 'bg-cs-good' },
  assist: { word: 'Assist to stand', note: 'Borderline perfusion. Stand only with a crewmate holding on.', tone: 'text-cs-warn', dot: 'bg-cs-warn' },
  down: { word: 'Stay lying down', note: 'Perfusion would fall below the fainting floor. Fluids and compression first.', tone: 'text-cs-bad', dot: 'bg-cs-bad' },
};

const GRAVITY = [
  { g: 0, label: 'Zero g' },
  { g: 0.16, label: 'Moon' },
  { g: 0.38, label: 'Mars' },
  { g: 1, label: 'Earth' },
];

const SCENARIOS = [
  {
    title: 'Splashdown, day one',
    gravity: 'Earth, 1g',
    body: 'Stand-up heart rate jumps 34 bpm and plasma is down 14%.',
    verdict: 'down' as Verdict,
    astronautId: 'SYNTH-AST-01',
    phase: 'Early Postflight (1g Return)',
  },
  {
    title: 'First lunar walk',
    gravity: 'Moon, 0.16g',
    body: 'A short pressure column keeps the brain well supplied.',
    verdict: 'go' as Verdict,
    astronautId: 'SYNTH-AST-01',
    phase: 'Planetary/Lunar Surface (Partial-g)',
  },
  {
    title: 'Mars cruise check-in',
    gravity: 'Transit, 0g',
    body: 'Fluid sits high in the head. Tracking the baseline for arrival.',
    verdict: 'assist' as Verdict,
    astronautId: 'SYNTH-AST-01',
    phase: 'In-Flight (0g Transit)',
  },
  {
    title: 'Arctic clinic triage',
    gravity: 'Earth, 1g',
    body: 'The same logic helps remote clinics judge fainting risk.',
    verdict: 'assist' as Verdict,
    astronautId: 'SYNTH-AST-02',
    phase: 'Early Postflight (1g Return)',
  },
];

function Slider({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const id = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-cs-muted">
          {label}
        </label>
        <span className="cs-num text-lg font-bold">
          {value}
          <span className="ml-1 text-xs font-semibold text-cs-muted">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="h-2 w-full cursor-pointer accent-[#FFB59A]"
      />
    </div>
  );
}

export const LandingHomeView: React.FC<LandingHomeViewProps> = ({ operationalMode, onLaunchConsole, onOpenPiP, currentData }) => {
  const isClinic = operationalMode === 'clinic';
  const [g, setG] = useState(1);
  const [hr, setHr] = useState(96);
  const [sbp, setSbp] = useState(104);
  const [dbp, setDbp] = useState(68);

  const calc = useMemo(() => {
    const mapHeart = dbp + (sbp - dbp) / 3;
    const drop = g * 26.5; // heart-to-brain hydrostatic column, mmHg at 1g
    const icp = 9.5 + (1 - g) * 5;
    const cpp = Math.round((mapHeart - drop - icp) * 10) / 10;
    const pp = sbp - dbp;
    const si = Math.round((hr / sbp) * 100) / 100;
    const jump = Math.max(0, hr - 72);
    const verdict: Verdict = cpp < 50 ? 'down' : cpp < 60 || si >= 0.8 ? 'assist' : 'go';
    return { mapHeart: Math.round(mapHeart * 10) / 10, drop: Math.round(drop * 10) / 10, cpp, pp, si, jump, verdict };
  }, [g, hr, sbp, dbp]);

  const live: Verdict | null = currentData?.flight_rules
    ? currentData.flight_rules.overall_status === 'GO'
      ? 'go'
      : currentData.flight_rules.overall_status === 'CAUTION'
      ? 'assist'
      : 'down'
    : null;

  const v = VERDICT_COPY[calc.verdict];
  const marker = Math.max(0, Math.min(100, ((calc.cpp - 30) / 50) * 100));

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-10 px-1 pb-10 pt-6 sm:gap-14 sm:px-4 sm:pt-12 lg:px-8">
        {/* Hero */}
        <section className="flex max-w-[680px] flex-col gap-6">
          <h1 className="text-[44px] font-extrabold leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-[76px]">
            Know when your crew can stand.
          </h1>
          <p className="max-w-[34rem] text-lg leading-relaxed text-cs-muted">
            {isClinic
              ? 'In a remote clinic, CrewSignal reads a patient against their own baseline and says whether standing is safe, without waiting for a specialist.'
              : 'After landing, Earth is up to 22 minutes away. CrewSignal reads each astronaut against their own preflight baseline and the gravity they just landed in, then says go, assist or stay down.'}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => onLaunchConsole('overview')} className="cs-btn-primary !min-h-[52px] !px-6 text-base">
              <LayoutDashboard className="h-4 w-4" strokeWidth={2.2} />
              Open flight console
            </button>
            {live && currentData && (
              <button
                type="button"
                onClick={() => onLaunchConsole('overview')}
                className="cs-btn-ghost !min-h-[52px] backdrop-blur-md"
                title="Open this crew member's overview"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${VERDICT_COPY[live].dot}`} />
                <span>
                  {currentData.astronaut.id === 'SYNTH-AST-01' ? 'A-01' : 'B-02'} right now: <strong>{VERDICT_COPY[live].word}</strong>
                </span>
              </button>
            )}
          </div>
        </section>

        {/* Stand-up check */}
        <section className="cs-panel grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_1fr] lg:gap-10" aria-labelledby="standup-check">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="standup-check" className="text-xl font-bold tracking-tight">
                Try the stand-up check
              </h2>
              <div className="cs-seg" role="group" aria-label="Landing gravity">
                {GRAVITY.map((o) => (
                  <button key={o.label} type="button" aria-pressed={g === o.g} onClick={() => setG(o.g)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Slider label="Standing heart rate" unit="bpm" value={hr} min={55} max={145} onChange={setHr} />
              <Slider
                label="Systolic"
                unit="mmHg"
                value={sbp}
                min={80}
                max={140}
                onChange={(val) => {
                  setSbp(val);
                  if (val <= dbp + 10) setDbp(val - 15);
                }}
              />
              <Slider
                label="Diastolic"
                unit="mmHg"
                value={dbp}
                min={50}
                max={95}
                onChange={(val) => {
                  setDbp(val);
                  if (val >= sbp - 10) setSbp(val + 15);
                }}
              />
            </div>
            <p className="text-sm leading-relaxed text-cs-muted">
              Change the landing site to see why the same vitals can be safe on the Moon and unsafe on Earth: the column of blood
              between heart and brain weighs more in stronger gravity.
            </p>
          </div>

          <div className="flex flex-col gap-5 rounded-[22px] border border-cs-line bg-cs-panel-strong p-5 sm:p-6" aria-live="polite">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-cs-muted">Verdict at {GRAVITY.find((o) => o.g === g)?.label}</span>
              <span className={`text-4xl font-extrabold tracking-tight sm:text-5xl ${v.tone}`}>{v.word}</span>
              <span className="text-[15px] leading-snug text-cs-muted">{v.note}</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-cs-muted">Brain perfusion</span>
                <span className="cs-num text-2xl font-bold">
                  {calc.cpp}
                  <span className="ml-1 text-xs font-semibold text-cs-muted">mmHg</span>
                </span>
              </div>
              <div className="relative h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg, var(--cs-bad) 0 40%, var(--cs-warn) 40% 60%, var(--cs-good) 60% 100%)' }}>
                <span
                  className="absolute -top-1.5 h-[22px] w-[22px] -translate-x-1/2 rounded-full border-[3px] border-cs-panel-strong bg-cs-text shadow transition-[left] duration-300"
                  style={{ left: `${marker}%` }}
                />
              </div>
              <div className="flex justify-between text-xs font-semibold text-cs-muted">
                <span>30</span>
                <span>Fainting floor 50</span>
                <span>80</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['Stand-up jump', `+${calc.jump} bpm`],
                ['Shock index', calc.si.toFixed(2)],
                ['Pulse pressure', `${calc.pp} mmHg`],
                ['Heart-to-brain drop', `${calc.drop} mmHg`],
              ].map(([k, val]) => (
                <div key={k} className="cs-well flex items-center justify-between gap-2 px-3 py-2.5">
                  <dt className="text-cs-muted">{k}</dt>
                  <dd className="cs-num font-bold">{val}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Scenarios */}
        <section className="flex flex-col gap-4" aria-labelledby="scenarios">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="scenarios" className="text-xl font-bold tracking-tight">
              Open a mission moment
            </h2>
            <button type="button" onClick={() => onOpenPiP(0)} className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-cs-accent-text hover:underline">
              <HelpCircle className="h-4 w-4" strokeWidth={2} />
              How each feature works
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SCENARIOS.map((sc) => {
              const vc = VERDICT_COPY[sc.verdict];
              return (
                <button
                  key={sc.title}
                  type="button"
                  onClick={() => onLaunchConsole('overview', { astronautId: sc.astronautId, phase: sc.phase })}
                  className="cs-panel group flex flex-col gap-3 !rounded-[22px] p-5 text-left transition-colors hover:bg-cs-panel-strong"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-cs-muted">{sc.gravity}</span>
                    <ArrowUpRight className="h-4 w-4 text-cs-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={2} />
                  </div>
                  <span className="text-lg font-bold leading-tight">{sc.title}</span>
                  <span className="text-sm leading-relaxed text-cs-muted">{sc.body}</span>
                  <span className={`mt-auto inline-flex items-center gap-2 text-sm font-bold ${vc.tone}`}>
                    <span className={`h-2 w-2 rounded-full ${vc.dot}`} />
                    {vc.word}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* What sets it apart */}
        <section className="grid gap-6 border-t border-cs-line pt-8 md:grid-cols-3">
          {[
            ['Judged against the person', 'Thirty days of preflight vitals set each astronaut’s own normal range, so a 30 bpm jump is read in context.'],
            ['Corrected for local gravity', 'The heart-to-brain pressure drop is worked out for zero g, the Moon, Mars and Earth, so a Moon walk and a splashdown are not treated alike.'],
            ['A plan, not just an alarm', 'Every verdict comes with fluids, compression and a projected time until the crew member can stand on their own.'],
          ].map(([title, body]) => (
            <div key={title} className="flex flex-col gap-2">
              <h3 className="text-base font-bold">{title}</h3>
              <p className="text-sm leading-relaxed text-cs-muted">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default LandingHomeView;
