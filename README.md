# CrewSignal

## Autonomous Cardiovascular Telemetry and Orthostatic Adaptation System

CrewSignal is an autonomous clinical decision support system prototype (TRL 3/4 Concept & Validation) engineered for human deep-space exploration missions (Artemis, Lunar Gateway, and Mars Transit) as well as isolated terrestrial clinics. Grounded in the NASA Human Research Program (NASA HRP Risk of Orthostatic Intolerance and Cardiovascular Deconditioning) and Canadian Space Agency (CSA) deep-space biomedical research, CrewSignal tells an astronaut whether it is safe to stand up after landing without waiting 22 minutes for Earth to answer.

---

## 1. System Overview

During long-duration spaceflight, microgravity induces cephalad fluid redistribution, plasma volume contraction (approximately 12% to 15%), and vascular baroreflex deconditioning. Upon re-exposure to gravity vectors (planetary landing or Earth return), venous blood pooling in the lower extremities causes acute cerebral hypoperfusion, orthostatic intolerance, and pre-syncope.

CrewSignal solves this clinical operational challenge through three pillars:

### Pillar 1: Gravity-Adaptive Personal Baseline
Generic clinical population norms fail in spaceflight because individual autonomic physiology varies widely. CrewSignal computes an individual reference envelope using 30-day preflight baseline records (mean +/- standard deviation) for each astronaut. Live in-flight and postflight vitals are scored as Z-scores against their own preflight baseline, distinguishing benign adaptive compensation from pathological decompensation.

### Pillar 2: Hydrostatic Hemodynamic Modeling and Flight Rules
CrewSignal models real-time hydrostatic pressure differentials across varying gravitational vectors:
- Transit: 0.0g
- Lunar Surface: 0.16g
- Martian Surface: 0.38g
- Earth Return: 1.0g

Using the biophysical hydrostatic equation (Delta P = rho * g * h), the engine calculates:
- Heart-to-Brain Hydrostatic Column Delta
- Mean Arterial Pressure at the Brain Level: MAP_brain = MAP_heart - Delta P_hydro
- Intracranial Pressure (ICP) estimate based on microgravity cephalad fluid redistribution
- Real-time Cerebral Perfusion Pressure: CPP = MAP_brain - ICP (Target: >= 50 mmHg)
- Automated evaluation of illustrative Flight Rule MED-B13-102 (modeled on NASA Flight Rules & HRP Protocols for unassisted ambulation clearance).

### Pillar 3: Interoperability, Audit Ledger, and Dual-Use
- CCSDS 133.0 Space Packet Telemetry: Modeled on binary packets with application identifier APID 0x04F2 for avionics telemetry buses.
- HL7 FHIR Space Diagnostic Profiles: Formatted to HL7 FHIR observation standards for interoperable clinical health records.
- FIPS 180-4 SHA-256 Audit Ledger: Hashes telemetry records into an immutable audit chain for post-mission flight surgery debriefs.
- Dual-Use Earth Clinic Mode: Translates space autonomic deconditioning protocols to terrestrial remote clinics (e.g. Svalbard Arctic research stations and rural emergency care).

---

## 2. System Architecture

CrewSignal is structured as a decoupled full-stack architecture:

```
crewsignal/
├── api/
│   ├── server.py              # FastAPI application endpoints and CORS configuration
│   └── si_engine.py           # Structured Insight generation and rule evaluator
├── core/
│   ├── analytics.py           # Z-score baselines, biophysics engine, and flight rules
│   ├── database.py            # SQLite schema, data models, and seeding logic
│   └── knowledge_graph.py     # NetworkX biomedical graph for symptom-rule relationships
├── data/
│   ├── crewsignal.db          # Embedded SQLite database (synthetic profiles and telemetry)
│   └── nasa_csa_evidence.json # Grounded clinical literature citations and flight rules
├── frontend/
│   ├── public/                # Static assets, video loops, and manifests
│   ├── src/
│   │   ├── components/        # Bento Box UI views, BodyMapSvg, and PiP Guide
│   │   ├── api.ts             # Typed API client with environment fallback
│   │   ├── types.ts           # TypeScript interfaces for telemetry, KPIs, and reports
│   │   ├── App.tsx            # Main application root and layout coordinator
│   │   └── main.tsx           # Application entry point
│   ├── package.json           # Frontend dependencies (React 18, Vite, Tailwind CSS)
│   ├── vite.config.ts         # Vite build configuration and local API proxy
│   └── vercel.json            # Vercel SPA routing rules
├── tests/
│   ├── verify_api.py          # End-to-end FastAPI test suite (11 endpoints)
│   ├── verify_backend.py      # Core biophysics and mathematical verification
│   └── verify_frontend.py     # Frontend artifact and bundle verification
├── requirements.txt           # Python backend dependencies
├── package.json               # Monorepo root helper scripts
├── vercel.json                # Root Vercel deployment configuration
└── README.md                  # System documentation and execution guide
```

