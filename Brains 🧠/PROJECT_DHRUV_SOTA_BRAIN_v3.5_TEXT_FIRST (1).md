
# Project Dhruv — SOTA Engine Master Plan (v3.5, Agent‑Ready, **Text‑First**)
**Date:** 2025-09-11 21:39:11 UTC+05:30  
**Owner:** Abhi (Product Lead)  
**Purpose:** _Single Source of Truth_ (SSOT) to build Dhruv’s **Digital Twin + Reasoning Engine** with **TDD-first**, **high coverage**, and **ironclad** quality gates.  
**Key Change:** **TEXT-ONLY NOW.** Image/Video processing is **provisioned behind feature flags** and **disabled by default**.

---

## Part 0 — Execution Contract (Non‑Negotiables)
- **TDD-first** for **every** task (red → green → refactor).  
- **Coverage targets:** unit ≥ **90%**, integration ≥ **85%**, e2e ≥ **80%**.  
- **CI-only “done”:** A task is “done” only when CI is green and all **Ironclad Gates** pass.  
- **Atomic PRs:** 1 task = 1 PR. Small, reversible, documented.  
- **Security/Privacy:** DPDP-compliant logging, least-privilege secrets, PII redaction.  
- **Observability:** Structured logs, **OpenTelemetry traces**, **RED metrics** for APIs, ML runs logged to **MLflow**.  
- **Data Integrity:** All loads are validated with **Great Expectations** + idempotent writes.  
- **Branching:** `main` protected; short-lived feature branches `feat/<task-id>-slug`. Conventional commits.  
- **Reproducibility:** Everything runs in **Dev Containers** + **Docker Compose**; parity with CI.  

---

## Part 1 — SOTA Vision (Adapted to Text‑First)
1. **Text Parser + KG Reasoning (Now):** robust text parsing, hypothesis loop, temporal linking, Story Arcs.  
2. **Provisioned Multi‑modal (Later via flags):** image/video OCR, face/entity detection, setting classification — **disabled now**.  
3. **Automated KBC (Self‑Learning):** background discovery from trusted sources.  
4. **Certainty & Provenance:** every fact audited (score + provenance + last_verified).  
5. **Narrative Tracking:** topic trends over time.  
6. **Predictive Foresight:** learned patterns from Story Arcs.

---

## Part 2 — Feature Flags (Central Switches)
```python
from dataclasses import dataclass
import os

@dataclass(frozen=True)
class FeatureFlags:
    ENABLE_VISION: bool = os.getenv("ENABLE_VISION", "false").lower() == "true"
    ENABLE_VIDEO: bool  = os.getenv("ENABLE_VIDEO", "false").lower() == "true"
    ENABLE_EMBEDDINGS: bool = os.getenv("ENABLE_EMBEDDINGS", "true").lower() == "true"

FLAGS = FeatureFlags()
```

Usage in code:
```python
from src.config.feature_flags import FLAGS

if FLAGS.ENABLE_VISION:
    # call vision paths (currently disabled by default)
    ...
else:
    # skip vision, rely on text-only pipeline
    pass
```

**.env.example**
```env
# --- Feature Flags (text-only default) ---
ENABLE_VISION=false
ENABLE_VIDEO=false
ENABLE_EMBEDDINGS=true
```

---

## Part 3 — System Architecture (High Level, Text‑Only Path)
**Ingest (text) → Preprocess (normalize) → Reason (hypothesis loop) → Persist (Neo4j/Postgres) → Serve → Validate → Observe**

- **APIs (Flask):** `/api/sota/parse` (text only), `/api/sota/events/link`, `/api/kb/*`, `/api/health`  
- **NLP:** Gemini text models (summarize/classify), regex/Zod/Pydantic rules, optional embeddings (Milvus/PGVector)  
- **Knowledge Graph:** **Neo4j 5** (Person, Org, Event, Place, Topic, Arc)  
- **Relational/Geo:** **PostgreSQL 16 + PostGIS** (place mirrors, exports)  
- **Pipelines:** **Prefect** background jobs (KBC)  
- **Caching:** Redis  
- **Observability:** OpenTelemetry, Prom/Grafana, MLflow  
- **CMS (React/Vite/TS/Tailwind):** validation UI, Story Arcs, Sandbox

---

## Part 4 — Schemas & Contracts (Field‑Level, Enforced)
> All objects carry: `certainty_score: float [0..1]`, `provenance: string`, `last_verified: datetime`, `source_ids: list[str]`.

### 4.1 Event (Neo4j `:Event`, Postgres mirror) — **Text‑First**
```json
{{
  "event_id": "string (slug: {{date}}-{{type}}-{{place}}-{{hash5}})",
  "type": "Meeting|Rally|Inspection|Inauguration|Memorandum|Announcement|Constituent_Engagement|Relief|Other",
  "title": "string",
  "description": "string",
  "actors": ["person_id"],
  "orgs": ["org_id"],
  "place_id": "place_id",
  "datetime_start": "iso datetime",
  "datetime_end": "iso datetime|null",
  "media_ids": [],
  "narratives": ["topic_id"],
  "arc_ids": ["arc_id"],
  "causal_links_in": ["event_id"],
  "causal_links_out": ["event_id"],
  "ocr_text": "",
  "setting": "Unknown|Office|Village|TownHall|RallyGround",
  "embedding_id": "uuid|milvus_key|null",
  "certainty_score": 0.0,
  "provenance": "TweetID:..., Human:Abhi, ...",
  "last_verified": "iso datetime"
}}
```

---

## Part 5 — Tools & Dependencies (Pinned)
(Python: flask, pydantic, neo4j, sqlalchemy, psycopg2-binary, otel, structlog, mlflow, GE, hypothesis, pytest, etc.  
Node: vite, react, tailwind, zod, axios, etc.  
Docker: postgres+postgis, neo4j, redis, prom/grafana, etc.)

---

## Part 6 — Agent Invocation Prompt (Drop‑in)
```
You are “Roger-Dhruv”, a senior code architect + execution agent.
Objective: Build Project Dhruv per SSOT (v3.5 TEXT-FIRST).

Core Rules:
- TDD for EVERY task (red → green → refactor).
- Each atomic task → new branch `feat/<TASK-ID>-slug`, one PR, conventional commits.
- CI is the judge. A task is “done” only after all Ironclad Gates pass.
- Strict typing, structured logs, OTEL traces with a single trace_id.
- All data writes validated with GE; Neo4j writes are idempotent and transactional.
- Security: PII redacted in logs, secrets via env, DPDP compliant.
- **Feature Flags:** ENABLE_VISION=false, ENABLE_VIDEO=false.
```

---

## Part 7 — Atomic Task Plan (Text‑First)
Phases: Planning → Foundation → Reasoning (text only) → CMS → Provisioned (vision later).

---

**End of Document — v3.5 (TEXT-FIRST)**
