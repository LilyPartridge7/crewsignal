"""
CrewSignal — Core Database Engine
==================================
Manages SQLite persistence for astronauts, longitudinal physiological measurements,
evidence sources (NASA HRP / CSA), and plain-English astronaut indicator guides.

SAFETY & COMPLIANCE GUARDRAIL:
- This is an evidence-informed prototype for cardiovascular adaptation & recovery.
- NOT a medical diagnostic or prescriptive device.
- All simulated measurements are labeled 'SYNTHETIC DEMONSTRATION DATA' (is_synthetic=1).
- Strictly references 5 official NASA & CSA publications.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DEFAULT_DB_PATH = DATA_DIR / "crewsignal.db"
EVIDENCE_JSON_PATH = DATA_DIR / "nasa_csa_evidence.json"

DISCLAIMER_TEXT = (
    "CrewSignal is an evidence-informed astronaut health-monitoring prototype "
    "focused strictly on cardiovascular adaptation in microgravity and postflight recovery. "
    "It is NOT a diagnostic or prescriptive medical tool."
)
DATA_CLASSIFICATION = "SYNTHETIC DEMONSTRATION DATA"


def get_db_connection(db_path: Optional[Path | str] = None) -> sqlite3.Connection:
    """Creates a configured connection to the SQLite database with row factory."""
    target_path = Path(db_path) if db_path else DEFAULT_DB_PATH
    target_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def create_schema(conn: sqlite3.Connection) -> None:
    """Initializes tables for astronauts, measurements, evidence sources, and guides."""
    with conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS astronauts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                mission_name TEXT NOT NULL,
                is_synthetic INTEGER NOT NULL DEFAULT 1,
                data_classification TEXT NOT NULL DEFAULT 'SYNTHETIC DEMONSTRATION DATA',
                created_at TEXT NOT NULL,
                metadata_json TEXT
            );

            CREATE TABLE IF NOT EXISTS evidence_sources (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                organization TEXT NOT NULL,
                url TEXT NOT NULL,
                summary TEXT NOT NULL,
                mission_contexts TEXT NOT NULL,
                related_indicators TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS indicator_guides (
                indicator TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                unit TEXT NOT NULL,
                how_to_measure TEXT NOT NULL,
                why_it_matters TEXT NOT NULL,
                abnormal_action TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                astronaut_id TEXT NOT NULL,
                mission_day INTEGER NOT NULL,
                phase_name TEXT NOT NULL,
                gravity_g REAL NOT NULL,
                location TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                resting_hr REAL,
                systolic_bp REAL,
                diastolic_bp REAL,
                orthostatic_hr_delta REAL,
                cumulative_radiation_msv REAL,
                activity_context TEXT,
                is_synthetic INTEGER NOT NULL DEFAULT 1,
                data_classification TEXT NOT NULL DEFAULT 'SYNTHETIC DEMONSTRATION DATA',
                notes TEXT,
                FOREIGN KEY (astronaut_id) REFERENCES astronauts(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_measurements_ast_day 
                ON measurements(astronaut_id, mission_day);
            CREATE INDEX IF NOT EXISTS idx_measurements_phase 
                ON measurements(phase_name);
            """
        )


def seed_evidence_and_guides(conn: sqlite3.Connection) -> None:
    """Populates evidence_sources and indicator_guides from verified JSON."""
    if not EVIDENCE_JSON_PATH.exists():
        raise FileNotFoundError(f"Evidence file missing at: {EVIDENCE_JSON_PATH}")

    with open(EVIDENCE_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    with conn:
        for src in data.get("evidence_sources", []):
            conn.execute(
                """
                INSERT OR REPLACE INTO evidence_sources
                (id, title, organization, url, summary, mission_contexts, related_indicators)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    src["id"],
                    src["title"],
                    src["organization"],
                    src["url"],
                    src["summary"],
                    json.dumps(src.get("mission_contexts", [])),
                    json.dumps(src.get("related_indicators", [])),
                ),
            )

        for indicator, guide in data.get("indicator_guides", {}).items():
            conn.execute(
                """
                INSERT OR REPLACE INTO indicator_guides
                (indicator, label, unit, how_to_measure, why_it_matters, abnormal_action)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    indicator,
                    guide["label"],
                    guide["unit"],
                    guide["how_to_measure"],
                    guide["why_it_matters"],
                    guide["abnormal_action"],
                ),
            )


