---
name: ai-rag-faiss-bge-zh
description: Build and keep a Chinese retrieval pipeline on FAISS with bge-small-zh-v1.5 — chunking rules, query instruction prefixes, index type and normalization, metadata and ACL filtering, reranking, and a small retrieval eval that proves a change actually helped. Use when adding or debugging RAG over device configs, runbooks or tickets.
bundle: dsh-ai-stack-skills
origin: original
---

# Chinese RAG on FAISS + bge-small-zh-v1.5

**Given:** documents worth retrieving (device configs, runbooks, tickets) and questions users ask in Chinese.
**Produces:** a retrieval path with a measurable hit rate, an index you can rebuild, and a stated answer for "what happens when nothing relevant exists".

## Non-negotiables

1. **Vectors are normalized and searched by inner product.** `faiss.normalize_L2(v)` then `IndexFlatIP` is cosine similarity. Skipping the normalize step gives a ranking that looks plausible and is wrong.
2. **The query gets the instruction prefix; documents do not.** bge retrieval models are asymmetric. Prefix only the query, never the stored chunks.
3. **ACL filtering happens before recall, not after.** Retrieve from the set the caller may read, then rank. Filtering after top-k silently returns fewer results and hides the problem.
4. **Every chunk carries provenance.** Without `doc_id` + section path + source version you cannot cite, cannot dedupe, and cannot delete.
5. **No tuning without an eval set.** Twenty query→gold-chunk pairs beat any intuition about chunk size.

## 1. Where each piece lives

| Thing | Store | Why |
|---|---|---|
| Document body, chunks, metadata, ACL | MySQL | Transactional, joinable, deletable |
| Vectors + row ids | FAISS index file | Fast nearest neighbour; not a source of truth |
| Model name, dim, normalize flag, chunk rule version | index sidecar JSON | An index whose model you cannot name is unusable |
| Query logs, hit feedback | MySQL | The only honest source of eval queries |

FAISS is a **derived artifact**: if it and MySQL disagree, MySQL wins and you rebuild.

## 2. Chunking Chinese documents

- 300–500 characters per chunk, 10–15% overlap. Chinese is information-dense; English-sized 1000-token chunks dilute recall on short queries.
- **Never split a table or a command block.** Split on heading → paragraph → sentence, in that order; a chunk that starts mid-table is worse than a slightly long chunk.
- Store the heading path (`配置 > 交换机 > 生成树`) on the chunk and prepend it to the embedded text. This is the cheapest recall win that exists.
- Keep the original offsets so a hit can be highlighted in the source document.
- Version the chunk rule (`chunk_v1`) and re-chunk everything when it changes — mixed chunking inside one index makes eval results meaningless.

## 3. Embeddings

- `bge-small-zh-v1.5`: 512 dimensions, 512-token limit, CLS pooling, trained with an instruction on the query side.
- Query side prefix: `为这个句子生成表示以用于检索相关文章：`
- Batch 32–64 on CPU; sort by length before batching to avoid padding waste.
- Model or pooling change ⇒ **full rebuild**. There is no partial migration between embedding spaces.
- Record in the sidecar: model id, revision, dim, normalize=true, max tokens, chunk rule.

## 4. Index choice

| Corpus size | Index | Settings |
|---|---|---|
| < 100k chunks | `IndexFlatIP` | exact; simplest; a full scan is fine |
| 100k–10M | `IndexIVFFlat` (with `IndexFlatIP` quantizer) | `nlist ≈ 4·√N`, `nprobe` 8–16, raise until recall plateaus |
| latency-critical | `IndexHNSWFlat` | `M=32`, `efConstruction=200`, `efSearch` 64+ |

Deletions: wrap with `IndexIDMap` and call `remove_ids`. If deletes are frequent, prefer a nightly rebuild from MySQL over incremental surgery — the rebuild is also your corruption check.

Persist with `faiss.write_index` plus the sidecar; load with `read_index`. Keep the id→(doc_id, chunk_no) map in MySQL so the index only needs to carry integers.

## 5. Recall and rerank

- Retrieve `k=20`, rerank, keep 5 in the prompt. 4B-class local models degrade with long contexts; five tight chunks beat twenty loose ones.
- Drop hits below a score threshold and **say so** in the answer path (a "no relevant document" branch beats a confident hallucination).
- Dedupe by parent document before reranking, otherwise one long document occupies the whole window.
- Reranking options, cheapest first: score threshold → metadata boost (same device family / recency) → cross-encoder or LLM rerank.

## 6. Eval you can actually run

1. Collect 20–50 real questions. For each, mark the chunk(s) that should be found.
2. Log `Recall@5`, `Recall@20`, `MRR`, and the count of questions with **no** correct answer available.
3. Rerun after every change (chunk size, prefix, index params, rerank). Keep the numbers in the repo.
4. Include 5–10 "should refuse" questions — the refusal rate is a product feature, not an edge case.

## 7. Failure modes

| Symptom | Usual cause | Fix |
|---|---|---|
| Answers cite irrelevant chunks | chunks are too large / no heading prefix | re-chunk, prepend heading path |
| Same question answers well in test, badly live | query prefix missing in production path | assert prefix in one place, both call sites |
| Recall drops after adding documents | IVF `nprobe` too low for new distribution | retune, or move to HNSW |
| Different answers for the same doc | duplicate chunks, no dedupe | dedupe by content hash at ingest |
| Users see documents they may not read | ACL applied after top-k | filter ids before search |
| Index works locally, not in prod | model revision differs | pin revision, store it in the sidecar |

## 8. Checklist before shipping

- [ ] normalize + IP asserted in a unit test
- [ ] query prefix in exactly one function
- [ ] ACL filter proven with a test user who can see one document
- [ ] eval set committed with current numbers
- [ ] rebuild script one command, and it is the only writer of the index
- [ ] refusal path returns a distinct, non-hallucinated answer
