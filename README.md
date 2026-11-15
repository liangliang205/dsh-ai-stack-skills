# dsh-ai-stack-skills

24 skills for a **FastAPI + Vue 3 + local-RAG** stack, packaged as one host-plane bundle for **DeepSeek Harness** (DSH).

Four of them are authored for this stack — ★ in the tables — because nothing upstream covers FAISS/bge retrieval, an Ollama↔cloud router, netmiko collection, or the FastAPI-specific async discipline. The other twenty are faithful ports with provenance, chosen because they apply to this stack rather than to the process around it.

Process (spec → plan → execute → verify) is not included: use [superpowers](https://github.com/obra/superpowers) for that.

## Install

```bash
dsh plugin add https://github.com/liangliang205/dsh-ai-stack-skills/releases/download/v1.0.0/dsh-ai-stack-skills-1.0.0.tgz
dsh plugin add dsh-ai-stack-skills@file:./dsh-ai-stack-skills-1.0.0.tgz   # downloaded asset
```

Or point the DSH plugin manager at the same tarball. Skills appear in the session catalog as `ai-*`; start a new session after installing.

## Skills

### Retrieval and knowledge base

FAISS + bge-small-zh-v1.5 is the pipeline everything else reads from. Get normalization, ACL filtering and an eval set right before tuning anything.

| Skill | What it does | Source |
|---|---|---|
| `ai-rag-faiss-bge-zh` ★ | Build and keep a Chinese retrieval pipeline on FAISS with bge-small-zh-v1.5 — chunking rules, query instruction prefixes, index type and normalization, metadata and ACL filtering, reranking, and a small retrieval eval that proves a change actually helped. Use when adding or debugging RAG over device configs, runbooks or tickets. | authored for this bundle |

### Local and cloud models

One interface over Ollama (qwen3:4b) and a cloud API, with routing decided in code and every structured response schema-validated.

| Skill | What it does | Source |
|---|---|---|
| `ai-ollama-llm-router` ★ | Run one LLM interface over two backends — local Ollama (qwen3:4b) and a cloud API — with task routing, privacy routing, JSON-schema-validated structured output, streaming, timeouts, fallback and per-call metering. Use when the app must switch between a local model and a cloud model without the rest of the code noticing. | authored for this bundle |

### FastAPI backend

Async discipline over slow dependencies, pydantic v2 contracts, injected seams, and the layered design underneath.

| Skill | What it does | Source |
|---|---|---|
| `ai-api-design-principles` | Master REST and GraphQL API design principles to build intuitive, scalable, and maintainable APIs that delight developers. Use when designing new APIs, reviewing API specifications, or establishing API design standards. | `wshobson/agents/plugins/backend-development/skills/api-design-principles` |
| `ai-architecture-patterns` | Implement proven backend architecture patterns including Clean Architecture, Hexagonal Architecture, and Domain-Driven Design. Use this skill when designing clean architecture for a new microservice, when refactoring a monolith to use bounded contexts, when implementing hexagonal or onion architecture patterns, or when debugging dependency cycles between application layers. | `wshobson/agents/plugins/backend-development/skills/architecture-patterns` |
| `ai-fastapi-service` ★ | Keep a FastAPI service honest when it calls slow things — embedding models, FAISS, MySQL, Ollama, netmiko — with async discipline, pydantic v2 contracts, dependency-injected seams, background jobs, SSE streaming and an error taxonomy. Use when building or reviewing the backend layer of an AI-enabled Python service. | authored for this bundle |
| `ai-python-code-style` | Python code style, linting, formatting, naming conventions, and documentation standards. Use when writing new code, reviewing style, configuring linters, writing docstrings, or establishing project standards. | `wshobson/agents/plugins/python-development/skills/python-code-style` |

### Device collection

netmiko/paramiko done defensively: read-only allowlist, typed per-device outcomes, credentials that never reach a log or a prompt.

| Skill | What it does | Source |
|---|---|---|
| `ai-netmiko-collection` ★ | Collect configuration and state from network devices with netmiko/paramiko without wrecking the network or the box — session parameters that matter, blocking-model concurrency, prompt and paging handling, a read-only command allowlist, failure classification, credential handling, and how collection output feeds the knowledge base. Use when writing or reviewing a device collection job. | authored for this bundle |

### Vue 3 + Element Plus

No upstream skill covers Vue; these three carry the JS, visual and testing craft that still applies.

| Skill | What it does | Source |
|---|---|---|
| `ai-frontend-design` | Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults. | `anthropics/skills/skills/frontend-design` |
| `ai-modern-javascript-patterns` | Master ES6+ features including async/await, destructuring, spread operators, arrow functions, promises, modules, iterators, generators, and functional programming patterns for writing clean, efficient JavaScript code. Use when refactoring legacy code, implementing modern patterns, or optimizing JavaScript applications. | `wshobson/agents/plugins/javascript-typescript/skills/modern-javascript-patterns` |
| `ai-webapp-testing` | Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs. | `anthropics/skills/skills/webapp-testing` |

### Security

Threat model the device and model boundaries first, then turn threats into requirements, then scanners, then a code-level audit.

| Skill | What it does | Source |
|---|---|---|
| `ai-attack-tree-construction` | Build comprehensive attack trees to visualize threat paths. Use when mapping attack scenarios, identifying defense gaps, or communicating security risks to stakeholders. | `wshobson/agents/plugins/security-scanning/skills/attack-tree-construction` |
| `ai-sast-configuration` | Configure Static Application Security Testing (SAST) tools for automated vulnerability detection in application code. Use when setting up security scanning, implementing DevSecOps practices, or automating code vulnerability detection. | `wshobson/agents/plugins/security-scanning/skills/sast-configuration` |
| `ai-security-requirement-extraction` | Derive security requirements from threat models and business context. Use when translating threats into actionable requirements, creating security user stories, or building security test cases. | `wshobson/agents/plugins/security-scanning/skills/security-requirement-extraction` |
| `ai-security-review` | Security code review for vulnerabilities. Use when asked to "security review", "find vulnerabilities", "check for security issues", "audit security", "OWASP review", or review code for injection, XSS, authentication, authorization, cryptography issues. Provides systematic review with confidence-based reporting. | `getsentry/skills/skills/security-review` |
| `ai-stride-analysis-patterns` | Apply STRIDE methodology to systematically identify threats. Use when analyzing system security, conducting threat modeling sessions, or creating security documentation. | `wshobson/agents/plugins/security-scanning/skills/stride-analysis-patterns` |
| `ai-threat-mitigation-mapping` | Map identified threats to appropriate security controls and mitigations. Use when prioritizing security investments, creating remediation plans, or validating control effectiveness. | `wshobson/agents/plugins/security-scanning/skills/threat-mitigation-mapping` |

### Understanding, review, discipline

Reading an inherited codebase, reviewing a diff on two axes, and chasing the bugs that resist first guesses.

| Skill | What it does | Source |
|---|---|---|
| `ai-code-review` | Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes: Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \"review since X\". | `mattpocock/skills/skills/engineering/code-review` |
| `ai-codebase-design` | Shared vocabulary for designing deep modules. Use when the user wants to design or improve a module's interface, find deepening opportunities, decide where a seam goes, make code more testable or AI-navigable, or when another skill needs the deep-module vocabulary. | `mattpocock/skills/skills/engineering/codebase-design` |
| `ai-diagnosing-bugs` | Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow. | `mattpocock/skills/skills/engineering/diagnosing-bugs` |
| `ai-domain-modeling` | Build and sharpen a project's domain model. Use when discussing codebase terminology, writing or editing a GLOSSARY.md, or recording or editing an ADR. | `mattpocock/skills/skills/engineering/domain-modeling` |
| `ai-improve-codebase-architecture` | Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick. | `mattpocock/skills/skills/engineering/improve-codebase-architecture` |
| `ai-karpathy-guidelines` | Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria. | `forrestchang/andrej-karpathy-skills/skills/karpathy-guidelines` |
| `ai-prototype` | Build a throwaway prototype to answer a design question. Use when the user wants to sanity-check whether a state model or logic feels right, or explore what a UI should look like. | `mattpocock/skills/skills/engineering/prototype` |
| `ai-research` | Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent. | `mattpocock/skills/skills/engineering/research` |

All 24 names carry the `ai-` prefix, so this bundle can coexist with `dsh-engineering-skills` (`eng-*`), `dsh-devskills` or `dsh-upstream-skills` without name collisions. Overlapping content still costs catalog index, so do not install two bundles that ship the same texts unless you want both.

## Stack notes worth knowing before you start

- **MySQL 8.0.12 is old.** Functional key parts arrived in 8.0.13 and enforced `CHECK` constraints in 8.0.16, so do not copy them from current tutorials. CTEs and window functions are fine (8.0.1+).
- **Vue 3 + Element Plus has no dedicated skill** in any of the upstream sets. `ai-modern-javascript-patterns` carries the language craft, `ai-frontend-design` the visual judgement, `ai-webapp-testing` the Playwright loop. Element Plus component conventions are yours to write down.
- **FAISS is a derived artifact, MySQL is the truth.** If they disagree, rebuild the index.
- **qwen3:4b is small.** Keep prompts tight, disable thinking mode for extraction and JSON, and prefer five sharp chunks over twenty loose ones.
- **netmiko is blocking and slow.** It belongs in a thread pool behind a read-only allowlist, never inside an `async def` body.
- **Sensitive data is local-model-only.** Device credentials, raw configs and topology must not be routed to a cloud API — make that a code path, not a convention.

## Known limits

- These are skill texts, not runtimes. Playwright, `onnxruntime`/sentence-transformers, FAISS, netmiko and Ollama must be installed by you.
- The four authored skills were written against the library generations named above; verify parameter names against the versions you actually pin. Where a skill says "check your runtime", it means it.
- Ported skills are faithful copies; only the frontmatter `name` (prefixed) and provenance fields differ.

## Licensing

MIT for this package, including the four authored skills. Ported skills keep their upstream license — MIT (wshobson/agents, mattpocock/skills, forrestchang/andrej-karpathy-skills), Apache-2.0 (anthropics/skills, getsentry/skills). See `THIRD_PARTY/NOTICE.md`.
