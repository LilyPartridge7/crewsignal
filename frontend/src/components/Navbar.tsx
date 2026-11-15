import React from 'react';
import {
  Activity,
  ShieldAlert,
  UserCheck,
  Orbit,
  Rocket,
  Hospital,
  Download,
  Sun,
  Moon,
  LayoutDashboard,
  LineChart,
  Siren,
  BookOpenCheck,
  PictureInPicture2,
  Compass,
  Eye,
  Sparkles,
  Pause,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Astronaut } from '../types';

export type NavTabId = 'home' | 'overview' | 'timeline' | 'acute' | 'evidence';

interface NavbarProps {
  astronauts: Astronaut[];
  selectedAstronautId: string;
  onSelectAstronaut: (id: string) => void;
  operationalMode: 'spacecraft' | 'clinic';
  onToggleOperationalMode: () => void;
  availablePhases: string[];
  activePhase: string;
  onSelectPhase: (phase: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  onExportReport: () => void;
  onOpenPiPGuide: () => void;
  backdropMode?: 'video' | 'ambient' | 'paused';
  onCycleBackdropMode?: () => void;
  backdropFit?: 'wide' | 'cover';
  onToggleBackdropFit?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  astronauts,
  selectedAstronautId,
  onSelectAstronaut,
  operationalMode,
  onToggleOperationalMode,
  availablePhases,
  activePhase,
  onSelectPhase,
  theme,
  onToggleTheme,
  activeTab,
  onSelectTab,
  onExportReport,
  onOpenPiPGuide,
  backdropMode = 'video',
  onCycleBackdropMode,
  backdropFit = 'wide',
  onToggleBackdropFit,
}) => {
  const isDark = theme === 'dark';
  const isClinic = operationalMode === 'clinic';

  const phaseShortNames: Record<string, string> = {
    'Preflight (1g Baseline)': 'Preflight 1g',
    'In-Flight (0g Transit)': 'In-Flight 0g',
    'Planetary/Lunar Surface (Partial-g)': 'Lunar 0.16g',
    'Early Postflight (1g Return)': 'Early Postflight 1g',
    'Late Postflight Recovery': 'Late Recovery',
  };

  const navTabs: { id: NavTabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'home',
      label: 'Mission Home',
      icon: <Compass className="w-4 h-4" strokeWidth={2} />,
    },
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4" strokeWidth={2} />,
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: <LineChart className="w-4 h-4" strokeWidth={2} />,
    },
    {
      id: 'acute',
      label: 'Acute Assist',
      icon: <Siren className="w-4 h-4" strokeWidth={2} />,
    },
    {
      id: 'evidence',
      label: 'SI & Evidence',
      icon: <BookOpenCheck className="w-4 h-4" strokeWidth={2} />,
    },
  ];

  return (
    <header className={`max-w-[1440px] w-full mx-auto shrink-0 rounded-2xl border transition-all duration-300 ${
      isClinic
        ? 'border-transparent dark:border-emerald-500/20 bg-emerald-950/15 dark:bg-[#071714]/60 shadow-sm'
        : 'border-transparent dark:border-white/10 bg-white/25 dark:bg-[#0B1120]/50 shadow-sm'
    } backdrop-blur-md select-none`}>
      {/* Row 1 — Brand, Scientific Provenance & Global Controls */}
      <div className="min-h-12 py-1.5 px-3 sm:px-5 flex items-center justify-between gap-3 border-b border-slate-900/[0.06] dark:border-slate-800/40 overflow-x-auto scrollbar-none">
        {/* Left: Brand & Responsive Provenance Badge */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Activity className={`w-5 h-5 sm:w-6 sm:h-6 animate-pulse ${isClinic ? 'text-emerald-500' : 'text-sky-500'}`} strokeWidth={2} />
            <span className="text-lg sm:text-xl font-extrabold tracking-tight whitespace-nowrap text-slate-900 dark:text-white">
              CrewSignal
            </span>
          </div>

          <div className={`whitespace-nowrap text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 rounded-full flex items-center gap-1.5 border ${
            isClinic
              ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/30'
              : 'bg-white/20 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-transparent dark:border-slate-700'
          }`}>
            {isClinic ? (
              <>
                <Hospital className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">TERRESTRIAL CLINIC • SVALBARD ARCTIC STATION • DUAL-USE</span>
                <span className="inline md:hidden">SVALBARD CLINIC</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-sky-500 shrink-0" strokeWidth={2} />
                <span className="hidden md:inline">AEROSPACE TELEMETRY • NASA HRP &amp; CSA • PROTOCOL ACTIVE</span>
                <span className="inline md:hidden">NASA HRP • PROTOCOL ACTIVE</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Global Operational Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Crew Selector */}
          <div className="h-9 px-3 rounded-lg text-xs font-bold whitespace-nowrap border border-transparent dark:border-slate-700 bg-white/30 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 focus-within:ring-1 focus-within:ring-sky-500">
            <UserCheck className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={2} />
            <select
              value={selectedAstronautId}
              onChange={(e) => onSelectAstronaut(e.target.value)}
              className="bg-transparent font-bold cursor-pointer focus:outline-none text-slate-800 dark:text-slate-200"
              title="Select Active Astronaut Profile"
            >
              {astronauts.length > 0 ? (
                astronauts.map((ast) => (
                  <option key={ast.id} value={ast.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {ast.id === 'SYNTH-AST-01' ? 'Crew A-01' : 'Crew B-02'}
                  </option>
                ))
              ) : (
                <>
                  <option value="SYNTH-AST-01" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Crew A-01</option>
                  <option value="SYNTH-AST-02" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Crew B-02</option>
                </>
              )}
            </select>
          </div>

          {/* Mission Phase Selector */}
          <div className="h-9 px-3 rounded-lg text-xs font-bold whitespace-nowrap border border-transparent dark:border-slate-700 bg-white/30 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 flex items-center gap-1.5 focus-within:ring-1 focus-within:ring-sky-500">
            <Orbit className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={2} />
            <select
              value={activePhase}
              onChange={(e) => onSelectPhase(e.target.value)}
              className="bg-transparent font-bold cursor-pointer focus:outline-none text-slate-800 dark:text-slate-200 max-w-[155px] truncate"
              title="Select Mission Gravitational Phase"
            >
              {availablePhases.map((p) => (
                <option key={p} value={p} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {phaseShortNames[p] || p}
                </option>
              ))}
            </select>
          </div>

          {/* Environment Mode Toggle */}
          <button
            type="button"
            onClick={onToggleOperationalMode}
            className={`h-9 px-3 rounded-lg text-xs font-bold whitespace-nowrap border flex items-center gap-1.5 transition-colors shadow-2xs ${
              isClinic
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                : 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/25'
            }`}
            title="Toggle Spacecraft Flight Console vs. Earth Remote Clinic Dual-Use Mode"
          >
            {isClinic ? (
              <Hospital className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2} />
            ) : (
              <Rocket className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" strokeWidth={2} />
            )}
            <span>{isClinic ? 'Earth Clinic' : 'Spacecraft'}</span>
          </button>

          {/* Export Report Button */}
          <button
            type="button"
            onClick={onExportReport}
            className="h-9 px-3 rounded-lg text-xs font-bold whitespace-nowrap border flex items-center gap-1.5 border-transparent dark:border-slate-700/60 bg-white/25 dark:bg-slate-800/60 hover:bg-white/40 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors shadow-2xs backdrop-blur-sm"
            title="Export SBAR Flight-Surgeon Briefing"
          >
            <Download className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>SBAR</span>
          </button>

          {/* Backdrop Mode Button (Video / Ambient CSS / Paused) */}
          {onCycleBackdropMode && (
            <button
              type="button"
              onClick={onCycleBackdropMode}
              className="h-9 px-2.5 rounded-lg border border-transparent dark:border-slate-700/60 bg-white/25 dark:bg-slate-800/60 hover:bg-white/40 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs text-xs font-bold backdrop-blur-sm"
              title={`Backdrop Mode: ${backdropMode === 'video' ? 'Video Active' : backdropMode === 'ambient' ? 'Pure CSS Mesh (Zero GPU Lag)' : 'Paused'} (Click to cycle)`}
            >
              {backdropMode === 'video' ? (
                <Eye className="w-3.5 h-3.5 text-sky-500 shrink-0" strokeWidth={2} />
              ) : backdropMode === 'ambient' ? (
                <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={2} />
              ) : (
                <Pause className="w-3.5 h-3.5 text-amber-500 shrink-0" strokeWidth={2} />
              )}
              <span className="capitalize hidden xl:inline text-[11px]">
                {backdropMode === 'video' ? 'Video' : backdropMode === 'ambient' ? 'Fast Mesh' : 'Paused'}
              </span>
            </button>
          )}

          {/* Backdrop Fit Toggle (Wide Fit = Native 100% Crisp / Cover = Full Screen) */}
          {onToggleBackdropFit && backdropMode !== 'ambient' && (
            <button
              type="button"
              onClick={onToggleBackdropFit}
              className="h-9 px-2.5 rounded-lg border border-transparent dark:border-slate-700/60 bg-white/25 dark:bg-slate-800/60 hover:bg-white/40 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs text-xs font-bold backdrop-blur-sm"
              title={
                backdropFit === 'wide'
                  ? 'Wide Fit: Native resolution without cropping/zooming. Click to switch to Cover.'
                  : 'Cover: Full screen stretch. Click to switch to Wide Fit.'
              }
            >
              {backdropFit === 'wide' ? (
                <Minimize2 className="w-3.5 h-3.5 text-sky-500 shrink-0" strokeWidth={2} />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-slate-500 shrink-0" strokeWidth={2} />
              )}
              <span className="capitalize hidden 2xl:inline text-[11px]">
                {backdropFit === 'wide' ? 'Wide Fit' : 'Cover'}
              </span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="h-9 w-9 rounded-lg border border-transparent dark:border-slate-700/60 bg-white/25 dark:bg-slate-800/60 hover:bg-white/40 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 transition-colors shadow-2xs backdrop-blur-sm"
            title="Toggle Light / Dark Mode"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 shrink-0" strokeWidth={2} />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 shrink-0" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {/* Row 2 — Compact Icon Navigation Tabs & PiP Launcher */}
      <div className="min-h-12 py-1 px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4 overflow-x-auto scrollbar-none">
        {/* Left: Clean Icon-Led Navigation Buttons */}
        <nav className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`h-9 px-2.5 sm:px-3.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap flex items-center gap-1.5 sm:gap-2 transition-colors border ${
                  isActive
                    ? 'bg-sky-600 text-white border-sky-500 shadow-sm dark:bg-sky-500'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Prominent PiP Guide Launcher */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPiPGuide}
            className="h-9 px-3 sm:px-3.5 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 sm:gap-2 bg-violet-600 hover:bg-violet-500 text-white shadow-sm transition-colors border border-violet-400/40"
            title="Open Interactive PiP Function Guide"
          >
            <PictureInPicture2 className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span>PiP Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
};