def generate_synthetic_profile_measurements(
    astronaut_id: str = "SYNTH-AST-01",
    seed: int = 42,
) -> List[Dict[str, Any]]:
    """
    Generates a deterministic 151-day longitudinal trajectory (Days -30 to 120)
    for astronauts across 5 distinct gravitational and operational phases:

    1. Days -30 to -1:  Preflight (1g Baseline) — Earth Training Facility
    2. Days 1 to 60:    In-Flight (0g Transit) — Deep-Space Transit Spacecraft
    3. Days 61 to 90:   Planetary/Lunar Surface (Partial-g) — Lunar Surface Habitat
    4. Days 91 to 105:  Early Postflight (1g Return) — Earth Recovery
    5. Days 106 to 120: Late Postflight Recovery — Earth Rehabilitation

    Profiles:
    - SYNTH-AST-01: High Orthostatic Sensitivity (Postflight HR ~76, SBP ~105-107, Ortho Delta ~31, Z > +11)
    - SYNTH-AST-02: Strong Countermeasure Responder (Postflight HR ~65, SBP ~116, Ortho Delta ~16)
    """
    is_responder = astronaut_id == "SYNTH-AST-02"
    actual_seed = seed + 100 if is_responder else seed
    rng = np.random.RandomState(actual_seed)
    base_date = datetime(2026, 3, 1, 8, 0, 0)
    records: List[Dict[str, Any]] = []

    cumulative_rad = 0.20  # Baseline earthly background mSv

    # Day indices from -30 up to 120
    for day in range(-30, 121):
        timestamp = (base_date + timedelta(days=day + 30)).strftime("%Y-%m-%d %H:%M:%S")

        if -30 <= day <= -1:
            # Phase 1: Preflight 1g Baseline
            phase_name = "Preflight (1g Baseline)"
            gravity_g = 1.0
            location = "Earth Training Facility (Johnson Space Center)"
            
            if is_responder:
                resting_hr = round(float(rng.normal(58.5, 2.0)), 1)
                systolic_bp = round(float(rng.normal(120.2, 2.6)), 1)
                diastolic_bp = round(float(rng.normal(77.5, 1.9)), 1)
                ortho_delta = round(float(rng.normal(10.2, 1.7)), 1)
            else:
                resting_hr = round(float(rng.normal(60.2, 2.2)), 1)
                systolic_bp = round(float(rng.normal(118.4, 2.8)), 1)
                diastolic_bp = round(float(rng.normal(76.1, 2.0)), 1)
                ortho_delta = round(float(rng.normal(11.0, 1.8)), 1)
            
            cumulative_rad += round(float(rng.uniform(0.005, 0.010)), 3)
            activity = "Standard Morning 1g Supine-to-Stand Baseline Protocol"
            notes = "Standard preflight baseline measurement. Normal autonomic tone."

        elif 1 <= day <= 60:
            # Phase 2: In-Flight 0g Transit
            phase_name = "In-Flight (0g Transit)"
            gravity_g = 0.0
            location = "Deep-Space Transit Spacecraft (Hab Module)"
            
            if is_responder:
                # Strong countermeasure responder maintains higher tone
                resting_hr = round(float(rng.normal(61.2, 2.1)), 1)
                systolic_bp = round(float(rng.normal(117.0, 2.8)), 1)
                diastolic_bp = round(float(rng.normal(76.0, 1.9)), 1)
            else:
                resting_hr = round(float(rng.normal(63.1, 2.3)), 1)
                systolic_bp = round(float(rng.normal(114.8, 3.0)), 1)
                diastolic_bp = round(float(rng.normal(74.2, 2.1)), 1)

            # Intermittent LBNP stand-simulations:
            if (day % 4 == 0) or (day in (15, 30, 45, 60)):
                ortho_delta = round(float(rng.normal(13.8 if is_responder else 16.5, 2.2)), 1)
                activity = "In-Flight LBNP (Lower Body Negative Pressure) Stress Check"
                notes = "Scheduled LBNP cardiovascular stress test. " + (
                    "Robust countermeasure tolerance observed." if is_responder else "Mild vascular deconditioning noted."
                )
            else:
                ortho_delta = None  # Transparent missing data
                activity = "Standard In-Flight Microgravity Morning Check"
                notes = "Routine rest telemetry. LBNP not scheduled on this flight day."

            cumulative_rad += round(float(rng.normal(0.33, 0.04)), 3)

        elif 61 <= day <= 90:
            # Phase 3: Planetary/Lunar Surface Partial-g
            phase_name = "Planetary/Lunar Surface (Partial-g)"
            gravity_g = 0.16
            location = "Lunar Surface Habitat (Shackleton Base)"
            
            if is_responder:
                resting_hr = round(float(rng.normal(62.8, 2.2)), 1)
                systolic_bp = round(float(rng.normal(118.0, 2.9)), 1)
                diastolic_bp = round(float(rng.normal(76.8, 2.0)), 1)
            else:
                resting_hr = round(float(rng.normal(65.4, 2.4)), 1)
                systolic_bp = round(float(rng.normal(116.5, 3.2)), 1)
                diastolic_bp = round(float(rng.normal(75.8, 2.2)), 1)

            if day % 3 == 0:
                ortho_delta = round(float(rng.normal(14.2 if is_responder else 17.8, 2.0)), 1)
                activity = "Partial-g Orthostatic Sit-to-Stand Check"
                notes = "Partial gravity (0.16g) sit-to-stand check. " + (
                    "Stable baroreflex response." if is_responder else "Moderate baroreflex response."
                )
            else:
                ortho_delta = None
                activity = "Surface Habitat Morning Rest Check"
                notes = "Post-rest baseline prior to EVA prep."

            cumulative_rad += round(float(rng.normal(0.28, 0.03)), 3)

        elif 91 <= day <= 105:
            # Phase 4: Early Postflight 1g Return
            phase_name = "Early Postflight (1g Return)"
            gravity_g = 1.0
            location = "Earth Recovery Facility (Landing Zone Medical Unit)"
            
            if is_responder:
                # Strong responder has tight postflight control
                resting_hr = round(float(rng.normal(65.1, 2.2)), 1)
                systolic_bp = round(float(rng.normal(116.2, 2.8)), 1)
                diastolic_bp = round(float(rng.normal(75.4, 2.0)), 1)
                ortho_delta = round(float(rng.normal(16.1, 2.2)), 1)
                activity = "Postflight Medical Monitoring & Re-Adaptation Stand Test"
                notes = (
                    "STABLE RE-ADAPTATION: Strong countermeasure responder. Heart rate delta "
                    "remains controlled (<20 bpm). Good baroreflex tone and blood pressure maintenance."
                )
            else:
                # High sensitivity: pronounced orthostatic intolerance shift!
                resting_hr = round(float(rng.normal(76.2, 2.5)), 1)
                systolic_bp = round(float(rng.normal(106.8, 3.1)), 1)
                diastolic_bp = round(float(rng.normal(70.8, 2.4)), 1)
                ortho_delta = round(float(rng.normal(31.4, 2.8)), 1)
                activity = "Postflight Medical Monitoring & Re-Adaptation Stand Test"
                notes = (
                    "SIGNIFICANT SHIFT: Orthostatic intolerance detected. Exaggerated heart rate delta "
                    "(>30 bpm) upon standing and reduced systolic pressure. Compression garments active."
                )
            cumulative_rad += round(float(rng.uniform(0.006, 0.012)), 3)

        else:
            # Phase 5: Late Postflight Recovery (Days 106 to 120)
            phase_name = "Late Postflight Recovery"
            gravity_g = 1.0
            location = "Earth Rehabilitation Facility"
            
            progress = (day - 105) / 15.0  # 0.0 to 1.0
            if is_responder:
                target_hr = 65.0 - progress * (65.0 - 58.5)
                target_sys = 116.0 + progress * (120.0 - 116.0)
                target_dia = 75.0 + progress * (77.5 - 75.0)
                target_ortho = 16.0 - progress * (16.0 - 10.5)
            else:
                target_hr = 76.0 - progress * (76.0 - 61.0)
                target_sys = 106.0 + progress * (118.0 - 106.0)
                target_dia = 71.0 + progress * (76.0 - 71.0)
                target_ortho = 31.0 - progress * (31.0 - 12.0)

            resting_hr = round(float(rng.normal(target_hr, 1.8)), 1)
            systolic_bp = round(float(rng.normal(target_sys, 2.3)), 1)
            diastolic_bp = round(float(rng.normal(target_dia, 1.8)), 1)
            
            if day % 2 == 0 or day == 120:
                ortho_delta = round(float(rng.normal(target_ortho, 2.0)), 1)
            else:
                ortho_delta = None

            activity = "Postflight Reconditioning & Cardiovascular Re-training"
            notes = f"Progressive re-adaptation day {day-105}/15. Biomarkers trending back to personal baseline."
            cumulative_rad += round(float(rng.uniform(0.006, 0.010)), 3)

        records.append(
            {
                "astronaut_id": astronaut_id,
                "mission_day": day,
                "phase_name": phase_name,
                "gravity_g": gravity_g,
                "location": location,
                "timestamp": timestamp,
                "resting_hr": resting_hr,
                "systolic_bp": systolic_bp,
                "diastolic_bp": diastolic_bp,
                "orthostatic_hr_delta": ortho_delta,
                "cumulative_radiation_msv": round(cumulative_rad, 2),
                "activity_context": activity,
                "is_synthetic": 1,
                "data_classification": DATA_CLASSIFICATION,
                "notes": notes,
            }
        )

    return records


