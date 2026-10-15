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

export interface SuiteRunSummary {
    suiteName: string;
    passed: number;
    failed: number;
    durationMs: number;
}

export interface TestResult {
    passed: number;
    failed: number;
    durationMs: number;
    suites: SuiteRunSummary[];
    errors: { testName: string; error: unknown }[];
}

const testSuites: Map<string, TestSuite> = new Map();

export function registerSuite(name: string): TestSuite {
    if (testSuites.has(name)) {
        return testSuites.get(name)!;
    }
    const suite: TestSuite = { name, tests: [] };
    testSuites.set(name, suite);
    return suite;
}

export function getRegisteredSuiteNames(): string[] {
    return Array.from(testSuites.keys());
}

export function addTest(suiteName: string, testName: string, fn: TestFunction) {
    const suite = registerSuite(suiteName);
    if (!suite.tests.some((t) => t.name === testName)) {
        suite.tests.push({ name: testName, fn });
    }
}

export async function runSuite(suite: TestSuite): Promise<TestResult> {
    const startMs = Date.now();
    infoLog(`[TestRunner] Starting suite: '${suite.name}' (${suite.tests.length} tests)`);
    const result: TestResult = { passed: 0, failed: 0, durationMs: 0, suites: [], errors: [] };

    for (const test of suite.tests) {
        debugLog(`[TestRunner] Running test: ${suite.name} > ${test.name}`);
        try {
            await test.fn();
            result.passed++;
            debugLog(`[TestRunner] PASS: ${test.name}`);
        } catch (e: unknown) {
            result.failed++;
            result.errors.push({ testName: `${suite.name} > ${test.name}`, error: e });
            errorLog(`[TestRunner] FAIL: ${suite.name} > ${test.name}`, e);
        }
    }

    result.durationMs = Date.now() - startMs;
    result.suites.push({
        suiteName: suite.name,
        passed: result.passed,
        failed: result.failed,
        durationMs: result.durationMs
    });
    return result;
}

export async function runTests(context?: string): Promise<TestResult> {
    const overallStart = Date.now();
    const combinedResult: TestResult = { passed: 0, failed: 0, durationMs: 0, suites: [], errors: [] };

    let suitesToRun: TestSuite[] = [];

    if (context && context !== 'all') {
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
        warnLog('[TestRunner] No test suites registered to run.');
        return combinedResult;
    }

    for (const suite of suitesToRun) {
        const result = await runSuite(suite);
        combinedResult.passed += result.passed;
        combinedResult.failed += result.failed;
        combinedResult.suites.push(...result.suites);
        combinedResult.errors.push(...result.errors);
    }

    combinedResult.durationMs = Date.now() - overallStart;

    const total = combinedResult.passed + combinedResult.failed;
    const summaryHeader = '\n========== TEST RUN SUMMARY ==========';
    const summaryBody = `Total: ${total} | Passed: ${combinedResult.passed} | Failed: ${combinedResult.failed} | Time: ${combinedResult.durationMs}ms`;

    if (combinedResult.failed > 0) {
        errorLog(summaryHeader);
        errorLog(summaryBody);
        errorLog('Failures:');
        for (const err of combinedResult.errors) {
            const errStr = err.error instanceof Error ? err.error.message : String(err.error);
            errorLog(` - [${err.testName}]: ${errStr}`);
        }
        errorLog('======================================\n');
    } else {
        infoLog(summaryHeader);
        infoLog(summaryBody);
        infoLog('All tests passed successfully!');
        infoLog('======================================\n');
    }

    return combinedResult;
}

export const assert = {
    ok(value: unknown, message?: string) {
        if (!value) {
            throw new Error(message || `Expected truthy, got ${String(value)}`);
        }
    },
    equal<T>(actual: T, expected: T, message?: string) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${String(expected)}, got ${String(actual)}`);
        }
    },
    deepEqual(actual: unknown, expected: unknown, message?: string) {
        const aJson = JSON.stringify(actual);
        const eJson = JSON.stringify(expected);
        if (aJson !== eJson) {
            throw new Error(message || `Expected ${eJson}, got ${aJson}`);
        }
    },
    notEqual<T>(actual: T, expected: T, message?: string) {
        if (actual === expected) {
            throw new Error(message || `Expected not equal to ${String(expected)}`);
        }
    },
    throws(fn: () => void, message?: string) {
        let threw = false;
        try {
            fn();
        } catch {
            threw = true;
        }
        if (!threw) {
            throw new Error(message || 'Expected function to throw');
        }
    },
    async throwsAsync(fn: () => Promise<void>, message?: string) {
        let threw = false;
        try {
            await fn();
        } catch {
            threw = true;
        }
        if (!threw) {
            throw new Error(message || 'Expected async function to throw');
        }
    }
};
