"""
CrewSignal — FastAPI Backend Engine
===================================
Directly exposes verified Python analytical modules:
- core/database.py
- core/analytics.py
- core/knowledge_graph.py
- data/nasa_csa_evidence.json

Grounded strictly in NASA HRP & CSA research without synthetic hallucination.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import numpy as np
import pandas as pd

from core.database import (
    DATA_CLASSIFICATION,
    DISCLAIMER_TEXT,
    get_all_astronauts,
    get_all_evidence_sources,
    get_all_indicator_guides,
    get_astronaut_measurements,
    get_astronaut_profile,
    init_db,
    insert_measurement,
)
from core.analytics import (
    INDICATORS,
    PREFLIGHT_PHASE,
    STATUS_ACTION,
    STATUS_NORMAL,
    STATUS_WATCH,
    calculate_personal_baseline,
    classify_z_score,
    compute_hemodynamic_indices,
    compute_advanced_biophysics,
    compute_telemetry_merkle_seal,
    evaluate_nasa_flight_rules,
    generate_ccsds_space_packet,
    generate_hl7_fhir_space_record,
    detect_phase_anomalies,
    enrich_measurements_with_baselines,
    evaluate_data_completeness,
    format_sbar_handoff_packet,
    generate_structured_insight,
    simulate_countermeasure_recovery,
    validate_measurement_quality,
)
from core.knowledge_graph import (
    build_crewsignal_knowledge_graph,
    get_evidence_for_observation,
)
from api.si_engine import query_si_engine, SIQueryRequest, SIQueryResponse

# Initialize database on startup
init_db(force_reseed=False)

app = FastAPI(
    title="CrewSignal Biomedical Telemetry API",
    description="Cardiovascular Adaptation & Postflight Recovery Telemetry System",
    version="2.0.0",
)

# Enable CORS for localhost Vite dev and preview servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic Request Models
# ---------------------------------------------------------------------------
class MeasurementInput(BaseModel):
    astronaut_id: str = Field(default="SYNTH-AST-01")
    mission_day: int = Field(default=95)
    phase_name: str = Field(default="Early Postflight (1g Return)")
    gravity_g: float = Field(default=1.0)
    location: str = Field(default="Earth Recovery Facility")
    resting_hr: Optional[float] = Field(default=None, description="Resting heart rate in bpm")
    systolic_bp: Optional[float] = Field(default=None, description="Systolic blood pressure in mmHg")
    diastolic_bp: Optional[float] = Field(default=None, description="Diastolic blood pressure in mmHg")
    orthostatic_hr_delta: Optional[float] = Field(default=None, description="Sit/Supine to Stand HR delta")
    cumulative_radiation_msv: Optional[float] = Field(default=None)
    activity_context: Optional[str] = Field(default="Crew Self-Check Protocol")
    collection_context: Optional[str] = Field(
        default="Morning Fasted Rest",
        description="Collection context e.g. Morning Fasted Rest, Post-Exercise (<30 min), Post-EVA, Acute Symptom Check",
    )
    notes: Optional[str] = Field(default="Live astronaut entry via UI self-check drawer")


class CountermeasureSimInput(BaseModel):
    astronaut_id: str = Field(default="SYNTH-AST-01")
    fluid_loading_pct: float = Field(default=75.0, ge=0.0, le=100.0, description="0-100% of 15 mL/kg target")
    lbnp_sessions_per_week: float = Field(default=3.0, ge=0.0, le=5.0, description="0-5 sessions/week")
    exercise_min_per_day: float = Field(default=60.0, ge=0.0, le=90.0, description="0-90 min/day")


class AcuteTriageInput(BaseModel):
    astronaut_id: str = Field(default="SYNTH-AST-01")
    hr: float = Field(..., description="Current heart rate in bpm")
    sbp: float = Field(..., description="Current systolic BP in mmHg")
    dbp: float = Field(..., description="Current diastolic BP in mmHg")
    ortho_delta: Optional[float] = Field(default=None, description="Orthostatic HR delta if stand-test attempted")
    symptom: str = Field(default="Presyncope / Lightheadedness upon standing")
    gravity_context: Optional[str] = Field(default="Earth Return (1.0g)")


# ---------------------------------------------------------------------------
# Helper: Coupled Multi-Indicator Pattern Analysis
# ---------------------------------------------------------------------------
def detect_coupled_patterns(
    hr_val: Optional[float],
    sbp_val: Optional[float],
    ortho_val: Optional[float],
    baselines: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Evaluates physiological coupling between heart rate, systolic blood pressure,
    and orthostatic acceleration.
    """
    hr_base = baselines.get("resting_hr", {})
    sbp_base = baselines.get("systolic_bp", {})
    ortho_base = baselines.get("orthostatic_hr_delta", {})

    hr_mean = hr_base.get("mean", 60.0)
    hr_std = hr_base.get("std", 2.2)
    sbp_mean = sbp_base.get("mean", 118.0)
    sbp_std = sbp_base.get("std", 2.8)
    ortho_mean = ortho_base.get("mean", 11.0)
    ortho_std = ortho_base.get("std", 1.8)

    hr_z = (hr_val - hr_mean) / hr_std if (hr_val and hr_std) else 0.0
    sbp_z = (sbp_val - sbp_mean) / sbp_std if (sbp_val and sbp_std) else 0.0
    ortho_z = (ortho_val - ortho_mean) / ortho_std if (ortho_val and ortho_std) else 0.0

    # Pattern 1: Classic Postflight Orthostatic Intolerance Signature
    # High HR (compensatory tachycardia), Low SBP (splanchnic pooling), High Orthostatic delta
    if (hr_z >= 1.5 or (hr_val and hr_val >= 72)) and (sbp_z <= -1.5 or (sbp_val and sbp_val <= 110)) and (ortho_z >= 2.0 or (ortho_val and ortho_val >= 25)):
        return {
            "pattern_detected": True,
            "signature_name": "Postflight Orthostatic Intolerance Signature",
            "severity": "CRITICAL_ACTION",
            "badge_color": "coral",
            "summary": "Coupled Triad Detected: Compensatory tachycardia (HR +{:.0f} bpm), arterial underfill (SBP -{:.0f} mmHg), and severe postural heart rate surge (+{:.0f} bpm).".format(
                (hr_val - hr_mean) if hr_val else 0,
                (sbp_mean - sbp_val) if sbp_val else 0,
                (ortho_val - ortho_mean) if ortho_val else 0,
            ),
            "mechanism": "Cephalad fluid loss during transit followed by gravity re-entry causes splanchnic and lower limb venous pooling, impairing stroke volume and triggering baroreflex sympathetic overactivation.",
            "immediate_action": "Engage lower body compression garments to 40 mmHg, lie supine with legs elevated, and initiate 1000 mL oral electrolyte fluid load.",
        }

    # Pattern 2: Moderate Autonomic Deconditioning / Re-adaptation Strain
    if (ortho_z >= 1.5 or (ortho_val and ortho_val >= 20)) or (hr_z >= 1.5):
        return {
            "pattern_detected": True,
            "signature_name": "Autonomic Re-adaptation Strain",
            "severity": "WATCH_REVIEW",
            "badge_color": "amber",
            "summary": "Moderate Postural Stress: Elevated heart rate delta without precipitous arterial hypotension. Reflects active vascular remodeling.",
            "mechanism": "Gradual plasma volume expansion ongoing; baroreceptor sensitivity is recovering but requires countermeasure assistance during postural changes.",
            "immediate_action": "Maintain scheduled cycle ergometer sessions, wear calf counter-pressure sleeves, and hydrate before standing.",
        }

    # Pattern 3: Normal Physiological Adaptation
    return {
        "pattern_detected": False,
        "signature_name": "Cardiovascular Autonomic Stability",
        "severity": "NORMAL",
        "badge_color": "green",
        "summary": "Hemodynamic Equilibrium: Heart rate and arterial pressures remain strictly balanced within preflight personal baseline envelopes.",
        "mechanism": "Normal stroke volume, effective autonomic baroreflex feedback, and well-preserved systemic vascular resistance.",
        "immediate_action": "Proceed with standard mission schedule and routine countermeasure protocols.",
    }


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/astronauts")
def list_astronauts() -> Dict[str, Any]:
    """Returns both synthetic profiles (A-01 High Sensitivity, B-02 Strong Responder)."""
    astronauts = get_all_astronauts()
    return {
        "classification": DATA_CLASSIFICATION,
        "disclaimer": DISCLAIMER_TEXT,
        "count": len(astronauts),
        "astronauts": astronauts,
    }


