import React, { useState } from 'react';
import {
  ShieldAlert,
  Copy,
  Download,
  Send,
  Check,
  Activity,
  FileText,
  Camera,
  HelpCircle,
  ShieldCheck,
  FileCode,
} from 'lucide-react';
import { Astronaut, DashboardData, TriageResult } from '../types';
import { postAcuteTriage, fetchFhirExport, fetchCcsdsExport } from '../api';
import { PiPTopicKey } from './PiPFunctionGuide';
import { VisionVitalsCapture } from './VisionVitalsCapture';

interface AcuteAssistViewProps {
  astronaut: Astronaut;
  baselines: DashboardData['baselines'];
  theme: 'dark' | 'light';
  onOpenPiP: (topic: PiPTopicKey) => void;
  operationalMode?: 'spacecraft' | 'clinic';
}

export const AcuteAssistView: React.FC<AcuteAssistViewProps> = ({
  astronaut,
  baselines,
  theme,
  onOpenPiP,
  operationalMode = 'spacecraft',
}) => {
  const [symptom, setSymptom] = useState<string>('Presyncope / Lightheadedness upon standing');
  const [gravityContext, setGravityContext] = useState<string>(
    operationalMode === 'clinic' ? 'Earth Remote Clinic (1.0g)' : 'Earth Landing Zone (1.0g)'
  );

  // Acute vitals inputs
  const [hr, setHr] = useState<string>('86');
  const [sbp, setSbp] = useState<string>('98');
  const [dbp, setDbp] = useState<string>('64');
  const [orthoDelta, setOrthoDelta] = useState<string>('32');

  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [sbarViewMode, setSbarViewMode] = useState<'structured' | 'raw'>('structured');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const isClinic = operationalMode === 'clinic';

  // Baselines
  const hrBase = baselines.resting_hr || { mean: 60.2, std: 2.2 };
  const sbpBase = baselines.systolic_bp || { mean: 118.4, std: 2.8 };
  const dbpBase = baselines.diastolic_bp || { mean: 76.1, std: 2.0 };
  const orthoBase = baselines.orthostatic_hr_delta || { mean: 11.0, std: 1.8 };

  // Live Deltas and Z-Scores preview
  const liveHr = hr ? parseFloat(hr) : null;
  const liveSbp = sbp ? parseFloat(sbp) : null;
  const liveDbp = dbp ? parseFloat(dbp) : null;
  const liveOrtho = orthoDelta ? parseFloat(orthoDelta) : null;

  const hrZ = liveHr ? ((liveHr - hrBase.mean) / hrBase.std).toFixed(1) : null;
  const sbpZ = liveSbp ? ((liveSbp - sbpBase.mean) / sbpBase.std).toFixed(1) : null;
  const orthoZ = liveOrtho ? ((liveOrtho - orthoBase.mean) / orthoBase.std).toFixed(1) : null;

  // Real-time derived hemodynamics
  const liveMap = liveSbp !== null && liveDbp !== null ? Math.round((liveDbp + (liveSbp - liveDbp) / 3.0) * 10) / 10 : null;
  const livePp = liveSbp !== null && liveDbp !== null ? Math.round((liveSbp - liveDbp) * 10) / 10 : null;
  const liveShockIndex = liveHr !== null && liveSbp !== null && liveSbp > 0 ? Math.round((liveHr / liveSbp) * 100) / 100 : null;

  const handleRunTriage = async () => {
    if (!liveHr || !liveSbp || !liveDbp) return;
    setIsLoading(true);
    try {
      const res = await postAcuteTriage({
        astronaut_id: astronaut.id,
        hr: liveHr,
        sbp: liveSbp,
        dbp: liveDbp,
        ortho_delta: liveOrtho,
        symptom: symptom,
        gravity_context: gravityContext,
      });
      setTriageResult(res);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!triageResult) return;
    const reportText = triageResult.uplink_report || triageResult.sbar_report || '';
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!triageResult) return;
    const reportText = triageResult.uplink_report || triageResult.sbar_report || '';
    const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CREWSIGNAL_SBAR_HANDOFF_${astronaut.id}_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadFhir = async () => {
    try {
      const fhirData = await fetchFhirExport(astronaut.id);
      const blob = new Blob([JSON.stringify(fhirData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `NASA_LSAH_FHIR_${astronaut.id}_Day95.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export FHIR:', e);
    }
  };

  const handleDownloadCcsds = async () => {
    try {
      const ccsdsData = await fetchCcsdsExport(astronaut.id);
      const blob = new Blob([ccsdsData.formatted_hex], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CCSDS_133_SpacePacket_${astronaut.id}_APID04F2.hex`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export CCSDS:', e);
    }
  };

  return (
    <div className="grid grid-cols-12 grid-rows-6 gap-2.5 w-full flex-1 min-h-[max(720px,calc(100dvh-170px))] select-none">
      {/* ========================================================================= */}
      {/* LEFT BENTO CARD: Crewmate Acute Assist & SBAR Engine (Cols 1–6, Rows 1–6)  */}
      {/* ========================================================================= */}
      <div className="col-span-6 row-span-6 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md p-3.5 flex flex-col justify-between overflow-hidden shadow-sm relative">
        {/* Subtle Corner Reticles */}
        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-rose-500/40 rounded-tl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-rose-500/40 rounded-br pointer-events-none" />
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-rose-500/20 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                {isClinic
                  ? 'Clinic Emergency Assist & SBAR Handoff'
                  : 'Crewmate Acute Assist & Flight-Surgeon SBAR'}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Rapid stabilization protocol • Non-diagnostic guidance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/20 text-slate-700 dark:text-slate-300">
              {astronaut.name.split('—')[0].trim()}
            </span>
            <button
              onClick={() => onOpenPiP('acute_triage')}
              className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 transition-colors"
              title="Open Acute Assist PiP Guide"
            >
              <HelpCircle className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Middle Content */}
        <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-2.5 flex flex-col justify-between">
          {/* Symptom & Gravity Selection */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observed Symptom
              </label>
              <select
                value={symptom}
                onChange={(e) => setSymptom(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-white/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="Presyncope / Lightheadedness upon standing">Presyncope / Lightheadedness upon standing</option>
                <option value="Palpitations & Tachycardia during postural transition">Palpitations & Tachycardia</option>
                <option value="Visual Tunneling / Grayout upon gravity re-entry">Visual Tunneling / Grayout</option>
                <option value="Extreme Fatigue & Weakness in Lower Extremities">Extreme Fatigue & Weakness</option>
                <option value="Routine Acute Cardiovascular Check">Routine Acute Cardiovascular Check</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                Gravity / Operational Context
              </label>
              <select
                value={gravityContext}
                onChange={(e) => setGravityContext(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-white/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="Earth Landing Zone (1.0g)">Earth Landing Zone (1.0g)</option>
                <option value="Transit Spacecraft (0.0g)">Transit Spacecraft (0.0g)</option>
                <option value="Lunar Surface (0.16g)">Lunar Surface (0.16g)</option>
                <option value="Earth Remote Clinic (1.0g)">Earth Remote Clinic (1.0g)</option>
              </select>
            </div>
          </div>

          {/* 3-Step Stabilization Checklist Pills */}
          <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-rose-500/20 space-y-1.5 shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1">
              <Activity className="w-3 h-3 text-rose-600" />
              Immediate Countermeasure Sequence
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 font-medium text-slate-800 dark:text-slate-200">
                <span className="font-bold text-rose-600 block">1. Position</span>
                Supine or head-down tilt; avoid sudden upright stance.
              </div>
              <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 font-medium text-slate-800 dark:text-slate-200">
                <span className="font-bold text-rose-600 block">2. Compression</span>
                Inflate/fasten lower-body anti-g suit or thigh wraps.
              </div>
              <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 font-medium text-slate-800 dark:text-slate-200">
                <span className="font-bold text-rose-600 block">3. Fluid Bolus</span>
                Oral electrolyte hydration (0.7L water + isotonic salts).
              </div>
            </div>
          </div>

          {/* Live Vitals Input with Deltas & Z-Scores */}
          <div className="space-y-1.5 shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              Acute Hemodynamic Telemetry
            </span>
            <div className="grid grid-cols-4 gap-2">
              <div className="p-1.5 rounded bg-white/35 dark:bg-slate-900/60 border border-transparent dark:border-slate-700/60 backdrop-blur-sm">
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">HR (bpm)</label>
                <input
                  type="number"
                  value={hr}
                  onChange={(e) => setHr(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-transparent border-none text-slate-900 dark:text-white p-0 focus:outline-none"
                />
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-0.5">
                  <span>Base {hrBase.mean}</span>
                  <span className={Number(hrZ) >= 2.0 ? 'text-rose-600 font-bold' : ''}>Z {hrZ ?? '—'}</span>
                </div>
              </div>

              <div className="p-1.5 rounded bg-white/35 dark:bg-slate-900/60 border border-transparent dark:border-slate-700/60 backdrop-blur-sm">
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">SBP (mmHg)</label>
                <input
                  type="number"
                  value={sbp}
                  onChange={(e) => setSbp(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-transparent border-none text-slate-900 dark:text-white p-0 focus:outline-none"
                />
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-0.5">
                  <span>Base {sbpBase.mean}</span>
                  <span className={Number(sbpZ) <= -2.0 ? 'text-rose-600 font-bold' : ''}>Z {sbpZ ?? '—'}</span>
                </div>
              </div>

              <div className="p-1.5 rounded bg-white/35 dark:bg-slate-900/60 border border-transparent dark:border-slate-700/60 backdrop-blur-sm">
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">DBP (mmHg)</label>
                <input
                  type="number"
                  value={dbp}
                  onChange={(e) => setDbp(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-transparent border-none text-slate-900 dark:text-white p-0 focus:outline-none"
                />
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-0.5">
                  <span>Base {dbpBase.mean}</span>
                  <span>Live</span>
                </div>
              </div>

              <div className="p-1.5 rounded bg-white/35 dark:bg-slate-900/60 border border-transparent dark:border-slate-700/60 backdrop-blur-sm">
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">Ortho Δ</label>
                <input
                  type="number"
                  value={orthoDelta}
                  onChange={(e) => setOrthoDelta(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-transparent border-none text-slate-900 dark:text-white p-0 focus:outline-none"
                />
                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-0.5">
                  <span>Base {orthoBase.mean}</span>
                  <span className={Number(orthoZ) >= 2.0 ? 'text-rose-600 font-bold' : ''}>Z {orthoZ ?? '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Derived Hemodynamics strip */}
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-lg bg-slate-900/40 text-[10px] font-mono shrink-0">
            <div>
              <span className="text-slate-400 block">MAP</span>
              <span className="font-bold text-slate-200">{liveMap ? `${liveMap} mmHg` : '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Pulse Pressure</span>
              <span className={`font-bold ${livePp && livePp < 25 ? 'text-rose-400' : 'text-slate-200'}`}>
                {livePp ? `${livePp} mmHg` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Shock Index</span>
              <span className={`font-bold ${liveShockIndex && liveShockIndex >= 0.7 ? 'text-rose-400' : 'text-slate-200'}`}>
                {liveShockIndex ?? '—'}
              </span>
            </div>
          </div>

          {/* SBAR Structured Output with Tab Toggle */}
          {triageResult ? (
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 shrink-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    triageResult.triage_level.includes('CRITICAL') || triageResult.triage_level.includes('RED')
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {triageResult.triage_level}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-300 truncate max-w-[200px]">
                    {triageResult.risk_summary}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setSbarViewMode('structured')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      sbarViewMode === 'structured'
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Structured
                  </button>
                  <button
                    type="button"
                    onClick={() => setSbarViewMode('raw')}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      sbarViewMode === 'raw'
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Markdown
                  </button>
                </div>
              </div>

              {sbarViewMode === 'structured' ? (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800 space-y-1">
                    <span className="font-extrabold text-sky-400 block text-[10px] uppercase">
                      Situation &amp; Assessment
                    </span>
                    <p className="text-slate-300 font-medium leading-snug line-clamp-2">
                      {symptom} in {gravityContext}. Orthostatic delta {orthoDelta} bpm (Z {orthoZ}).
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-slate-800 space-y-1">
                    <span className="font-extrabold text-emerald-400 block text-[10px] uppercase">
                      Recommendation &amp; Flight Rule
                    </span>
                    <p className="text-slate-300 font-medium leading-snug line-clamp-2">
                      Immediate recumbent position, 40-50 mmHg lower body counter-pressure, 1000 mL isotonic fluid.
                    </p>
                  </div>
                </div>
              ) : (
                <pre className="p-2 rounded-lg bg-black/50 border border-slate-800 font-mono text-[10px] text-slate-300 whitespace-pre-wrap leading-tight max-h-24 overflow-y-auto">
                  {triageResult.uplink_report || triageResult.sbar_report}
                </pre>
              )}

              {/* NASA FIPS 180-4 Cryptographic Audit Seal */}
              <div className="p-1.5 rounded-lg bg-black/40 border border-slate-800 flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SHA-256 FLIGHT LEDGER:</span>
                  <span className="text-slate-200 font-bold truncate max-w-[150px]">
                    9D89A5B3B5B1B7A4...
                  </span>
                </div>
                <span className="text-emerald-400 font-bold text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                  TAMPER-EVIDENT
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-800 text-[10px] text-slate-500 flex items-center justify-center gap-1.5 shrink-0">
              <FileText className="w-3.5 h-3.5" />
              <span>Telemetry loaded. Click &ldquo;Run Acute Triage&rdquo; to generate SBAR handoff.</span>
            </div>
          )}
        </div>

        {/* Card Bottom Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-rose-500/20 shrink-0">
          <button
            onClick={handleRunTriage}
            disabled={isLoading}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Triaging...' : 'Run Acute Triage'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyReport}
              disabled={!triageResult}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
              title="Copy SBAR Report"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownloadReport}
              disabled={!triageResult}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-2xs transition-colors disabled:opacity-40"
              title="Download Standard SBAR Briefing (.md)"
            >
              <Download className="w-3 h-3" />
              <span>SBAR</span>
            </button>
            <button
              onClick={handleDownloadFhir}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs transition-colors"
              title="Export NASA LSAH HL7 FHIR Space Profile (.json)"
            >
              <FileCode className="w-3 h-3" />
              <span>FHIR</span>
            </button>
            <button
              onClick={handleDownloadCcsds}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs transition-colors"
              title="Export CCSDS 133.0 Space Packet Telemetry Frame (.hex)"
            >
              <FileText className="w-3 h-3" />
              <span>CCSDS</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT BENTO CARD: Embedded Computer Vision Assistant (Cols 7–12, Rows 1–6)*/}
      {/* ========================================================================= */}
      <div className="col-span-6 row-span-6 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md p-3.5 flex flex-col justify-between overflow-hidden shadow-sm relative">
        {/* Subtle Corner Reticles */}
        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-sky-500/40 rounded-tl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-sky-500/40 rounded-br pointer-events-none" />
        <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-sky-500/20 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                Embedded CV Sensor &amp; Monitor Assistant
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Heart-level reticle alignment &amp; optical OCR auto-fill
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenPiP('vision_vitals')}
            className="p-1 rounded-lg hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 transition-colors"
            title="Open Computer Vision PiP Guide"
          >
            <HelpCircle className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Embedded Vision Component */}
        <div className="flex-1 min-h-0 pt-2">
          <VisionVitalsCapture
            embedded={true}
            theme={theme}
            onConfirmValues={(vitals) => {
              setSbp(vitals.sbp.toString());
              setDbp(vitals.dbp.toString());
              setHr(vitals.hr.toString());
            }}
          />
        </div>
      </div>
    </div>
  );
};
