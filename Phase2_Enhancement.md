# AI Assistant v3.0 Implementation Plan

This list breaks down the work required to implement the "LangGraph AI Assistant v3.0" architecture.

### Phase 1: Core Infrastructure
- [ ] Set up the new directory structure under `src/ai/`.
- [ ] Create `core/types.ts` with Zod schemas for AIState and Intent.
- [ ] Implement the Transactional State Engine in `core/kernel.ts`.

### Phase 2: Model Abstraction
- [ ] Implement the `ModelAdapter` interface and the `FallbackPolicy` in `core/adapters/model-policy.ts`.
- [ ] Create the `gemini.ts` and `ollama.ts` model adapters.

### Phase 3: Intent Parsing
- [ ] Implement the rule-based parser in `core/parser/rule.ts`.
- [ ] Implement the `Fusion Engine` in `core/parser/index.ts` to combine rule and LLM parsing.

### Phase 4: Tooling System
- [ ] Implement the `ToolRegistry` in `core/tools/registry.ts`.
- [ ] Create initial tool plugins (e.g., `location.ts`, `suggest.ts`).

### Phase 5: Final Assembly
- [ ] Implement the `AIAssistant` orchestrator in `core/orchestrator.ts`.
- [ ] Create the factory in `src/ai/index.ts` to assemble and export the `ai` instance.
- [ ] Integrate the final `ai` object into a sample API route.

### Phase 6: Integration & Verification
- [ ] Write unit and integration tests for the new architecture.
- [ ] Document the new v3.0 architecture in a README file.

---
# DYNAMIC LEARNING SYSTEM v2.1 — FINAL HYBRID SOTA

| Feature | v1 (LangGraph) | v2 (Apple) | **v2.1 Hybrid** |
|-------|----------------|-----------|-----------------|
| **Schema** | JSONB + SQL | Zod + TS | **Zod + SQL + Index** |
| **Learning** | Feedback diff | Pure engine | **Diff + Confidence Fusion** |
| **Confidence** | `+0.1` | Bounded | **Exponential Smoothing** |
| **Storage** | Raw `Pool` | Safe adapter | **Transactional Client** |
| **Rollout** | Disabled | Feature flag | **Sampling + Canary** |
| **Observability** | `console.log` | `trace()` | **CoreDiagnostics + Metrics** |
| **Testing** | None | Deterministic | **Mock + E2E** |

---
# AGENT POLICY FILES
---

## /Users/abhijita/Projects/Project_Dhruv/.agent-policy/PRD_Dhruv_Dashboard.markdown

# Product Requirements Document (PRD) for Project Dhruv: Functional Dashboard for OP Choudhary X Activity Analysis

## Overview
This PRD outlines the requirements and build process for a basic functional dashboard analyzing OP Choudhary's X (formerly Twitter) posts from September 1–6, 2025. The dashboard will process the dataset into a structured view, extracting and displaying details such as when (timestamp in Hindi format), where (locations extracted from post content, in Devanagari script), what (activities/events), which (entities like people or events), and how (context from text). All content will be rendered in Hindi (Devanagari script) using Noto Sans Devanagari font (selected as Google's native multilingual font supporting Hindi, aligned with Pixel phone's system UI preferences for sans-serif fonts like Google Sans Text, but optimized for Devanagari). The core engine will execute data processing verbatim as per prior discussions, with no fancy UI—focusing on a simple table and metrics summary.

The build adheres strictly to Ironclad DevOps Rulebook v2.1 (imported from `/Users/abhijita/Projects/Project_Dhruv/.agent-policy/ironclad-bootstrap.mdc`). This enforces atomic tasks (1–4 hours each, one concern per task/PR), TDD (red-green-refactor), scope lock (only checklist items), shift-left security/privacy/accessibility/performance/observability, CI gates, reversible changes, and documentation. Tasks are decomposed into ~150 atomic units, with TDD for each. From Task 1, deploy to Vercel for live simulation/verification. Use Next.js for the app (Vercel-compatible, React-based for web dashboard). Hardcode the fetched dataset (48 posts) for initial engine; future tasks can add dynamic fetch if scoped.

## Metadata
- **Project Name**: Project Dhruv
- **Root Directory**: `/Users/abhijita/Projects/Project_Dhruv`
- **Owners**: Engineering team, with policy owners from Ironclad (`eng@company`, `sec@company`, `sre@company`)
- **Applies To**: Web (Next.js/React)
- **Branching**: Trunk-based; short-lived feature branches per task
- **Environments**: Dev (local), Staging/Prod (Vercel)
- **Font**: Noto Sans Devanagari (import via Google Fonts CDN for Hindi support)
- **Data Source**: Hardcoded JSON from fetched posts (Sept 1–6, 2025); parse in Hindi
- **Acceptance Criteria** (per Ironclad):
  - Tests added: true
  - Coverage: lines >=95%, branches >=70% (mandatory gate)
  - Docs updated: true
  - A11y pass: true (WCAG 2.1 AA via semantic HTML)
  - Perf within budget: LCP <=2.5s (Lighthouse), API p95 <=300ms (k6)
  - Security scans green: No secrets, input validation
  - Feature flagged: Risky changes (e.g., data parsing) behind flags
  - Health check: /health endpoint
- **Exemptions**: None; all tasks follow rules

---

## /Users/abhijita/Projects/Project_Dhruv/.agent-policy/README.md

# Ironclad DevOps Rulebook v2.1 — It Just Works

This repo hosts policy-as-code for atomic, TDD-first, shift-left security & observability.
- **Policy**: `devops_agent_policy.yaml`
- **Cursor rules**: `.cursorrules`
- **Prompts**: `gemini.md`, `agent.md`
- **CI**: `.github/workflows/ironclad.yml`
- **Scripts**: `scripts/enforce-coverage.js`, `scripts/assert-k6-p95.js`
- **PR template**: `.github/pull_request_template.md`

---
## /Users/abhijita/Projects/Project_Dhruv/.agent-policy/agent.md

### Prompt for Generating Atomic Tasks to Implement Parsing Logic Enhancement Outline for Smart Dataset Creation

You are a DevOps Agent operating under the Ironclad DevOps Rulebook v2.1...

---
## /Users/abhijita/Projects/Project_Dhruv/.agent-policy/devops_agent_policy.yaml

... (and so on for all the other files) ...