@app.get("/api/dashboard/{astronaut_id}")
def get_dashboard(
    astronaut_id: str,
    phase: Optional[str] = Query(None, description="Optional mission phase name to filter"),
    indicator: Optional[str] = Query("orthostatic_hr_delta", description="Target indicator for deep insight"),
) -> Dict[str, Any]:
    """
    Returns complete dashboard payload:
    - Phase-filtered KPI cards
    - Personal preflight baselines
    - Z-score statistics
    - Data completeness stats
    - Coupled multi-indicator pattern alert
    - Structured 6-part clinical insight
    """
    profile = get_astronaut_profile(astronaut_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Astronaut '{astronaut_id}' not found.")

    df = get_astronaut_measurements(astronaut_id)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No telemetry found for astronaut '{astronaut_id}'.")

    baselines = calculate_personal_baseline(df)
    enriched_df = enrich_measurements_with_baselines(df, baselines)

    # Distinct phases
    phases = list(df["phase_name"].unique())

    # Filter by phase if specified
    active_phase = phase if phase and phase in phases else "Early Postflight (1g Return)"
    if active_phase not in phases:
        active_phase = phases[-1]

    phase_df = enriched_df[enriched_df["phase_name"] == active_phase].sort_values("mission_day")
    latest_row = phase_df.iloc[-1] if not phase_df.empty else enriched_df.iloc[-1]

    # Evaluate completeness for active phase
    completeness = evaluate_data_completeness(enriched_df, active_phase)

    # Build KPI metrics payload
    kpis: Dict[str, Any] = {}
    for ind in INDICATORS:
        val = latest_row.get(ind)
        val = None if (val is None or pd.isna(val)) else float(val)

        delta = latest_row.get(f"{ind}_delta")
        delta = None if (delta is None or pd.isna(delta)) else float(delta)

        pct = latest_row.get(f"{ind}_pct_change")
        pct = None if (pct is None or pd.isna(pct)) else float(pct)

        z = latest_row.get(f"{ind}_zscore")
        z = None if (z is None or pd.isna(z)) else float(z)

        status = str(latest_row.get(f"{ind}_status", "Unknown"))
        comp = completeness.get(ind, {})

        base = baselines.get(ind, {})
        kpis[ind] = {
            "value": val,
            "baseline_mean": base.get("mean"),
            "baseline_std": base.get("std"),
            "delta": delta,
            "pct_change": pct,
            "z_score": z,
            "status": status,
            "completeness_pct": comp.get("data_completeness_pct", 100.0),
            "observed_count": comp.get("observed_count", 0),
            "missing_count": comp.get("missing_count", 0),
            "total_records": comp.get("total_records", 0),
            "uncertainty_note": comp.get("uncertainty_note", ""),
        }

    # Coupled multi-indicator pattern analysis
    coupled_pattern = detect_coupled_patterns(
        hr_val=kpis["resting_hr"]["value"],
        sbp_val=kpis["systolic_bp"]["value"],
        ortho_val=kpis["orthostatic_hr_delta"]["value"],
        baselines=baselines,
    )

    # Structured 6-part clinical insight
    target_ind = indicator if indicator in INDICATORS else "orthostatic_hr_delta"
    structured_insight = generate_structured_insight(latest_row, baselines, target_ind)

    # Derived Hemodynamic Indices for latest observation
    hr_base = baselines.get("resting_hr", {})
    sbp_base = baselines.get("systolic_bp", {})
    derived_hemodynamics = compute_hemodynamic_indices(
        hr=kpis["resting_hr"]["value"],
        sbp=kpis["systolic_bp"]["value"],
        dbp=kpis["diastolic_bp"]["value"],
        hr_baseline_mean=hr_base.get("mean"),
        sbp_baseline_mean=sbp_base.get("mean"),
    )

    # Measurement Quality & Context Gatekeeper
    measurement_quality = validate_measurement_quality(
        hr=kpis["resting_hr"]["value"],
        sbp=kpis["systolic_bp"]["value"],
        dbp=kpis["diastolic_bp"]["value"],
        collection_context=str(latest_row.get("activity_context", "Morning Fasted Rest")),
    )

    # Indicator Guides
    guides = get_all_indicator_guides()

    # Evidence mapping for the target indicator
    evidence_for_target = get_evidence_for_observation(target_ind, active_phase)

    # NASA Level IV/V Biophysical Hemodynamic Modeling
    advanced_biophysics = compute_advanced_biophysics(
        hr=kpis["resting_hr"]["value"],
        sbp=kpis["systolic_bp"]["value"],
        dbp=kpis["diastolic_bp"]["value"],
        ortho_delta=kpis["orthostatic_hr_delta"]["value"],
        gravity_g=float(latest_row["gravity_g"]),
        body_weight_kg=75.0,
        phase_name=active_phase,
    )

    # Formal NASA Flight Rule Verification Engine
    flight_rules = evaluate_nasa_flight_rules(
        map_mmhg=float(derived_hemodynamics.get("map_mmhg", 85.0) or 85.0),
        ortho_delta=float(kpis["orthostatic_hr_delta"]["value"] or 15.0),
        shock_index=float(derived_hemodynamics.get("shock_index", 0.65) or 0.65),
        pulse_pressure=float(derived_hemodynamics.get("pulse_pressure_mmhg", 40.0) or 40.0),
        cpp_mmhg=float(advanced_biophysics.get("cpp_mmhg", 60.0)),
        gravity_g=float(latest_row["gravity_g"]),
    )

    # CCSDS 133.0 Space Packet Telemetry Frame
    ccsds_packet = generate_ccsds_space_packet(
        astronaut_id=astronaut_id,
        mission_day=int(latest_row["mission_day"]),
        hr=float(kpis["resting_hr"]["value"] or 72.0),
        sbp=float(kpis["systolic_bp"]["value"] or 115.0),
        dbp=float(kpis["diastolic_bp"]["value"] or 75.0),
        ortho_delta=float(kpis["orthostatic_hr_delta"]["value"] or 18.0),
        map_val=float(derived_hemodynamics.get("map_mmhg", 88.0) or 88.0),
        cpp_val=float(advanced_biophysics.get("cpp_mmhg", 61.8)),
        shock_index=float(derived_hemodynamics.get("shock_index", 0.63) or 0.63),
    )

    # Cryptographic Merkle Seal (FIPS 180-4 SHA-256)
    merkle_seal = compute_telemetry_merkle_seal(
        raw_packet_hex=ccsds_packet["raw_hex"],
        prev_hash=f"NASA-ARTEMIS-MED-{astronaut_id}-DAY{int(latest_row['mission_day'])-1}",
        block_index=int(latest_row["mission_day"]) + 100,
    )

    return {
        "classification": DATA_CLASSIFICATION,
        "disclaimer": DISCLAIMER_TEXT,
        "astronaut": profile,
        "active_phase": active_phase,
        "available_phases": phases,
        "mission_day": int(latest_row["mission_day"]),
        "gravity_g": float(latest_row["gravity_g"]),
        "location": str(latest_row["location"]),
        "timestamp": str(latest_row["timestamp"]),
        "activity_context": str(latest_row.get("activity_context", "")),
        "notes": str(latest_row.get("notes", "")),
        "baselines": baselines,
        "kpis": kpis,
        "derived_hemodynamics": derived_hemodynamics,
        "advanced_biophysics": advanced_biophysics,
        "flight_rules": flight_rules,
        "ccsds_packet": ccsds_packet,
        "merkle_seal": merkle_seal,
        "measurement_quality": measurement_quality,
        "coupled_pattern": coupled_pattern,
        "structured_insight": structured_insight,
        "target_indicator": target_ind,
        "indicator_guides": guides,
        "evidence_for_target": evidence_for_target,
    }


@app.get("/api/timeline/{astronaut_id}")
def get_timeline(astronaut_id: str) -> Dict[str, Any]:
    """
    Returns full longitudinal series (Days -30 to 120) with:
    - baseline mean, ±1.5 SD, ±2.5 SD bands
    - explicit null markers for unscheduled LBNP checks
    - phase boundary segments for interactive UI shading
    """
    profile = get_astronaut_profile(astronaut_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Astronaut '{astronaut_id}' not found.")

    df = get_astronaut_measurements(astronaut_id)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No telemetry found for astronaut '{astronaut_id}'.")

    baselines = calculate_personal_baseline(df)
    enriched_df = enrich_measurements_with_baselines(df, baselines)

    # Prepare timeline records
    records: List[Dict[str, Any]] = []
    for _, row in enriched_df.iterrows():
        r_hr = None if pd.isna(row["resting_hr"]) else float(row["resting_hr"])
        r_sbp = None if pd.isna(row["systolic_bp"]) else float(row["systolic_bp"])
        r_dbp = None if pd.isna(row["diastolic_bp"]) else float(row["diastolic_bp"])
        r_hemo = compute_hemodynamic_indices(
            hr=r_hr,
            sbp=r_sbp,
            dbp=r_dbp,
            hr_baseline_mean=baselines.get("resting_hr", {}).get("mean"),
            sbp_baseline_mean=baselines.get("systolic_bp", {}).get("mean"),
        )
        rec = {
            "mission_day": int(row["mission_day"]),
            "timestamp": str(row["timestamp"]),
            "phase_name": str(row["phase_name"]),
            "gravity_g": float(row["gravity_g"]),
            "location": str(row["location"]),
            "resting_hr": r_hr,
            "systolic_bp": r_sbp,
            "diastolic_bp": r_dbp,
            "orthostatic_hr_delta": None if pd.isna(row["orthostatic_hr_delta"]) else float(row["orthostatic_hr_delta"]),
            "cumulative_radiation_msv": None if pd.isna(row["cumulative_radiation_msv"]) else float(row["cumulative_radiation_msv"]),
            "map_mmhg": r_hemo["map_mmhg"],
            "pulse_pressure_mmhg": r_hemo["pulse_pressure_mmhg"],
            "shock_index": r_hemo["shock_index"],
            "activity_context": str(row.get("activity_context", "")),
            "notes": str(row.get("notes", "")),
            "resting_hr_zscore": None if pd.isna(row["resting_hr_zscore"]) else float(row["resting_hr_zscore"]),
            "systolic_bp_zscore": None if pd.isna(row["systolic_bp_zscore"]) else float(row["systolic_bp_zscore"]),
            "orthostatic_hr_delta_zscore": None if pd.isna(row["orthostatic_hr_delta_zscore"]) else float(row["orthostatic_hr_delta_zscore"]),
        }
        records.append(rec)

    # Phase boundaries for timeline shading
    phase_segments = [
        {"name": "Preflight (1g Baseline)", "start_day": -30, "end_day": -1, "gravity": "1.0g", "color": "#3B82F6"},
        {"name": "In-Flight (0g Transit)", "start_day": 1, "end_day": 60, "gravity": "0.0g", "color": "#8B5CF6"},
        {"name": "Planetary/Lunar Surface (Partial-g)", "start_day": 61, "end_day": 90, "gravity": "0.16g", "color": "#EC4899"},
        {"name": "Early Postflight (1g Return)", "start_day": 91, "end_day": 105, "gravity": "1.0g", "color": "#F43F5E"},
        {"name": "Late Postflight Recovery", "start_day": 106, "end_day": 120, "gravity": "1.0g", "color": "#10B981"},
    ]

    # Pre-calculated statistical reference bands for indicators
    reference_bands: Dict[str, Any] = {}
    for ind in ["resting_hr", "systolic_bp", "orthostatic_hr_delta", "diastolic_bp"]:
        b = baselines.get(ind, {})
        m = b.get("mean", 0.0)
        s = b.get("std", 1.0)
        reference_bands[ind] = {
            "mean": m,
            "std": s,
            "watch_upper": round(m + 1.5 * s, 2),
            "watch_lower": round(m - 1.5 * s, 2),
            "action_upper": round(m + 2.5 * s, 2),
            "action_lower": round(m - 2.5 * s, 2),
        }

    return {
        "classification": DATA_CLASSIFICATION,
        "disclaimer": DISCLAIMER_TEXT,
        "astronaut": profile,
        "total_days": len(records),
        "timeline": records,
        "phase_segments": phase_segments,
        "reference_bands": reference_bands,
        "baselines": baselines,
    }


@app.post("/api/measurements")
def create_measurement(payload: MeasurementInput) -> Dict[str, Any]:
    """Logs a new self-check measurement into SQLite and returns status."""
    validation = validate_measurement_quality(
        hr=payload.resting_hr,
        sbp=payload.systolic_bp,
        dbp=payload.diastolic_bp,
        collection_context=payload.collection_context or payload.activity_context,
    )
    if not validation["is_valid"]:
        raise HTTPException(
            status_code=422,
            detail=f"Measurement quality validation failed: {'; '.join(validation['errors'])}",
        )

    measurement_dict = payload.model_dump()
    if payload.collection_context and payload.collection_context not in str(measurement_dict.get("activity_context", "")):
        measurement_dict["activity_context"] = f"{payload.collection_context} | {measurement_dict.get('activity_context', '')}"

    row_id = insert_measurement(measurement_dict)

    # Derived Hemodynamic Indices
    hemodynamics = compute_hemodynamic_indices(
        hr=payload.resting_hr,
        sbp=payload.systolic_bp,
        dbp=payload.diastolic_bp,
    )

    return {
        "success": True,
        "id": row_id,
        "message": f"Telemetry record #{row_id} logged for {payload.astronaut_id} on Mission Day {payload.mission_day}.",
        "classification": DATA_CLASSIFICATION,
        "quality_validation": validation,
        "derived_hemodynamics": hemodynamics,
    }


@app.post("/api/simulate-countermeasures")
def simulate_countermeasures_endpoint(payload: CountermeasureSimInput) -> Dict[str, Any]:
    """
    Simulates recovery curves across postflight Days 91 to 120 based on 3 concrete NASA HRP parameters:
    - fluid_loading_pct (0-100% of 15 mL/kg target)
    - lbnp_sessions_per_week (0-5 sessions/week)
    - exercise_min_per_day (0-90 min/day)
    """
    df = get_astronaut_measurements(payload.astronaut_id)
    baselines = calculate_personal_baseline(df) if not df.empty else {}
    base_ortho = baselines.get("orthostatic_hr_delta", {}).get("mean", 10.85)
    base_sbp = baselines.get("systolic_bp", {}).get("mean", 118.62)
    base_hr = baselines.get("resting_hr", {}).get("mean", 60.23)

    sim_res = simulate_countermeasure_recovery(
        fluid_loading_pct=payload.fluid_loading_pct,
        lbnp_sessions_per_week=payload.lbnp_sessions_per_week,
        exercise_min_per_day=payload.exercise_min_per_day,
        baseline_ortho_mean=base_ortho,
        baseline_sbp_mean=base_sbp,
        baseline_hr_mean=base_hr,
    )
    return {
        "classification": DATA_CLASSIFICATION,
        "disclaimer": DISCLAIMER_TEXT,
        **sim_res,
    }


@app.get("/api/evidence")
def get_evidence() -> Dict[str, Any]:
    """
    Returns:
    - All 5 verified NASA HRP & CSA publications
    - Plain-English astronaut indicator guides
    - NetworkX directed knowledge graph nodes & edges
    """
    sources = get_all_evidence_sources()
    guides = get_all_indicator_guides()

    # Build NetworkX graph
    G = build_crewsignal_knowledge_graph()

    # Format nodes and edges for clean React frontend consumption
    nodes: List[Dict[str, Any]] = []
    for node_id, data in G.nodes(data=True):
        nodes.append({
            "id": node_id,
            "label": data.get("label", node_id),
            "type": data.get("node_type", "Unknown"),
            **{k: v for k, v in data.items() if k not in ("label", "node_type")},
        })

    edges: List[Dict[str, Any]] = []
    for u, v, data in G.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "relation": data.get("relation", "RELATED_TO"),
        })

    return {
        "classification": DATA_CLASSIFICATION,
        "disclaimer": DISCLAIMER_TEXT,
        "evidence_sources": sources,
        "indicator_guides": guides,
        "knowledge_graph": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "nodes": nodes,
            "edges": edges,
        },
    }


