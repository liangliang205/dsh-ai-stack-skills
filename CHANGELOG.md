# Changelog

## 1.0.0 — first release

24 skills for a FastAPI + Vue 3 service with local RAG, packaged as one host-plane
bundle for DeepSeek Harness.

### Authored (★, original work)

- `ai-rag-faiss-bge-zh` — Chinese retrieval on FAISS with bge-small-zh-v1.5:
  chunking, query instruction prefix, index choice, ACL-before-recall, reranking,
  and a retrieval eval that proves a change helped.
- `ai-ollama-llm-router` — one LLM interface over Ollama (qwen3:4b) and a cloud
  API: routing policy, privacy route, schema-validated structured output,
  streaming, timeouts, fallback, metering.
- `ai-fastapi-service` — async discipline over slow dependencies, pydantic v2
  contracts, dependency-injected seams, job tables, SSE, error taxonomy.
- `ai-netmiko-collection` — device collection that fails safely: read-only
  allowlist, session parameters, concurrency cap, typed per-device outcomes,
  credential handling, redaction before indexing.

### Ported

- Backend: `ai-python-code-style`, `ai-api-design-principles`, `ai-architecture-patterns`
- Frontend: `ai-modern-javascript-patterns`, `ai-frontend-design`, `ai-webapp-testing`
- Security: `ai-stride-analysis-patterns`, `ai-attack-tree-construction`,
  `ai-threat-mitigation-mapping`, `ai-security-requirement-extraction`,
  `ai-sast-configuration`, `ai-security-review`
- Understanding and review: `ai-codebase-design`, `ai-domain-modeling`,
  `ai-improve-codebase-architecture`, `ai-research`, `ai-code-review`,
  `ai-diagnosing-bugs`, `ai-prototype`, `ai-karpathy-guidelines`

### Notes

- Prefix `ai-` keeps this bundle side-by-side with `dsh-engineering-skills` (`eng-*`).
- No process skills: superpowers owns spec → plan → execute → verify.
- Upstream: wshobson/agents (MIT), mattpocock/skills (MIT), anthropics/skills
  (Apache-2.0), getsentry/skills (Apache-2.0), forrestchang/andrej-karpathy-skills (MIT).
