"""
CrewSignal — Frontend Verification Suite (React + TypeScript + Vite)
===================================================================
Verifies:
1. Vite production build artifacts (dist/index.html, dist/assets)
2. React + TypeScript components integrity (Navbar, OverviewView, BodyMapSvg, TimelineView, AcuteAssistView, EvidenceView)
3. Provenance & Non-Diagnostic Guardrails in frontend code
4. Theme configuration (Light/Dark mode palettes)
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"

def test_frontend_build_artifacts():
    print("\n[1/4] Verifying Vite Production Build Artifacts...")
    assert DIST_DIR.exists(), f"dist directory does not exist at {DIST_DIR}"
    index_html = DIST_DIR / "index.html"
    assert index_html.exists(), "dist/index.html is missing"
    html_content = index_html.read_text(encoding="utf-8")
    assert "CrewSignal" in html_content, "CrewSignal title missing in built HTML"
    
    assets = list((DIST_DIR / "assets").glob("*"))
    assert len(assets) >= 2, f"Expected JS and CSS bundles in dist/assets, found {len(assets)}"
    print(f"  ✓ Production build verified: {len(assets)} bundled assets generated.")


def test_components_integrity():
    print("\n[2/4] Verifying React Components & Views...")
    components_dir = FRONTEND_DIR / "src" / "components"
    expected_components = [
        "Navbar.tsx",
        "OverviewView.tsx",
        "BodyMapSvg.tsx",
        "QuickLogDrawer.tsx",
        "TimelineView.tsx",
        "AcuteAssistView.tsx",
        "EvidenceView.tsx",
        "PiPFunctionGuide.tsx",
        "ProtocolTimer.tsx",
    ]
    for comp in expected_components:
        comp_path = components_dir / comp
        assert comp_path.exists(), f"Component {comp} missing!"
        content = comp_path.read_text(encoding="utf-8")
        assert len(content) > 100, f"Component {comp} is unexpectedly small"
        print(f"  ✓ Verified component: {comp} ({len(content)} bytes)")


def test_provenance_and_guardrails():
    print("\n[3/4] Verifying Provenance Pill & Safety Guardrails...")
    navbar_content = (FRONTEND_DIR / "src" / "components" / "Navbar.tsx").read_text(encoding="utf-8")
    assert "SYNTHETIC DEMO TELEMETRY" in navbar_content, "Mandatory synthetic classification missing in Navbar"
    assert "Non-Diagnostic Prototype" in navbar_content, "Non-diagnostic disclaimer missing in Navbar"
    assert "Grounded in NASA HRP & CSA Research" in navbar_content, "Evidence basis missing in Navbar"
    print("  ✓ Provenance pill and non-diagnostic safety guardrails verified in UI.")


def test_theme_and_styling():
    print("\n[4/4] Verifying Light & Dark Mode Color Palettes...")
    tailwind_cfg = (FRONTEND_DIR / "tailwind.config.js").read_text(encoding="utf-8")
    assert "darkMode: 'class'" in tailwind_cfg or 'darkMode: "class"' in tailwind_cfg, "Class-based dark mode missing"
    assert "#E2E8F0" in tailwind_cfg, "Clinical light mode outer backdrop (#E2E8F0) missing"
    assert "#F1F5F9" in tailwind_cfg, "Clinical light mode canvas (#F1F5F9) missing"
    assert "#060A14" in tailwind_cfg, "Mission dark mode outer backdrop (#060A14) missing"
    assert "#0B1120" in tailwind_cfg, "Mission dark mode console background (#0B1120) missing"
    print("  ✓ Tailwind clinical layered (#E2E8F0/#F1F5F9) and mission dark (#060A14/#0B1120) palettes verified.")


if __name__ == "__main__":
    print("==================================================================")
    print("  CREWSIGNAL FRONTEND BUILD & COMPONENT VERIFICATION")
    print("==================================================================")
    test_frontend_build_artifacts();
    test_components_integrity();
    test_provenance_and_guardrails();
    test_theme_and_styling();
    print("\n==================================================================")
    print("  ALL FRONTEND TESTS PASSED SUCCESSFULLY! (4/4)")
    print("==================================================================\n")
