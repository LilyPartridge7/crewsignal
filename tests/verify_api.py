"""
CrewSignal — FastAPI Server Verification Script
==============================================
Tests all endpoints:
- GET /api/astronauts
- GET /api/dashboard/{astronaut_id} (including Derived Hemodynamics & Quality Gatekeeper)
- GET /api/timeline/{astronaut_id} (including per-point hemodynamic indices)
- POST /api/measurements (Quality Gatekeeper validation & context flag)
- GET /api/evidence
- POST /api/acute-triage (SBAR Flight Surgeon packet & Hemodynamics)
- POST /api/simulate-countermeasures (NASA HRP operational parameters)
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from api.server import (
    list_astronauts,
    get_dashboard,
    get_timeline,
    create_measurement,
    get_evidence,
    acute_triage,
    simulate_countermeasures_endpoint,
    handle_si_query,
    get_flight_rules,
    export_fhir,
    export_ccsds,
    get_audit_seal,
    MeasurementInput,
    AcuteTriageInput,
    CountermeasureSimInput,
    SIQueryRequest,
)

def test_endpoints():
    print("\n--- Running FastAPI Server Verification Test ---")

    # 1. Astronauts
    data = list_astronauts()
    assert data["count"] >= 2, "Expected at least 2 astronauts"
    ast_ids = [a["id"] for a in data["astronauts"]]
    assert "SYNTH-AST-01" in ast_ids
    assert "SYNTH-AST-02" in ast_ids
    print(f"✓ GET /api/astronauts: 200 OK (Found {data['count']} profiles: {ast_ids})")

    # 2. Dashboard with Derived Hemodynamics & Quality
    dash = get_dashboard("SYNTH-AST-01", phase="Early Postflight (1g Return)")
    assert "kpis" in dash
    assert "coupled_pattern" in dash
    assert "structured_insight" in dash
    assert "derived_hemodynamics" in dash
    assert "measurement_quality" in dash
    hemo = dash["derived_hemodynamics"]
    assert hemo["map_mmhg"] is not None, "MAP must be calculated"
    assert hemo["pulse_pressure_mmhg"] is not None, "Pulse pressure must be calculated"
    assert hemo["shock_index"] is not None, "Shock index must be calculated"
    print(f"✓ GET /api/dashboard/SYNTH-AST-01: 200 OK (MAP={hemo['map_mmhg']} mmHg, PP={hemo['pulse_pressure_mmhg']} mmHg, Shock Index={hemo['shock_index']})")

    # 3. Timeline with Derived Hemodynamics
    tline = get_timeline("SYNTH-AST-01")
    assert len(tline["timeline"]) == 151
    assert "phase_segments" in tline
    assert "reference_bands" in tline
    assert "map_mmhg" in tline["timeline"][0]
    print(f"✓ GET /api/timeline/SYNTH-AST-01: 200 OK (151 points with derived hemodynamics)")

    # 4. Measurement Quality & Context Gatekeeper
    # 4a. Post-exercise elevation context
    meas_input = MeasurementInput(
        astronaut_id="SYNTH-AST-01",
        mission_day=98,
        phase_name="Early Postflight (1g Return)",
        resting_hr=74.0,
        systolic_bp=108.0,
        diastolic_bp=72.0,
        orthostatic_hr_delta=29.5,
        activity_context="Automated Unit Test Self-Check",
        collection_context="Post-Exercise (<30 min)",
        notes="Testing measurement quality gatekeeper"
    )
    res = create_measurement(meas_input)
    assert res["success"] is True
    assert res["quality_validation"]["context_flag"] == "Contextual Elevation (Expected Post-Exertion)"
    assert res["quality_validation"]["alert_suppressed"] is True
    print(f"✓ POST /api/measurements (Context Gatekeeper): Flagged as '{res['quality_validation']['context_flag']}'")

    # 4b. Physiological plausibility check (invalid SBP < DBP)
    invalid_input = MeasurementInput(
        resting_hr=70.0,
        systolic_bp=70.0,
        diastolic_bp=110.0,  # SBP < DBP
    )
    try:
        create_measurement(invalid_input)
        assert False, "Should have raised HTTPException for SBP <= DBP"
    except Exception as e:
        print(f"✓ POST /api/measurements (Physiological Gatekeeper): Correctly rejected invalid vitals: {e.detail}")

    # 5. Evidence
    ev = get_evidence()
    assert len(ev["evidence_sources"]) == 5
    assert len(ev["indicator_guides"]) == 5
    assert ev["knowledge_graph"]["node_count"] > 10
    print(f"✓ GET /api/evidence: 200 OK (5 sources, 5 guides, {ev['knowledge_graph']['node_count']} graph nodes)")

    # 6. SBAR Flight-Surgeon Handoff Packet in Acute Triage
    triage_payload = AcuteTriageInput(
        astronaut_id="SYNTH-AST-01",
        hr=88.0,
        sbp=96.0,
        dbp=62.0,
        ortho_delta=34.0,
        symptom="Presyncope / Lightheadedness upon standing",
        gravity_context="Earth Landing Zone (1.0g)"
    )
    tri = acute_triage(triage_payload)
    assert "LEVEL 3" in tri["triage_level"]
    assert "uplink_report" in tri
    assert "[S - SITUATION]" in tri["uplink_report"]
    assert "[B - BACKGROUND]" in tri["uplink_report"]
    assert "[A - ASSESSMENT & PHYSIOLOGICAL INDICES]" in tri["uplink_report"]
    assert "[R - CONSERVATIVE CREW ACTION & FLIGHT-RULE ESCALATION]" in tri["uplink_report"]
    assert tri["derived_hemodynamics"]["map_mmhg"] == 73.3
    assert tri["derived_hemodynamics"]["pulse_pressure_mmhg"] == 34.0
    print("✓ POST /api/acute-triage: Standardized SBAR Flight-Surgeon Packet verified with MAP, PP & Shock Index")

    # 7. Countermeasure Simulation
    sim_input = CountermeasureSimInput(
        astronaut_id="SYNTH-AST-01",
        fluid_loading_pct=85.0,
        lbnp_sessions_per_week=4.0,
        exercise_min_per_day=75.0,
    )
    sim = simulate_countermeasures_endpoint(sim_input)
    assert len(sim["recovery_curve"]) == 30
    assert sim["parameters"]["composite_adherence_index"] > 0.8
    print(f"✓ POST /api/simulate-countermeasures: Verified 30-day recovery curve (Adherence Index: {sim['parameters']['composite_adherence_index']})")

    # 8. Super Intelligence (SI) Co-Pilot Query
    si_input = SIQueryRequest(
        astronaut_id="SYNTH-AST-01",
        phase="Early Postflight (1g Return)",
        question="Why did my pulse pressure narrow in 0g?",
        map_mmhg=85.2,
        pulse_pressure_mmhg=24.0,
        shock_index=0.72,
        ortho_delta_z=2.1,
    )
    si_res = handle_si_query(si_input)
    assert len(si_res.answer_bullets) <= 4
    assert len(si_res.answer_bullets) >= 1
    assert len(si_res.cited_sources) >= 1
    assert any("NASA" in s.id or "CSA" in s.id for s in si_res.cited_sources)
    assert "NON-DIAGNOSTIC" in si_res.non_diagnostic_guardrail
    assert si_res.data_gaps_acknowledged != ""
    print(f"✓ POST /api/si-query: 200 OK ({si_res.grounded_mode}, {len(si_res.answer_bullets)} bullets, Sources: {[s.id for s in si_res.cited_sources]})")

    # 9. NASA Level IV/V Flight Rules
    fr = get_flight_rules("SYNTH-AST-01")
    assert "overall_status" in fr
    assert len(fr["rules"]) == 3
    print(f"✓ GET /api/flight-rules/SYNTH-AST-01: 200 OK (Status: {fr['overall_status']}, Rules: {[r['id'] for r in fr['rules']]})")

    # 10. HL7 FHIR Spaceflight Profile
    fhir = export_fhir("SYNTH-AST-01")
    assert fhir["resourceType"] == "DiagnosticReport"
    assert len(fhir["contained"]) >= 5
    print(f"✓ GET /api/export/fhir/SYNTH-AST-01: 200 OK (FHIR DiagnosticReport with {len(fhir['contained'])} Observation resources)")

    # 11. CCSDS 133.0 Space Packet Telemetry Frame
    ccsds = export_ccsds("SYNTH-AST-01")
    assert "raw_hex" in ccsds
    assert ccsds["standard"] == "CCSDS 133.0-B-2 Space Packet Protocol"
    print(f"✓ GET /api/export/ccsds/SYNTH-AST-01: 200 OK (APID: {ccsds['apid_hex']}, Bytes: {ccsds['total_bytes']})")

    # 12. FIPS 180-4 SHA-256 Merkle Audit Seal
    seal = get_audit_seal("SYNTH-AST-01")
    assert "sha256_seal" in seal
    assert seal["is_verified"] is True
    print(f"✓ GET /api/telemetry/audit-seal/SYNTH-AST-01: 200 OK (SHA-256: {seal['sha256_seal'][:16]}...)")

    print("\nALL FASTAPI ENDPOINTS & ANALYTICS VERIFIED SUCCESSFULLY!\n")

if __name__ == "__main__":
    test_endpoints()
