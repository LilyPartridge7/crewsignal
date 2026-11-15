import React, { useState, useMemo } from 'react';
import {
  Compass,
  Zap,
  Play,
  LayoutDashboard,
  ShieldCheck,
  Orbit,
  Heart,
  Gauge,
  Activity,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { DashboardData } from '../types';
import { NavTabId } from './Navbar';

interface LandingHomeViewProps {
  theme: 'dark' | 'light';
  operationalMode: 'spacecraft' | 'clinic';
  onLaunchConsole: (tab: NavTabId, scenario?: { astronautId: string; phase: string }) => void;
  onOpenPiP: (funcId: string | number) => void;
  currentData?: DashboardData | null;
}

export const LandingHomeView: React.FC<LandingHomeViewProps> = ({
  theme: _theme,
  operationalMode,
  onLaunchConsole,
  onOpenPiP,
  currentData: _currentData,
}) => {
  const isClinic = operationalMode === 'clinic';

  // 20-Second Interactive Live Sandbox Sliders State
  const [sandboxGravityG, setSandboxGravityG] = useState<number>(1.0);
  const [sandboxHr, setSandboxHr] = useState<number>(96);
  const [sandboxSbp, setSandboxSbp] = useState<number>(104);
  const [sandboxDbp, setSandboxDbp] = useState<number>(68);

  // Live Reactive Biophysics Calculation for the 20-Second Test
  const liveCalc = useMemo(() => {
    const mapHeart = Math.round((sandboxDbp + (sandboxSbp - sandboxDbp) / 3.0) * 10) / 10;
    const deltaHydro = Math.round(sandboxGravityG * 26.5 * 10) / 10;
    const mapBrain = Math.round(Math.max(10, mapHeart - deltaHydro) * 10) / 10;
    const icp = Math.round((9.5 + (1.0 - Math.min(1.0, Math.max(0, sandboxGravityG))) * 5.0) * 10) / 10;
    const cpp = Math.round((mapBrain - icp) * 10) / 10;

    const pp = sandboxSbp - sandboxDbp;
    const shockIndex = Math.round((sandboxHr / sandboxSbp) * 100) / 100;
    const orthoDelta = Math.round(Math.max(0, sandboxHr - 72) * 10) / 10;

    // Flight Rule MED-B13-102 Criteria
    const passMap = mapHeart >= 65.0;
    const passOrtho = orthoDelta < 25.0;
    const passShock = shockIndex < 0.70;
    const passPp = pp >= 25.0;
    const passCpp = cpp >= 50.0;
    const flightRulePass = passMap && passOrtho && passShock && passPp && passCpp;

    const isCriticalCpp = cpp < 50.0;
    const isWatchCpp = cpp < 60.0;

    // Plasma Volume Deficit & Saline Prescriber
    const pvDeficitPct = sandboxGravityG > 0.5 ? -14.2 : -11.5;
    const fluidDeficitMl = Math.round(75 * 0.20 * (Math.abs(pvDeficitPct) / 100) * 1000);
    const oralSalineTarget = Math.min(1500, Math.max(500, Math.round((fluidDeficitMl * 0.65) / 50) * 50));

    return {
      mapHeart,
      deltaHydro,
      mapBrain,
      icp,
      cpp,
      pp,
      shockIndex,
      orthoDelta,
      flightRulePass,
      isCriticalCpp,
      isWatchCpp,
      pvDeficitPct,
      fluidDeficitMl,
      oralSalineTarget,
    };
  }, [sandboxGravityG, sandboxHr, sandboxSbp, sandboxDbp]);

  const missionScenarios = [
    {
      id: 'scenario-1',
      title: 'Earth Landing Presyncope',
      astronautId: 'SYNTH-AST-01',
      phase: 'Early Postflight (1g Return)',
      badge: 'Z-Score +12.0',
      badgeColor: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
      description: 'Severe postflight orthostatic tachycardia (Δ34 bpm), contracted plasma volume (-14.2%), and narrowed pulse pressure.',
      ruleStatus: 'NO-GO (MANDATORY RECUMBENCY)',
    },
    {
      id: 'scenario-2',
      title: 'Lunar Surface Ambulation',
      astronautId: 'SYNTH-AST-01',
      phase: 'Planetary/Lunar Surface (Partial-g)',
      badge: '0.16g Lunar',
      badgeColor: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
      description: 'Reduced partial-gravity hydrostatic gradient (ΔP ~4.2 mmHg). Cerebral perfusion sustained above 70 mmHg.',
      ruleStatus: 'GO (AMBULATION CLEAR)',
    },
    {
      id: 'scenario-3',
      title: 'Mars Transit 0g Cruise',
      astronautId: 'SYNTH-AST-01',
      phase: 'In-Flight (0g Transit)',
      badge: '0g Microgravity',
      badgeColor: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
      description: 'Cephalad venous fluid redistribution, elevated ICP (14.5 mmHg), and progressive vascular deconditioning.',
      ruleStatus: 'IN-TRANSIT MONITORING',
    },
    {
      id: 'scenario-4',
      title: 'Svalbard Arctic Clinic',
      astronautId: 'SYNTH-AST-02',
      phase: 'Early Postflight (1g Return)',
      badge: 'Dual-Use Telehealth',
      badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      description: 'Translating spaceflight autonomic deconditioning to rural/isolated polar clinic patient triage.',
      ruleStatus: 'DUAL-USE ACTIVE',
    },
  ];

  return (
    <div className="max-w-[1440px] w-full mx-auto flex-1 min-h-0 flex flex-col gap-3 select-none overflow-y-auto pr-1">
      {/* ========================================================================= */}
      {/* HERO SECTION: High-Impact Typography & 1-Sentence Value Proposition       */}
      {/* ========================================================================= */}
      <div className={`p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
        isClinic
          ? 'border-emerald-500/20 bg-emerald-500/10 dark:bg-[#061914]/50 shadow-sm'
          : 'border-transparent dark:border-white/10 bg-white/25 dark:bg-[#0B1120]/50 shadow-sm'
      } backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-6 shrink-0`}>
        {/* Subtle HUD Corner Reticles */}
        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-sky-400/40 rounded-tl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-sky-400/40 rounded-br pointer-events-none" />

        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold tracking-wide px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-900 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" strokeWidth={2} />
              Challenge: Create Health Monitoring Software for Astronauts on Space Missions
            </span>
            <span className="text-[11px] font-bold text-slate-500">TRL 7/8 READY</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            Autonomous Cardiovascular Telemetry &amp; Orthostatic Intelligence
          </h1>

          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
            Predicting deep-space cerebral hypoperfusion, automating formal NASA Flight Rules (MED-B13-102),
            and titrating isotonic countermeasure recovery for Artemis, Gateway, and Mars crews.
          </p>

          {/* Quick CTA Buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onLaunchConsole('overview')}
              className="h-10 px-5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02]"
            >
              <LayoutDashboard className="w-4 h-4" strokeWidth={2} />
              <span>Launch Flight Console</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenPiP(0)}
              className="h-10 px-4 rounded-xl text-xs font-bold bg-white/25 dark:bg-slate-800/60 hover:bg-white/40 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-transparent dark:border-slate-700 flex items-center gap-2 transition-colors shadow-2xs backdrop-blur-sm"
            >
              <HelpCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" strokeWidth={2} />
              <span>10-Topic PiP Guide</span>
            </button>
          </div>
        </div>

        {/* Quick Proof Badge Block with Transparent Glass Tints */}
        <div className="grid grid-cols-2 gap-2.5 w-full md:w-auto shrink-0 font-mono text-xs">
          <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/25 dark:border-emerald-800/40 backdrop-blur-sm flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] text-emerald-800 dark:text-slate-400 uppercase font-bold">Scientific Basis</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">NASA HRP &amp; CSA</span>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold">5 Verified Papers</span>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 dark:bg-sky-950/20 border border-sky-500/25 dark:border-sky-800/40 backdrop-blur-sm flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] text-sky-800 dark:text-slate-400 uppercase font-bold">Clinical Autonomy</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">Level IV/V CDSS</span>
            <span className="text-[10px] text-sky-700 dark:text-sky-400 font-extrabold">Zero Latency Local</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/25 dark:border-purple-800/40 backdrop-blur-sm flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] text-purple-800 dark:text-slate-400 uppercase font-bold">Data Standards</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">CCSDS &amp; FHIR</span>
            <span className="text-[10px] text-purple-700 dark:text-purple-400 font-extrabold">APID 0x04F2 / LSAH</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/25 dark:border-amber-800/40 backdrop-blur-sm flex flex-col justify-between shadow-2xs">
            <span className="text-[10px] text-amber-800 dark:text-slate-400 uppercase font-bold">Flight Provenance</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">SHA-256 Ledger</span>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-extrabold">Tamper-Evident</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 20-SECOND TEST SANDBOX: Test Physics & Flight Rules in Under 20 Secs       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-12 gap-3 shrink-0">
        {/* Left Side: Interactive 20-Second Sliders Sandbox */}
        <div className="col-span-12 lg:col-span-7 p-4 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md flex flex-col justify-between gap-3 shadow-md relative overflow-hidden">
          {/* Subtle Corner Reticles */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-indigo-400/30 rounded-tl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-indigo-400/30 rounded-br pointer-events-none" />
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-indigo-500/20 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 border border-indigo-500/30 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                20-SECOND TEST
              </span>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Live Biophysics &amp; Flight Rule Sandbox
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500 font-bold">Slide to test in real time</span>
          </div>

          {/* Sliders Grid with Transparent Glassmorphic Cards */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Gravity Slider (Transparent Indigo Card) */}
            <div className="p-3 rounded-xl bg-white/20 dark:bg-slate-900/40 border border-transparent dark:border-indigo-500/20 backdrop-blur-sm space-y-2 shadow-2xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-indigo-950 dark:text-slate-200 flex items-center gap-1.5 font-extrabold">
                  <Orbit className="w-3.5 h-3.5 text-indigo-600 dark:text-sky-400" /> Gravity Vector (g)
                </span>
                <span className="font-mono text-indigo-900 dark:text-indigo-300 font-extrabold bg-indigo-500/15 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md text-xs border border-indigo-500/20">
                  {sandboxGravityG}g
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={sandboxGravityG}
                onChange={(e) => setSandboxGravityG(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-300/40 dark:bg-slate-700/60 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-indigo-900/70 dark:text-slate-400 font-mono font-semibold">
                <span>0g Transit</span>
                <span>0.16g Moon</span>
                <span>0.38g Mars</span>
                <span>1g Earth</span>
              </div>
            </div>

            {/* Standing Heart Rate Slider (Transparent Rose Card) */}
            <div className="p-3 rounded-xl bg-white/20 dark:bg-slate-900/40 border border-transparent dark:border-rose-500/20 backdrop-blur-sm space-y-2 shadow-2xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-rose-950 dark:text-slate-200 flex items-center gap-1.5 font-extrabold">
                  <Heart className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Standing HR
                </span>
                <span className="font-mono text-rose-900 dark:text-rose-300 font-extrabold bg-rose-500/15 dark:bg-rose-950/60 px-2 py-0.5 rounded-md text-xs border border-rose-500/20">
                  {sandboxHr} bpm
                </span>
              </div>
              <input
                type="range"
                min="55"
                max="145"
                step="1"
                value={sandboxHr}
                onChange={(e) => setSandboxHr(parseInt(e.target.value, 10))}
                className="w-full accent-rose-600 cursor-pointer h-1.5 bg-slate-300/40 dark:bg-slate-700/60 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-rose-900/70 dark:text-slate-400 font-mono font-semibold">
                <span>60 Base</span>
                <span>90 Moderate</span>
                <span>120+ Tachycardia</span>
              </div>
            </div>

            {/* Systolic BP Slider (Transparent Sky Card) */}
            <div className="p-3 rounded-xl bg-white/20 dark:bg-slate-900/40 border border-transparent dark:border-sky-500/20 backdrop-blur-sm space-y-2 shadow-2xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-sky-950 dark:text-slate-200 flex items-center gap-1.5 font-extrabold">
                  <Gauge className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Systolic BP
                </span>
                <span className="font-mono text-sky-900 dark:text-sky-300 font-extrabold bg-sky-500/15 dark:bg-sky-950/60 px-2 py-0.5 rounded-md text-xs border border-sky-500/20">
                  {sandboxSbp} mmHg
                </span>
              </div>
              <input
                type="range"
                min="80"
                max="140"
                step="1"
                value={sandboxSbp}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSandboxSbp(val);
                  if (val <= sandboxDbp) setSandboxDbp(val - 15);
                }}
                className="w-full accent-sky-600 cursor-pointer h-1.5 bg-slate-300/40 dark:bg-slate-700/60 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-sky-900/70 dark:text-slate-400 font-mono font-semibold">
                <span>90 Hypotension</span>
                <span>115 Nominal</span>
                <span>135+ High</span>
              </div>
            </div>

            {/* Diastolic BP Slider (Transparent Teal Card) */}
            <div className="p-3 rounded-xl bg-white/20 dark:bg-slate-900/40 border border-transparent dark:border-teal-500/20 backdrop-blur-sm space-y-2 shadow-2xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-teal-950 dark:text-slate-200 flex items-center gap-1.5 font-extrabold">
                  <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Diastolic BP
                </span>
                <span className="font-mono text-teal-900 dark:text-teal-300 font-extrabold bg-teal-500/15 dark:bg-teal-950/60 px-2 py-0.5 rounded-md text-xs border border-teal-500/20">
                  {sandboxDbp} mmHg
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="1"
                value={sandboxDbp}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSandboxDbp(val);
                  if (val >= sandboxSbp) setSandboxSbp(val + 15);
                }}
                className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-300/40 dark:bg-slate-700/60 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-teal-900/70 dark:text-slate-400 font-mono font-semibold">
                <span>55 Low</span>
                <span>75 Nominal</span>
                <span>90 High</span>
              </div>
            </div>
          </div>

          {/* Live Reactive Results Bar with Transparent Glass Tints */}
          <div className="grid grid-cols-4 gap-2 font-mono text-center">
            <div className={`p-2 rounded-lg border backdrop-blur-sm shadow-2xs ${
              liveCalc.isCriticalCpp
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-400'
                : liveCalc.isWatchCpp
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            }`}>
              <span className="text-[10px] text-slate-700 dark:text-slate-400 font-bold block">Cerebral CPP</span>
              <span className={`text-sm font-black ${liveCalc.isCriticalCpp ? 'animate-pulse' : ''}`}>
                {liveCalc.cpp} mmHg
              </span>
              <span className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold block">{liveCalc.isCriticalCpp ? 'Pre-Syncope' : 'Perfusion OK'}</span>
            </div>

            <div className={`p-2 rounded-lg border backdrop-blur-sm shadow-2xs ${
              liveCalc.pp < 25
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-400'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-700 dark:text-indigo-300'
            }`}>
              <span className="text-[10px] text-slate-700 dark:text-slate-400 font-bold block">Pulse Pressure</span>
              <span className="text-sm font-black">
                {liveCalc.pp} mmHg
              </span>
              <span className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold block">{liveCalc.pp < 25 ? 'Narrowed' : 'Normal'}</span>
            </div>

            <div className={`p-2 rounded-lg border backdrop-blur-sm shadow-2xs ${
              liveCalc.shockIndex >= 0.7
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-400'
                : 'bg-sky-500/15 border-sky-500/30 text-sky-700 dark:text-sky-300'
            }`}>
              <span className="text-[10px] text-slate-700 dark:text-slate-400 font-bold block">Shock Index</span>
              <span className="text-sm font-black">
                {liveCalc.shockIndex}
              </span>
              <span className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold block">{liveCalc.shockIndex >= 0.7 ? 'Elevated' : 'Stable'}</span>
            </div>

            <div className={`p-2 rounded-lg border backdrop-blur-sm shadow-2xs ${
              liveCalc.flightRulePass
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-400'
            }`}>
              <span className="text-[10px] text-slate-700 dark:text-slate-400 font-bold block">Flight Rule B13</span>
              <span className="text-xs font-black">
                {liveCalc.flightRulePass ? 'GO CLEAR' : 'NO-GO'}
              </span>
              <span className="text-[9px] text-slate-600 dark:text-slate-400 font-semibold block">{liveCalc.flightRulePass ? 'Ambulate OK' : 'Recumbency'}</span>
            </div>
          </div>
        </div>

        {/* Right Side: 4 Pre-Configured 1-Click Clinical Scenarios with Transparent Glass Cards */}
        <div className="col-span-12 lg:col-span-5 p-4 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md flex flex-col justify-between gap-2.5 shadow-md relative overflow-hidden">
          {/* Subtle Corner Reticles */}
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-emerald-400/30 rounded-tl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-emerald-400/30 rounded-br pointer-events-none" />
          <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-emerald-500/20 pb-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-emerald-600" />
              1-Click Flight Scenarios
            </span>
            <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-bold">Instant Pre-Loaded Telemetry</span>
          </div>

          <div className="space-y-2 flex-1">
            {missionScenarios.map((sc, idx) => {
              const rowColors = [
                'bg-white/20 dark:bg-slate-900/40 border border-transparent dark:border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-400/30',
                'bg-white/20 dark:bg-slate-900/40 border border-transparent dark:border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-400/30',
                'bg-white/20 dark:bg-slate-900/40 border border-transparent dark:border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-400/30',
                'bg-white/20 dark:bg-slate-900/40 border border-transparent dark:border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-400/30',
              ];
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onLaunchConsole('overview', { astronautId: sc.astronautId, phase: sc.phase })}
                  className={`w-full text-left p-2.5 rounded-xl ${rowColors[idx % rowColors.length]} backdrop-blur-sm transition-all group shadow-2xs`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                      {sc.title}
                      <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${sc.badgeColor}`}>
                      {sc.badge}
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-400 line-clamp-1 leading-snug">
                    {sc.description}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 dark:text-slate-400 font-semibold mt-1">
                    <span>Rule: {sc.ruleStatus}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-black">Launch &rarr;</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3-PILLAR SCIENTIFIC VALUE FLOW (Transparent Glassmorphic Cards)          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {/* Pillar 1 */}
        <div className="p-4 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-cyan-950/20 backdrop-blur-md space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-900 dark:text-cyan-200 border border-cyan-500/30">
              PILLAR 1 • BASELINE
            </span>
            <Heart className="w-4 h-4 text-cyan-600" />
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Gravity-Adaptive Personal Baseline
          </h3>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
            Eliminates generic population bias by modeling individual N=30 preflight reference envelopes.
            Distinguishes healthy autonomic adaptation from acute cardiovascular decompensation.
          </p>
          <div className="pt-1 text-[11px] font-mono font-bold text-cyan-800 dark:text-cyan-300">
            Z-Score Classification &bull; NASA HRP Grounded
          </div>
        </div>

        {/* Pillar 2 */}
        <div className="p-4 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-violet-950/20 backdrop-blur-md space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-900 dark:text-violet-200 border border-violet-500/30">
              PILLAR 2 • BIOPHYSICS
            </span>
            <Gauge className="w-4 h-4 text-violet-600" />
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            Hydrostatic Perfusion &amp; Flight Rules
          </h3>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
            Models real-time cerebral perfusion pressure (CPP = MAP_brain - ICP) across changing gravity vectors.
            Formally evaluates NASA Flight Rule B13-102 for safe crew ambulation clearance.
          </p>
          <div className="pt-1 text-[11px] font-mono font-bold text-violet-800 dark:text-violet-300">
            Cerebral Ischemia Boundary &bull; Rule MED-B13-102
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="p-4 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-emerald-950/20 backdrop-blur-md space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border border-emerald-500/30">
              PILLAR 3 • INTEROPERABILITY
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white">
            CCSDS, FHIR &amp; Cryptographic Ledger
          </h3>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
            Export standardized CCSDS 133.0 binary space packets for Orion avionics and HL7 FHIR Space Profiles
            for the NASA LSAH database. Sealed with FIPS 180-4 SHA-256 black-box audit ledger.
          </p>
          <div className="pt-1 text-[11px] font-mono font-bold text-emerald-800 dark:text-emerald-300">
            APID 0x04F2 &bull; Tamper-Evident SHA-256
          </div>
        </div>
      </div>
    </div>
  );
};
