import { debugLog, errorLog, infoLog, warnLog } from '@core/logger.js';

export type TestFunction = () => void | Promise<void>;

export interface TestCase {
    name: string;
    fn: TestFunction;
}

export interface TestSuite {
    name: string;
    tests: TestCase[];
}

const testSuites: Map<string, TestSuite> = new Map();

/**
 * Register a new test suite with a specific context name.
 */
export function registerSuite(name: string): TestSuite {
    if (testSuites.has(name)) {
        return testSuites.get(name)!;
    }
    const suite: TestSuite = { name, tests: [] };
    testSuites.set(name, suite);
    return suite;
}

/**
 * Add a test to a suite.
 */
export function addTest(suiteName: string, testName: string, fn: TestFunction) {
    const suite = registerSuite(suiteName);
    suite.tests.push({ name: testName, fn });
}

export interface TestResult {
    passed: number;
    failed: number;
    errors: { testName: string; error: unknown }[];
}

/**
 * Runs a specific suite and returns the result.
 */
export async function runSuite(suite: TestSuite): Promise<TestResult> {
    infoLog(`[TestRunner] Starting suite: '${suite.name}' (${suite.tests.length} tests)`);
    const result: TestResult = { passed: 0, failed: 0, errors: [] };

    for (const test of suite.tests) {
        debugLog(`[TestRunner] Running test: ${suite.name} > ${test.name}`);
        try {
            await test.fn();
            result.passed++;
            debugLog(`[TestRunner] PASS: ${test.name}`);
        } catch (e: unknown) {
            result.failed++;
            result.errors.push({ testName: `${suite.name} > ${test.name}`, error: e });
            errorLog(`[TestRunner] FAIL: ${test.name}`, e);
        }
    }

    return result;
}

/**
 * Runs one or all suites. Returns a combined TestResult.
 */
export async function runTests(context?: string): Promise<TestResult> {
    const combinedResult: TestResult = { passed: 0, failed: 0, errors: [] };

    let suitesToRun: TestSuite[] = [];

    if (context) {
        const suite = testSuites.get(context);
        if (!suite) {
            warnLog(`[TestRunner] Test suite '${context}' not found.`);
            return combinedResult;
        }
        suitesToRun.push(suite);
    } else {
        suitesToRun = Array.from(testSuites.values());
    }

    if (suitesToRun.length === 0) {
        warnLog(`[TestRunner] No test suites registered to run.`);
        return combinedResult;
    }

    for (const suite of suitesToRun) {
        const result = await runSuite(suite);
        combinedResult.passed += result.passed;
        combinedResult.failed += result.failed;
        combinedResult.errors.push(...result.errors);
    }

    // Summary
    const total = combinedResult.passed + combinedResult.failed;
    const summaryHeader = `\n========== TEST RUN SUMMARY ==========`;
    const summaryBody = `Total: ${total} | Passed: ${combinedResult.passed} | Failed: ${combinedResult.failed}`;

    if (combinedResult.failed > 0) {
        errorLog(summaryHeader);
        errorLog(summaryBody);
        errorLog(`Failures:`);
        for (const err of combinedResult.errors) {
            const errStr = err.error instanceof Error ? err.error.message : String(err.error);
            errorLog(` - [${err.testName}]: ${errStr}`);
        }
        errorLog(`======================================\n`);
    } else {
        infoLog(summaryHeader);
        infoLog(summaryBody);
        infoLog(`All tests passed successfully!`);
        infoLog(`======================================\n`);
    }

    return combinedResult;
}

/**
 * Assertion utility functions
 */
export const assert = {
    ok(value: unknown, message?: string) {
        if (!value) throw new Error(message || `Expected truthy, got ${String(value)}`);
    },
    equal<T>(actual: T, expected: T, message?: string) {
        if (actual !== expected) throw new Error(message || `Expected ${String(expected)}, got ${String(actual)}`);
    },
    notEqual<T>(actual: T, expected: T, message?: string) {
        if (actual === expected) throw new Error(message || `Expected not equal to ${String(expected)}`);
    },
    throws(fn: () => void, message?: string) {
        let threw = false;
        try {
            fn();
        } catch {
            threw = true;
        }
        if (!threw) throw new Error(message || `Expected function to throw`);
    },
    async throwsAsync(fn: () => Promise<void>, message?: string) {
        let threw = false;
        try {
            await fn();
        } catch {
            threw = true;
        }
        if (!threw) throw new Error(message || `Expected async function to throw`);
    }
};
