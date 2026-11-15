export interface Astronaut {
  id: string;
  name: string;
  role: string;
  mission_name: string;
  is_synthetic: number;
  data_classification: string;
  metadata?: {
    phenotype?: string;
    phenotype_summary?: string;
    flight_duration_days?: number;
    primary_objective?: string;
    evidence_basis?: string;
  };
}

export interface KpiMetric {
  value: number | null;
  baseline_mean: number | null;
  baseline_std: number | null;
  delta: number | null;
  pct_change: number | null;
  z_score: number | null;
  status: string;
  completeness_pct: number;
  observed_count: number;
  missing_count: number;
  total_records: number;
  uncertainty_note: string;
}

export interface CoupledPattern {
  pattern_detected: boolean;
  signature_name: string;
  severity: 'CRITICAL_ACTION' | 'WATCH_REVIEW' | 'NORMAL';
  badge_color: 'coral' | 'amber' | 'green';
  summary: string;
  mechanism: string;
  immediate_action: string;
}

export interface StructuredInsight {
  observed_data: string;
  statistical_finding: string;
  mission_context: string;
  scientific_background: string;
  uncertainty_and_limitations: string;
  recommended_crew_action: string;
}

export interface IndicatorGuide {
  indicator: string;
  label: string;
  unit: string;
  how_to_measure: string;
  why_it_matters: string;
  abnormal_action: string;
}

export interface EvidenceSource {
  id: string;
  title: string;
  organization: string;
  url: string;
  summary: string;
  mission_contexts: string[];
  related_indicators: string[];
}

export interface DerivedHemodynamics {
  map_mmhg: number | null;
  pulse_pressure_mmhg: number | null;
  pulse_pressure_flag: string;
  is_pulse_pressure_narrowed: boolean;
  shock_index: number | null;
  shock_index_baseline: number;
  shock_index_delta: number | null;
  shock_index_status: string;
  is_shock_index_elevated: boolean;
}

export interface MeasurementQuality {
  is_valid: boolean;
  errors: string[];
  collection_context: string;
  context_flag: string;
  alert_suppressed: boolean;
  recommendation: string;
}

export interface AdvancedBiophysics {
  map_heart_mmhg: number;
  delta_p_hydro_mmhg: number;
  map_brain_mmhg: number;
  icp_mmhg: number;
  cpp_mmhg: number;
  cpp_status: string;
  cpp_color: 'rose' | 'amber' | 'emerald';
  is_cpp_critical: boolean;
  gravity_g: number;
  plasma_volume_contraction_pct: number;
  fluid_deficit_ml: number;
  recommended_saline_loading_ml: number;
  estimated_stroke_volume_ml: number;
  cardiac_output_lpm: number;
  svr_dyn_s_cm5: number;
  svr_status: string;
}

export interface FlightRuleItem {
  id: string;
  title: string;
  status: 'GO' | 'NO-GO' | 'STANDBY' | 'MODERATE_COMPRESSION' | 'MAX_COMPRESSION' | 'EMERGENCY_ACTIVE';
  action: string;
  rationale: string;
  target_pressure_mmhg?: number;
  authority: string;
}

export interface FlightRuleMatrix {
  overall_status: 'GO' | 'CAUTION' | 'NO-GO';
  evaluated_at_utc: string;
  rules: FlightRuleItem[];
}

export interface CcsdsPacket {
  standard: string;
  apid_hex: string;
  apid_name: string;
  packet_sequence_count: number;
  met_seconds: number;
  total_bytes: number;
  raw_hex: string;
  formatted_hex: string;
  crc16_ccitt: string;
}

export interface MerkleSeal {
  block_index: number;
  timestamp_utc: string;
  prev_hash: string;
  sha256_seal: string;
  is_verified: boolean;
  cryptographic_standard: string;
}

