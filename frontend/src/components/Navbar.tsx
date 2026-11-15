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
    { id: 'home', label: 'Home', icon: <Compass className="h-4 w-4" strokeWidth={2} /> },
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" strokeWidth={2} /> },
    { id: 'timeline', label: 'Recovery', icon: <LineChart className="h-4 w-4" strokeWidth={2} /> },
    { id: 'acute', label: 'Acute assist', icon: <Siren className="h-4 w-4" strokeWidth={2} /> },
    { id: 'evidence', label: 'Evidence', icon: <BookOpenCheck className="h-4 w-4" strokeWidth={2} /> },
  ];

  const iconBtn =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cs-line bg-cs-well text-cs-text transition-colors hover:bg-cs-panel-strong';
  const selectWrap =
    'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-cs-line bg-cs-well pl-3 pr-2 text-sm font-semibold text-cs-text focus-within:border-cs-accent';

  return (
    <header className="cs-panel mx-auto w-full max-w-[1440px] shrink-0 select-none !rounded-[28px] px-3 py-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Brand */}
        <div
          className="flex items-center gap-2.5 pl-1"
          title="AEROSPACE TELEMETRY. Non-Diagnostic Prototype. Grounded in NASA HRP & CSA Research."
        >
          <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-cs-accent text-cs-accent-ink">
            <Activity className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-extrabold tracking-tight">CrewSignal</span>
          <span className="hidden items-center gap-1.5 rounded-full border border-cs-line px-2.5 py-1 text-xs font-semibold text-cs-muted 2xl:inline-flex">
            {isClinic ? <Hospital className="h-3.5 w-3.5" strokeWidth={2} /> : <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />}
            {isClinic ? 'Svalbard clinic mode' : 'Research prototype, not for diagnosis'}
          </span>
        </div>

        {/* Tabs */}
        <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-0.5 xl:order-none xl:w-auto" aria-label="Sections">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-cs-panel-strong text-cs-text shadow-sm' : 'text-cs-muted hover:text-cs-text'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <label className={selectWrap} title="Crew member">
            <UserCheck className="h-4 w-4 text-cs-muted" strokeWidth={2} />
            <span className="sr-only">Crew member</span>
            <select
              value={selectedAstronautId}
              onChange={(e) => onSelectAstronaut(e.target.value)}
              className="cursor-pointer bg-transparent pr-1 focus:outline-none"
            >
              {(astronauts.length ? astronauts.map((a) => a.id) : ['SYNTH-AST-01', 'SYNTH-AST-02']).map((id) => (
                <option key={id} value={id} className="bg-white text-slate-900">
                  {id === 'SYNTH-AST-01' ? 'Crew A-01' : 'Crew B-02'}
                </option>
              ))}
            </select>
          </label>

          <label className={selectWrap} title="Mission phase">
            <Orbit className="h-4 w-4 text-cs-muted" strokeWidth={2} />
            <span className="sr-only">Mission phase</span>
            <select
              value={activePhase}
              onChange={(e) => onSelectPhase(e.target.value)}
              className="max-w-[150px] cursor-pointer truncate bg-transparent pr-1 focus:outline-none"
            >
              {availablePhases.map((p) => (
                <option key={p} value={p} className="bg-white text-slate-900">
                  {phaseShortNames[p] || p}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onToggleOperationalMode}
            className={iconBtn}
            title={isClinic ? 'Switch to spacecraft console' : 'Switch to Earth clinic mode'}
            aria-label={isClinic ? 'Switch to spacecraft console' : 'Switch to Earth clinic mode'}
          >
            {isClinic ? <Hospital className="h-4 w-4" strokeWidth={2} /> : <Rocket className="h-4 w-4" strokeWidth={2} />}
          </button>

          <button type="button" onClick={onExportReport} className={iconBtn} title="Download SBAR handoff" aria-label="Download SBAR handoff">
            <Download className="h-4 w-4" strokeWidth={2} />
          </button>

          {onCycleBackdropMode && (
            <button
              type="button"
              onClick={onCycleBackdropMode}
              className={iconBtn}
              title={`Background: ${backdropMode === 'video' ? 'video' : backdropMode === 'ambient' ? 'still' : 'paused'} (click to change)`}
              aria-label="Change background mode"
            >
              {backdropMode === 'video' ? (
                <Eye className="h-4 w-4" strokeWidth={2} />
              ) : backdropMode === 'ambient' ? (
                <Sparkles className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Pause className="h-4 w-4" strokeWidth={2} />
              )}
            </button>
          )}

          {onToggleBackdropFit && backdropMode !== 'ambient' && (
            <button
              type="button"
              onClick={onToggleBackdropFit}
              className={`${iconBtn} hidden sm:inline-flex`}
              title={backdropFit === 'wide' ? 'Fill the screen with the video' : 'Show the whole video frame'}
              aria-label="Change video fit"
            >
              {backdropFit === 'wide' ? <Maximize2 className="h-4 w-4" strokeWidth={2} /> : <Minimize2 className="h-4 w-4" strokeWidth={2} />}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            className={iconBtn}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="h-4 w-4" strokeWidth={2} /> : <Moon className="h-4 w-4" strokeWidth={2} />}
          </button>

          <button type="button" onClick={onOpenPiPGuide} className="cs-btn-primary hidden !px-4 md:inline-flex" title="Open the feature guide">
            <PictureInPicture2 className="h-4 w-4" strokeWidth={2} />
            <span>Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
};
