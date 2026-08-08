/**
 * acp-fixture-agent — deterministic, scenario-driven ACP agent for testing
 * Agent Client Protocol clients.
 */

export { createFixtureAgent, type FixtureAgentOptions } from "./agent.js";
export type {
	ProtocolFeature,
	Scenario,
	ScenarioContext,
	ScenarioOutcome,
} from "./scenario.js";
export { TurnCancelledError } from "./scenario.js";
