# AIFARM DOCTOR

**Chicken Influenza Early Warning** — an AI preventive health and vaccination copilot for poultry and pig farms (proof of concept).

> Detect the outbreak signal before the outbreak becomes obvious.
> AI watches. AI correlates. AI warns. Veterinarians and farmers decide.

AIFARM DOCTOR is an early-warning and decision-support system. It does not replace veterinary diagnosis or laboratory confirmation.

## Run it

Requirements: Python 3.10+ and Node.js 18+. Everything runs locally; no cloud service is used.

```bash
./start.sh          # Linux / macOS / WSL
```

```powershell
.\start.ps1         # Windows (starts inside WSL automatically if the project lives there)
```

The script installs dependencies on first run, starts the backend and frontend, and prints the address to open
(http://localhost:5500 by default; the next free port is used if 5500 or 8000 is busy).
Set `AIFARM_WEB_PORT` to use a different port.

## Run it on a server (AWS EC2)

```bash
# Ubuntu: one-time prerequisites (Node 18+; tested with Ubuntu 24.04's packaged Node 18.19)
sudo apt-get update && sudo apt-get install -y git python3 python3-venv python3-pip nodejs npm

git clone git@github.com:Sherlock2019/MAIFARM-Fluenza-Detector.git
cd MAIFARM-Fluenza-Detector
./start.sh --prod
```

`--prod` builds the frontend once and serves the whole application from a single port (5500 by default, or
`AIFARM_WEB_PORT=80`-style override), listening on all interfaces. The script prints the public address when it runs on
EC2. Allow that TCP port inbound in the instance's security group.

To keep it running after you log out:

```bash
nohup ./start.sh --prod > aifarm.log 2>&1 &
```

The POC has no login, so restrict the security group to your own IP address rather than opening it to the internet.
On Amazon Linux 2023 use `sudo dnf install -y git python3 python3-pip nodejs npm` (Python 3.9+ is supported).

## What to look at

| Page | What it shows |
|---|---|
| Overview | Farm outbreak risk, affected house, "first anomaly Day 3 vs traditional detection Day 5", daily brief |
| Influenza Risk | Transparent 0–100 score per house, contribution breakdown, "why" explanation, response plan, trend charts |
| AI Vision | Mock camera feed with detection boxes, camera metrics, flock movement heatmap |
| Sound AI | Mock spectrogram, sound classification, respiratory events per hour |
| Flock Health | Farm map and live sensor panel (NORMAL / WATCH / ABNORMAL / CRITICAL) |
| Vaccination | Compliance, due / overdue / missing, AI insight |
| Biosecurity | Visitor, vehicle, disinfection and access log with risk contribution |
| Alerts, Ask Doctor | Prioritised alerts and a farm-health-only question assistant |
| Classic vs AI, Business Impact, Architecture | Sales comparison, value simulator, how the engine works |
| Data Import | Manual entry and CSV upload with column mapping ("My Farm Data") |

Use **Run influenza outbreak demo** (top bar) for the animated Day 1 → Day 5 story. The **Farm type** switch shows the
same engine on a pig farm.

## How the score works

For each house and day (`backend/app/engine.py`):

1. baseline = median of the previous 21 days for that house
2. deviation = % difference from that baseline
3. anomaly score 0–100 per signal (only the harmful direction counts)
4. risk = weighted sum

Poultry weights: respiratory audio 0.25, movement 0.15, feed 0.10, water 0.10, mortality 0.15, egg production 0.10,
abnormal posture 0.05, environment 0.05, biosecurity 0.05. Levels: 0–29 LOW, 30–49 WATCH, 50–74 HIGH, 75–100 CRITICAL.

## Project layout

```
backend/app/engine.py     risk engine (weights, scales, levels)
backend/app/service.py    farm analysis: alerts, vaccination, biosecurity, briefing, explanations
backend/app/assistant.py  Ask AIFARM DOCTOR (intent matching over the computed analysis; no external AI)
backend/app/seed.py       demo farm generator (rebuilt at every start so "today" is current)
backend/app/main.py       FastAPI routes, manual entry, CSV import
backend/smoke_test.py     end-to-end API check
frontend/src              React + TypeScript + Tailwind + Recharts UI
```

Data is stored in `backend/aifarm.db` (SQLite). Camera and sound screens use synthetic demo detections.
