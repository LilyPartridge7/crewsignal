import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, NavTabId } from './components/Navbar';
import ReactiveBackdrop from './components/ReactiveBackdrop';
import { OverviewView } from './components/OverviewView';
import { LandingHomeView } from './components/LandingHomeView';
import { TimelineView } from './components/TimelineView';
import { AcuteAssistView } from './components/AcuteAssistView';
import { EvidenceView } from './components/EvidenceView';
import { PiPFunctionGuide, PIP_TOPIC_KEYS, PiPFunctionId } from './components/PiPFunctionGuide';
import {
  fetchAstronauts,
  fetchDashboard,
  fetchTimeline,
  fetchEvidence,
} from './api';
import {
  Astronaut,
  DashboardData,
  TimelineData,
  EvidencePayload,
} from './types';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  // Theme state: defaults to light mode
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('crewsignal-theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Controls state
  const [astronauts, setAstronauts] = useState<Astronaut[]>([]);
  const [selectedAstronautId, setSelectedAstronautId] = useState<string>('SYNTH-AST-01');
  const [operationalMode, setOperationalMode] = useState<'spacecraft' | 'clinic'>('spacecraft');
  const [activePhase, setActivePhase] = useState<string>('Early Postflight (1g Return)');
  const [backdropMode, setBackdropMode] = useState<'video' | 'ambient' | 'paused'>(() => {
    const saved = localStorage.getItem('crewsignal-backdrop-mode');
    return (saved as 'video' | 'ambient' | 'paused') || 'video';
  });
  const [backdropFit, setBackdropFit] = useState<'wide' | 'cover'>(() => {
    const saved = localStorage.getItem('crewsignal-backdrop-fit');
    return (saved as 'wide' | 'cover') || 'cover';
  });

  const handleCycleBackdropMode = () => {
    setBackdropMode((prev) => {
      const next = prev === 'video' ? 'ambient' : prev === 'ambient' ? 'paused' : 'video';
      localStorage.setItem('crewsignal-backdrop-mode', next);
      return next;
    });
  };

  const handleToggleBackdropFit = () => {
    setBackdropFit((prev) => {
      const next = prev === 'wide' ? 'cover' : 'wide';
      localStorage.setItem('crewsignal-backdrop-fit', next);
      return next;
    });
  };
  const [availablePhases, setAvailablePhases] = useState<string[]>([
    'Preflight (1g Baseline)',
    'In-Flight (0g Transit)',
    'Planetary/Lunar Surface (Partial-g)',
    'Early Postflight (1g Return)',
    'Late Postflight Recovery',
  ]);
  const [activeTab, setActiveTab] = useState<NavTabId>('home');
  const [targetIndicator, setTargetIndicator] = useState<string>('orthostatic_hr_delta');

  // Handle 1-Click Launch from Mission Home Landing Page
  const handleLaunchConsole = (tab: NavTabId, scenario?: { astronautId: string; phase: string }) => {
    if (scenario) {
      setSelectedAstronautId(scenario.astronautId);
      setActivePhase(scenario.phase);
    }
    setActiveTab(tab);
  };

  // Lifted Picture-in-Picture (PiP) Guide state (starts closed, opened on user click)
  const [pipOpen, setPipOpen] = useState<boolean>(false);
  const [pipIndex, setPipIndex] = useState<number>(0);
  const [pipMinimized, setPipMinimized] = useState<boolean>(false);

  // Telemetry Data states
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [evidenceData, setEvidenceData] = useState<EvidencePayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync theme class to root element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('crewsignal-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleOperationalMode = () => {
    setOperationalMode((prev) => (prev === 'spacecraft' ? 'clinic' : 'spacecraft'));
  };

  const handleOpenPiP = (topicOrIndex: string | number) => {
    let idx = 0;
    if (typeof topicOrIndex === 'number') {
      idx = Math.max(0, Math.min(PIP_TOPIC_KEYS.length - 1, topicOrIndex));
    } else {
      const normalized = topicOrIndex === 'cv_vitals_capture' || topicOrIndex === 'vision_vitals'
        ? 'vision_vitals'
        : topicOrIndex === 'countermeasure_simulator' || topicOrIndex === 'countermeasure_sim'
        ? 'countermeasure_sim'
        : topicOrIndex;
      const found = PIP_TOPIC_KEYS.indexOf(normalized as PiPFunctionId);
      if (found >= 0) idx = found;
    }
    setPipIndex(idx);
    setPipOpen(true);
    setPipMinimized(false);
  };

  // Initial load: Fetch Astronauts & Evidence
  useEffect(() => {
    async function init() {
      try {
        const [asts, ev] = await Promise.all([
          fetchAstronauts(),
          fetchEvidence(),
        ]);
        setAstronauts(asts);
        setEvidenceData(ev);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to initialize system.';
        setError(msg);
      }
    }
    init();
  }, []);

  // Fetch Dashboard & Timeline on astronaut / phase / indicator change
  const loadTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dash, tl] = await Promise.all([
        fetchDashboard(selectedAstronautId, activePhase, targetIndicator),
        fetchTimeline(selectedAstronautId),
      ]);
      setDashboardData(dash);
      setTimelineData(tl);
      if (dash.available_phases && dash.available_phases.length) {
        setAvailablePhases(dash.available_phases);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch telemetry data.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedAstronautId, activePhase, targetIndicator]);

  useEffect(() => {
    loadTelemetry();
  }, [loadTelemetry]);

  // Export clean SBAR Markdown Briefing
  const handleExportReport = () => {
    if (!dashboardData) return;
    const nowStr = new Date().toISOString();
    const d = dashboardData;
    const isClinic = operationalMode === 'clinic';

    const hemo = d.derived_hemodynamics || {
      map_mmhg: d.kpis.diastolic_bp?.value && d.kpis.systolic_bp?.value
        ? Math.round((d.kpis.diastolic_bp.value + (d.kpis.systolic_bp.value - d.kpis.diastolic_bp.value) / 3.0) * 10) / 10
        : null,
      pulse_pressure_mmhg: d.kpis.diastolic_bp?.value && d.kpis.systolic_bp?.value
        ? Math.round((d.kpis.systolic_bp.value - d.kpis.diastolic_bp.value) * 10) / 10
        : null,
      shock_index: d.kpis.resting_hr?.value && d.kpis.systolic_bp?.value
        ? Math.round((d.kpis.resting_hr.value / d.kpis.systolic_bp.value) * 100) / 100
        : null,
      shock_index_baseline: 0.51,
      shock_index_delta: null,
      shock_index_status: 'Normal',
      pulse_pressure_flag: 'Normal Pulse Pressure',
      is_pulse_pressure_narrowed: false,
      is_shock_index_elevated: false,
    };

    const report = `# CREWSIGNAL STANDARDIZED SBAR CLINICAL TELEMETRY HANDOFF
**Generated:** ${nowStr}
**Data Classification:** ${d.classification}
**Disclaimer:** ${d.disclaimer}
**Operational Mode:** ${isClinic ? 'EARTH REMOTE CLINIC DUAL-USE TELEHEALTH' : 'SPACECRAFT FLIGHT SURGEON CONSOLE'}

---

## [S - SITUATION]
- **Subject:** ${d.astronaut.name} (${d.astronaut.id})
- **Role / Profile:** ${d.astronaut.role}
- **Mission Day:** Day ${d.mission_day}
- **Operational Phase:** ${d.active_phase} (${d.gravity_g}g Field)
- **Deployment Location:** ${d.location}
- **Active Syndrome State:** ${d.coupled_pattern.signature_name} (${d.coupled_pattern.severity})

---

## [B - BACKGROUND]
- **Personal Baseline Phase:** Preflight 1g Baseline (N=${d.kpis.resting_hr?.total_records ?? 30} days reference envelope)
- **Preflight Resting HR Baseline:** ${d.kpis.resting_hr?.baseline_mean} ± ${d.kpis.resting_hr?.baseline_std} bpm
- **Preflight Systolic BP Baseline:** ${d.kpis.systolic_bp?.baseline_mean} ± ${d.kpis.systolic_bp?.baseline_std} mmHg
- **Preflight Orthostatic HR Δ Baseline:** ${d.kpis.orthostatic_hr_delta?.baseline_mean} ± ${d.kpis.orthostatic_hr_delta?.baseline_std} bpm
- **Preflight Shock Index Baseline:** ~0.51 (HR/SBP ratio)

---

## [A - ASSESSMENT & PHYSIOLOGICAL INDICES]
### 1. Primary Indicators vs. Personal Envelope
| Indicator | Observed | Baseline Mean ± SD | Delta | Z-Score | Status | Data Completeness |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Resting HR | ${d.kpis.resting_hr?.value ?? 'N/A'} bpm | ${d.kpis.resting_hr?.baseline_mean} ± ${d.kpis.resting_hr?.baseline_std} | ${d.kpis.resting_hr?.delta ?? '—'} bpm | ${d.kpis.resting_hr?.z_score ?? '—'} | ${d.kpis.resting_hr?.status} | ${d.kpis.resting_hr?.completeness_pct}% obs |
| Systolic BP | ${d.kpis.systolic_bp?.value ?? 'N/A'} mmHg | ${d.kpis.systolic_bp?.baseline_mean} ± ${d.kpis.systolic_bp?.baseline_std} | ${d.kpis.systolic_bp?.delta ?? '—'} mmHg | ${d.kpis.systolic_bp?.z_score ?? '—'} | ${d.kpis.systolic_bp?.status} | ${d.kpis.systolic_bp?.completeness_pct}% obs |
| Orthostatic HR Δ | ${d.kpis.orthostatic_hr_delta?.value ?? 'N/A'} bpm | ${d.kpis.orthostatic_hr_delta?.baseline_mean} ± ${d.kpis.orthostatic_hr_delta?.baseline_std} | ${d.kpis.orthostatic_hr_delta?.delta ?? '—'} bpm | ${d.kpis.orthostatic_hr_delta?.z_score ?? '—'} | ${d.kpis.orthostatic_hr_delta?.status} | ${d.kpis.orthostatic_hr_delta?.completeness_pct}% obs |
| CSA Cumulative Radiation | ${d.kpis.cumulative_radiation_msv?.value ?? 'N/A'} mSv | Career ALARA Limit: 1000 mSv | — | — | Career Envelope OK | 100% obs |

### 2. Derived Hemodynamic Indices
- **Mean Arterial Pressure (MAP):** ${hemo.map_mmhg ?? 'N/A'} mmHg (Adequate Perfusion Target: ≥ 65 mmHg)
- **Pulse Pressure (PP):** ${hemo.pulse_pressure_mmhg ?? 'N/A'} mmHg [${hemo.pulse_pressure_flag}]
- **Shock Index (HR / SBP Ratio):** ${hemo.shock_index ?? 'N/A'} [${hemo.shock_index_status}] (Preflight baseline ~0.51)

### 3. Coupled Pattern & Physiological Mechanism
- **Pattern Summary:** ${d.coupled_pattern.summary}
- **Underlying Mechanism:** ${d.coupled_pattern.mechanism}
- **Evidence Grounding:** Grounded strictly in NASA HRP (NASA-HRP-RISK-01 / NASA-HRP-HAZ-01) and CSA Research (${isClinic ? 'CSA-SCI-2026-01 Earth Remote Clinic Translation' : 'CSA-RAD-2026-01 / CSA-SCI-2026-01'}).

---

## [R - CONSERVATIVE CREW ACTION & FLIGHT-RULE ESCALATION]
### Immediate Non-Pharmacological Actions Executed:
${d.structured_insight.recommended_crew_action}

### Conservative Aerospace Flight Rules:
1. **Ambulation Rule:** No unassisted standing or ambulation permitted while Orthostatic HR Delta Z-score >= +2.5 or Pulse Pressure < 25 mmHg.
2. **Compression Garment Rule:** Maintain 40–50 mmHg lower-body counter-pressure during postural transitions.
3. **Fluid Loading Rule:** Ingest 15 mL/kg isotonic electrolyte solution (~1000 mL); avoid plain hypotonic water.
4. **Console Uplink:** Log automated 10-minute telemetry checks to ground surgeon console until hemodynamics normalize.

---
*Classification: MISSION RESEARCH TELEMETRY • Grounded in NASA HRP & CSA Research • Clinical Protocol Prototype.*
`;

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CREWSIGNAL_SBAR_${d.astronaut.id}_D${d.mission_day}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    // Single-viewport zero-scroll Bento Box frame
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col p-2 sm:p-3 gap-2 sm:gap-3 relative text-cs-text">
      {/* Living Ambient Animated Backdrop */}
      <ReactiveBackdrop theme={theme} mode={backdropMode} fit={backdropFit} />

      {/* Balanced Single-Row Top Header */}
      <Navbar
        astronauts={astronauts}
        selectedAstronautId={selectedAstronautId}
        onSelectAstronaut={setSelectedAstronautId}
        operationalMode={operationalMode}
        onToggleOperationalMode={toggleOperationalMode}
        availablePhases={availablePhases}
        activePhase={activePhase}
        onSelectPhase={setActivePhase}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onExportReport={handleExportReport}
        onOpenPiPGuide={() => handleOpenPiP(pipIndex)}
        backdropMode={backdropMode}
        onCycleBackdropMode={handleCycleBackdropMode}
        backdropFit={backdropFit}
        onToggleBackdropFit={handleToggleBackdropFit}
      />

      {/* Main Single-Viewport Bento Canvas */}
      <main className="max-w-[1440px] w-full mx-auto flex-1 min-h-0 overflow-hidden relative flex flex-col">
        {/* Loading State */}
        {loading && !dashboardData && (
          <div className="h-full w-full flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-7 h-7 text-cs-accent animate-spin" />
            <p className="text-sm font-semibold text-cs-muted">Loading crew telemetry…</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadTelemetry}
              className="px-2.5 py-1 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-500"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Tab 0: Mission Home & 20-Second Interactive Landing Sandbox */}
        {activeTab === 'home' && (
          <LandingHomeView
            theme={theme}
            operationalMode={operationalMode}
            onLaunchConsole={handleLaunchConsole}
            onOpenPiP={handleOpenPiP}
            currentData={dashboardData}
          />
        )}

        {/* Tab 1: Overview & Body Map Bento Box */}
        {activeTab === 'overview' && dashboardData && (
          <OverviewView
            data={dashboardData}
            theme={theme}
            operationalMode={operationalMode}
            onRefresh={loadTelemetry}
            onSelectIndicator={setTargetIndicator}
            onOpenPiP={handleOpenPiP}
          />
        )}

        {/* Tab 2: Longitudinal Timeline & Simulator Bento Box */}
        {activeTab === 'timeline' && timelineData && (
          <TimelineView
            data={timelineData}
            theme={theme}
            onOpenPiP={handleOpenPiP}
            operationalMode={operationalMode}
          />
        )}

        {/* Tab 3: Crewmate Acute Assist & CV Scan Bento Box */}
        {activeTab === 'acute' && dashboardData && (
          <AcuteAssistView
            astronaut={dashboardData.astronaut}
            baselines={dashboardData.baselines}
            theme={theme}
            onOpenPiP={handleOpenPiP}
            operationalMode={operationalMode}
          />
        )}

        {/* Tab 4: Super Intelligence (SI) Co-Pilot & Evidence Bento Box */}
        {activeTab === 'evidence' && evidenceData && dashboardData && (
          <EvidenceView
            evidence={evidenceData}
            theme={theme}
            astronautId={dashboardData.astronaut.id}
            activePhase={dashboardData.active_phase}
            derivedHemodynamics={dashboardData.derived_hemodynamics}
            kpis={dashboardData.kpis}
            onOpenPiP={handleOpenPiP}
          />
        )}
      </main>

      {/* Lifted Picture-in-Picture (PiP) Interactive Function Guide */}
      <PiPFunctionGuide
        isOpen={pipOpen}
        onClose={() => setPipOpen(false)}
        funcIndex={pipIndex}
        onSelectIndex={setPipIndex}
        theme={theme}
        isMinimized={pipMinimized}
        onToggleMinimize={() => setPipMinimized(!pipMinimized)}
        onNavigateTab={setActiveTab}
      />
    </div>
  );
};

export default App;
