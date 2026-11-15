import React, { useState } from 'react';
import {
  BookOpen,
  ExternalLink,
  Share2,
  HelpCircle,
} from 'lucide-react';
import {
  DerivedHemodynamics,
  EvidencePayload,
  KpiMetric,
} from '../types';
import { PiPTopicKey } from './PiPFunctionGuide';
import { SICopilotPanel } from './SICopilotPanel';

interface EvidenceViewProps {
  evidence: EvidencePayload;
  theme: 'dark' | 'light';
  astronautId: string;
  activePhase: string;
  derivedHemodynamics?: DerivedHemodynamics;
  kpis?: Record<string, KpiMetric>;
  onOpenPiP: (topic: PiPTopicKey) => void;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({
  evidence,
  theme,
  astronautId,
  activePhase,
  derivedHemodynamics,
  kpis,
  onOpenPiP,
}) => {
  const [selectedTopic, setSelectedTopic] = useState<string>('ALL');

  const sources = evidence.evidence_sources;
  const filteredSources = sources.filter((s) => {
    if (selectedTopic !== 'ALL' && !s.related_indicators.includes(selectedTopic)) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-12 grid-rows-6 gap-2.5 h-full w-full overflow-hidden select-none">
      {/* ========================================================================= */}
      {/* LEFT BENTO CARD: Embedded Super Intelligence (SI) Co-Pilot (Cols 1–5, Rows 1–6) */}
      {/* ========================================================================= */}
      <div className="col-span-5 row-span-6 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md p-3 flex flex-col justify-between overflow-hidden shadow-sm">
        <SICopilotPanel
          astronautId={astronautId}
          activePhase={activePhase}
          theme={theme}
          derivedHemodynamics={derivedHemodynamics}
          kpis={kpis}
          onOpenPiP={onOpenPiP}
        />
      </div>

      {/* ========================================================================= */}
      {/* RIGHT BENTO CARD: NASA HRP & CSA Traceability & Papers (Cols 6–12, Rows 1–6) */}
      {/* ========================================================================= */}
      <div className="col-span-7 row-span-6 rounded-2xl border border-transparent dark:border-white/10 bg-white/25 dark:bg-[#080E1E]/50 backdrop-blur-md p-3.5 flex flex-col justify-between overflow-hidden shadow-sm relative">
        {/* Subtle Corner Reticles */}
        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-sky-500/40 rounded-tl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-sky-500/40 rounded-br pointer-events-none" />
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-sky-500/20 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                NASA HRP &amp; CSA Evidence Traceability Graph
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {evidence.knowledge_graph.node_count} Graph Nodes • {evidence.knowledge_graph.edge_count} Directed Edges • 5 Verified Sources
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenPiP('evidence_graph')}
            className="p-1 rounded-lg hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 transition-colors"
            title="Open Evidence Graph PiP Guide"
          >
            <HelpCircle className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* 5-Stage Semantic Graph Pipeline Horizontal Strip */}
        <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-900/60 border border-sky-500/25 my-1.5 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-900 dark:text-sky-300 flex items-center gap-1">
              <Share2 className="w-3 h-3 text-sky-500" />
              5-Stage Grounded Knowledge Pipeline
            </span>
            <span className="text-[9px] font-mono text-slate-500">
              Deterministic Provenance Chain
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
            <div className="p-1 rounded bg-sky-500/10 border border-sky-500/20">
              <span className="text-[9px] text-slate-500 block">1. CREW</span>
              <span className="text-[10px] font-bold text-sky-900 dark:text-sky-200 truncate block">
                {astronautId}
              </span>
            </div>
            <div className="p-1 rounded bg-violet-500/10 border border-violet-500/20">
              <span className="text-[9px] text-slate-500 block">2. PHASE</span>
              <span className="text-[10px] font-bold text-violet-900 dark:text-violet-200 truncate block">
                {activePhase.split(' ')[0]}
              </span>
            </div>
            <div className="p-1 rounded bg-teal-500/10 border border-teal-500/20">
              <span className="text-[9px] text-slate-500 block">3. VITALS</span>
              <span className="text-[10px] font-bold text-teal-900 dark:text-teal-200 block">
                4 KPIs + 3 Hemo
              </span>
            </div>
            <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20">
              <span className="text-[9px] text-slate-500 block">4. GUIDES</span>
              <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 block">
                4 Protocols
              </span>
            </div>
            <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[9px] text-slate-500 block">5. SOURCE</span>
              <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-200 block">
                5 NASA / CSA
              </span>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 pb-1 shrink-0">
          <span className="text-[10px] font-bold text-slate-500">Topic Filter:</span>
          {[
            { id: 'ALL', label: 'All 5 Sources' },
            { id: 'orthostatic_hr_delta', label: 'Orthostatic' },
            { id: 'resting_hr', label: 'Autonomic HR' },
            { id: 'systolic_bp', label: 'Arterial BP' },
            { id: 'cumulative_radiation_msv', label: 'CSA Radiation' },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setSelectedTopic(chip.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                selectedTopic === chip.id
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Compact 2-Column Grid of 5 Verified Sources */}
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-2 pr-0.5">
          {filteredSources.map((src) => (
            <a
              key={src.id}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-lg border border-transparent dark:border-slate-800/80 bg-white/20 dark:bg-slate-900/60 hover:border-sky-500 dark:hover:border-sky-400 transition-all flex flex-col justify-between group shadow-2xs backdrop-blur-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-400/30">
                    {src.id}
                  </span>
                  <span className="text-[9px] text-slate-500 font-semibold truncate max-w-[120px]">
                    {src.organization}
                  </span>
                </div>

                <h4 className="font-extrabold text-[11px] leading-tight text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors flex items-center justify-between gap-1">
                  <span className="line-clamp-2">{src.title}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0 text-slate-400 group-hover:text-sky-500" />
                </h4>

                <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {src.summary}
                </p>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[9px] font-mono">
                <span className="text-slate-500">
                  {src.related_indicators.join(', ')}
                </span>
                <span className="text-sky-600 dark:text-sky-400 font-bold group-hover:underline">
                  Open Paper &rarr;
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Card Footer */}
        <div className="pt-1.5 border-t border-sky-500/20 text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
          <span>Non-Diagnostic Grounding Protocol</span>
          <span>NASA Task Book &amp; CSA Open Science</span>
        </div>
      </div>
    </div>
  );
};
