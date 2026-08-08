# acp-fixture-agent

A deterministic, scenario-driven fixture agent for the [Agent Client Protocol (ACP)](https://agentclientprotocol.com).

> **Status: early development.** Not yet published to npm. APIs and scenarios will change without notice until the first release.

## Why

If you build an ACP **client** (an editor, an IDE plugin, a chat UI), you test it against real agents — and real agents are terrible test partners. They are non-deterministic, they exercise only a fraction of the protocol surface, and some parts of ACP are nearly impossible to trigger on demand:

- Tool-call content types that mainstream agents never emit (`audio`, and until recently `image`, `resource`, `resource_link`)
- Update edge cases: omitted-vs-`null`-vs-empty field semantics, status-less `tool_call_update`s, tool calls that arrive already `completed`
- Permission requests in all four option kinds, queued permissions, cancellation outcomes
- Timing races such as `available_commands_update` arriving around the `session/new` response

`acp-fixture-agent` is the controllable counterpart: a real ACP agent process whose only job is to reproduce protocol situations **exactly, on demand, every time**.

## How it works

Every test scenario is exposed as an **ACP slash command**. Connect the fixture agent from your client, type `/`, and the full scenario catalog appears in your client's own command UI — discoverable, documented in place, and parameterizable:

```
/content-all          Emit a tool call carrying every standard content type
/permission allow_always   Request permission with a specific option kind
/usage 90             Report context-window usage at 90%
...
```

The catalog delivery itself exercises `available_commands_update`, so even scenario discovery is protocol-conformant.

## Planned surface

- **CLI**: `npx acp-fixture-agent` — a stdio ACP agent you can register in any client
- **Library**: `createFixtureAgent()` — run the same scenarios in-process against your client's test suite, no subprocess needed
- **Deterministic by construction**: no randomness; the same command always produces the same update sequence

## Protocol coverage

Built on the official [`@agentclientprotocol/sdk`](https://www.npmjs.com/package/@agentclientprotocol/sdk) (pinned exactly; currently `1.3.0`, speaking ACP v1). Each scenario declares which protocol features it exercises, and [`COVERAGE.md`](./COVERAGE.md) — generated from that metadata — shows what is covered, what is planned, and what is deliberately out of scope. The test suite enforces that the table and the shipped scenarios never drift apart.

## License

[Apache-2.0](./LICENSE)
