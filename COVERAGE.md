<!-- GENERATED FILE — do not edit. Update src/coverage.ts and run `npm run generate:coverage`. -->

# Protocol coverage

What this fixture can exercise of the Agent Client Protocol (v1), what
is planned, and what is deliberately out of scope. Generated from
[`src/coverage.ts`](./src/coverage.ts); the test suite enforces that this
table, the feature vocabulary, and the shipped scenarios stay consistent.

## Messages

| Feature | Status | Exercised by | Notes |
| --- | --- | --- | --- |
| Agent message chunks | ✅ Covered | `/help` | — |
| Agent thought chunks | 📋 Planned | — | Planned scenario: /thought. |
| Message boundaries via messageId | 📋 Planned | — | Planned scenario: /message-ids — consecutive same-type chunks split only by messageId. |

## Prompt input

| Feature | Status | Exercised by | Notes |
| --- | --- | --- | --- |
| Prompt content types (text, image, audio, resource, resource_link) | ⚙️ Core | — | The echo responder describes every received block by type; all prompt capabilities are advertised as true. |

## Tool calls

| Feature | Status | Exercised by | Notes |
| --- | --- | --- | --- |
| Tool call lifecycle | ✅ Covered | `/content-all`, `/content-clear`, `/content-resend`, `/status-less`, `/completed-at-birth`, `/permission`, `/permission-queue` | — |
| Content collections and patch semantics | ✅ Covered | `/content-all`, `/content-clear`, `/content-resend`, `/status-less` | — |
| Status transitions, including omitted-status updates | ✅ Covered | `/content-all`, `/status-less`, `/completed-at-birth` | — |
| Locations (follow-along) | 📋 Planned | — | No scenario sends locations yet; surfaced while designing this table. |
| Terminal content (real terminals and virtual ids) | 📋 Planned | — | Planned scenarios: /terminal (terminal/create round trip) and /terminal-virtual (a terminal id that was never created, as seen in the wild). |

## Permissions

| Feature | Status | Exercised by | Notes |
| --- | --- | --- | --- |
| Permission requests (all kinds, queueing, orphan, cancelled outcome) | ✅ Covered | `/permission`, `/permission-queue`, `/permission-orphan` | — |

## Commands

| Feature | Status | Exercised by | Notes |
| --- | --- | --- | --- |
| Command advertisement, hints, and argument passing | ✅ Covered | `/help` | — |
| Dynamic command updates mid-session | 📋 Planned | — | The catalog is currently advertised once per session; the spec allows re-advertising at any time. |

## Turn

| Feature | Status | Exercised by | Notes |
| --- | --- | --- | --- |
| Turn cancellation resolving with the cancelled stop reason | ⚙️ Core | — | The agent core converts turn aborts for every scenario; a dedicated /cancel-me scenario is planned. |
| $/cancel_request request cancellation | 📋 Planned | — | The prompt handler's ctx.signal is not yet wired to the turn; surfaced while designing this table. |
| Stop reasons beyond end_turn (refusal, max_tokens, …) | 📋 Planned | — | Planned scenario: /stop-reason. |
| Turns that end without any update | 📋 Planned | — | Planned scenario: /silent — some clients treat empty turns as failures. |
| Update-timing races | 📋 Planned | — | Planned scenarios: /commands-race (advertisement before the session/new response) and /trailing (updates after the prompt resolves). |

## Session updates

| Feature | Status | Exercised by | Notes |
| --- | --- | --- | --- |
| Plan updates | 📋 Planned | — | Planned scenario: /plan. |
| Context usage updates (usage_update with cost) | 📋 Planned | — | Planned scenario: /usage. |
| Session title updates (session_info_update) | 📋 Planned | — | Planned scenario: /rename. |
| Session config options (initial state, round trip, agent-initiated updates) | 📋 Planned | — | Planned scenario: /config. |

## Session lifecycle

| Feature | Status | Exercised by | Notes |
| --- | --- | --- | --- |
| Session load, resume, list, and fork | 📋 Planned | — | Planned, but distant: history-replay verification is where real clients struggle most, yet it requires the fixture to hold session state. |
| Legacy session modes API | 🚫 Out of scope | — | Superseded by session config options in the spec; revisit only if a client asks. |

## Client-side surfaces

| Feature | Status | Exercised by | Notes |
| --- | --- | --- | --- |
| Client fs methods | 🚫 Out of scope | — | The fixture never requests client file-system access. |
| Authentication flows | 🚫 Out of scope | — | authMethods is deliberately empty; the fixture needs no login. |
| Elicitation (form and URL modes) | 📋 Planned | — | Distant: requires the client to advertise the elicitation capability. |
| MCP server connections | 🚫 Out of scope | — | mcpServers is accepted and ignored; a deterministic fixture needs no MCP. |