def seed_astronaut_profile(conn: sqlite3.Connection) -> None:
    """Inserts the two contrasting synthetic astronaut profiles SYNTH-AST-01 and SYNTH-AST-02."""
    metadata_ast1 = {
        "disclaimer": DISCLAIMER_TEXT,
        "classification": DATA_CLASSIFICATION,
        "flight_duration_days": 151,
        "primary_objective": "Longitudinal cardiovascular adaptation and orthostatic monitoring (High Orthostatic Sensitivity Profile)",
        "evidence_basis": "NASA Human Research Program (HRP) & Canadian Space Agency (CSA)",
        "phenotype": "High Orthostatic Sensitivity",
        "phenotype_summary": "Exhibits pronounced postflight orthostatic shift (HR ~76, SBP ~107, Ortho Delta ~31 bpm, Z > +11).",
        "synthetic_generation_seed": 42,
    }
    metadata_ast2 = {
        "disclaimer": DISCLAIMER_TEXT,
        "classification": DATA_CLASSIFICATION,
        "flight_duration_days": 151,
        "primary_objective": "Countermeasure compliance and autonomic resilience evaluation (Strong Responder Profile)",
        "evidence_basis": "NASA Human Research Program (HRP) & Canadian Space Agency (CSA)",
        "phenotype": "Strong Countermeasure Responder",
        "phenotype_summary": "Maintains tighter postflight recovery (HR ~65, SBP ~116, Ortho Delta ~16 bpm) via high countermeasure adherence.",
        "synthetic_generation_seed": 142,
    }
    with conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO astronauts
            (id, name, role, mission_name, is_synthetic, data_classification, created_at, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "SYNTH-AST-01",
                "Crew Member A-01 — High Orthostatic Sensitivity",
                "Mission Specialist / Biomedical Flight Engineer",
                "Artemis Extended Long-Duration Simulation (120-Day Flight)",
                1,
                DATA_CLASSIFICATION,
                datetime(2026, 3, 1, 0, 0, 0).isoformat(),
                json.dumps(metadata_ast1),
            ),
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO astronauts
            (id, name, role, mission_name, is_synthetic, data_classification, created_at, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "SYNTH-AST-02",
                "Crew Member B-02 — Strong Countermeasure Responder",
                "Commander / Countermeasure Specialist",
                "Artemis Extended Long-Duration Simulation (120-Day Flight)",
                1,
                DATA_CLASSIFICATION,
                datetime(2026, 3, 1, 0, 0, 0).isoformat(),
                json.dumps(metadata_ast2),
            ),
        )


