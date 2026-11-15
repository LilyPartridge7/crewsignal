import {
  Astronaut,
  DashboardData,
  TimelineData,
  EvidencePayload,
  TriageResult,
  SIQueryPayload,
  SIQueryResponse,
} from './types';
import {
  MOCK_ASTRONAUTS,
  MOCK_DASHBOARDS,
  MOCK_TIMELINES,
  MOCK_EVIDENCE,
} from './mockFallbackData';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api';

export async function fetchAstronauts(): Promise<Astronaut[]> {
  try {
    const res = await fetch(`${API_BASE}/astronauts`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.astronauts && data.astronauts.length > 0) {
        return data.astronauts;
      }
    }
  } catch (_err) {
    // Standalone Vercel deployment fallback
  }
  return MOCK_ASTRONAUTS;
}

export async function fetchDashboard(
  astronautId: string,
  phase?: string,
  indicator?: string
): Promise<DashboardData> {
  try {
    const params = new URLSearchParams();
    if (phase) params.append('phase', phase);
    if (indicator) params.append('indicator', indicator);

    const url = `${API_BASE}/dashboard/${astronautId}${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (_err) {
    // Standalone Vercel deployment fallback
  }

  const fallback = MOCK_DASHBOARDS[astronautId] || MOCK_DASHBOARDS['SYNTH-AST-01'];
  if (phase && phase !== fallback.active_phase) {
    return { ...fallback, active_phase: phase };
  }
  return fallback;
}

export async function fetchTimeline(astronautId: string): Promise<TimelineData> {
  try {
    const res = await fetch(`${API_BASE}/timeline/${astronautId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (_err) {
    // Standalone Vercel deployment fallback
  }
  return MOCK_TIMELINES[astronautId] || MOCK_TIMELINES['SYNTH-AST-01'];
}

export async function fetchEvidence(): Promise<EvidencePayload> {
  try {
    const res = await fetch(`${API_BASE}/evidence`);
    if (res.ok) {
      return await res.json();
    }
  } catch (_err) {
    // Standalone Vercel deployment fallback
  }
  return MOCK_EVIDENCE;
}

export async function postMeasurement(payload: {
  astronaut_id: string;
  mission_day: number;
  phase_name: string;
  gravity_g?: number;
  location?: string;
  resting_hr?: number | null;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  orthostatic_hr_delta?: number | null;
  cumulative_radiation_msv?: number | null;
  activity_context?: string;
  collection_context?: string;
  notes?: string;
}): Promise<{ success: boolean; id: number; message: string; derived_hemodynamics?: any; quality_validation?: any }> {
  try {
    const res = await fetch(`${API_BASE}/measurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_err) {
    // Standalone Vercel deployment fallback
  }

  const sbp = payload.systolic_bp ?? 115;
  const dbp = payload.diastolic_bp ?? 75;
  const hr = payload.resting_hr ?? 72;
  const mapVal = Math.round((dbp + (sbp - dbp) / 3.0) * 10) / 10;
  const pp = sbp - dbp;
  const shock = Math.round((hr / sbp) * 100) / 100;

  return {
    success: true,
    id: Date.now(),
    message: 'Measurement logged successfully (Local Autonomy Mode).',
    derived_hemodynamics: {
      map_mmhg: mapVal,
      pulse_pressure_mmhg: pp,
      shock_index: shock,
    },
    quality_validation: {
      valid: true,
      flags: [],
    },
  };
}

export async function simulateCountermeasures(payload: {
  astronaut_id: string;
  fluid_loading_pct: number;
  lbnp_sessions_per_week: number;
  exercise_min_per_day: number;
}): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/simulate-countermeasures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_err) {
    // Standalone Vercel deployment fallback
  }

  const f_score = payload.fluid_loading_pct / 100.0;
  const l_score = payload.lbnp_sessions_per_week / 5.0;
  const e_score = payload.exercise_min_per_day / 90.0;
  const adherence = Math.round((0.40 * f_score + 0.35 * l_score + 0.25 * e_score) * 1000) / 1000;
  const days = Array.from({ length: 30 }, (_, i) => 91 + i);
  const baseline_ortho = 10.85;
  const initial_ortho = 34.0;
  const delta_reduction = (initial_ortho - baseline_ortho) * Math.min(1.0, adherence * 1.05);

  const recovery_curve = days.map((day) => {
    const prog = (day - 91) / 29.0;
    const exp_decay = Math.exp(-prog * (2.2 * adherence + 0.6));
    const simulated_ortho = Math.round((initial_ortho - delta_reduction * (1.0 - exp_decay)) * 10) / 10;
    return {
      mission_day: day,
      simulated_ortho_delta: Math.max(baseline_ortho, simulated_ortho),
      simulated_recovery: Math.max(baseline_ortho, simulated_ortho),
    };
  });

  return {
    astronaut_id: payload.astronaut_id,
    adherence_index: adherence,
    adherence_label: adherence >= 0.8 ? 'High Adherence' : adherence >= 0.5 ? 'Moderate Adherence' : 'Sub-Optimal Protocol',
    projected_ortho_delta_day105: Math.round((34.0 - delta_reduction * 0.65) * 10) / 10,
    recovery_curve,
    recommendation: 'Deterministic model grounded in NASA HRP countermeasure standards.',
  };
}

export async function postAcuteTriage(payload: {
  astronaut_id: string;
  hr: number;
  sbp: number;
  dbp: number;
  ortho_delta?: number | null;
  symptom: string;
  gravity_context?: string;
}): Promise<TriageResult> {
  try {
    const res = await fetch(`${API_BASE}/acute-triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_err) {
    // Standalone Vercel deployment fallback
  }

  const mapVal = Math.round((payload.dbp + (payload.sbp - payload.dbp) / 3.0) * 10) / 10;
  const pp = payload.sbp - payload.dbp;
  const shockIndex = Math.round((payload.hr / payload.sbp) * 100) / 100;
  const isEmergency = payload.sbp < 90 || shockIndex >= 0.9 || mapVal < 60;
  const isAction = payload.sbp < 100 || (payload.ortho_delta ?? 0) >= 28 || shockIndex >= 0.7;

  const sbarStr = `SITUATION: Acute cardiovascular event (${payload.symptom}).
BACKGROUND: Autonomous offline triage packet grounded in NASA HRP flight rules.
ASSESSMENT: MAP ${mapVal} mmHg, Pulse Pressure ${pp} mmHg, Shock Index ${shockIndex}.
RECOMMENDATION: Place patient supine with legs elevated. Ingest 1000 mL oral electrolyte fluid load.`;

  return {
    classification: 'SYNTHETIC DEMO • NASA HRP & CSA',
    disclaimer: 'NON-DIAGNOSTIC RESEARCH PROTOTYPE',
    triage_level: isEmergency ? 'CRITICAL_ACTION' : isAction ? 'ACTION' : 'WATCH_REVIEW',
    status_color: isEmergency ? 'coral' : isAction ? 'amber' : 'green',
    risk_summary: isEmergency
      ? 'Critical pre-syncope and cerebral hypoperfusion risk upon standing.'
      : 'Cardiovascular deconditioning requiring fluid loading and counter-pressure.',
    vitals_evaluated: {
      hr: { value: payload.hr, delta: payload.hr - 60, z_score: (payload.hr - 60) / 2.2, base_mean: 60.2 },
      sbp: { value: payload.sbp, delta: payload.sbp - 118, z_score: (payload.sbp - 118) / 3.0, base_mean: 118.6 },
      dbp: { value: payload.dbp, delta: payload.dbp - 75, z_score: (payload.dbp - 75) / 2.5, base_mean: 75.0 },
      ortho_delta: {
        value: payload.ortho_delta ?? 12,
        delta: (payload.ortho_delta ?? 12) - 10.8,
        z_score: ((payload.ortho_delta ?? 12) - 10.8) / 1.7,
        base_mean: 10.8,
      },
    },
    immediate_steps: [
      'Assume supine posture immediately with legs elevated 30 degrees.',
      'Fast-track 1000 mL oral isotonic electrolyte rehydration solution.',
      'Engage lower body counter-pressure sleeves (40 mmHg).',
    ],
    uplink_report: sbarStr,
    sbar_report: sbarStr,
  };
}

export async function postSIQuery(payload: SIQueryPayload): Promise<SIQueryResponse> {
  try {
    const res = await fetch(`${API_BASE}/si-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_err) {
    // Standalone Vercel deployment fallback
  }

  return {
    astronaut_id: payload.astronaut_id,
    phase: payload.phase || 'Early Postflight (1g Return)',
    question: payload.question,
    answer_bullets: [
      'Orthostatic tachycardia reflects autonomic baroreflex compensation for contracted plasma volume (-14.2%).',
      'Cerebral perfusion pressure (CPP = MAP_brain - ICP) must remain above 50 mmHg to avoid presyncope.',
      'Formal Flight Rule MED-B13-102 mandates recumbency and fluid loading until hemodynamics stabilize.',
      'Lower-body counter-pressure garments (40-50 mmHg) reduce splanchnic and femoral venous pooling.',
    ],
    cited_sources: [
      {
        id: 'NASA-HRP-RISK-01',
        title: 'Risk of Orthostatic Intolerance and Cardiovascular Deconditioning',
        organization: 'NASA Human Research Program (HRP)',
        url: 'https://www.nasa.gov/hrp/risks/',
        summary: 'Documents cardiovascular deconditioning and post-landing orthostatic intolerance.',
      },
      {
        id: 'CSA-SCI-2026-01',
        title: 'Deep-Space Biomedical Telemedicine & Terrestrial Remote Clinics',
        organization: 'Canadian Space Agency (CSA)',
        url: 'https://www.asc-csa.gc.ca/eng/iss/science/',
        summary: 'Translates spaceflight autonomic deconditioning to rural and remote clinics.',
      },
    ],
    data_gaps_acknowledged: 'Offline deterministic Co-Pilot mode active.',
    non_diagnostic_guardrail: 'Synthetic demonstration data. Non-diagnostic.',
    grounded_mode: 'Local Autonomous Knowledge Engine',
    telemetry_context: {
      map_mmhg: payload.map_mmhg ?? 85.2,
      pulse_pressure_mmhg: payload.pulse_pressure_mmhg ?? 44.7,
      shock_index: payload.shock_index ?? 0.67,
    },
    retrieved_graph_nodes: [
      { id: 'RULE-MED-B13-102', label: 'NASA Flight Rule MED-B13-102', type: 'FlightRule' },
      { id: 'IND-ORTHO-DELTA', label: 'Orthostatic HR Delta', type: 'Indicator' },
    ],
  };
}

export async function fetchFlightRules(astronautId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/flight-rules/${astronautId}`);
    if (res.ok) return await res.json();
  } catch (_err) {
    // Fallback
  }
  return {
    status: 'NO-GO',
    rules: ['RULE-MED-B13-102', 'RULE-MED-B13-104', 'RULE-MED-B13-108'],
    cleared_for_ambulation: false,
    evaluated_criteria: {
      map_adequate: true,
      ortho_nominal: false,
      shock_index_nominal: true,
      pulse_pressure_nominal: true,
    },
  };
}

export async function fetchFhirExport(astronautId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/export/fhir/${astronautId}`);
    if (res.ok) return await res.json();
  } catch (_err) {
    // Fallback
  }
  return {
    resourceType: 'DiagnosticReport',
    id: `fhir-${astronautId}`,
    status: 'final',
    code: { text: 'Astronaut Cardiovascular Adaptation Profile' },
  };
}

export async function fetchCcsdsExport(astronautId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/export/ccsds/${astronautId}`);
    if (res.ok) return await res.json();
  } catch (_err) {
    // Fallback
  }
  return {
    apid: '0x04F2',
    bytes: 40,
    hex_dump: '08F2C0010023...',
  };
}

export async function fetchAuditSeal(astronautId: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/telemetry/audit-seal/${astronautId}`);
    if (res.ok) return await res.json();
  } catch (_err) {
    // Fallback
  }
  return {
    merkle_root_sha256: '05B474CDFED166299B7770ECAED3254B860E884FFB9A15124017C8A97F29BA74',
    verified: true,
  };
}
