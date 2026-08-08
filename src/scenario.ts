/**
 * The scenario contract: the shape every test scenario implements, and the
 * context the agent core hands to a running scenario.
 *
 * Scenarios are data plus one deterministic `run` function. The registry
 * derives everything else from them (command advertisement, /help output,
 * the README catalog), so this file is the single point where the shape of
 * a scenario is defined.
 */

import type {
	PromptRequest,
	RequestPermissionRequest,
	RequestPermissionResponse,
	SessionUpdate,
	StopReason,
} from "@agentclientprotocol/sdk";

/**
 * The protocol feature vocabulary. Scenarios tag what they exercise with
 * these ids, and the coverage table (src/coverage.ts) must carry exactly
 * one row per entry — the runtime array exists so tests can enforce that.
 * Gaps become visible in COVERAGE.md when ACP grows new surface.
 */
export const PROTOCOL_FEATURES = [
	// messages
	"message_chunks",
	"thought_chunks",
	"message_ids",
	// prompt input
	"prompt_content",
	// tool calls
	"tool_calls",
	"tool_call_content",
	"tool_call_status",
	"tool_call_locations",
	"terminal",
	// permissions
	"permissions",
	// commands
	"commands",
	"dynamic_commands",
	// turn
	"cancellation",
	"request_cancellation",
	"stop_reasons",
	"empty_turn",
	"timing",
	// session updates
	"plan",
	"usage",
	"session_info",
	"config_options",
	// session lifecycle
	"session_management",
	"modes",
	// client-side surfaces
	"fs",
	"auth",
	"elicitation",
	"mcp",
] as const;

/** One entry of {@link PROTOCOL_FEATURES}. */
export type ProtocolFeature = (typeof PROTOCOL_FEATURES)[number];

/**
 * Thrown by `ScenarioContext` operations when the turn is cancelled
 * (`session/cancel`). The agent core catches it and resolves the prompt
 * with `stopReason: "cancelled"`, as the spec requires — scenarios only
 * need to let it propagate.
 */
export class TurnCancelledError extends Error {
	constructor() {
		super("Turn cancelled by the client");
		this.name = "TurnCancelledError";
	}
}

/**
 * Capabilities the agent core exposes to a running scenario. All output
 * flows through this context so pacing, ids, and cancellation stay
 * deterministic and centrally controlled.
 */
export interface ScenarioContext {
	/** The session this turn belongs to. */
	readonly sessionId: string;
	/**
	 * Aborts when the client cancels the turn. Long-running scenarios that
	 * loop without calling `delay()` should check this.
	 */
	readonly signal: AbortSignal;
	/**
	 * The full content of the prompt that invoked the scenario, for
	 * scenarios that inspect more than the command text (e.g. attachments).
	 */
	readonly prompt: PromptRequest["prompt"];
	/** Send one `session/update` notification for this session. */
	update(update: SessionUpdate): Promise<void>;
	/**
	 * Send a `session/request_permission` and await the client's decision.
	 * Rejects with {@link TurnCancelledError} when the turn is cancelled.
	 */
	requestPermission(
		params: Omit<RequestPermissionRequest, "sessionId">,
	): Promise<RequestPermissionResponse>;
	/**
	 * Pause for the configured pacing delay (0 in tests). Rejects with
	 * {@link TurnCancelledError} when the turn is cancelled — the intended
	 * cancellation point for streaming scenarios.
	 */
	delay(): Promise<void>;
	/**
	 * Next deterministic id for the given prefix, scoped to the session:
	 * `nextId("call")` yields `call_1`, `call_2`, … Never random.
	 */
	nextId(prefix: string): string;
}

/**
 * What a scenario run ends with. An omitted `stopReason` means a normal
 * `end_turn`, so `return {};` is the standard way to finish a scenario.
 */
export interface ScenarioOutcome {
	stopReason?: StopReason;
}

/**
 * One test scenario, exposed to clients as the slash command `/<name>`.
 */
export interface Scenario {
	/** Slash command name (without the leading `/`). */
	readonly name: string;
	/** One-line description shown in client command popups. */
	readonly description: string;
	/** Input hint for parameterized scenarios (ACP `input.hint`). */
	readonly hint?: string;
	/** Protocol features this scenario exercises. */
	readonly exercises: readonly ProtocolFeature[];
	/**
	 * Deterministic scenario body: same `args`, same update sequence.
	 * `args` is everything after the command name, trimmed ("" when absent).
	 * Every code path must return an outcome; `return {};` ends the turn
	 * normally.
	 */
	run(ctx: ScenarioContext, args: string): Promise<ScenarioOutcome>;
}
