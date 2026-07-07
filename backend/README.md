# Obsidian

> AI Agent Governance & Cost Audit Backend — built on [cascadeflow](https://github.com/cascade-ai/cascadeflow) + [Hindsight](https://github.com/vectorize-io/hindsight)

Obsidian is a FastAPI backend that enforces budget caps, compliance policies, and routing governance on every AI query. Every decision is logged, patterns are detected, and actionable cost-reduction recommendations are generated automatically.

---

## Features

- 🛡️ **Enforce Mode** — cascadeflow intercepts every LLM call; queries are blocked when the budget cap is hit
- 📊 **Audit Trail** — every query logs model, cost, latency, action, and category to an in-memory + Hindsight store
- 🧠 **Routing Insights** — Hindsight memory detects over-escalation patterns and recommends cheaper models
- 💡 **4 Query Categories** — `order_status`, `refund`, `sensitive_data`, `general_faq`
- 🔄 **Graceful Degradation** — `/events` works even if Hindsight Docker container is stopped

---

## Stack

| Layer | Tech |
|---|---|
| API Framework | FastAPI + Uvicorn |
| LLM Provider | Groq (OpenAI-compatible) via `openai` SDK |
| Governance | [cascadeflow](https://pypi.org/project/cascadeflow/) — enforce mode |
| Memory / Insights | [Hindsight](https://github.com/vectorize-io/hindsight) (Docker) |
| Language | Python 3.11+ |

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/hanumanraj07/Obsidian.git
cd Obsidian
pip install -r requirements.txt
pip install hindsight-client
```

### 2. Set Environment Variables

```powershell
# Windows PowerShell
$env:GROQ_API_KEY = "gsk_..."
$env:USE_HINDSIGHT = "true"        # optional — set false to skip Docker
```

Get a free Groq API key at: https://console.groq.com

### 3. Start the Hindsight Docker Container (optional)

```bash
docker run -d --rm --name hindsight \
  -p 8888:8888 -p 9999:9999 \
  -e HINDSIGHT_API_LLM_PROVIDER=groq \
  -e HINDSIGHT_API_LLM_API_KEY=<your-groq-key> \
  -v $HOME/.hindsight-docker:/home/hindsight/.pg0 \
  ghcr.io/vectorize-io/hindsight:latest
```

> Skip this step and set `USE_HINDSIGHT=false` to run in pure in-memory mode.

### 4. Run the Server

```bash
python -m uvicorn main:app --reload --port 8000
```

### 5. Sanity Check

```bash
curl http://localhost:8000/health
# → {"status": "ok"}

curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Where is my order?"}'
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/query` | Run a query through cascadeflow + Groq. Returns response, audit event, budget summary. |
| `GET` | `/events` | Full audit event history sorted by timestamp. |
| `GET` | `/insights` | Hindsight-powered routing recommendation (or in-memory heuristic fallback). |
| `DELETE` | `/session` | Reset the $0.02 budget session for a new demo run. |
| `GET` | `/health` | Health check. |

Interactive docs: http://localhost:8000/docs

---

## Generate Synthetic Data

To generate 25 synthetic queries across all 4 categories and save audit output:

```bash
python generate_data.py
```

This loops through queries, prints real-time cost/action per query, and saves `events.json` + `insights.json`.

---

## Project Structure

```
Obsidian/
├── main.py              # FastAPI app — all endpoints
├── obsidian_core.py     # cascadeflow session, category classifier, Groq handler
├── hindsight_store.py   # Event storage + Hindsight integration + escalation detection
├── generate_data.py     # Script: send 25 synthetic queries, save events.json/insights.json
├── fix_insights.py      # Script: generate insights.json from local events.json (offline)
├── requirements.txt     # Python dependencies
└── .gitignore
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | *(required)* | Groq API key |
| `USE_HINDSIGHT` | `false` | Set `true` to enable Hindsight Docker integration |
| `HINDSIGHT_URL` | `http://localhost:8888` | Hindsight container URL |
| `DEMO_BUDGET` | `0.02` | Per-session budget cap in USD |
| `EXPENSIVE_COST_THRESHOLD` | `0.006` | Cost threshold for escalation detection |

> ⚠️ Never commit your `.env` file or API keys. `.gitignore` already excludes `.env`.