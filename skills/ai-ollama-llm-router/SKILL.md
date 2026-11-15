---
name: ai-ollama-llm-router
description: Run one LLM interface over two backends — local Ollama (qwen3:4b) and a cloud API — with task routing, privacy routing, JSON-schema-validated structured output, streaming, timeouts, fallback and per-call metering. Use when the app must switch between a local model and a cloud model without the rest of the code noticing.
bundle: dsh-ai-stack-skills
origin: original
---

# One interface, two model backends

**Given:** a business feature that needs text generation or extraction, a local Ollama instance and a cloud API key, and a rule about which data may leave the host.
**Produces:** `LLMClient` with two implementations, a routing policy wired in one place, and a call log that can answer "what did this cost and how slow was it".

## Non-negotiables

1. **One interface.** Callers never import `ollama` or a vendor SDK; they import `LLMClient`.
2. **Validate every structured response with a schema.** Both paths fail here, differently and constantly.
3. **Privacy route is a code path, not a convention.** Secrets, device credentials and raw configs are local-only, and the router enforces it rather than trusting the caller.
4. **Every call has a timeout and a fallback decision.** No unbounded `await`.
5. **Meter every call.** Tokens, time-to-first-token, total duration, model, route, fallback flag.

## 1. The interface

```python
class LLMClient(Protocol):
    async def chat(
        self,
        messages: list[Message],
        *,
        schema: dict | None = None,      # JSON Schema when the caller needs structure
        max_tokens: int = 1024,
        temperature: float = 0.2,
        think: bool = False,             # qwen3 reasoning mode, off by default
        timeout_s: float = 30.0,
    ) -> ChatResult: ...                 # text, parsed (dict|None), usage, model, route, latency
```

Two implementations: `OllamaClient`, `CloudClient`. A third, `RoutedClient`, picks between them per call and owns the fallback. Only `RoutedClient` knows the policy.

## 2. Ollama details that bite

- Base URL from config (`OLLAMA_BASE_URL`, default `http://127.0.0.1:11434`). Never hardcode `localhost` — it is the wrong host inside a container.
- Chat endpoint: `/api/chat`. Streaming returns newline-delimited JSON; each line carries a `message.content` delta and the last line carries `done: true` with timing and token counts.
- Set `options.num_ctx` explicitly. Defaults get silently truncated on long RAG contexts, and the symptom is "the model ignored the document".
- qwen3 reasoning: keep `think=false` for extraction, classification, formatting and JSON. Turn it on only for planning or multi-step reasoning — on a 4B model thinking roughly doubles latency and eats the JSON budget.
- `keep_alive` keeps the model resident; without it the first call after idle pays a multi-second load.
- Use the embedding endpoint that matches your build (`/api/embed`; `/api/embeddings` on older ones) and check the returned dimension — it must equal 512 for bge-small-zh-v1.5.

## 3. Routing policy

| Situation | Route |
|---|---|
| Classification, field extraction, short summaries, JSON | local |
| Anything containing credentials, raw device config, or internal topology | local **only** |
| Long document reasoning, tool-use chains, code generation | cloud |
| Local unreachable / timeout / model not pulled | cloud **if** data is not sensitive, else fail loudly |
| Cloud quota exhausted or key missing | local, degrades gracefully |

Write the policy as a function of `(task_kind, sensitivity, local_available, cloud_available)` and unit-test the table. A router whose rules live in five `if` statements across three files will eventually send a credential to the cloud.

## 4. Structured output

Both backends can emit malformed JSON; handle it in one place:

```
prompt (schema inline + one worked example)
  → backend format=json / JSON mode
  → json.loads
  → pydantic validate
  → on failure: one repair retry with the validation error appended
  → on second failure: raise a typed LLMFormatError, never return partial data
```

- Pass the JSON Schema to the backend when it supports it; otherwise inline it in the prompt and keep it short.
- Do not ask for both prose and JSON in one call. Two calls are cheaper than one unparseable answer.
- Keep a 20-sample regression set per schema and measure pass rate after any prompt or model change.

## 5. Streaming through FastAPI

- Ollama stream → SSE (`text/event-stream`), one `data:` frame per delta, `[DONE]` sentinel.
- Send `X-Accel-Buffering: no` so a reverse proxy does not buffer the whole stream.
- Handle client disconnect: cancel the upstream request, otherwise you keep paying for a stream nobody reads.
- Never stream a JSON-schema response to the UI half-validated — buffer it, validate, then deliver.

## 6. Budgets and metering

- Log per call: route, model, prompt/completion tokens, TTFT, total ms, fallback flag, task kind. One row, queryable.
- On CPU, qwen3:4b is slow: cap `max_tokens`, serialize to 1–2 concurrent generations, and keep prompts under the retrieval budget.
- Rewrite or truncate before you retry: a retry with the same oversized prompt just doubles the wait.

## 7. Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `model not found` | tag never `ollama pull`ed | preflight check at startup, fail fast |
| First call takes 10s, later calls fast | model unloaded | set `keep_alive` |
| Model ignores the retrieved context | `num_ctx` too small | set it, and assert prompt length |
| JSON valid locally, broken in cloud | different formatting behaviour | validate + repair path shared by both |
| Latency spikes under load | CPU contention from parallel generations | queue with concurrency 1–2 |
| Sensitive text in the cloud request | router bypassed | make the sensitive route a separate typed call, test it |

## 8. Checklist before shipping

- [ ] callers import only `LLMClient`
- [ ] both paths pass the same schema regression set
- [ ] sensitive route proven with a test that fails if it calls the cloud client
- [ ] timeouts, fallback and "fail loudly" branches all tested
- [ ] per-call metering row written even on failure
- [ ] startup preflight: model present, context size set, embedding dim correct
