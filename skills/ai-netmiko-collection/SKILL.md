---
name: ai-netmiko-collection
description: Collect configuration and state from network devices with netmiko/paramiko without wrecking the network or the box — session parameters that matter, blocking-model concurrency, prompt and paging handling, a read-only command allowlist, failure classification, credential handling, and how collection output feeds the knowledge base. Use when writing or reviewing a device collection job.
bundle: dsh-ai-stack-skills
origin: original
---

# Device collection with netmiko / paramiko

**Given:** a fleet of switches, routers and firewalls reachable over SSH, and a need for their configuration and status on a schedule.
**Produces:** a collector whose failures are per-device and explainable, whose credentials never leave the host, and whose output is trustworthy enough to diff and to index.

## Non-negotiables

1. **Read-only by construction.** An allowlist of commands, enforced in code, not a convention in a runbook.
2. **No credential ever reaches a log, the database, or a model prompt.** Not masked, not truncated — never written.
3. **netmiko is blocking.** It runs in threads with an explicit concurrency limit, never inside an `async def` body.
4. **Failure is per device and typed.** "One box of 400 timed out" must not fail the job or look like success.
5. **A parse that fails returns an error, not an empty list.** Silent empties poison every downstream diff and index.

## 1. Session parameters that decide success

```python
ConnectHandler(
    device_type=..., host=..., username=..., password=...,
    port=22,
    timeout=10,            # socket connect
    conn_timeout=10,       # SSH negotiation
    auth_timeout=10,       # credential round-trip (TACACS can be slow)
    banner_timeout=10,     # some vendors pause before the banner
    session_timeout=60,    # inactivity on the channel
)
```

- `read_timeout` on long commands (`display current-configuration`) must exceed the device's own generation time — 60–120 s for big configs, not the default.
- Set the prompt explicitly for odd boxes: `read_timeout` and `expect_string` when the prompt does not match the platform template.
- Disable paging first: `terminal length 0` (Cisco-like), `screen-length 0 temporary` (Huawei/H3C), `| no-more` per command. A pager prompt is the classic cause of a "hung" collector.

## 2. Concurrency model

- Thread pool sized 10–30 for a typical management network. The limit is usually TACACS/RADIUS, SNMP, or the console server — not your CPU.
- One session per device per run, many commands per session. Reconnecting per command multiplies auth load and log noise.
- Global rate limit in front of the pool so a retry storm cannot amplify.
- Wrap the whole job in a deadline: a device that never answers must not hold the worker forever.

## 3. Command allowlist

```python
READ_ONLY = [
    r"^display (current-configuration|version|interface .*|ip routing-table)$",
    r"^show (running-config|version|interfaces|ip route)$",
    r"^terminal length 0$",
]
```

- Match the **whole command**, not a substring; forbid `|`, `;`, `>` in submitted text.
- Refuse config-mode commands outright. If a change is ever needed, it goes through a separate, approved path with a change record — not through the collector.
- Keep the allowlist per vendor family, in code, with a test that a config command raises.

## 4. Parsing

| Approach | When |
|---|---|
| regex on a stable header | a handful of fields, one vendor |
| textfsm / ntc-templates | many vendors, tabular output |
| genie/pyats | structured models you can validate |
| store raw + parse later | always, as an escape hatch |

- Save the raw output with a hash. Parsed data without the raw text cannot be re-parsed after a bug fix.
- Validate the parse: expected field count, non-empty critical fields. A regex that silently matches nothing is worse than a crash.
- Re-run the parser against a fixture set from at least three vendors before shipping a change.

## 5. Credentials

- Read from a secret store or environment at job start; hold in memory only.
- Never in exception messages: netmiko errors can include the command, and some drivers echo parameters.
- One credential object per job, rotated by the caller, never persisted.
- Per-device credentials where the fleet is heterogeneous; a single shared admin credential across 400 boxes is an incident waiting for a reason.

## 6. Batch semantics

- The job result is a **list of per-device outcomes**: `ok / auth_failed / unreachable / timeout / command_unsupported / parse_failed`.
- Retry only idempotent reads, at most twice, with jitter. Retrying an auth failure is how accounts get locked.
- Write results per device as they complete, so a crash keeps the first 300.
- Emit counts per outcome; alert on a change in the mix (sudden `auth_failed` spike = expired credential or ACL change).

## 7. Feeding the knowledge base

`raw config → normalized config → diff vs previous snapshot → chunks → embeddings`

- Diff first, index the diff and the section, not the whole file — otherwise a one-line change re-embeds a 4000-line config.
- Attach device identity (hostname, vendor, role, site) to every chunk; retrieval over device knowledge without the device name is nearly useless.
- Keep snapshots in MySQL with a version; the vector store only holds what is allowed to be retrieved.
- Configs frequently contain secrets (`snmp-server community`, local users, keys). **Redact before indexing, and store the redaction rule with the version.** This is also why raw config retrieval must be local-model-only.

## 8. Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| Collector hangs on one device | pager prompt or missing prompt match | disable paging, set `expect_string` |
| Random auth failures under load | auth server rate limit | cap concurrency, add jitter |
| Empty parsed results, no error | regex matched nothing | assert field count, fail loudly |
| Configs truncated | `read_timeout` too short | raise it for config commands |
| Job marked success, devices missing | exceptions swallowed per device | typed outcome list, counts, alert |
| Secrets in logs | driver echoes command/params | scrub at the formatter, test with a canary token |

## 9. Checklist

- [ ] allowlist enforced in code, with a negative test
- [ ] paging disabled per vendor family
- [ ] timeouts: connect, auth, banner, session, read
- [ ] concurrency cap + global rate limit + job deadline
- [ ] typed per-device outcomes, counts, alerting on mix change
- [ ] raw + hash stored; parse validated before use
- [ ] redaction before indexing; canary token test for log leaks
- [ ] retries only on idempotent reads, never on auth failure
