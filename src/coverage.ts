/**
 * The protocol coverage table: for every entry in PROTOCOL_FEATURES, whether
 * this fixture exercises it — and if not, whether that is planned or a
 * deliberate non-goal. COVERAGE.md is generated from this file, and
 * coverage.test.ts enforces that the table, the vocabulary, and the shipped
 * scenarios can never drift apart.
 */

import type { ProtocolFeature, Scenario } from "./scenario.js";

export type CoverageStatus = "covered" | "core" | "planned" | "out-of-scope";

export interface CoverageRow {
	id: ProtocolFeature;
	/** Table grouping (e.g. "Tool calls"). */
	area: string;
	/** Human-readable feature name. */
	feature: string;
	status: CoverageStatus;
	/** Required on every non-covered row: what is envisioned, or why not. */
	note?: string;
}

export const coverageTable: readonly CoverageRow[] = [
	// Messages
	{
		id: "message_chunks",
		area: "Messages",
		feature: "Agent message chunks",
		status: "covered",
	},
	{
		id: "thought_chunks",
		area: "Messages",
		feature: "Agent thought chunks",
		status: "planned",
		note: "Planned scenario: /thought.",
	},
	{
		id: "message_ids",
		area: "Messages",
		feature: "Message boundaries via messageId",
		status: "planned",
		note: "Planned scenario: /message-ids — consecutive same-type chunks split only by messageId.",
	},
	// Prompt input
	{
		id: "prompt_content",
		area: "Prompt input",
		feature:
			"Prompt content types (text, image, audio, resource, resource_link)",
		status: "core",
		note: "The echo responder describes every received block by type; all prompt capabilities are advertised as true.",
	},
	// Tool calls
	{
		id: "tool_calls",
		area: "Tool calls",
		feature: "Tool call lifecycle",
		status: "covered",
	},
	{
		id: "tool_call_content",
		area: "Tool calls",
		feature: "Content collections and patch semantics",
		status: "covered",
	},
	{
		id: "tool_call_status",
		area: "Tool calls",
		feature: "Status transitions, including omitted-status updates",
		status: "covered",
	},
	{
		id: "tool_call_locations",
		area: "Tool calls",
		feature: "Locations (follow-along)",
		status: "planned",
		note: "No scenario sends locations yet; surfaced while designing this table.",
	},
	{
		id: "terminal",
		area: "Tool calls",
		feature: "Terminal content (real terminals and virtual ids)",
		status: "planned",
		note: "Planned scenarios: /terminal (terminal/create round trip) and /terminal-virtual (a terminal id that was never created, as seen in the wild).",
	},
	// Permissions
	{
		id: "permissions",
		area: "Permissions",
		feature:
			"Permission requests (all kinds, queueing, orphan, cancelled outcome)",
		status: "covered",
	},
	// Commands
	{
		id: "commands",
		area: "Commands",
		feature: "Command advertisement, hints, and argument passing",
		status: "covered",
	},
	{
		id: "dynamic_commands",
		area: "Commands",
		feature: "Dynamic command updates mid-session",
		status: "planned",
		note: "The catalog is currently advertised once per session; the spec allows re-advertising at any time.",
	},
	// Turn
	{
		id: "cancellation",
		area: "Turn",
		feature: "Turn cancellation resolving with the cancelled stop reason",
		status: "core",
		note: "The agent core converts turn aborts for every scenario; a dedicated /cancel-me scenario is planned.",
	},
	{
		id: "request_cancellation",
		area: "Turn",
		feature: "$/cancel_request request cancellation",
		status: "planned",
		note: "The prompt handler's ctx.signal is not yet wired to the turn; surfaced while designing this table.",
	},
	{
		id: "stop_reasons",
		area: "Turn",
		feature: "Stop reasons beyond end_turn (refusal, max_tokens, …)",
		status: "planned",
		note: "Planned scenario: /stop-reason.",
	},
	{
		id: "empty_turn",
		area: "Turn",
		feature: "Turns that end without any update",
		status: "planned",
		note: "Planned scenario: /silent — some clients treat empty turns as failures.",
	},
	{
		id: "timing",
		area: "Turn",
		feature: "Update-timing races",
		status: "planned",
		note: "Planned scenarios: /commands-race (advertisement before the session/new response) and /trailing (updates after the prompt resolves).",
	},
	// Session updates
	{
		id: "plan",
		area: "Session updates",
		feature: "Plan updates",
		status: "planned",
		note: "Planned scenario: /plan.",
	},
	{
		id: "usage",
		area: "Session updates",
		feature: "Context usage updates (usage_update with cost)",
		status: "planned",
		note: "Planned scenario: /usage.",
	},
	{
		id: "session_info",
		area: "Session updates",
		feature: "Session title updates (session_info_update)",
		status: "planned",
		note: "Planned scenario: /rename.",
	},
	{
		id: "config_options",
		area: "Session updates",
		feature:
			"Session config options (initial state, round trip, agent-initiated updates)",
		status: "planned",
		note: "Planned scenario: /config.",
	},
	// Session lifecycle
	{
		id: "session_management",
		area: "Session lifecycle",
		feature: "Session load, resume, list, and fork",
		status: "planned",
		note: "Planned, but distant: history-replay verification is where real clients struggle most, yet it requires the fixture to hold session state.",
	},
	{
		id: "modes",
		area: "Session lifecycle",
		feature: "Legacy session modes API",
		status: "out-of-scope",
		note: "Superseded by session config options in the spec; revisit only if a client asks.",
	},
	// Client-side surfaces
	{
		id: "fs",
		area: "Client-side surfaces",
		feature: "Client fs methods",
		status: "out-of-scope",
		note: "The fixture never requests client file-system access.",
	},
	{
		id: "auth",
		area: "Client-side surfaces",
		feature: "Authentication flows",
		status: "out-of-scope",
		note: "authMethods is deliberately empty; the fixture needs no login.",
	},
	{
		id: "elicitation",
		area: "Client-side surfaces",
		feature: "Elicitation (form and URL modes)",
		status: "planned",
		note: "Distant: requires the client to advertise the elicitation capability.",
	},
	{
		id: "mcp",
		area: "Client-side surfaces",
		feature: "MCP server connections",
		status: "out-of-scope",
		note: "mcpServers is accepted and ignored; a deterministic fixture needs no MCP.",
	},
];

