/**
 * The fixture agent core: ACP handlers wired around the scenario registry.
 *
 * `createFixtureAgent` returns a plain SDK `AgentApp`, so callers connect it
 * the SDK-native way: `.connect(ndJsonStream(...))` for stdio (the CLI), or
 * `client(...).connect(app)` for in-process use (tests, client test suites).
 */

import { createRequire } from "node:module";
import type { PromptRequest } from "@agentclientprotocol/sdk";
import {
	type AgentApp,
	type AgentContext,
	agent,
	methods,
	PROTOCOL_VERSION,
} from "@agentclientprotocol/sdk";
import { findScenario, parseCommand, toAvailableCommands } from "./registry.js";
import {
	type Scenario,
	type ScenarioContext,
	type ScenarioOutcome,
	TurnCancelledError,
} from "./scenario.js";
import { runEcho } from "./scenarios/echo.js";
import { builtinScenarios } from "./scenarios/index.js";

const require = createRequire(import.meta.url);
const { version: packageVersion } = require("../package.json") as {
	version: string;
};

export interface FixtureAgentOptions {
	/**
	 * Pacing delay in ms applied by `ScenarioContext.delay()`.
	 * Default 50 (visible streaming in real clients); use 0 in tests.
	 */
	delayMs?: number;
	/** Scenario catalog. Defaults to the built-in scenarios. */
	scenarios?: readonly Scenario[];
}

interface SessionState {
	/** Per-prefix id counters; persist across turns so ids never collide. */
	idCounters: Map<string, number>;
	/** The turn currently running, if any. A new prompt supersedes it. */
	activeTurn: AbortController | null;
}

/**
 * Create the fixture agent as an SDK `AgentApp`.
 *
 * State (session table, id counters) lives in this closure: create one app
 * per connection. Connecting one app twice shares the session namespace but
 * ids stay unique, so nothing breaks — it is just not the intended usage.
 */
export function createFixtureAgent(
	options: FixtureAgentOptions = {},
): AgentApp {
	const delayMs = options.delayMs ?? 50;
	const scenarios = options.scenarios ?? builtinScenarios;
	const sessions = new Map<string, SessionState>();
	let sessionCounter = 0;

	return agent({ name: "acp-fixture-agent" })
		.onRequest(methods.agent.initialize, () => ({
			protocolVersion: PROTOCOL_VERSION,
			agentCapabilities: {
				// Everything true: the fixture exists to make rarely-supported
				// content reachable, and clients gate what they send on these.
				promptCapabilities: { image: true, audio: true, embeddedContext: true },
			},
			agentInfo: {
				name: "acp-fixture-agent",
				title: "ACP Fixture Agent",
				version: packageVersion,
			},
			authMethods: [],
		}))
		.onRequest(methods.agent.session.new, (ctx) => {
			const sessionId = `sess_${++sessionCounter}`;
			sessions.set(sessionId, { idCounters: new Map(), activeTurn: null });
			// Advertise the catalog only after the session/new response has been
			// sent: many clients adopt the session id from the response and
			// filter updates by it, so an earlier notification can be dropped.
			setTimeout(() => {
				ctx.client
					.notify(methods.client.session.update, {
						sessionId,
						update: {
							sessionUpdate: "available_commands_update",
							availableCommands: toAvailableCommands(scenarios),
						},
					})
					.catch(() => {
						// The connection may already be gone; best-effort.
					});
			}, 0);
			return { sessionId };
		})
		.onRequest(methods.agent.session.prompt, async (ctx) => {
			const { sessionId } = ctx.params;
			const session = sessions.get(sessionId);
			if (!session) {
				throw new Error(`Session not found: ${sessionId}`);
			}
			// One turn per session: a new prompt supersedes the previous one.
			session.activeTurn?.abort();
			const turn = new AbortController();
			session.activeTurn = turn;
			const scenarioCtx = makeScenarioContext({
				client: ctx.client,
				sessionId,
				prompt: ctx.params.prompt,
				turn,
				delayMs,
				session,
			});
			const parsed = parseCommand(ctx.params.prompt);
			const scenario = parsed
				? findScenario(scenarios, parsed.name)
				: undefined;
			try {
				let outcome: ScenarioOutcome;
				if (scenario && parsed) {
					outcome = await scenario.run(scenarioCtx, parsed.args);
				} else {
					// Non-command and unknown-command input gets the echo reply.
					outcome = await runEcho(scenarioCtx);
				}
				return { stopReason: outcome.stopReason ?? "end_turn" };
			} catch (error) {
				if (error instanceof TurnCancelledError || turn.signal.aborted) {
					// The spec requires cancelled turns to resolve with the
					// "cancelled" stop reason, never an error response.
					return { stopReason: "cancelled" };
				}
				throw error;
			} finally {
				if (session.activeTurn === turn) {
					session.activeTurn = null;
				}
			}
		})
		.onNotification(methods.agent.session.cancel, (ctx) => {
			// Unknown sessions are silently ignored, like the official adapters.
			sessions.get(ctx.params.sessionId)?.activeTurn?.abort();
		});
}

function makeScenarioContext(args: {
	client: AgentContext;
	sessionId: string;
	prompt: PromptRequest["prompt"];
	turn: AbortController;
	delayMs: number;
	session: SessionState;
}): ScenarioContext {
	const { client, sessionId, prompt, turn, delayMs, session } = args;
	return {
		sessionId,
		signal: turn.signal,
		prompt,
		update: (update) =>
			client.notify(methods.client.session.update, { sessionId, update }),
		requestPermission: async (params) => {
			if (turn.signal.aborted) throw new TurnCancelledError();
			try {
				// cancellationSignal turns a turn abort into $/cancel_request,
				// so the client's pending permission UI is released too.
				return await client.request(
					methods.client.session.requestPermission,
					{ sessionId, ...params },
					{ cancellationSignal: turn.signal },
				);
			} catch (error) {
				if (turn.signal.aborted) throw new TurnCancelledError();
				throw error;
			}
		},
		delay: () =>
			new Promise<void>((resolve, reject) => {
				if (turn.signal.aborted) {
					reject(new TurnCancelledError());
					return;
				}
				if (delayMs === 0) {
					resolve();
					return;
				}
				const onAbort = () => {
					clearTimeout(timer);
					reject(new TurnCancelledError());
				};
				const timer = setTimeout(() => {
					turn.signal.removeEventListener("abort", onAbort);
					resolve();
				}, delayMs);
				turn.signal.addEventListener("abort", onAbort, { once: true });
			}),
		nextId: (prefix) => {
			const next = (session.idCounters.get(prefix) ?? 0) + 1;
			session.idCounters.set(prefix, next);
			return `${prefix}_${next}`;
		},
	};
}
