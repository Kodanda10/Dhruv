
# Project Dhruv — **SOTA, No‑Compromise Master Plan** (v4.0)
**Date:** 2025-09-11 21:35:46 UTC+05:30  
**Owner:** Abhi (Product Lead)  
**Mission:** Build an end‑to‑end **Digital Twin + Reasoning Engine** for the Chhattisgarh political landscape that ingests **text, images, and video**, fuses them into a **trusted Knowledge Graph**, performs **temporal & causal reasoning**, enables **strategic foresight**, and ships with **enterprise‑grade quality, security, and observability**.

> This is the **canonical SSOT**. It includes agent prompts, architecture, schemas, tooling, atomic tasks, tests, SLAs/SLOs, security, data governance, MLOps, and rollout. It is **execution‑ready**.

---

## 0) Non‑Negotiables (“Ironclad”)
- **TDD everywhere** (red → green → refactor). **Coverage gates:** unit ≥ 90%, integration ≥ 85%, e2e ≥ 80%.
- **SLOs:** API P95 latency ≤ **800 ms** (text‑only) / ≤ **1200 ms** (vision); uptime **99.5%**.
- **Observability:** OpenTelemetry traces, RED metrics, structured logs (JSON via structlog), MLflow.
- **Security/Compliance:** DPDP compliant; PII redaction; least‑privilege; SBOM + license audit; CIS Benchmarks on containers.
- **Data Integrity:** Great Expectations suites for every dataset; idempotent writes; provenance mandatory.
- **Reproducible DevEx:** Dev Containers + Docker Compose; parity with CI; IaC for prod.
- **Feature Flags:** Vision/video/embeddings can be toggled per env. **For “100% SOTA”: _enabled in prod_.**

---

## 1) Objectives & Key Results (OKRs)
- **O1. Accurate Parsing:** F1 ≥ **0.85** on labeled validation set for event type, actors, place, time.  
- **O2. Reliable Causal Chains:** ≥ **70%** of auto‑proposed causal links approved by reviewers.  
- **O3. Narrative Clarity:** Topic attribution coverage ≥ **80%** of events; drift alarms with <2% false positives.  
- **O4. Foresight Utility:** Top‑1 next‑event forecast accuracy ≥ **0.55** on rolling backtests.  
- **O5. Ops Excellence:** On‑call MTTR < **30 min**; P95 latency within SLO; GE failure rate < **1%** of runs.

---

## 2) System Architecture (High‑Level)
**Acquire → Preprocess (Text/Vision) → Reason (Hypothesize→Retrieve→Re‑evaluate→Update) → Persist (Neo4j/Postgres) → Serve APIs & CMS → Analytics & Foresight → Observe**

### Core components
- **APIs (Flask/FastAPI):** `/api/sota/parse`, `/api/sota/events/link`, `/api/kb/*`, `/api/foresight/*`, `/api/health`  
- **Text NLP:** Gemini models + rules; nukta‑aware normalization; optional embeddings (pgvector/Milvus).  
- **Vision:** Gemini Vision (faces/entities, OCR), fallback Tesseract; video keyframe extraction via ffmpeg.  
- **Knowledge Graph:** **Neo4j 5** (primary SoR); Postgres (relational mirrors + geo via PostGIS).  
- **Pipelines:** **Prefect** orchestration for KBC, backfills, cron jobs.  
- **Cache/Queues:** Redis.  
- **Analytics:** topic modeling, sentiment, foresight models; dashboards.  
- **Observability:** OpenTelemetry, Prometheus, Grafana, MLflow, Loki (optional logs).  
- **Storage/Artifacts:** MinIO/S3 for datasets, models, and run artifacts.

---

## 3) Schemas & Contracts (Field‑Level)
**Global fields:** `certainty_score: 0..1`, `confidence_label: Low|Med|High`, `provenance`, `provenance_detail{{source, uri, author_handle, post_id, captured_at}}`, `last_verified`, `source_ids[]`.

