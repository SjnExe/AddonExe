import { registerCoreTests } from './coreTests.js';
import { registerMcApiTests } from './mcApiTests.js';

export function registerAllSuites(): void {
  registerMcApiTests();
  registerCoreTests();
}