export interface DashboardData {
  classification: string;
  disclaimer: string;
  astronaut: Astronaut;
  active_phase: string;
  available_phases: string[];
  mission_day: number;
  gravity_g: number;
  location: string;
  timestamp: string;
  activity_context: string;
  notes: string;
  baselines: Record<string, { mean: number; std: number; n_samples: number; min: number; max: number }>;
  kpis: Record<string, KpiMetric>;
  derived_hemodynamics?: DerivedHemodynamics;
  advanced_biophysics?: AdvancedBiophysics;
  flight_rules?: FlightRuleMatrix;
  ccsds_packet?: CcsdsPacket;
  merkle_seal?: MerkleSeal;
  measurement_quality?: MeasurementQuality;
  coupled_pattern: CoupledPattern;
  structured_insight: StructuredInsight;
  target_indicator: string;
  indicator_guides: Record<string, IndicatorGuide>;
  evidence_for_target?: {
    indicator: string;
    phase_name: string;
    relevant_sources: EvidenceSource[];
    guide: IndicatorGuide;
  };
}

export interface PhaseSegment {
  name: string;
  start_day: number;
  end_day: number;
  gravity: string;
  color: string;
}

export interface ReferenceBand {
  mean: number;
  std: number;
  watch_upper: number;
  watch_lower: number;
  action_upper: number;
  action_lower: number;
}

export interface TimelinePoint {
  mission_day: number;
  timestamp: string;
  phase_name: string;
  gravity_g: number;
  location: string;
  resting_hr: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  orthostatic_hr_delta: number | null;
  cumulative_radiation_msv: number | null;
  map_mmhg?: number | null;
  pulse_pressure_mmhg?: number | null;
  shock_index?: number | null;
  activity_context: string;
  notes: string;
  resting_hr_zscore: number | null;
  systolic_bp_zscore: number | null;
  orthostatic_hr_delta_zscore: number | null;
}

export interface TimelineData {
  classification: string;
  disclaimer: string;
  astronaut: Astronaut;
  total_days: number;
  timeline: TimelinePoint[];
  phase_segments: PhaseSegment[];
  reference_bands: Record<string, ReferenceBand>;
  baselines: Record<string, { mean: number; std: number }>;
}

export interface KGNode {
  id: string;
  label: string;
  type: string;
  role?: string;
  gravity_g?: number;
  location?: string;
  unit?: string;
  url?: string;
  organization?: string;
  summary?: string;
}

export interface KGEdge {
  source: string;
  target: string;
  relation: string;
}

export interface EvidencePayload {
  classification: string;
  disclaimer: string;
  evidence_sources: EvidenceSource[];
  indicator_guides: Record<string, IndicatorGuide>;
  knowledge_graph: {
    node_count: number;
    edge_count: number;
    nodes: KGNode[];
    edges: KGEdge[];
  };
}

export interface TriageResult {
  classification: string;
  disclaimer: string;
  triage_level: string;
  status_color: 'coral' | 'amber' | 'green';
  risk_summary: string;
  vitals_evaluated: {
    hr: { value: number; delta: number; z_score: number; base_mean: number };
    sbp: { value: number; delta: number; z_score: number; base_mean: number };
    dbp: { value: number; delta: number; z_score: number; base_mean: number };
    ortho_delta: { value: number | null; delta: number | null; z_score: number | null; base_mean: number };
  };
  derived_hemodynamics?: DerivedHemodynamics;
  measurement_quality?: MeasurementQuality;
  immediate_steps: string[];
  uplink_report: string;
  sbar_report?: string;
}

export interface SICitedSource {
  id: string;
  title: string;
  organization: string;
  url: string;
  summary: string;
}

export interface SIQueryPayload {
  astronaut_id: string;
  phase?: string;
  question: string;
  map_mmhg?: number | null;
  pulse_pressure_mmhg?: number | null;
  shock_index?: number | null;
  resting_hr_z?: number | null;
  systolic_bp_z?: number | null;
  ortho_delta_z?: number | null;
}

export interface SIQueryResponse {
  astronaut_id: string;
  phase: string;
  question: string;
  answer_bullets: string[];
  cited_sources: SICitedSource[];
  data_gaps_acknowledged: string;
  non_diagnostic_guardrail: string;
  grounded_mode: string;
  telemetry_context: Record<string, any>;
  retrieved_graph_nodes: Array<{ id: string; label: string; type: string }>;
}

export interface OCRCapturedVitals {
  systolic_bp: number;
  diastolic_bp: number;
  resting_hr: number;
  confidence_pct: number;
  raw_text: string;
}
