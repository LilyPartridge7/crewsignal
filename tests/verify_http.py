import sys
import threading
import time
import urllib.request
import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import uvicorn
from api.server import app

def run_uvicorn():
    config = uvicorn.Config(app, host="127.0.0.1", port=8009, log_level="error")
    server = uvicorn.Server(config)
    server.run()

def test_uvicorn_thread():
    t = threading.Thread(target=run_uvicorn, daemon=True)
    t.start()
    
    # Wait for server
    time.sleep(1.5)
    
    # Test GET /api/astronauts
    with urllib.request.urlopen("http://127.0.0.1:8009/api/astronauts") as r:
        assert r.status == 200
        data = json.loads(r.read().decode())
        print("✓ /api/astronauts HTTP 200:", data["count"], "profiles")

    # Test GET /api/dashboard/SYNTH-AST-01
    with urllib.request.urlopen("http://127.0.0.1:8009/api/dashboard/SYNTH-AST-01?phase=Early%20Postflight%20(1g%20Return)") as r:
        assert r.status == 200
        data = json.loads(r.read().decode())
        print("✓ /api/dashboard HTTP 200: resting_hr =", data["kpis"]["resting_hr"]["value"])

    # Test GET /api/timeline/SYNTH-AST-01
    with urllib.request.urlopen("http://127.0.0.1:8009/api/timeline/SYNTH-AST-01") as r:
        assert r.status == 200
        data = json.loads(r.read().decode())
        print("✓ /api/timeline HTTP 200:", len(data["timeline"]), "points")

    # Test GET /api/evidence
    with urllib.request.urlopen("http://127.0.0.1:8009/api/evidence") as r:
        assert r.status == 200
        data = json.loads(r.read().decode())
        print("✓ /api/evidence HTTP 200:", len(data["evidence_sources"]), "sources")

    # Test POST /api/acute-triage
    req = urllib.request.Request(
        "http://127.0.0.1:8009/api/acute-triage",
        data=json.dumps({
            "astronaut_id": "SYNTH-AST-01",
            "hr": 88.0,
            "sbp": 96.0,
            "dbp": 62.0,
            "ortho_delta": 34.0,
            "symptom": "Presyncope / Lightheadedness upon standing",
            "gravity_context": "Earth Landing Zone (1.0g)"
        }).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        assert r.status == 200
        data = json.loads(r.read().decode())
        print("✓ /api/acute-triage HTTP 200:", data["triage_level"])

    # Test POST /api/measurements
    req2 = urllib.request.Request(
        "http://127.0.0.1:8009/api/measurements",
        data=json.dumps({
            "astronaut_id": "SYNTH-AST-01",
            "mission_day": 99,
            "phase_name": "Early Postflight (1g Return)",
            "resting_hr": 75.0,
            "systolic_bp": 107.0,
            "diastolic_bp": 71.0,
            "orthostatic_hr_delta": 30.0
        }).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req2) as r:
        assert r.status == 200
        data = json.loads(r.read().decode())
        print("✓ /api/measurements HTTP 200: Row ID", data["id"])

    print("\nALL 6 BACKEND ENDPOINTS RETURNED HTTP 200 OVER UVICORN!")

if __name__ == "__main__":
    test_uvicorn_thread()