def seed_measurements(conn: sqlite3.Connection, records: List[Dict[str, Any]]) -> None:
    """Inserts seeded measurement records into SQLite."""
    with conn:
        conn.executemany(
            """
            INSERT INTO measurements (
                astronaut_id, mission_day, phase_name, gravity_g, location, timestamp,
                resting_hr, systolic_bp, diastolic_bp, orthostatic_hr_delta,
                cumulative_radiation_msv, activity_context, is_synthetic,
                data_classification, notes
            ) VALUES (
                :astronaut_id, :mission_day, :phase_name, :gravity_g, :location, :timestamp,
                :resting_hr, :systolic_bp, :diastolic_bp, :orthostatic_hr_delta,
                :cumulative_radiation_msv, :activity_context, :is_synthetic,
                :data_classification, :notes
            )
            """,
            records,
        )


def init_db(db_path: Optional[Path | str] = None, force_reseed: bool = False) -> sqlite3.Connection:
    """
    Initializes database tables and seeds demo profiles and evidence.
    If database exists and has measurements for both profiles, avoids re-seeding unless force_reseed=True.
    """
    conn = get_db_connection(db_path)
    create_schema(conn)
    seed_evidence_and_guides(conn)
    seed_astronaut_profile(conn)

    for ast_id in ("SYNTH-AST-01", "SYNTH-AST-02"):
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM measurements WHERE astronaut_id = ?", (ast_id,))
        count = cursor.fetchone()[0]

        if count == 0 or force_reseed:
            if force_reseed:
                with conn:
                    conn.execute("DELETE FROM measurements WHERE astronaut_id = ?", (ast_id,))
            records = generate_synthetic_profile_measurements(ast_id)
            seed_measurements(conn, records)

    return conn