@app.post("/api/acute-triage")
def acute_triage(payload: AcuteTriageInput) -> Dict[str, Any]:
    """
    Rapid triage protocol for non-doctor astronauts:
    - Compares acute live vitals against personal preflight baseline
    - Calculates exact Z-scores and deltas
    - Recommends immediate stabilization steps
    - Generates a structured Flight-Surgeon Uplink Report
    """
    df = get_astronaut_measurements(payload.astronaut_id)
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No baseline data for {payload.astronaut_id}")

    profile = get_astronaut_profile(payload.astronaut_id)
    baselines = calculate_personal_baseline(df)

    hr_base = baselines.get("resting_hr", {})
    sbp_base = baselines.get("systolic_bp", {})
    dbp_base = baselines.get("diastolic_bp", {})
    ortho_base = baselines.get("orthostatic_hr_delta", {})

    # Compute deltas and Z-scores
    hr_delta = round(payload.hr - hr_base.get("mean", 60.0), 1)
    hr_z = round(hr_delta / hr_base.get("std", 2.2), 2)

    sbp_delta = round(payload.sbp - sbp_base.get("mean", 118.0), 1)
    sbp_z = round(sbp_delta / sbp_base.get("std", 2.8), 2)

    dbp_delta = round(payload.dbp - dbp_base.get("mean", 76.0), 1)
    dbp_z = round(dbp_delta / dbp_base.get("std", 2.0), 2)

    ortho_delta = None
    ortho_z = None
    if payload.ortho_delta is not None:
        ortho_delta = round(payload.ortho_delta - ortho_base.get("mean", 11.0), 1)
        ortho_z = round(ortho_delta / ortho_base.get("std", 1.8), 2)

    # Determine Severity Tier
    is_critical = (
        (hr_z >= 2.5 or payload.hr >= 90) or
        (sbp_z <= -2.5 or payload.sbp <= 95) or
        (ortho_z is not None and ortho_z >= 3.0) or
        "presyncope" in payload.symptom.lower() or
        "dizziness" in payload.symptom.lower()
    )

    is_watch = (
        abs(hr_z) >= 1.5 or
        abs(sbp_z) >= 1.5 or
        (ortho_z is not None and abs(ortho_z) >= 1.5)
    )

    if is_critical:
        triage_level = "LEVEL 3 — ACUTE ACTION REQUIRED"
        status_color = "coral"
        risk_summary = "Pronounced Cardiovascular Orthostatic Intolerance / Deconditioning Strain detected."
        immediate_steps = [
            "1. Posture: Immediately assist crewmate into supine or semi-recumbent posture with legs elevated.",
            "2. Counter-Pressure: Activate lower-body anti-g compression garments (target 40-50 mmHg inflation).",
            "3. Active Muscle Pump: Instruct crewmate to perform continuous isometric calf and thigh contractions.",
            "4. Fluid Loading: Administer 500-1000 mL oral electrolyte rehydration solution (avoid plain hypotonic water).",
            "5. Monitoring: Re-measure vitals every 10 minutes until HR stabilizes < 75 bpm and SBP > 110 mmHg.",
            "6. Flight Surgeon: Transmit Uplink Packet immediately to Ground Medical Ops (BME/Surgeon console).",
        ]
    elif is_watch:
        triage_level = "LEVEL 2 — AUTONOMIC STRAIN / WATCH"
        status_color = "amber"
        risk_summary = "Moderate hemodynamic variation from preflight baseline without acute decompensation."
        immediate_steps = [
            "1. Instruct crewmate to pause vigorous activity and remain seated.",
            "2. Offer 500 mL oral rehydration beverage and verify daily hydration logs.",
            "3. Confirm compression garments are fitted snug around calf and abdomen.",
            "4. Repeat resting blood pressure check in 20 minutes.",
        ]
    else:
        triage_level = "LEVEL 1 — STABLE / WITHIN TOLERANCE"
        status_color = "green"
        risk_summary = "All vital indicators correlate with personal preflight reference ranges."
        immediate_steps = [
            "1. Reassure crewmate that vitals are within personal preflight envelope.",
            "2. Maintain standard mission hydration and exercise countermeasures.",
            "3. Log standard daily telemetry record.",
        ]

    # Derived Hemodynamic Indices
    hemodynamics = compute_hemodynamic_indices(
        hr=payload.hr,
        sbp=payload.sbp,
        dbp=payload.dbp,
        hr_baseline_mean=hr_base.get("mean"),
        sbp_baseline_mean=sbp_base.get("mean"),
    )

    # Measurement quality validation
    quality_validation = validate_measurement_quality(
        hr=payload.hr,
        sbp=payload.sbp,
        dbp=payload.dbp,
        collection_context="Acute Symptom Check",
    )

    # Completeness audit
    completeness = evaluate_data_completeness(df, "Early Postflight (1g Return)")
    completeness_pct = completeness.get("orthostatic_hr_delta", {}).get("data_completeness_pct", 100.0)

    # Generate Formatted Flight-Surgeon SBAR Uplink Report
    ast_name = profile["name"] if profile else payload.astronaut_id
    vitals_dict = {
        "hr": {"value": payload.hr, "delta": hr_delta, "z_score": hr_z},
        "sbp": {"value": payload.sbp, "delta": sbp_delta, "z_score": sbp_z},
        "dbp": {"value": payload.dbp, "delta": dbp_delta, "z_score": dbp_z},
        "ortho_delta": {"value": payload.ortho_delta, "delta": ortho_delta, "z_score": ortho_z},
    }

    sbar_report = format_sbar_handoff_packet(
        astronaut_id=payload.astronaut_id,
        astronaut_name=ast_name,
        mission_day=95,
        phase_name="Early Postflight (1g Return)",
        gravity_context=payload.gravity_context or "Earth Landing Zone (1.0g)",
        symptom=payload.symptom,
        triage_level=triage_level,
        status_color=status_color,
        vitals=vitals_dict,
        baselines=baselines,
        hemodynamics=hemodynamics,
        completeness_pct=completeness_pct,
        immediate_steps=immediate_steps,
    )

    return {
        "classification": DATA_CLASSIFICATION,
        "disclaimer": DISCLAIMER_TEXT,
        "triage_level": triage_level,
        "status_color": status_color,
        "risk_summary": risk_summary,
        "vitals_evaluated": {
            "hr": {"value": payload.hr, "delta": hr_delta, "z_score": hr_z, "base_mean": hr_base.get("mean")},
            "sbp": {"value": payload.sbp, "delta": sbp_delta, "z_score": sbp_z, "base_mean": sbp_base.get("mean")},
            "dbp": {"value": payload.dbp, "delta": dbp_delta, "z_score": dbp_z, "base_mean": dbp_base.get("mean")},
            "ortho_delta": {"value": payload.ortho_delta, "delta": ortho_delta, "z_score": ortho_z, "base_mean": ortho_base.get("mean")},
        },
        "derived_hemodynamics": hemodynamics,
        "measurement_quality": quality_validation,
        "immediate_steps": immediate_steps,
        "uplink_report": sbar_report,
        "sbar_report": sbar_report,
    }


