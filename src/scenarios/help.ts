/**
 * `/help` — lists the whole scenario catalog as a message.
 */

import { helpText } from "../registry.js";
import type { Scenario } from "../scenario.js";

/**
 * Build the help scenario. The catalog is passed as a getter because help
 * itself is part of it: the list is only complete at run time, and a getter
 * avoids a circular module import.
 */
export function createHelpScenario(
	getCatalog: () => readonly Scenario[],
): Scenario {
	return {
		name: "help",
		description: "List every scenario in this fixture agent",
		exercises: ["message_chunks", "commands"],
		run: async (ctx) => {
			await ctx.update({
				sessionUpdate: "agent_message_chunk",
				content: { type: "text", text: helpText(getCatalog()) },
			});
			return {};
		},
	};
}