def get_all_astronauts(db_path: Optional[Path | str] = None) -> List[Dict[str, Any]]:
    """Returns all astronaut profiles with parsed metadata."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM astronauts ORDER BY id ASC")
    rows = cur.fetchall()
    conn.close()
    results = []
    for r in rows:
        item = dict(r)
        if item.get("metadata_json"):
            item["metadata"] = json.loads(item["metadata_json"])
        results.append(item)
    return results


def insert_measurement(measurement: Dict[str, Any], db_path: Optional[Path | str] = None) -> int:
    """
    Inserts a new astronaut measurement (e.g. from UI self-check).
    Enforces synthetic demonstration classification.
    """
    conn = get_db_connection(db_path)
    payload = {
        "astronaut_id": measurement.get("astronaut_id", "SYNTH-AST-01"),
        "mission_day": int(measurement.get("mission_day", 0)),
        "phase_name": measurement.get("phase_name", "In-Flight (0g Transit)"),
        "gravity_g": float(measurement.get("gravity_g", 0.0)),
        "location": measurement.get("location", "Hab Module"),
        "timestamp": measurement.get("timestamp", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")),
        "resting_hr": float(measurement["resting_hr"]) if measurement.get("resting_hr") is not None else None,
        "systolic_bp": float(measurement["systolic_bp"]) if measurement.get("systolic_bp") is not None else None,
        "diastolic_bp": float(measurement["diastolic_bp"]) if measurement.get("diastolic_bp") is not None else None,
        "orthostatic_hr_delta": (
            float(measurement["orthostatic_hr_delta"])
            if measurement.get("orthostatic_hr_delta") is not None
            else None
        ),
        "cumulative_radiation_msv": (
            float(measurement["cumulative_radiation_msv"])
            if measurement.get("cumulative_radiation_msv") is not None
            else None
        ),
        "activity_context": measurement.get("activity_context", "Crew Self-Check"),
        "is_synthetic": 1,
        "data_classification": DATA_CLASSIFICATION,
        "notes": measurement.get("notes", "Crew manual self-check entry."),
    }

    with conn:
        cur = conn.execute(
            """
            INSERT INTO measurements (
                astronaut_id, mission_day, phase_name, gravity_g, location, timestamp,
                resting_hr, systolic_bp, diastolic_bp, orthostatic_hr_delta,
                cumulative_radiation_msv, activity_context, is_synthetic,
                data_classification, notes
            ) VALUES (
                :astronaut_id, :mission_day, :phase_name, :gravity_g, :location, :timestamp,
                :resting_hr, :systolic_bp, :diastolic_bp, :orthostatic_hr_delta,
                :cumulative_radiation_msv, :activity_context, :is_synthetic,
                :data_classification, :notes
            )
            """,
            payload,
        )
        return int(cur.lastrowid)


def get_astronaut_measurements(
    astronaut_id: str = "SYNTH-AST-01",
    db_path: Optional[Path | str] = None,
) -> pd.DataFrame:
    """Returns all measurements for an astronaut sorted chronologically by mission day."""
    conn = get_db_connection(db_path)
    query = """
        SELECT * FROM measurements
        WHERE astronaut_id = ?
        ORDER BY mission_day ASC
    """
    df = pd.read_sql_query(query, conn, params=(astronaut_id,))
    conn.close()
    return df


def get_astronaut_profile(
    astronaut_id: str = "SYNTH-AST-01",
    db_path: Optional[Path | str] = None,
) -> Optional[Dict[str, Any]]:
    """Retrieves metadata profile for the specified astronaut."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM astronauts WHERE id = ?", (astronaut_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    res = dict(row)
    if res.get("metadata_json"):
        res["metadata"] = json.loads(res["metadata_json"])
    return res


def get_all_evidence_sources(db_path: Optional[Path | str] = None) -> List[Dict[str, Any]]:
    """Returns all 5 verified NASA & CSA evidence sources."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM evidence_sources ORDER BY id ASC")
    rows = cur.fetchall()
    conn.close()
    results = []
    for r in rows:
        item = dict(r)
        item["mission_contexts"] = json.loads(item["mission_contexts"])
        item["related_indicators"] = json.loads(item["related_indicators"])
        results.append(item)
    return results


def get_all_indicator_guides(db_path: Optional[Path | str] = None) -> Dict[str, Dict[str, Any]]:
    """Returns plain-English astronaut indicator guides."""
    conn = get_db_connection(db_path)
    cur = conn.cursor()
    cur.execute("SELECT * FROM indicator_guides")
    rows = cur.fetchall()
    conn.close()
    return {r["indicator"]: dict(r) for r in rows}
