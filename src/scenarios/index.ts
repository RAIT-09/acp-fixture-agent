/**
 * Built-in scenario catalog composition — the single place scenarios are
 * assembled. Command advertisement, `/help`, and the README catalog all
 * derive from this list.
 */

import type { Scenario } from "../scenario.js";
import { contentScenarios } from "./content.js";
import { createHelpScenario } from "./help.js";

const catalog: Scenario[] = [];
catalog.push(createHelpScenario(() => catalog));
catalog.push(...contentScenarios);

export const builtinScenarios: readonly Scenario[] = catalog;
