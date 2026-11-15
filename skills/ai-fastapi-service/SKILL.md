---
name: ai-fastapi-service
description: Keep a FastAPI service honest when it calls slow things — embedding models, FAISS, MySQL, Ollama, netmiko — with async discipline, pydantic v2 contracts, dependency-injected seams, background jobs, SSE streaming and an error taxonomy. Use when building or reviewing the backend layer of an AI-enabled Python service.
bundle: dsh-ai-stack-skills
origin: original
---

# FastAPI over slow dependencies

**Given:** a Python service where one request may touch MySQL, FAISS, an embedding model, a local or cloud LLM, and a network device.
**Produces:** request paths that never block the event loop, contracts that reject bad input before work starts, seams that let you test without any of those backends, and errors a frontend can act on.

## Non-negotiables

1. **`async def` never calls blocking code directly.** Embedding encode, FAISS search, `pymysql`/sync SQLAlchemy, `requests`, `paramiko`/`netmiko` are all blocking. Wrap them (`await run_in_threadpool(...)`) or make the whole path synchronous.
2. **Request and response models are separate.** Leaking an ORM object into a response is how password hashes reach the client.
3. **Every external call has a timeout.** Unbounded waits are the number one cause of "the service hung", and the hung thing is always the device or the model.
4. **Seams via `Depends`.** LLM, vector store, DB session and device collector are injected, so tests substitute fakes instead of hitting reality.
5. **Errors are classified.** "Device unreachable", "model timeout" and "bad input" must not all become a 500.

## 1. Layer map

```
router        pydantic in/out, status codes, SSE framing
  service     business rules, transaction boundary, ordering of external calls
    repo      SQLAlchemy (MySQL) — one place that knows SQL
    adapter   LLMClient / VectorStore / DeviceCollector — one place that knows each backend
```

Adapters return plain domain objects. Routers never import an adapter module directly; they get it through a dependency.

## 2. Async rules, concretely

| Do not | Because | Do instead |
|---|---|---|
| `async def` + `requests.get` | blocks the loop for every other request | `httpx.AsyncClient` |
| `async def` + `model.encode(texts)` | CPU-bound, 50–500 ms | `run_in_threadpool` or a process pool |
| `async def` + `index.search(...)` | CPU-bound | threadpool; keep k small |
| `async def` + `ConnectHandler(...)` | seconds of SSH handshake | threadpool, with its own concurrency limit |
| sync SQLAlchemy session in `async def` | blocks on I/O | async driver (`asyncmy`/`aiomysql`) or sync route |
| `time.sleep` | obvious, but it happens | `asyncio.sleep` |

A quick audit: any `async def` whose body contains no `await` is suspicious — either it does nothing or it is blocking.

## 3. Pydantic v2 contracts

- `class XxxIn(BaseModel)` and `class XxxOut(BaseModel)`; `response_model=XxxOut` on the route so extra fields can never leak.
- `model_config = ConfigDict(extra="forbid")` on inputs: a typo in a field name becomes a 422 instead of a silent default.
- Field constraints where they belong (`min_length`, `ge`, `pattern`), not in service code.
- `field_validator` for cross-field rules; keep business rules out of it — validators are for shape, not policy.
- One error envelope (`code`, `message`, `details`) and one exception handler that produces it.

## 4. Dependencies are the test seams

```python
def get_llm() -> LLMClient: ...
def get_vector_store() -> VectorStore: ...
def get_collector() -> DeviceCollector: ...
def get_db() -> Iterator[Session]: ...
```

`app.dependency_overrides[get_llm] = lambda: FakeLLM([...])` makes the whole LLM path testable with no network. Do the same for the vector store and the collector — this is the single highest-value test investment in this stack.

## 5. Long-running work

| Duration | Mechanism |
|---|---|
| < 1 s | inline in the request |
| 1–5 s (one device poll, one small retrieval) | inline, with tight timeouts |
| minutes (full config collection, index rebuild, batch re-embed) | **job table + worker**, not `BackgroundTasks` |

`BackgroundTasks` dies with the process and gives the client no way to see progress. A `jobs` table with `status/progress/result/error` plus polling or SSE gives you restart safety and a UI.

Job rules: idempotency key per logical job, one worker per resource-heavy job (index rebuild must never run twice), progress written in batches rather than per item.

## 6. Streaming

```python
async def stream():
    yield "data: " + json.dumps({"delta": chunk}) + "\n\n"
return StreamingResponse(stream(), media_type="text/event-stream",
                         headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})
```

Cancel the upstream generator on client disconnect, and do not stream a JSON-schema response until it validates.

## 7. Error taxonomy

| Condition | Status | Code |
|---|---|---|
| bad input / schema | 422 | `invalid_input` |
| not found | 404 | `not_found` |
| conflict (duplicate job, stale version) | 409 | `conflict` |
| device unreachable / auth failed | 502 | `device_unavailable` |
| model missing, model timeout | 503 | `model_unavailable` |
| our own bug | 500 | `internal` |

Log the upstream exception with a correlation id; return the id in the envelope. Never return stack traces or backend URLs.

## 8. Testing

- `TestClient` + dependency overrides: no real model, no real FAISS, no SSH.
- One integration test per adapter, marked slow, run in CI nightly.
- A test that asserts a sensitive route never calls the cloud client.
- A test that a blocking call inside `async def` is caught: wrap the dependency in a fixture that raises if invoked from the loop thread.

## 9. Ops

- `uvicorn --workers N` with N tied to CPU, not to requests — the heavy work is CPU-bound.
- MySQL pool size × workers must stay under `max_connections`; leave headroom for admin sessions.
- One Ollama instance serves one generation at a time comfortably on CPU: queue it, do not shard requests across workers.

## 10. Checklist

- [ ] no blocking call in an `async def` (audited, not assumed)
- [ ] `response_model` on every route
- [ ] `extra="forbid"` on every input model
- [ ] timeouts on every external call
- [ ] slow work in a job table, not `BackgroundTasks`
- [ ] dependency overrides used in tests
- [ ] error envelope + correlation id
