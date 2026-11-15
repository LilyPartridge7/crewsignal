import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Database,
  Info,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { postSIQuery } from '../api';
import {
  DerivedHemodynamics,
  KpiMetric,
  SIQueryResponse,
} from '../types';
import { PiPTopicKey } from './PiPFunctionGuide';

interface SICopilotPanelProps {
  astronautId: string;
  activePhase: string;
  theme?: 'dark' | 'light';
  derivedHemodynamics?: DerivedHemodynamics;
  kpis?: Record<string, KpiMetric>;
  onOpenPiP?: (topic: PiPTopicKey) => void;
}

export const SICopilotPanel: React.FC<SICopilotPanelProps> = ({
  astronautId,
  activePhase,
  theme: _theme = 'dark',
  derivedHemodynamics,
  kpis,
  onOpenPiP,
}) => {
  const [question, setQuestion] = useState<string>('Why did my pulse pressure narrow in 0g?');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<SIQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapVal = derivedHemodynamics?.map_mmhg ?? (kpis?.systolic_bp?.value && kpis?.diastolic_bp?.value
    ? Math.round((kpis.diastolic_bp.value + (kpis.systolic_bp.value - kpis.diastolic_bp.value) / 3.0) * 10) / 10
    : 85.2);

  const ppVal = derivedHemodynamics?.pulse_pressure_mmhg ?? (kpis?.systolic_bp?.value && kpis?.diastolic_bp?.value
    ? Math.round((kpis.systolic_bp.value - kpis.diastolic_bp.value) * 10) / 10
    : 44.7);

  const shockIndex = derivedHemodynamics?.shock_index ?? (kpis?.resting_hr?.value && kpis?.systolic_bp?.value
    ? Math.round((kpis.resting_hr.value / kpis.systolic_bp.value) * 100) / 100
    : 0.67);

  const hrZ = kpis?.resting_hr?.z_score ?? null;
  const sbpZ = kpis?.systolic_bp?.z_score ?? null;
  const orthoZ = kpis?.orthostatic_hr_delta?.z_score ?? null;

  const quickChips = [
    'Why did my pulse pressure narrow in 0g?',
    'Interpret my postflight orthostatic delta',
    'How does CSA radiation context relate to my vitals?',
    'Explain my current Shock Index and MAP',
  ];

  const handleQuery = async (queryText?: string) => {
    const q = queryText || question;
    if (!q.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await postSIQuery({
        astronaut_id: astronautId,
        phase: activePhase,
        question: q,
        map_mmhg: mapVal,
        pulse_pressure_mmhg: ppVal,
        shock_index: shockIndex,
        resting_hr_z: hrZ,
        systolic_bp_z: sbpZ,
        ortho_delta_z: orthoZ,
      });
      setResponse(res);
    } catch (err: any) {
      setError(err.message || 'Failed to query Super Intelligence Co-Pilot.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111827] border border-[#CBD5E1] dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                CrewSignal Super Intelligence (SI) Co-Pilot
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                Neuro-Symbolic SI
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Grounded exclusively in NetworkX knowledge graph &amp; 5 verified NASA HRP / CSA publications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Grounded Mode Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span>{response?.grounded_mode || 'SI Grounded Mode (Offline Deep-Space Ready)'}</span>
          </div>

          {onOpenPiP && (
            <button
              onClick={() => onOpenPiP('si_copilot')}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Open SI Co-Pilot Picture-in-Picture Function Guide"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Telemetry Input Parameter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-[#F8FAFC] dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
        <div>
          <span className="text-slate-500 block">Active Phase:</span>
          <span className="font-bold text-slate-900 dark:text-white truncate block">
            {activePhase}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Mean Arterial (MAP):</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {mapVal ? `${mapVal} mmHg` : '85.2 mmHg'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Pulse Pressure (PP):</span>
          <span className={`font-bold ${ppVal && ppVal < 25 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
            {ppVal ? `${ppVal} mmHg` : '44.7 mmHg'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Shock Index (HR/SBP):</span>
          <span className="font-bold text-slate-900 dark:text-white">
            {shockIndex ?? '0.67'}
          </span>
        </div>
      </div>

      {/* One-Click Operational Question Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
          One-Click Operational Inquiry Chips:
        </span>
        <div className="flex flex-wrap gap-2">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuestion(chip);
                handleQuery(chip);
              }}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-left"
            >
              &ldquo;{chip}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* Custom Question Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleQuery();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask SI Co-Pilot about hemodynamics, NASA flight rules, or CSA evidence..."
          className="flex-1 px-3.5 py-2 text-xs bg-[#F1F5F9] dark:bg-slate-800 border border-[#CBD5E1] dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isLoading || !question.trim()}
          className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Synthesizing...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              Ask Co-Pilot
            </>
          )}
        </button>
      </form>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Structured Answer Results */}
      {response && (
        <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
          {/* Query Summary & Node Trace */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
              Operational Query: &ldquo;{response.question}&rdquo;
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
              <Database className="w-3 h-3 text-sky-500" />
              <span>{response.retrieved_graph_nodes.length} Knowledge Graph Nodes Matched</span>
            </div>
          </div>

          {/* 4 Structured Answer Bullets */}
          <div className="space-y-2.5">
            {response.answer_bullets.map((bullet, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex-shrink-0 flex items-center justify-center font-bold text-[10px]">
                  {i + 1}
                </span>
                <p className="leading-relaxed font-medium">{bullet}</p>
              </div>
            ))}
          </div>

          {/* Clickable NASA / CSA Citation Pills */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
              Grounded in Verified NASA HRP &amp; CSA Sources:
            </span>
            <div className="flex flex-wrap gap-2">
              {response.cited_sources.map((src) => (
                <a
                  key={src.id}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-700/60 transition-colors shadow-2xs"
                >
                  <span>{src.id}: {src.title}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>

          {/* Telemetry Data Gaps Acknowledgment */}
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-[11px] flex items-start gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{response.data_gaps_acknowledged}</span>
          </div>

          {/* Prominent Non-Diagnostic Safety Guardrail */}
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-400 text-[11px] flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-500" />
            <span className="font-mono">{response.non_diagnostic_guardrail}</span>
          </div>
        </div>
      )}
    </div>
  );
};
