import { CommandExecutor, CustomCommand, commandManager } from '@commands/commandManager.js';
import { errorLog } from '@core/logger.js';
import { sendMessage } from '@core/messaging.js';
import { registerAllSuites } from '../suites/index.js';
import { getRegisteredSuiteNames, runTests } from '../testRunner.js';

registerAllSuites();

const testCommand: CustomCommand = {
    name: 'test',
    description: 'Runs in-game runtime diagnostic test suites.',
    category: 'Administration',
    permissionNode: 'cmd.test.admin',
    allowConsole: true,
    parameters: [
        {
            name: 'context',
            type: 'string',
            optional: true,
            enumOptions: () => ['all', ...getRegisteredSuiteNames()]
        }
    ],
    execute: async (executor: CommandExecutor, args: Record<string, unknown>) => {
        const contextArg = args['context'];
        const context = typeof contextArg === 'string' ? contextArg.toLowerCase() : undefined;

        sendMessage(`§e[TestRunner] Running ${context && context !== 'all' ? `suite '${context}'` : 'all runtime diagnostic suites'}...`, executor);

        try {
            const results = await runTests(context);
            const suiteLines = results.suites.map((s) => `§7- §f${s.suiteName}: ${s.failed === 0 ? `§a${s.passed} passed` : `§a${s.passed} passed, §c${s.failed} failed`} §8(${s.durationMs}ms)`);

            if (results.failed > 0) {
                const errorPreview = results.errors
                    .slice(0, 5)
                    .map((e) => `§c  * [${e.testName}]: §f${e.error instanceof Error ? e.error.message : String(e.error)}`)
                    .join('\n');
                sendMessage(
                    `§c[TestRunner] Completed in ${results.durationMs}ms: ${results.passed} passed, ${results.failed} failed!\n${suiteLines.join('\n')}\n§4Failures:\n${errorPreview}`,
                    executor
                );
            } else {
                sendMessage(`§a[TestRunner] All ${results.passed} runtime tests passed in ${results.durationMs}ms!\n${suiteLines.join('\n')}`, executor);
            }
        } catch (error) {
            sendMessage('§c[TestRunner] An unexpected error occurred while running tests. See console.', executor);
            errorLog('[TestRunner] Unexpected error: ', error);
        }
    }
};

commandManager.register(testCommand);
export default testCommand;
