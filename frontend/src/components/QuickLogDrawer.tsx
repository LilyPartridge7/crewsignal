import React, { useState } from 'react';
import { X, Check, PlusCircle, AlertCircle, Clock, ShieldCheck, Camera } from 'lucide-react';
import { postMeasurement } from '../api';
import { ProtocolTimer } from './ProtocolTimer';
import { VisionVitalsCapture } from './VisionVitalsCapture';

interface QuickLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  astronautId: string;
  activePhase: string;
  missionDay: number;
  onSuccess: () => void;
  operationalMode?: 'spacecraft' | 'clinic';
}

export const QuickLogDrawer: React.FC<QuickLogDrawerProps> = ({
  isOpen,
  onClose,
  astronautId,
  activePhase,
  missionDay,
  onSuccess,
  operationalMode = 'spacecraft',
}) => {
  const [showTimer, setShowTimer] = useState<boolean>(false);
  const [showVisionCapture, setShowVisionCapture] = useState<boolean>(false);
  const [hr, setHr] = useState<string>('72');
  const [sbp, setSbp] = useState<string>('115');
  const [dbp, setDbp] = useState<string>('75');
  const [orthoDelta, setOrthoDelta] = useState<string>('18');
  const [collectionContext, setCollectionContext] = useState<string>('Morning Fasted Rest');
  const [notes, setNotes] = useState<string>('Routine morning stand test self-check');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const hrNum = parseFloat(hr) || 0;
  const sbpNum = parseFloat(sbp) || 0;
  const dbpNum = parseFloat(dbp) || 0;

  // Real-time derived hemodynamics preview
  const liveMap = sbpNum > 0 && dbpNum > 0 ? Math.round((dbpNum + (sbpNum - dbpNum) / 3.0) * 10) / 10 : null;
  const livePp = sbpNum > 0 && dbpNum > 0 ? Math.round((sbpNum - dbpNum) * 10) / 10 : null;
  const liveShockIndex = hrNum > 0 && sbpNum > 0 ? Math.round((hrNum / sbpNum) * 100) / 100 : null;

  const isPostExercise = collectionContext === 'Post-Exercise (<30 min)';

  const handleTimerComplete = (res: {
    supine_hr: number;
    standing_hr: number;
    ortho_delta: number;
    sbp: number;
    dbp: number;
    map: number;
    pulse_pressure: number;
    shock_index: number;
  }) => {
    setHr(res.supine_hr.toString());
    setSbp(res.sbp.toString());
    setDbp(res.dbp.toString());
    setOrthoDelta(res.ortho_delta.toString());
    setNotes(`3-Minute Orthostatic Protocol completed. Supine HR ${res.supine_hr} bpm -> Stand HR ${res.standing_hr} bpm (Δ +${res.ortho_delta} bpm).`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Frontend validation gatekeeper
    if (sbpNum <= dbpNum) {
      setErrorMsg('Physiological Gatekeeper: Systolic BP must be strictly greater than Diastolic BP.');
      setIsSubmitting(false);
      return;
    }
    if (hrNum < 30 || hrNum > 220) {
      setErrorMsg(`Physiological Gatekeeper: Heart rate (${hrNum} bpm) outside plausible physiological limits [30-220 bpm].`);
      setIsSubmitting(false);
      return;
    }
    if (sbpNum < 50 || sbpNum > 240) {
      setErrorMsg(`Physiological Gatekeeper: Systolic BP (${sbpNum} mmHg) outside plausible limits [50-240 mmHg].`);
      setIsSubmitting(false);
      return;
    }
    if (dbpNum < 30 || dbpNum > 150) {
      setErrorMsg(`Physiological Gatekeeper: Diastolic BP (${dbpNum} mmHg) outside plausible limits [30-150 mmHg].`);
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await postMeasurement({
        astronaut_id: astronautId,
        mission_day: missionDay,
        phase_name: activePhase,
        resting_hr: hrNum,
        systolic_bp: sbpNum,
        diastolic_bp: dbpNum,
        orthostatic_hr_delta: orthoDelta ? parseFloat(orthoDelta) : null,
        activity_context: `Crew Self-Check [${collectionContext}]`,
        collection_context: collectionContext,
        notes: notes,
      });

      const flagNote = res.quality_validation?.context_flag === 'Contextual Elevation (Expected Post-Exertion)'
        ? ' [Contextual Elevation Flagged]'
        : '';

      setSuccessMsg(`Logged telemetry record #${res.id}${flagNote} into database successfully!`);
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessMsg(null);
        onSuccess();
        onClose();
      }, 1400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit telemetry.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-4">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-[#E8EEF5] dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400 flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Log Live Self-Check Telemetry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {astronautId} • Day {missionDay} • {activePhase}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Protocol Timer Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Interactive 3-Min Orthostatic Protocol Timer
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  90s Supine Rest → 90s Stand / LBNP Challenge
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTimer(!showTimer)}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-700 shadow-2xs hover:bg-sky-50"
            >
              {showTimer ? 'Hide Timer' : 'Open Timer'}
            </button>
          </div>

          {/* Built-in Protocol Timer */}
          {showTimer && (
            <ProtocolTimer
              operationalMode={operationalMode}
              initialRestingHr={hrNum || 70}
              initialSbp={sbpNum || 110}
              initialDbp={dbpNum || 72}
              onComplete={handleTimerComplete}
            />
          )}

          {/* Computer Vision Sensor & Monitor Assistant Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Computer Vision Sensor &amp; Monitor Assistant
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mode A Reticle Alignment &amp; Mode B OCR Snap-to-Log
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowVisionCapture(true)}
              className="px-2.5 py-1 text-xs font-bold rounded-md bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 shadow-2xs hover:bg-indigo-50"
            >
              Launch CV
            </button>
          </div>

          {/* Vision Vitals Capture Modal */}
          {showVisionCapture && (
            <VisionVitalsCapture
              isOpen={showVisionCapture}
              onClose={() => setShowVisionCapture(false)}
              onConfirmValues={(vitals) => {
                setHr(vitals.hr.toString());
                setSbp(vitals.sbp.toString());
                setDbp(vitals.dbp.toString());
                setNotes(`CV Capture: SBP ${vitals.sbp} mmHg, DBP ${vitals.dbp} mmHg, HR ${vitals.hr} bpm (Heart-Level Aligned / OCR Confirmed)`);
                setShowVisionCapture(false);
              }}
            />
          )}

          {/* Collection Context Selector (Gatekeeper) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Measurement Collection Context (Gatekeeper)
            </label>
            <select
              value={collectionContext}
              onChange={(e) => setCollectionContext(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#F1F5F9] dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-sky-500"
            >
              <option value="Morning Fasted Rest">Morning Fasted Rest (Standard Baseline Condition)</option>
              <option value="Post-Exercise (<30 min)">Post-Exercise (&lt;30 min) — Contextual Elevation Expected</option>
              <option value="Post-EVA">Post-EVA / Habitat Re-entry Check</option>
              <option value="Acute Symptom Check">Acute Symptom Check (Presyncope / Fatigue)</option>
              <option value="Heat/Dehydration Orthostatic Check">Heat / Dehydration Orthostatic Check (Remote Clinic)</option>
            </select>
            {isPostExercise && (
              <div className="mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Contextual Gatekeeper Active:</strong> Telemetry will be tagged as Expected Post-Exertion Elevation. False baseline alerts suppressed; 15-minute rest recheck recommended.
                </span>
              </div>
            )}
          </div>

          {/* Numerical Vitals Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Resting Heart Rate (bpm)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={hr}
                onChange={(e) => setHr(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F1F5F9] dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                placeholder="e.g. 74.0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Systolic BP (mmHg)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={sbp}
                onChange={(e) => setSbp(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F1F5F9] dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                placeholder="e.g. 110.0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Diastolic BP (mmHg)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={dbp}
                onChange={(e) => setDbp(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F1F5F9] dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                placeholder="e.g. 72.0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Orthostatic HR Δ (bpm)
              </label>
              <input
                type="number"
                step="0.1"
                value={orthoDelta}
                onChange={(e) => setOrthoDelta(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#F1F5F9] dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                placeholder="e.g. 28.0 (optional)"
              />
            </div>
          </div>

          {/* Derived Hemodynamics Real-Time Strip */}
          <div className="p-2.5 rounded-lg bg-[#E8EEF5] dark:bg-slate-800/60 border border-[#CBD5E1] dark:border-slate-700">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
              Live Derived Hemodynamics
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-[9px] text-slate-500 block">MAP (mmHg)</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {liveMap !== null ? `${liveMap} mmHg` : '—'}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-[9px] text-slate-500 block">Pulse Press.</span>
                <span className={`font-extrabold ${livePp !== null && livePp < 25 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                  {livePp !== null ? `${livePp} mmHg` : '—'}
                  {livePp !== null && livePp < 25 && ' (Narrow)'}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-[9px] text-slate-500 block">Shock Index</span>
                <span className={`font-extrabold ${liveShockIndex !== null && liveShockIndex >= 0.7 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                  {liveShockIndex !== null ? liveShockIndex : '—'}
                  {liveShockIndex !== null && liveShockIndex >= 0.7 && ' (Elevated)'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Clinical Context / Protocol Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#F1F5F9] dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              placeholder="e.g. Post-exercise stand test, wearing thigh compression sleeves."
            />
          </div>

          {successMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>Logging Telemetry...</>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Commit to SQLite
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