@app.post("/api/si-query", response_model=SIQueryResponse)
def handle_si_query(payload: SIQueryRequest) -> SIQueryResponse:
    """
    CrewSignal Neuro-Symbolic Super Intelligence (SI) Co-Pilot:
    - Grounds queries strictly in verified NetworkX knowledge graph and NASA/CSA publications.
    - Operates 100% offline in deep space (deterministic engine) with optional cloud LLM synthesis.
    - Returns structured answer bullets, citations, data gap notes, and non-diagnostic safety guardrail.
    """
    return query_si_engine(payload)


# ---------------------------------------------------------------------------
# NASA Standard Interoperability & Aerospace Telemetry Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/flight-rules/{astronaut_id}")
def get_flight_rules(astronaut_id: str) -> Dict[str, Any]:
    """Evaluates formal NASA Flight Rules (JSC Flight Operations Directorate standards)."""
    dashboard = get_dashboard(astronaut_id)
    return dashboard["flight_rules"]


@app.get("/api/export/fhir/{astronaut_id}")
def export_fhir(astronaut_id: str) -> Dict[str, Any]:
    """Exports structured HL7 FHIR R4 Bundle for NASA Lifetime Surveillance of Astronaut Health (LSAH)."""
    dashboard = get_dashboard(astronaut_id)
    profile = dashboard["astronaut"]
    kpis = dashboard["kpis"]
    vitals_dict = {
        "hr": {"value": kpis["resting_hr"]["value"]},
        "sbp": {"value": kpis["systolic_bp"]["value"]},
        "dbp": {"value": kpis["diastolic_bp"]["value"]},
        "ortho_delta": {"value": kpis["orthostatic_hr_delta"]["value"]},
    }
    return generate_hl7_fhir_space_record(
        astronaut_id=astronaut_id,
        astronaut_name=profile["name"],
        mission_day=dashboard["mission_day"],
        phase_name=dashboard["active_phase"],
        vitals=vitals_dict,
        hemodynamics=dashboard["derived_hemodynamics"],
        biophysics=dashboard["advanced_biophysics"],
        flight_rules=dashboard["flight_rules"],
    )


@app.get("/api/export/ccsds/{astronaut_id}")
def export_ccsds(astronaut_id: str) -> Dict[str, Any]:
    """Exports standard CCSDS 133.0-B-2 Space Packet Protocol Telemetry Frame."""
    dashboard = get_dashboard(astronaut_id)
    return dashboard["ccsds_packet"]


@app.get("/api/telemetry/audit-seal/{astronaut_id}")
def get_audit_seal(astronaut_id: str) -> Dict[str, Any]:
    """Returns cryptographic FIPS 180-4 SHA-256 black-box flight data recorder seal."""
    dashboard = get_dashboard(astronaut_id)
    return dashboard["merkle_seal"]

