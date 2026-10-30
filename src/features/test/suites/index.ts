import { registerCoreTests } from './coreTests.js';
import { registerEconomyTests } from './economyTests.js';
import { registerMcApiTests } from './mcApiTests.js';

export function registerAllSuites() {
    registerCoreTests();
    registerEconomyTests();
    registerMcApiTests();
}
