/**
 * Built-in scenario catalog composition — the single place scenarios are
 * assembled. Command advertisement, `/help`, and the README catalog all
 * derive from this list.
 */

import type { Scenario } from "../scenario.js";
import { createHelpScenario } from "./help.js";

const catalog: Scenario[] = [];
catalog.push(createHelpScenario(() => catalog));

export const builtinScenarios: readonly Scenario[] = catalog;
