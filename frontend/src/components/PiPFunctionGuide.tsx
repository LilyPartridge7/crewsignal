import React, { useState } from 'react';
import {
  X,
  Minus,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Wrench,
  MapPin,
  Target,
  PictureInPicture2,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from 'lucide-react';
import { NavTabId } from './Navbar';

export type PiPFunctionId =
  | 'personal_baseline'
  | 'body_map'
  | 'derived_hemodynamics'
  | 'orthostatic_timer'
  | 'gatekeeper'
  | 'countermeasure_sim'
  | 'acute_triage'
  | 'vision_vitals'
  | 'cv_vitals_capture'
  | 'si_copilot'
  | 'evidence_graph';

export type PiPTopicKey = PiPFunctionId;

export const PIP_TOPIC_KEYS: PiPFunctionId[] = [
  'personal_baseline',
  'body_map',
  'derived_hemodynamics',
  'orthostatic_timer',
  'gatekeeper',
  'countermeasure_sim',
  'acute_triage',
  'vision_vitals',
  'si_copilot',
  'evidence_graph',
];

export interface TopicGuideItem {
  id: PiPFunctionId;
  title: string;
  subtitle: string;
  targetTab: NavTabId;
  targetTabLabel: string;
  howToUse: [string, string];
  whereToUse: [string, string];
  forWhatToUse: [string, string];
  renderSchematic: (isDark: boolean) => React.ReactNode;
}

interface PiPFunctionGuideProps {
  isOpen: boolean;
  onClose: () => void;
  funcIndex: number;
  onSelectIndex: (index: number) => void;
  theme: 'dark' | 'light';
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onNavigateTab?: (tab: NavTabId) => void;
}

export const PiPFunctionGuide: React.FC<PiPFunctionGuideProps> = ({
  isOpen,
  onClose,
  funcIndex,
  onSelectIndex,
  theme,
  isMinimized,
  onToggleMinimize,
  onNavigateTab,
}) => {
  const isDark = theme === 'dark';
  // Position toggle: default to top-right to prevent occluding bottom-right action buttons in View 1
  const [position, setPosition] = useState<'top-right' | 'bottom-right'>('top-right');

  const topics: TopicGuideItem[] = [
    // 1. Gravity-Adaptive Personal Baseline
    {
      id: 'personal_baseline',
      title: 'Gravity-Adaptive Personal Baseline',
      subtitle: 'N=30 day preflight Gaussian reference envelopes',
      targetTab: 'overview',
      targetTabLabel: 'Open Personal Baseline (View 1)',
      howToUse: [
        'Inspect KPI cards for live Delta and Z-scores against individual baseline envelopes.',
        'Watch for Z-score pills turning Amber (±1.5 SD Watch) or Rose (±2.5 SD Action).',
      ],
      whereToUse: [
        'Row 1 KPI cards across Overview, Timeline, and Acute Assist.',
        'Mission phase transitions (1g Baseline → 0g Transit → 0.16g Lunar → 1g Return).',
      ],
      forWhatToUse: [
        'Eliminating generic population bias by comparing astronauts to their own preflight biology.',
        'Distinguishing adaptive physiological compensation from decompensation strain.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <path
            d="M 20 66 Q 90 66 120 42 Q 140 16 140 16 Q 140 16 160 42 Q 190 66 260 66"
            fill="none"
            stroke={isDark ? '#475569' : '#94A3B8'}
            strokeWidth="1.5"
          />
          <line x1="140" y1="16" x2="140" y2="66" stroke="#10B981" strokeWidth="1.5" strokeDasharray="2,2" />
          <text x="140" y="74" fontSize="7.5" textAnchor="middle" fill="#10B981" fontWeight="700">Mean 0.0</text>
          <line x1="180" y1="36" x2="180" y2="66" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="2,2" />
          <text x="180" y="74" fontSize="7.5" textAnchor="middle" fill="#F59E0B" fontWeight="700">+1.5 SD</text>
          <line x1="215" y1="52" x2="215" y2="66" stroke="#E11D48" strokeWidth="1.5" strokeDasharray="2,2" />
          <text x="215" y="74" fontSize="7.5" textAnchor="middle" fill="#E11D48" fontWeight="700">+2.5 SD</text>
          <circle cx="215" cy="52" r="4.5" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1.5" />
          <text x="222" y="46" fontSize="8" fontWeight="800" fill="#E11D48">Live Z +12.0</text>
        </svg>
      ),
    },

    // 2. Anatomical Skin-Tone Body Map
    {
      id: 'body_map',
      title: 'Anatomical Skin-Tone Body Map',
      subtitle: 'Regional vascular target reticles with zero hover shaking',
      targetTab: 'overview',
      targetTabLabel: 'Open Body Map (View 1)',
      howToUse: [
        'Click any anatomical hotspot (Heart, Baroreceptors, Central Aorta, Peripheral).',
        'Observe dynamic arterial (#DC2626) and venous (#2563EB) vessel highlights.',
      ],
      whereToUse: [
        'Overview Bento card (left column, Rows 2–6).',
        'Morning stand-test prep and pre-EVA cardiovascular screening.',
      ],
      forWhatToUse: [
        'Localizing baroreflex deconditioning, myocardial output, and splanchnic venous pooling.',
        'Connecting subjective astronaut symptoms to regional hemodynamics.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <circle cx="60" cy="22" r="10" fill={isDark ? '#D89F78' : '#F5D0B5'} stroke="#B97A52" strokeWidth="1" />
          <path d="M 54 33 L 66 33 L 70 52 L 50 52 Z" fill={isDark ? '#D89F78' : '#F5D0B5'} stroke="#B97A52" strokeWidth="1" />
          <path d="M 52 52 L 54 75 L 66 75 L 68 52 Z" fill={isDark ? '#D89F78' : '#F5D0B5'} stroke="#B97A52" strokeWidth="1" />
          <path d="M 60 35 L 60 55" stroke="#DC2626" strokeWidth="1.5" />
          <circle cx="60" cy="32" r="3.5" fill="#D97706" stroke="#FFF" strokeWidth="1" />
          <circle cx="58" cy="42" r="4" fill="#E11D48" stroke="#FFF" strokeWidth="1" />
          <circle cx="60" cy="62" r="3.5" fill="#10B981" stroke="#FFF" strokeWidth="1" />
          <text x="120" y="28" fontSize="8" fontWeight="700" fill={isDark ? '#38BDF8' : '#0284C7'}>Neck Baroreceptors</text>
          <text x="120" y="46" fontSize="8" fontWeight="700" fill="#E11D48">Heart &amp; Myocardium</text>
          <text x="120" y="66" fontSize="8" fontWeight="700" fill="#10B981">Peripheral Pooling</text>
        </svg>
      ),
    },

    // 3. Derived Hemodynamics (MAP / PP / SI)
    {
      id: 'derived_hemodynamics',
      title: 'Derived Hemodynamics (MAP / PP / SI)',
      subtitle: 'Real-time multi-vital indices calculated automatically',
      targetTab: 'overview',
      targetTabLabel: 'Inspect Hemodynamics (View 1)',
      howToUse: [
        'Check Mean Arterial Pressure (MAP = DBP + 1/3(SBP - DBP)) against >= 65 mmHg target.',
        'Flag narrowed Pulse Pressure (< 25 mmHg) and elevated Shock Index (HR / SBP >= 0.70).',
      ],
      whereToUse: [
        'Top Row Bento cards (Cards 5, 6, and 7) and SBAR Handoff packet.',
        'Evaluating acute presyncope or lightheadedness upon standing.',
      ],
      forWhatToUse: [
        'Detecting acute stroke-volume reduction and hypovolemia before syncope occurs.',
        'Quantifying sympathetic overdrive and vital organ perfusion adequacy.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <rect x="15" y="20" width="75" height="40" rx="6" fill="#0D9488" fillOpacity="0.2" stroke="#0D9488" strokeWidth="1" />
          <text x="52" y="36" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#0D9488">MAP</text>
          <text x="52" y="50" fontSize="8.5" fontWeight="800" textAnchor="middle" fill={isDark ? '#E2E8F0' : '#0F172A'}>85.2 mmHg</text>

          <rect x="102" y="20" width="75" height="40" rx="6" fill="#6366F1" fillOpacity="0.2" stroke="#6366F1" strokeWidth="1" />
          <text x="139" y="36" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#6366F1">Pulse Pressure</text>
          <text x="139" y="50" fontSize="8.5" fontWeight="800" textAnchor="middle" fill={isDark ? '#E2E8F0' : '#0F172A'}>44.7 mmHg</text>

          <rect x="190" y="20" width="75" height="40" rx="6" fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="1" />
          <text x="227" y="36" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#F59E0B">Shock Index</text>
          <text x="227" y="50" fontSize="8.5" fontWeight="800" textAnchor="middle" fill={isDark ? '#E2E8F0' : '#0F172A'}>0.67 (Normal)</text>
        </svg>
      ),
    },

    // 4. 3-Min Guided Orthostatic Protocol Timer
    {
      id: 'orthostatic_timer',
      title: '3-Min Guided Orthostatic Timer',
      subtitle: '90s Supine Rest → 90s Stand / LBNP challenge',
      targetTab: 'overview',
      targetTabLabel: 'Launch Orthostatic Timer (View 1)',
      howToUse: [
        'Click "Start" or use "Fast-Forward" for instant verification.',
        'Observe phase timer transitioning from Supine Rest to Active Stand.',
      ],
      whereToUse: [
        'Overview Right Bento card (Vitals Logger) and Acute Assist View.',
        'Routine morning self-check and postflight re-adaptation stand-tests.',
      ],
      forWhatToUse: [
        'Standardizing postural delta timing according to NASA spaceflight clinical standards.',
        'Capturing peak compensatory tachycardia without timing human error.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <circle cx="70" cy="40" r="28" fill="none" stroke="#38BDF8" strokeWidth="4" />
          <text x="70" y="37" fontSize="8" fontWeight="800" textAnchor="middle" fill="#38BDF8">90s</text>
          <text x="70" y="48" fontSize="6.5" textAnchor="middle" fill={isDark ? '#94A3B8' : '#64748B'}>Supine</text>

          <line x1="110" y1="40" x2="160" y2="40" stroke="#818CF8" strokeWidth="2" strokeDasharray="3,3" />

          <circle cx="205" cy="40" r="28" fill="none" stroke="#10B981" strokeWidth="4" />
          <text x="205" y="37" fontSize="8" fontWeight="800" textAnchor="middle" fill="#10B981">90s</text>
          <text x="205" y="48" fontSize="6.5" textAnchor="middle" fill={isDark ? '#94A3B8' : '#64748B'}>Standing</text>
        </svg>
      ),
    },

    // 5. Context & Artifact Gatekeeper
    {
      id: 'gatekeeper',
      title: 'Context & Artifact Gatekeeper',
      subtitle: 'Physiological boundary validation and exertion contextualization',
      targetTab: 'overview',
      targetTabLabel: 'Open Vitals Logger (View 1)',
      howToUse: [
        'Select collection context: Morning Fasted, Post-Exercise (<30 min), Post-EVA, or Acute.',
        'Input vitals are rejected if SBP <= DBP or values fall outside human survivability limits.',
      ],
      whereToUse: [
        'Quick Vitals Logger drawer, Acute Assist modal, and telemetry session store.',
        'Preventing false positive medical alerts after strenuous EVA or exercise workouts.',
      ],
      forWhatToUse: [
        'Suppressing false medical alarms by recognizing expected post-exercise tachycardia.',
        'Maintaining high telemetry integrity in intermittent deep-space self-check logs.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <rect x="25" y="22" width="90" height="36" rx="6" fill="#F59E0B" fillOpacity="0.2" stroke="#F59E0B" strokeWidth="1" />
          <text x="70" y="38" fontSize="7" fontWeight="700" textAnchor="middle" fill="#F59E0B">Post-Exercise</text>
          <text x="70" y="49" fontSize="6.5" textAnchor="middle" fill={isDark ? '#CBD5E1' : '#475569'}>HR 88 bpm</text>

          <line x1="120" y1="40" x2="155" y2="40" stroke="#10B981" strokeWidth="2" />

          <rect x="160" y="22" width="95" height="36" rx="6" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="1" />
          <text x="207" y="36" fontSize="7" fontWeight="700" textAnchor="middle" fill="#10B981">Context Verified</text>
          <text x="207" y="48" fontSize="6" textAnchor="middle" fill={isDark ? '#94A3B8' : '#64748B'}>False Alert Muted</text>
        </svg>
      ),
    },

    // 6. Countermeasure Protocol Simulator
    {
      id: 'countermeasure_sim',
      title: 'Countermeasure Protocol Simulator',
      subtitle: 'NASA HRP recovery curves across postflight Days 91 to 120',
      targetTab: 'timeline',
      targetTabLabel: 'Launch Countermeasure Simulator (View 2)',
      howToUse: [
        'Adjust 3 sliders: Fluid Loading (0–100%), LBNP Sessions (0–5/wk), and Daily Exercise (0–90 min).',
        'Observe live updated 30-day projected orthostatic HR recovery curves in the timeline.',
      ],
      whereToUse: [
        'Timeline & Simulator Bento View (Right column, Rows 1–6).',
        'Pre-reentry briefing and postflight reconditioning planning.',
      ],
      forWhatToUse: [
        'Evaluating whether higher countermeasure adherence accelerates plasma volume recovery by >40%.',
        'Optimizing astronaut-specific countermeasure dosage within tight mission schedules.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <path d="M 25 25 Q 120 28 250 65" fill="none" stroke="#E11D48" strokeWidth="1.5" strokeDasharray="3,3" />
          <text x="180" y="30" fontSize="7" fill="#E11D48">Zero Countermeasures</text>

          <path d="M 25 25 Q 80 55 250 65" fill="none" stroke="#10B981" strokeWidth="2" />
          <text x="120" y="60" fontSize="7.5" fontWeight="700" fill="#10B981">Full NASA Protocol (Adherence 0.83)</text>
        </svg>
      ),
    },

    // 7. Crewmate Acute Assist & SBAR Uplink
    {
      id: 'acute_triage',
      title: 'Crewmate Acute Assist & SBAR Uplink',
      subtitle: '3-step emergency stabilization & flight-surgeon handoff packet',
      targetTab: 'acute',
      targetTabLabel: 'Open Acute Assist & SBAR (View 3)',
      howToUse: [
        'Select symptom (Presyncope / Dizziness / Tachycardia) and execute immediate 4-step recumbent positioning.',
        'Click "Copy SBAR Handoff" or "Download SBAR Packet" to transmit standardized telemetry to ground console.',
      ],
      whereToUse: [
        'Acute Assist Bento View (Left column, Rows 1–6).',
        'Postflight landing capsule extraction and deep-space comm-delay medical events.',
      ],
      forWhatToUse: [
        'Enforcing standardized aerospace SBAR (Situation, Background, Assessment, Recommendation) communications.',
        'Guiding non-doctor astronauts through non-pharmacological emergency counter-pressure protocols.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <rect x="15" y="24" width="70" height="32" rx="5" fill="#0284C7" fillOpacity="0.2" stroke="#0284C7" strokeWidth="1" />
          <text x="50" y="44" fontSize="7" fontWeight="700" textAnchor="middle" fill="#0284C7">1. Supine Rest</text>

          <line x1="90" y1="40" x2="105" y2="40" stroke="#0284C7" strokeWidth="1.5" />

          <rect x="108" y="24" width="72" height="32" rx="5" fill="#0284C7" fillOpacity="0.2" stroke="#0284C7" strokeWidth="1" />
          <text x="144" y="44" fontSize="7" fontWeight="700" textAnchor="middle" fill="#0284C7">2. 40-50 mmHg</text>

          <line x1="184" y1="40" x2="198" y2="40" stroke="#0284C7" strokeWidth="1.5" />

          <rect x="200" y="24" width="70" height="32" rx="5" fill="#E11D48" fillOpacity="0.2" stroke="#E11D48" strokeWidth="1" />
          <text x="235" y="44" fontSize="7" fontWeight="700" textAnchor="middle" fill="#E11D48">3. SBAR Uplink</text>
        </svg>
      ),
    },

    // 8. Computer Vision Cuff & Monitor OCR
    {
      id: 'vision_vitals',
      title: 'Computer Vision Cuff & Monitor OCR',
      subtitle: 'Mid-sternal reticle alignment guide & digital screen character extraction',
      targetTab: 'acute',
      targetTabLabel: 'Open CV Reticle & OCR Scanner (View 3)',
      howToUse: [
        'Mode A: Align upper-arm cuff with the mid-sternal reticle to eliminate hydrostatic column bias (0.77 mmHg/cm).',
        'Mode B: Snap webcam, upload photo, or click "Load Sample Monitor Screen" to extract SYS / DIA / HR via tesseract.js.',
      ],
      whereToUse: [
        'Acute Assist View (Right column) and Quick Vitals Logger.',
        'Microgravity habitats where zero-g posture alters arm elevation relative to heart level.',
      ],
      forWhatToUse: [
        'Eliminating hydrostatic pressure measurement artifacts in altered gravity.',
        'Rapidly digitizing commercial medical monitors with zero typing latency.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <line x1="20" y1="40" x2="260" y2="40" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="4,3" />
          <rect x="35" y="24" width="75" height="32" rx="4" fill="none" stroke="#10B981" strokeWidth="1.5" />
          <text x="72" y="42" fontSize="7" textAnchor="middle" fill="#10B981" fontWeight="700">CUFF ALIGNED</text>
          <circle cx="140" cy="40" r="10" fill="none" stroke="#38BDF8" strokeWidth="1" />
          <circle cx="140" cy="40" r="2.5" fill="#38BDF8" />
          <rect x="180" y="20" width="85" height="40" rx="4" fill={isDark ? '#1E293B' : '#FFF'} stroke="#6366F1" strokeWidth="1" />
          <text x="222" y="34" fontSize="7" textAnchor="middle" fill="#6366F1" fontWeight="700">OCR PARSER</text>
          <text x="222" y="46" fontSize="7" textAnchor="middle" fill="#10B981" fontWeight="800">118 / 76 / 62</text>
        </svg>
      ),
    },

    // 9. Neuro-Symbolic SI Co-Pilot
    {
      id: 'si_copilot',
      title: 'Neuro-Symbolic SI Co-Pilot',
      subtitle: 'Deterministic biomedical knowledge graph synthesis with offline fallback',
      targetTab: 'evidence',
      targetTabLabel: 'Consult SI Co-Pilot (View 4)',
      howToUse: [
        'Click one-click operational inquiry chips or type custom clinical questions in the query bar.',
        'Review max 4 concise evidence-grounded bullets with clickable NASA HRP and CSA citation pills.',
      ],
      whereToUse: [
        'SI Co-Pilot & Evidence Bento View (Left column, Rows 1–6).',
        'Deep-space transit where 20+ minute round-trip comm delays prevent live surgeon tele-consults.',
      ],
      forWhatToUse: [
        'Explaining complex coupled cardiovascular adaptation mechanisms strictly grounded in peer-reviewed clinical evidence.',
        'Correlating MAP, Pulse Pressure, and Shock Index against NASA flight hazard guides.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <rect x="15" y="20" width="65" height="40" rx="6" fill="#6366F1" fillOpacity="0.2" stroke="#6366F1" strokeWidth="1" />
          <text x="47" y="36" fontSize="7" fontWeight="700" textAnchor="middle" fill="#6366F1">Telemetry</text>
          <text x="47" y="48" fontSize="6.5" textAnchor="middle" fill={isDark ? '#CBD5E1' : '#475569'}>MAP / SI / PP</text>

          <line x1="84" y1="40" x2="105" y2="40" stroke="#6366F1" strokeWidth="1.5" />

          <rect x="108" y="16" width="75" height="48" rx="6" fill="#0284C7" fillOpacity="0.2" stroke="#0284C7" strokeWidth="1.5" />
          <text x="145" y="34" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#0284C7">Knowledge SI</text>
          <text x="145" y="48" fontSize="6" textAnchor="middle" fill="#10B981">NASA/CSA Nodes</text>

          <line x1="187" y1="40" x2="208" y2="40" stroke="#6366F1" strokeWidth="1.5" />

          <rect x="210" y="20" width="60" height="40" rx="6" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="1" />
          <text x="240" y="36" fontSize="7" fontWeight="700" textAnchor="middle" fill="#10B981">4 Bullets</text>
          <text x="240" y="48" fontSize="6.5" textAnchor="middle" fill={isDark ? '#CBD5E1' : '#475569'}>Citations</text>
        </svg>
      ),
    },

    // 10. NASA Flight Rules & Space Data Standards (CCSDS & FHIR)
    {
      id: 'evidence_graph',
      title: 'Flight Rules & Space Data Standards (CCSDS / FHIR)',
      subtitle: 'Autonomous Decision Support (Concept) & Interoperability Standards',
      targetTab: 'evidence',
      targetTabLabel: 'Explore Evidence Graph (View 4)',
      howToUse: [
        'Evaluate illustrative flight rules modeled on NASA Flight Rules (e.g. RULE-MED-B13-102 ambulation clearance).',
        'Export telemetry formatted to HL7 FHIR standards or modeled on CCSDS 133.0 space packets.',
      ],
      whereToUse: [
        'Overview Step 2 Header & Acute Assist Flight Surgeon SBAR console.',
        'Downlink transmission and postflight incident investigation black-box.',
      ],
      forWhatToUse: [
        'Verifying astronaut ambulation safety without relying on delayed ground communications.',
        'Providing cryptographic FIPS 180-4 SHA-256 tamper-evident telemetry logs for mission archives.',
      ],
      renderSchematic: () => (
        <svg viewBox="0 0 280 80" className="w-full h-full select-none">
          <rect width="280" height="80" rx="8" fill={isDark ? '#0B1120' : '#F1F5F9'} />
          <rect x="15" y="20" width="75" height="40" rx="6" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="1" />
          <text x="52" y="36" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#10B981">RULE-B13-102</text>
          <text x="52" y="50" fontSize="8.5" fontWeight="800" textAnchor="middle" fill={isDark ? '#E2E8F0' : '#0F172A'}>NASA GO</text>

          <rect x="102" y="20" width="75" height="40" rx="6" fill="#6366F1" fillOpacity="0.2" stroke="#6366F1" strokeWidth="1" />
          <text x="139" y="36" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#6366F1">CCSDS 133.0</text>
          <text x="139" y="50" fontSize="8.5" fontWeight="800" textAnchor="middle" fill={isDark ? '#E2E8F0' : '#0F172A'}>APID 0x04F2</text>

          <rect x="190" y="20" width="75" height="40" rx="6" fill="#0284C7" fillOpacity="0.2" stroke="#0284C7" strokeWidth="1" />
          <text x="227" y="36" fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#0284C7">HL7 FHIR</text>
          <text x="227" y="50" fontSize="8.5" fontWeight="800" textAnchor="middle" fill={isDark ? '#E2E8F0' : '#0F172A'}>LSAH Valid</text>
        </svg>
      ),
    },
  ];

  const currentTopic = topics[funcIndex] || topics[0];

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (funcIndex - 1 + topics.length) % topics.length;
    onSelectIndex(nextIdx);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (funcIndex + 1) % topics.length;
    onSelectIndex(nextIdx);
  };

  const handleTogglePosition = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPosition((prev) => (prev === 'top-right' ? 'bottom-right' : 'top-right'));
  };

  if (!isOpen) return null;

  // Minimized Floating Pill View (Zero Emojis, non-blocking)
  if (isMinimized) {
    return (
      <div className={`fixed ${position === 'top-right' ? 'top-28 right-4' : 'bottom-4 right-4'} z-[9999] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-150`}>
        <button
          type="button"
          onClick={onToggleMinimize}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full shadow-2xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold border-2 border-violet-400/50 transition-all hover:scale-105"
        >
          <PictureInPicture2 className="w-4 h-4 shrink-0" strokeWidth={2} />
          <span>PiP Guide ({funcIndex + 1}/10)</span>
          <Maximize2 className="w-3.5 h-3.5 ml-0.5 opacity-80 shrink-0" strokeWidth={2} />
        </button>
      </div>
    );
  }

  // Full Expanded Floating PiP Window (Responsive w-full on mobile, sm:w-[390px], non-colliding position toggle)
  return (
    <div className={`fixed ${position === 'top-right' ? 'top-24 sm:top-28 right-4 left-4 sm:left-auto' : 'bottom-4 right-4 left-4 sm:left-auto'} z-[9999] pointer-events-auto transition-all duration-200 flex justify-end`}>
      <div className="w-full sm:w-[390px] max-w-[390px] rounded-2xl border border-transparent dark:border-white/15 shadow-2xl backdrop-blur-xl bg-white/95 dark:bg-[#0F172A]/95 p-3.5 space-y-2.5 animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-white select-none">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-900/[0.06] dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-extrabold bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30">
              {funcIndex + 1}/10
            </span>
            <div className="truncate max-w-[170px]">
              <h4 className="text-xs font-extrabold truncate" title={currentTopic.title}>
                {currentTopic.title}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Position flip toggle (Top-Right <-> Bottom-Right) */}
            <button
              type="button"
              onClick={handleTogglePosition}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title={position === 'top-right' ? 'Move PiP to Bottom-Right' : 'Move PiP to Top-Right (Unblock Bottom Actions)'}
            >
              {position === 'top-right' ? (
                <ArrowDownRight className="w-4 h-4" strokeWidth={2} />
              ) : (
                <ArrowUpRight className="w-4 h-4" strokeWidth={2} />
              )}
            </button>
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Previous Function"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Next Function"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={onToggleMinimize}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Minimize to Floating Pill"
            >
              <Minus className="w-4 h-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Close Guide"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Visual Schematic Preview (h-28 rounded-lg p-2) */}
        <div className="h-28 w-full rounded-lg border border-slate-200 dark:border-slate-800 p-2 bg-[#F8FAFC] dark:bg-[#0B1120] overflow-hidden flex items-center justify-center">
          {currentTopic.renderSchematic(isDark)}
        </div>

        {/* 3 Color-Coded Structured Mini-Lists (Strictly 2 short text-xs font-semibold bullets each) */}
        <div className="space-y-2 text-xs">
          {/* How to Use (Blue Tinted Box) */}
          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-950 dark:text-blue-200">
            <div className="flex items-center gap-1.5 font-bold mb-1 text-blue-800 dark:text-blue-300">
              <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={2} />
              <span className="uppercase tracking-wider font-extrabold text-[11px]">How to Use</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 leading-snug font-semibold text-xs">
              <li>{currentTopic.howToUse[0]}</li>
              <li>{currentTopic.howToUse[1]}</li>
            </ul>
          </div>

          {/* Where to Use (Emerald Tinted Box) */}
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-950 dark:text-emerald-200">
            <div className="flex items-center gap-1.5 font-bold mb-1 text-emerald-800 dark:text-emerald-300">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2} />
              <span className="uppercase tracking-wider font-extrabold text-[11px]">Where to Use</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 leading-snug font-semibold text-xs">
              <li>{currentTopic.whereToUse[0]}</li>
              <li>{currentTopic.whereToUse[1]}</li>
            </ul>
          </div>

          {/* For What to Use (Amber Tinted Box) */}
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-950 dark:text-amber-200">
            <div className="flex items-center gap-1.5 font-bold mb-1 text-amber-800 dark:text-amber-300">
              <Target className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={2} />
              <span className="uppercase tracking-wider font-extrabold text-[11px]">For What to Use</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 leading-snug font-semibold text-xs">
              <li>{currentTopic.forWhatToUse[0]}</li>
              <li>{currentTopic.forWhatToUse[1]}</li>
            </ul>
          </div>
        </div>

        {/* Deep-Link Jump to Tool Action Button */}
        {onNavigateTab && (
          <button
            type="button"
            onClick={() => onNavigateTab(currentTopic.targetTab)}
            className="w-full h-8 px-3 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
            <span>{currentTopic.targetTabLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
};
