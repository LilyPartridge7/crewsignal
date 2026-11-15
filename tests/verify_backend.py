"""
CrewSignal — Backend Verification & Acceptance Test Suite
==========================================================
Verifies SQLite initialization, synthetic 120-day longitudinal trajectory,
baseline computation, Z-score anomaly detection, official NASA/CSA URLs,
and NetworkX knowledge graph operations.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from core.database import (
    DEFAULT_DB_PATH,
    get_all_evidence_sources,
    get_all_indicator_guides,
    get_astronaut_measurements,
    get_astronaut_profile,
    init_db,
    insert_measurement,
)
from core.analytics import (
    calculate_personal_baseline,
    detect_phase_anomalies,
    enrich_measurements_with_baselines,
    evaluate_data_completeness,
    generate_structured_insight,
    STATUS_ACTION,
    STATUS_WATCH,
    STATUS_NORMAL,
)
from core.knowledge_graph import (
    build_crewsignal_knowledge_graph,
    get_evidence_for_observation,
    get_subgraph_for_visualization,
)

EXPECTED_EVIDENCE_URLS = {
    "NASA-HRP-HAZ-01": "https://www.nasa.gov/hrp/hazards/",
    "NASA-HRP-RISK-01": "https://www.nasa.gov/hrp/risks/",
    "NASA-HRP-RES-01": "https://www.nasa.gov/hrp/ongoing-hrp-research/",
    "CSA-RAD-2026-01": "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp",
    "CSA-SCI-2026-01": "https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp",
}


def test_database_and_synthetic_guardrails():
    print("\n[1/6] Testing Database Initialization & Synthetic Guardrails...")
    conn = init_db(force_reseed=True)
    assert conn is not None, "Failed to connect to SQLite database."

    profile = get_astronaut_profile("SYNTH-AST-01")
    assert profile is not None, "Profile SYNTH-AST-01 not found."
    assert profile["is_synthetic"] == 1, "is_synthetic must be 1."
    assert profile["data_classification"] == "SYNTHETIC DEMONSTRATION DATA", (
        "data_classification must be SYNTHETIC DEMONSTRATION DATA."
    )
    print(f"  ✓ Astronaut profile verified: {profile['name']} (is_synthetic={profile['is_synthetic']})")

    df = get_astronaut_measurements("SYNTH-AST-01")
    assert not df.empty, "Measurements DataFrame is empty."
    assert len(df) == 151, f"Expected 151 records (days -30 to 120), got {len(df)}."
    assert (df["is_synthetic"] == 1).all(), "All measurement records must have is_synthetic == 1."
    assert (df["data_classification"] == "SYNTHETIC DEMONSTRATION DATA").all(), (
        "All measurement records must have data_classification == 'SYNTHETIC DEMONSTRATION DATA'."
    )
    print(f"  ✓ 151 synthetic daily measurements verified across Days {df['mission_day'].min()} to {df['mission_day'].max()}.")


def test_evidence_and_indicator_guides():
    print("\n[2/6] Verifying Official NASA & CSA Evidence Sources...")
    sources = get_all_evidence_sources()
    assert len(sources) == 5, f"Expected exactly 5 official evidence sources, got {len(sources)}."

    found_urls = {}
    for src in sources:
        sid = src["id"]
        url = src["url"]
        found_urls[sid] = url
        assert sid in EXPECTED_EVIDENCE_URLS, f"Unexpected source ID: {sid}"
        assert url == EXPECTED_EVIDENCE_URLS[sid], f"URL mismatch for {sid}: {url} != {EXPECTED_EVIDENCE_URLS[sid]}"
        print(f"  ✓ Verified [{sid}] ({src['organization']}): {url}")

    guides = get_all_indicator_guides()
    expected_indicators = {"resting_hr", "systolic_bp", "diastolic_bp", "orthostatic_hr_delta", "cumulative_radiation_msv"}
    assert set(guides.keys()) == expected_indicators, f"Mismatch in indicator guides: {set(guides.keys())}"
    for k, g in guides.items():
        assert len(g["how_to_measure"]) > 10
        assert len(g["why_it_matters"]) > 10
        assert len(g["abnormal_action"]) > 10
    print(f"  ✓ All 5 plain-English astronaut indicator guides verified.")


def test_baseline_and_enrichment():
    print("\n[3/6] Testing Statistical Baseline Engine & Enrichment...")
    df = get_astronaut_measurements("SYNTH-AST-01")
    baselines = calculate_personal_baseline(df)

    assert "resting_hr" in baselines
    assert baselines["resting_hr"]["n_samples"] == 30, f"Expected 30 baseline days (-30 to -1), got {baselines['resting_hr']['n_samples']}."
    assert 57.0 <= baselines["resting_hr"]["mean"] <= 63.0, f"Unexpected resting_hr mean: {baselines['resting_hr']['mean']}"
    assert 115.0 <= baselines["systolic_bp"]["mean"] <= 122.0, f"Unexpected systolic_bp mean: {baselines['systolic_bp']['mean']}"
    assert 9.0 <= baselines["orthostatic_hr_delta"]["mean"] <= 14.0, f"Unexpected orthostatic delta mean: {baselines['orthostatic_hr_delta']['mean']}"
    print(f"  ✓ Preflight Baselines: Resting HR={baselines['resting_hr']['mean']}±{baselines['resting_hr']['std']} bpm, "
          f"Sys BP={baselines['systolic_bp']['mean']}±{baselines['systolic_bp']['std']} mmHg, "
          f"Ortho Delta={baselines['orthostatic_hr_delta']['mean']}±{baselines['orthostatic_hr_delta']['std']} bpm.")

    enriched_df = enrich_measurements_with_baselines(df, baselines)
    assert "orthostatic_hr_delta_zscore" in enriched_df.columns
    assert "resting_hr_status" in enriched_df.columns
    print("  ✓ Longitudinal DataFrame enriched with Z-scores, deltas, and status categories.")


def test_postflight_anomaly_detection():
    print("\n[4/6] Testing Postflight Orthostatic Anomaly Detection (Days 91-105)...")
    df = get_astronaut_measurements("SYNTH-AST-01")
    baselines = calculate_personal_baseline(df)
    enriched_df = enrich_measurements_with_baselines(df, baselines)

    early_post = enriched_df[enriched_df["phase_name"] == "Early Postflight (1g Return)"]
    assert not early_post.empty

    mean_post_hr = early_post["resting_hr"].mean()
    mean_post_sys = early_post["systolic_bp"].mean()
    mean_post_ortho = early_post["orthostatic_hr_delta"].mean()
    mean_post_ortho_z = early_post["orthostatic_hr_delta_zscore"].mean()

    print(f"  • Early Postflight Mean Resting HR: {mean_post_hr:.1f} bpm (Baseline: {baselines['resting_hr']['mean']} bpm)")
    print(f"  • Early Postflight Mean Systolic BP: {mean_post_sys:.1f} mmHg (Baseline: {baselines['systolic_bp']['mean']} mmHg)")
    print(f"  • Early Postflight Mean Ortho Delta: {mean_post_ortho:.1f} bpm (Baseline: {baselines['orthostatic_hr_delta']['mean']} bpm)")
    print(f"  • Early Postflight Orthostatic HR Delta Mean Z-Score: {mean_post_ortho_z:+.2f}")

    # Orthostatic intolerance verification
    assert mean_post_ortho >= 30.0, f"Expected postflight orthostatic delta >= 30 bpm, got {mean_post_ortho}"
    assert mean_post_ortho_z >= 5.0, f"Expected severe Z-score shift (>= 5.0), got {mean_post_ortho_z}"
    assert mean_post_sys < baselines["systolic_bp"]["mean"], "Expected postflight systolic BP reduction."

    # Anomaly detector
    anomalies = detect_phase_anomalies(enriched_df, "Early Postflight (1g Return)")
    assert len(anomalies) > 0, "Expected anomalies detected during Early Postflight."
    print(f"  ✓ Successfully identified {len(anomalies)} anomaly events in Early Postflight phase.")


def test_missing_data_transparency_and_insights():
    print("\n[5/6] Testing Missing Data Transparency & Structured Insights...")
    df = get_astronaut_measurements("SYNTH-AST-01")
    baselines = calculate_personal_baseline(df)

    # Check In-flight completeness (intermittent LBNP)
    inflight_completeness = evaluate_data_completeness(df, "In-Flight (0g Transit)")
    ortho_comp = inflight_completeness["orthostatic_hr_delta"]
    print(f"  • In-Flight Orthostatic Delta Completeness: {ortho_comp['data_completeness_pct']}% "
          f"({ortho_comp['observed_count']} observed, {ortho_comp['missing_count']} missing)")
    assert ortho_comp["missing_count"] > 0, "Expected missing observations in in-flight intermittent LBNP."
    assert "Intermittent protocol" in ortho_comp["uncertainty_note"], "Expected transparent uncertainty note."

    # Test structured insight generator on peak postflight day
    peak_row = df[df["mission_day"] == 95].iloc[0]
    insight = generate_structured_insight(peak_row, baselines, "orthostatic_hr_delta")

    required_keys = [
        "observed_data",
        "statistical_finding",
        "mission_context",
        "scientific_background",
        "uncertainty_and_limitations",
        "recommended_crew_action",
    ]
    for k in required_keys:
        assert k in insight, f"Missing key in insight: {k}"
        assert len(insight[k]) > 0, f"Empty field in insight: {k}"

    assert "NASA-HRP-RISK-01" in insight["scientific_background"], "Expected NASA-HRP-RISK-01 citation in insight."
    assert "SYNTHETIC DEMONSTRATION DATA" in insight["uncertainty_and_limitations"].upper()
    print("  ✓ Structured insight verified with all 6 separated scientific sections and citations.")


def test_knowledge_graph_and_queries():
    print("\n[6/6] Testing NetworkX Knowledge Graph & Subgraph Queries...")
    G = build_crewsignal_knowledge_graph()
    assert G.number_of_nodes() >= 15, f"Expected >= 15 nodes, got {G.number_of_nodes()}."
    assert G.number_of_edges() >= 25, f"Expected >= 25 edges, got {G.number_of_edges()}."

    # Test evidence retrieval
    ev_result = get_evidence_for_observation("orthostatic_hr_delta", "Early Postflight (1g Return)")
    assert ev_result["total_sources_found"] >= 2
    assert ev_result["guide"] is not None
    print(f"  ✓ Evidence retrieval successful: {ev_result['total_sources_found']} sources found for orthostatic_hr_delta in Early Postflight.")

    # Test subgraph
    sub = get_subgraph_for_visualization(indicator="orthostatic_hr_delta", phase_name="Early Postflight (1g Return)")
    assert sub.number_of_nodes() > 0
    print(f"  ✓ Visualization subgraph extracted ({sub.number_of_nodes()} nodes, {sub.number_of_edges()} edges).")

    # Test self-check insertion
    new_id = insert_measurement(
        {
            "astronaut_id": "SYNTH-AST-01",
            "mission_day": 121,
            "phase_name": "Late Postflight Recovery",
            "gravity_g": 1.0,
            "resting_hr": 62.0,
            "systolic_bp": 117.0,
            "diastolic_bp": 75.0,
            "orthostatic_hr_delta": 12.0,
            "cumulative_radiation_msv": 31.25,
            "notes": "Test Live Self-Check Entry.",
        }
    )
    assert new_id > 0
    print(f"  ✓ Live self-check insert verified (Row ID: {new_id}).")


if __name__ == "__main__":
    print("==================================================================")
    print("  CREWSIGNAL BACKEND VERIFICATION & ACCEPTANCE TEST SUITE")
    print("==================================================================")
    try:
        test_database_and_synthetic_guardrails()
        test_evidence_and_indicator_guides()
        test_baseline_and_enrichment()
        test_postflight_anomaly_detection()
        test_missing_data_transparency_and_insights()
        test_knowledge_graph_and_queries()
        print("\n==================================================================")
        print("  ALL BACKEND TESTS PASSED SUCCESSFULLY! (6/6)")
        print("==================================================================")
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
