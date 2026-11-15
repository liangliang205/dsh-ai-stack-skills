// dsh-ai-stack-skills: 24 curated AI-stack skills registered on the host skill registry.
//
// A Cordis plugin that registers one skill provider into the HOST layer of the
// `ctx.skills` registry, so every agent preset's scope chain merges these
// skills. Skill bodies live in `../skills/<name>/SKILL.md` inside this
// package; the provider locates them from `import.meta.url` (an assembly
// fact of this package, never user config) and loads bodies on demand.
//
// The provider protocol mirrors @deepseek-ai/dsh-skill-filesystem:
//   - list()  discovers directory-bundle candidates (name/description from
//     YAML frontmatter, body left unread until requested)
//   - get()   parses the winning candidate's SKILL.md and returns the full
//     definition with a directory resource base for relative references
//
// @module dsh-ai-stack-skills
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const name = 'dsh-ai-stack-skills'
const inject = ['skills']

/** Registry precedence for packaged skill providers: ranks below the local bundled root. */
const PACKAGED_SKILL_RANK = 553

/** The source bucket these skills advertise under (prompt-visible metadata). */
const SOURCE = 'custom'

/**
 * Parse the YAML frontmatter block of a SKILL.md into metadata plus body.
 * Handles only the scalar fields DSH skill discovery consumes (name,
 * description, whenToUse); richer metadata passes through verbatim.
 * @param text - the raw skill file contents.
 * @returns parsed metadata object and the markdown body after the block, or
 *   null when the file has no frontmatter block at all.
 */
/** Strip one layer of matching quotes from a scalar. */
function stripQuotes(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

/**
 * Parse the YAML frontmatter block of a SKILL.md into metadata plus body.
 *
 * DSH only consumes the scalar fields (name, description, whenToUse), so this
 * is deliberately not a full YAML parser 鈥?but it must handle the shapes real
 * skills use, because a skill whose description parses to an empty string is
 * rejected by the host registry:
 *   - plain single-line scalars:            description: Some text
 *   - quoted scalars:                       version: "1.0.0"
 *   - plain scalars folded over indented continuation lines:
 *       description:
 *         First line
 *         second line
 *   - block scalars:                        description: |
 *                                             line one
 *                                           description: >
 *                                             folded into one line
 *   - nested maps (metadata:) are flattened to an opaque string and ignored.
 *
 * @param text - the raw skill file contents.
 * @returns parsed metadata object and the markdown body after the block, or
 *   null when the file has no frontmatter block at all.
 */
function parseFrontmatter(input) {
  // Normalize before parsing: skill files authored on Windows carry CRLF, and a
  // trailing `\r` makes every `key: value` line fail to match. A UTF-8 BOM
  // would also hide the opening fence.
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  const block = text.slice(3, end)
  const body = text.slice(end + 4).replace(/^\n+/, '')

  const lines = block.split('\n')
  const metadata = {}

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    if (raw.trim() === '') continue
    if (/^\s/.test(raw)) continue // indented continuation, consumed by its key
    const match = /^([A-Za-z][\w-]*):[ \t]*(.*)$/.exec(raw)
    if (match === null) continue

    const key = match[1]
    const rest = match[2].trim()

    // Collect the indented/blank lines that belong to this key.
    const continuation = []
    let j = i + 1
    while (j < lines.length && (lines[j].trim() === '' || /^\s/.test(lines[j]))) {
      continuation.push(lines[j])
      j += 1
    }
    i = j - 1

    if (/^[>|][+-]?$/.test(rest)) {
      // Block scalar: drop the common indentation, then fold or keep lines.
      const indents = continuation
        .filter((line) => line.trim() !== '')
        .map((line) => line.match(/^\s*/)[0].length)
      const cut = indents.length > 0 ? Math.min(...indents) : 0
      const textLines = continuation.map((line) => line.slice(cut))
      if (rest[0] === '>') {
        metadata[key] = stripQuotes(textLines.join(' ').replace(/\s+/g, ' ').trim())
      } else {
        metadata[key] = stripQuotes(textLines.join('\n').trim())
      }
      continue
    }

    // Plain scalar, possibly folded across indented continuation lines.
    const merged = [rest, ...continuation.map((line) => line.trim())]
      .filter((part) => part !== '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    metadata[key] = stripQuotes(merged)
  }

  return { metadata, body }
}

/**
 * Read and parse one skill directory's SKILL.md.
 * @param skillFile - absolute path to the SKILL.md file.
 * @param signal - optional cancellation; aborts the read.
 * @returns the parsed skill record, or undefined when the file vanished.
 */
async function parseSkillFile(skillFile, signal) {
  let text
  try {
    text = await readFile(skillFile, 'utf8')
  } catch {
    return undefined
  }
  if (signal?.aborted) return undefined
  const parsed = parseFrontmatter(text)
  if (parsed === null) return undefined
  return {
    name: parsed.metadata.name ?? '',
    description: parsed.metadata.description ?? '',
    whenToUse: parsed.metadata.whenToUse,
    metadata: parsed.metadata,
    content: parsed.body
  }
}

/**
 * Discover packaged skill candidates by scanning the package's `skills/`
 * directory: one subdirectory per skill, each carrying a SKILL.md.
 * @param skillsRoot - absolute path to this package's skills directory.
 * @param signal - optional cancellation.
 * @returns the candidate list.
 */
async function discoverCandidates(skillsRoot, signal) {
  let entries
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true })
  } catch {
    return []
  }
  const candidates = []
  for (const entry of entries) {
    if (signal?.aborted) break
    if (!entry.isDirectory()) continue
    const skillDir = join(skillsRoot, entry.name)
    const skillFile = join(skillDir, 'SKILL.md')
    const parsed = await parseSkillFile(skillFile, signal)
    if (parsed === undefined) continue
    candidates.push({
      name: parsed.name,
      description: parsed.description,
      ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
      invocation: { modelInvocable: true, userInvocable: true },
      source: SOURCE,
      provider: name,
      rank: PACKAGED_SKILL_RANK,
      locator: skillDir,
      path: skillFile,
      ...(Object.keys(parsed.metadata).length > 0 ? { metadata: parsed.metadata } : {})
    })
  }
  return candidates
}

/** Register the packaged superpowers provider on `ctx.skills`. */
function apply(ctx) {
  const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')
  ctx.skills.registerProvider((control) => ({
    name,
    async list(options) {
      return discoverCandidates(skillsRoot, options.signal)
    },
    async get(candidate, options) {
      const parsed = await parseSkillFile(candidate.path, options.signal)
      if (parsed === undefined) return undefined
      return {
        name: parsed.name,
        description: parsed.description,
        ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
        invocation: { modelInvocable: true, userInvocable: true },
        source: SOURCE,
        provider: name,
        resourceBase: { kind: 'directory', path: candidate.locator },
        path: candidate.path,
        ...(Object.keys(parsed.metadata).length > 0 ? { metadata: parsed.metadata } : {}),
        content: parsed.content
      }
    }
  }))
}

export { apply, name, inject, parseFrontmatter }
export default { apply, name, inject, parseFrontmatter }