### 3.1 Event (`:Event`, mirrored to Postgres)
```json
{{
  "event_id": "YYYYMMDD-{{type}}-{{place_slug}}-{{hash5}}",
  "type": "Meeting|Rally|Inspection|Inauguration|Memorandum|Announcement|Constituent_Engagement|Relief|Other",
  "title": "string",
  "description": "string",
  "actors": ["person_id"],
  "orgs": ["org_id"],
  "place_id": "place_id",
  "datetime_start": "ISO8601 (UTC)",
  "datetime_end": "ISO8601 (UTC)|null",
  "media_ids": ["media_id"],
  "narratives": ["topic_id"],
  "arc_ids": ["arc_id"],
  "causal_links_in": ["event_id"],
  "causal_links_out": ["event_id"],
  "ocr_text": "string",
  "setting": "Office|Village|TownHall|RallyGround|Unknown",
  "embedding_id": "uuid|null",
  "certainty_score": 0.0,
  "confidence_label": "Low|Med|High",
  "provenance": "X|Insta|FB|YouTube|Web|Manual",
  "provenance_detail": {{"source":"X","uri":"...","author_handle":"...","post_id":"...","captured_at":"ISO"}},
  "last_verified": "ISO"
}}
```

### 3.2 Person/Org/Place/Promise/PolCal/Media/Topic/Arc
- Place nukta policy; constraints; GE suites for each.

---

## 4) Reasoning Engine (SOTA)
- Hypothesis‑Driven Loop (Hypothesize→Retrieve→Re‑evaluate→Update), single‑transaction writes, confidence/provenance.
- Causality & Story Arcs with thresholds and human validation + audit nodes.
- Narrative tracking (topic trends + sentiment).
- Foresight (baseline sequence → transformer) with backtests + abstention.

---

## 5) Feature Flags (Env‑Level)
```python
from dataclasses import dataclass
import os
@dataclass(frozen=True)
class FeatureFlags:
    ENABLE_VISION: bool = os.getenv("ENABLE_VISION", "true").lower() == "true"
    ENABLE_VIDEO:  bool = os.getenv("ENABLE_VIDEO", "true").lower() == "true"
    ENABLE_EMBEDDINGS: bool = os.getenv("ENABLE_EMBEDDINGS", "true").lower() == "true"
    ENABLE_MLFLOW: bool = os.getenv("ENABLE_MLFLOW", "true").lower() == "true"
    ENABLE_PGVECTOR: bool = os.getenv("ENABLE_PGVECTOR", "true").lower() == "true"
FLAGS = FeatureFlags()
```

---

## 6) Tooling & Dependencies
(Flask/FastAPI, Pydantic v2, Neo4j, SQLAlchemy, pgvector/Milvus, OTEL, structlog, MLflow, GE, Hypothesis, pytest, google‑generativeai, pytesseract, etc.)

---

## 7) APIs (OpenAPI‑lite)
- `POST /api/sota/parse` (headers: `X-Trace-Id`, `X-Parse-Confidence`)  
- `POST /api/sota/events/link` (+ audit node)  
- `GET /api/kb/search`  
- `GET /api/foresight/next`  
- `GET /api/health`

---

## 8) KBC (Self‑Learning)
Allowlist, robots, rate‑limits, GE validations, human approval workflow, provenance snapshots.

---

## 9) Observability & Ops
Traces, metrics, dashboards, alerts; backups with RPO 24h / RTO 4h; restore drill monthly.

---

## 10) Security & Governance
OIDC/magic link auth; roles; PII hashing; data retention; secrets rotation; SBOM/licensing; audit nodes.

---

## 11) Performance Targets
Text P95 ≤ 800 ms; Vision P95 ≤ 1200 ms; ≥ 20 rps; graph scale 5M/20M; compaction jobs.

---

## 12) Atomic Task Plan (Backlog)
Phases A–F (Infra→Builders→Parsing→CMS→Analytics→KBC/Ops) with per‑task deliverables and tests.

---

## 13) Snippets (selected)
Feature‑guarded imports, Neo4j transactional write, OTEL trace helper, GE programmatic validate, foresight API sketch.

---

## 14) CI/CD & Governance
Actions matrix; compose services; SAST/licensing; branch protection; tagged releases/canaries.

---

## 15) Rollout (10 weeks)
A/B/C milestones through foresight v1, DR drill, production cutover.

---

## 16) Risks & Mitigations
Ambiguity, vision misrecognition, graph bloat, CI flake, compliance, scale — with mitigations.

---

## 17) Definition of Done
All phases merged, gates green, SLOs met, DR tested, OKRs achieved.

---

**End of v4.0 — SOTA, No‑Compromise Plan**
