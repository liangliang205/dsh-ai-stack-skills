# Third-party notices

This bundle mixes **authored** skills and **ported** upstream skills. The four
authored ones (`ai-rag-faiss-bge-zh`, `ai-ollama-llm-router`, `ai-fastapi-service`,
`ai-netmiko-collection`) are original work released under this package's MIT
license; they carry `origin: original` in their frontmatter and have no upstream.

The ported skills keep their upstream license file inside their own directory
where upstream shipped one.

| Upstream repo | License | Where the text lives here |
|---|---|---|
| `wshobson/agents` | MIT (`wshobson__agents-LICENSE`) | 8 skills under `plugins/*/skills/` |
| `mattpocock/skills` | MIT (`mattpocock__skills-LICENSE`) | 7 skills under `skills/engineering/` |
| `anthropics/skills` | Apache-2.0 (per-skill `LICENSE.txt`, kept inside each skill directory) | 2 skills |
| `getsentry/skills` | Apache-2.0 (`getsentry__skills-LICENSE`, plus OWASP-derived `LICENSE` inside the skill) | `skills/security-review` |
| `forrestchang/andrej-karpathy-skills` | MIT (declared in the skill frontmatter; repo ships no LICENSE file) | `skills/karpathy-guidelines` |

## Modifications

To every redistributed skill, as required by the Apache-2.0 "prominent notices"
clause:

1. the frontmatter `name` was prefixed with `ai-`;
2. `upstream`, `upstream-name` and `bundle` provenance fields were added;
3. nothing in the skill body was edited.

Ported skills are otherwise byte-identical to the versions fetched from the
upstream repositories at build time.
