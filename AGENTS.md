# AGENTS.md

Guidance for AI coding agents working on this repository. `README.md` explains
the project to humans; this file tells you how to work on it.

## What this is (and is not)

`acp-fixture-agent` is a **deterministic test instrument** for the
[Agent Client Protocol](https://agentclientprotocol.com): an ACP agent whose
only job is to reproduce protocol situations exactly, on demand, every time.
Its users are developers of ACP **clients** (editors, IDE plugins, chat UIs)
who need a controllable counterpart for situations real agents rarely or never
produce.

It is **not** an AI agent. It contains no LLM, makes no network calls, and has
no autonomy. Never add "intelligence", adaptive behavior, or nondeterminism —
a fixture that behaves cleverly is a broken fixture.

It ships in two forms with one implementation:

- **CLI** (`acp-fixture-agent`): a stdio ACP agent registered in a real client.
- **Library** (`createFixtureAgent()`): the same agent attached to injected
  streams, for in-process client test suites.

Every test scenario is exposed as an ACP **slash command**, so the catalog is
discoverable from any client's command UI, and scenario discovery itself
exercises `available_commands_update`.

## Core invariants — never break these

1. **Determinism.** No randomness, no wall-clock dependence in output. The same
   command always produces the same update sequence. IDs are session-scoped
   counters (`call_1`, `call_2`, …). Pacing comes only from the configured
   delay (CLI `--delay`, `0` in tests).
2. **stdout is protocol-only.** In CLI mode, stdout carries nothing but ACP
   ndJSON messages — one stray `console.log` corrupts the stream. All logging
   and diagnostics go to stderr (clients commonly capture stderr into their
   debug logs, so keep it meaningful and small).
3. **The scenario registry is the single source of truth.** Command
   advertisement, the `/help` response, and the "Exercised by" column of
   `COVERAGE.md` all derive from it; the coverage table rows live in
   `src/coverage.ts`. Never hand-edit generated output (`COVERAGE.md`
   carries a GENERATED header and CI fails when it is stale).
4. **Protocol types come from the SDK only.** No hand-rolled protocol types.
   Tracking ACP updates must stay a mechanical task: bump the SDK, fix type
   errors, re-run snapshots.
5. **The SDK is exact-pinned** (no `^`). Upgrading it is a deliberate,
   dedicated commit — never a side effect of other work.
6. **Real-world quirks are labeled scenarios.** Reproducing a misbehavior seen
   in the wild (e.g. a terminal content block whose terminal was never created)
   is valuable — but only as a scenario that says so in its name and
   description. Default behavior stays spec-conformant.
7. **`cli.ts` stays a thin shell** over `createFixtureAgent()` plus argument
   parsing and stdio wiring. No scenario or protocol logic in the CLI layer.
8. **Everything in this repository is English** — code, comments, docs, commit
   messages.

## Architecture

```
src/
├── cli.ts              # bin: arg dispatch + stdio wiring; no protocol/scenario logic
├── cli-args.ts         # pure CLI argument parsing (unit-testable)
├── index.ts            # library entry: createFixtureAgent, scenario types, builtinScenarios
├── agent.ts            # ACP handlers (initialize / session/new / prompt / cancel)
├── scenario.ts         # Scenario, ScenarioContext, PROTOCOL_FEATURES vocabulary
├── registry.ts         # catalog → commands list, /help text, command parsing
├── coverage.ts         # coverage table rows + COVERAGE.md renderer
├── test-harness.ts     # in-process capturing client (test-only, excluded from dist)
└── scenarios/          # scenario modules + echo responder, composed in scenarios/index.ts
scripts/
├── generate-coverage.ts # writes COVERAGE.md (npm run generate:coverage)
└── generate-catalog.ts  # planned (pre-publish): registry → README catalog table
```

Data flow: client sends `session/prompt` → first text block is parsed as
`/command args` → the matching scenario's `run(ctx, args)` emits a
deterministic sequence of `session/update` notifications (and, for permission
scenarios, `session/request_permission` requests) → the prompt resolves with a
stop reason. Non-command prompts get a fixed self-describing echo response.

## Protocol notes that bite

Distilled from the ACP spec (v1) and the official adapters. Follow these
unless a scenario deliberately and visibly violates one.

1. **Send `available_commands_update` only after the session-setup response**
   (`session/new` / `session/load` / `session/resume`) has been returned —
   schedule it with `setTimeout(..., 0)`. Many clients adopt the new session id
   only when the response arrives and filter updates by current session id, so
   an early notification can be silently dropped. The official
   `@agentclientprotocol/claude-agent-acp` adapter does exactly this. The
   deliberate early-send race belongs only in its dedicated timing scenario.
2. **Slash commands are plain text.** A command arrives as a prompt whose
   first content block is text starting with `/` (surrounding whitespace is
   trimmed before the leading-slash check, matching the official adapters);
   the name runs to the first whitespace and everything after it is the
   argument string. Hints are advertised via `input.hint`. The command list
   may be re-sent at any time (dynamic updates are part of the spec).
3. **Cancellation returns a stop reason, not an error.** On `session/cancel`,
   abort scenario work and resolve the in-flight `session/prompt` with
   `stopReason: "cancelled"`. Clients surface unexpected errors to users; the
   spec makes the `cancelled` stop reason a MUST.
4. **`tool_call_update` patches, arrays replace.** An omitted field means
   "unchanged"; a provided `content` array replaces the whole collection
   (never appends); an empty array clears it. Scenarios probing these
   semantics must state which branch they exercise.
5. **Emit the `tool_call` before requesting permission for it.** Strict
   clients break on a permission request referencing an unknown tool call; the
   official adapters always emit the call first. The orphan-permission
   scenario is the deliberate exception. When handling responses, support both
   the `selected` (with `optionId`) and `cancelled` outcomes, and select
   options by `kind` semantics — `optionId` strings are free-form.
6. **Empty turns look like failures to some clients.** Ending a turn with zero
   session updates trips empty-response detection in the wild. Only the
   dedicated silent scenario does this; every other scenario emits at least
   one update.
7. **Declare every prompt capability.** `initialize` advertises `image`,
   `audio`, and `embeddedContext` as `true` — the fixture exists to make
   rarely-supported content reachable, and clients gate what they send on
   these flags. (For context: neither official adapter advertises `audio`.)
8. **Target ACP v1.** ACP v2 is a draft redesign with a different turn model
   (`state_update`) and different diff/terminal shapes. Do not let v2
   assumptions leak into v1 scenario code; a future v2 runner will reuse the
   scenario catalog metadata, not the scenario bodies.

## Adding a scenario

1. Create or extend a module in `src/scenarios/`.
2. Define the scenario object: `name` (the slash command), `description`
   (shown in client command popups — one line), optional `hint`, `exercises`
   (protocol features covered), and a deterministic `run(ctx, args)`.
3. Register it in `src/registry.ts`.
4. Add an in-process test at delay `0` asserting the ordered update-type
   sequence plus targeted payload assertions. Do not snapshot full payloads:
   they churn on every copy tweak, while the type sequence still catches
   unintended update additions, losses, and reordering.
5. Update the matching row in `src/coverage.ts` (typically planned →
   covered) and run `npm run generate:coverage`. The coverage tests fail
   when the table, the vocabulary, and the catalog disagree.

## Development workflow

- **Gates before every commit**: `npm run lint`, `npm run typecheck`, and
  `npm test` must pass (`npm run build` too when `dist/` behavior is
  affected). `npm run format` applies Biome fixes.
- **Branches**: `main` holds releasable state; implementation work happens on
  `feat/*` (or `fix/*`, `docs/*`) branches.
- **Commits**: conventional commits; imperative subject; body of 0–3 lines
  when needed; one concern per commit; no attribution footers or tool
  signatures.
- **Toolchain**: Node >= 20, TypeScript (native tsc), `tsx` for dev runs,
  `vitest` for tests, Biome for formatting and linting (tabs, double quotes;
  config in `biome.json`). Note: this TypeScript major requires
  `"types": ["node"]` explicitly in `tsconfig.json`.

## References

- ACP specification: https://agentclientprotocol.com (protocol v1 pages are
  the normative target)
- SDK: [`@agentclientprotocol/sdk`](https://www.npmjs.com/package/@agentclientprotocol/sdk)
  — its published `dist/examples/agent.js` is a minimal agent skeleton and
  `dist/test-support/` shows the in-process test pattern this project's
  library form follows
- Official adapters worth reading for agent-side conventions:
  [`@agentclientprotocol/claude-agent-acp`](https://www.npmjs.com/package/@agentclientprotocol/claude-agent-acp),
  [`@agentclientprotocol/codex-acp`](https://www.npmjs.com/package/@agentclientprotocol/codex-acp)

---

**Maintenance**: when architecture, invariants, or workflow rules change,
update this file in the same commit or PR. Last updated: 2026-08-08.