const STATUS_LABELS: Record<CoverageStatus, string> = {
	covered: "✅ Covered",
	core: "⚙️ Core",
	planned: "📋 Planned",
	"out-of-scope": "🚫 Out of scope",
};

/** Render COVERAGE.md from the table and the shipped scenario catalog. */
export function renderCoverageMarkdown(scenarios: readonly Scenario[]): string {
	const exercisedBy = new Map<ProtocolFeature, string[]>();
	for (const scenario of scenarios) {
		for (const feature of scenario.exercises) {
			const list = exercisedBy.get(feature) ?? [];
			list.push(`\`/${scenario.name}\``);
			exercisedBy.set(feature, list);
		}
	}

	const areas: string[] = [];
	for (const row of coverageTable) {
		if (!areas.includes(row.area)) areas.push(row.area);
	}

	const lines: string[] = [
		"<!-- GENERATED FILE — do not edit. Update src/coverage.ts and run `npm run generate:coverage`. -->",
		"",
		"# Protocol coverage",
		"",
		"What this fixture can exercise of the Agent Client Protocol (v1), what",
		"is planned, and what is deliberately out of scope. Generated from",
		"[`src/coverage.ts`](./src/coverage.ts); the test suite enforces that this",
		"table, the feature vocabulary, and the shipped scenarios stay consistent.",
		"",
	];
	for (const area of areas) {
		lines.push(
			`## ${area}`,
			"",
			"| Feature | Status | Exercised by | Notes |",
			"| --- | --- | --- | --- |",
		);
		for (const row of coverageTable.filter((r) => r.area === area)) {
			const scenariosCell = exercisedBy.get(row.id)?.join(", ") ?? "—";
			lines.push(
				`| ${row.feature} | ${STATUS_LABELS[row.status]} | ${scenariosCell} | ${row.note ?? "—"} |`,
			);
		}
		lines.push("");
	}
	return lines.join("\n");
}
