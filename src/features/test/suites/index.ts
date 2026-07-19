import { registerCoreTests } from './coreTests.js';
import { registerEconomyTests } from './economyTests.js';
import { registerEconomyTransferTests } from './economyTransferTests.js';
import { registerMcApiTests } from './mcApiTests.js';
import { registerUiIconTests } from './uiIconTests.js';

export function registerAllSuites() {
    registerCoreTests();
    registerEconomyTests();
    registerMcApiTests();
    registerUiIconTests();
    registerEconomyTransferTests();
}