---

## 3. How to Run Locally

### Prerequisites
- Python 3.10, 3.11, 3.12, 3.13, or 3.14
- Node.js 18.x or higher
- npm 9.x or higher

### Step 1: Clone or Open the Repository
```bash
cd crewsignal
```

### Step 2: Set Up and Run the Python Backend
Open a terminal in the project root:

1. Create a Python virtual environment (recommended):
   ```bash
   python -m venv venv
   ```
2. Activate the virtual environment:
   - On Windows (PowerShell):
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - On Windows (Command Prompt):
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   - On macOS / Linux:
     ```bash
     source venv/bin/activate
     ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI backend server:
   ```bash
   uvicorn api.server:app --reload --port 8000
   ```
The backend API is now live at `http://127.0.0.1:8000`. You can inspect the interactive OpenAPI documentation at `http://127.0.0.1:8000/docs`.

### Step 3: Set Up and Run the Frontend
Open a second terminal in the project root:

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

The Vite development server automatically proxies all `/api` requests to `http://127.0.0.1:8000`.

### Step 4: Run Verification Tests
To verify all backend analytical routines, biophysical calculations, and API endpoints, run:
```bash
python tests/verify_api.py
```
Expected output:
```
ALL FASTAPI ENDPOINTS & ANALYTICS VERIFIED SUCCESSFULLY!
```

---

## 4. Deploying to Vercel with GitHub Desktop

Follow these step-by-step instructions to publish the project to GitHub and deploy it to Vercel:

### Part A: Add and Push Repository via GitHub Desktop
1. Open GitHub Desktop.
2. Click `File` -> `Add Local Repository...` (or press `Ctrl+O` / `Cmd+O`).
3. Click `Choose...`, select the `d:\crewsignal` (or your local `crewsignal`) folder, and click `Add Repository`.
   - If GitHub Desktop prompts that this directory is not yet a Git repository, click `Create a repository here`.
   - Keep the default settings and ensure Git Ignore is set to `None` (a complete `.gitignore` is already provided in the repository).
   - Click `Create Repository`.
4. In GitHub Desktop, you will see all project files listed under the `Changes` tab on the left.
5. In the bottom-left summary box, enter:
   - Summary: `Version 1.0 Release`
   - Description: `Complete CrewSignal production build with Vercel configuration`
6. Click `Commit to main`.
7. Click `Publish repository` in the top bar.
   - Choose your repository name (e.g. `crewsignal`).
   - Uncheck `Keep this code private` if you wish the repository to be public.
   - Click `Publish repository`.

### Part B: Deploy on Vercel
1. Log in to your Vercel account at `https://vercel.com`.
2. Click `Add New...` -> `Project`.
3. Under `Import Git Repository`, find your `crewsignal` repository and click `Import`.
4. In the `Configure Project` screen:
   - **Framework Preset**: Select `Vite` (or leave as `Other` if auto-detected).
   - **Root Directory**: Click `Edit` and select `frontend` (or leave as root `./`, as `vercel.json` handles both).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. (Optional) If you have deployed the FastAPI backend to a cloud host (such as Render, Railway, or Fly.io), expand `Environment Variables` and add:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://your-backend-service.up.railway.app`
6. Click `Deploy`.
7. Vercel will build the project in approximately 30 to 45 seconds and provide a live production URL (e.g. `https://crewsignal.vercel.app`).

---

## 5. Medical and Operational Disclaimer

CrewSignal is a research and clinical decision support demonstration prototype developed for academic and engineering challenge evaluations. All data displayed in default demonstration mode consists of verified synthetic astronaut physiological records derived from published NASA HRP and CSA literature. This software is non-diagnostic and is not certified as an FDA Class II/III medical device.
